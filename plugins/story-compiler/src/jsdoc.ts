/** Converts explicit JavaScript JSDoc to JSON Schema without inferring function bodies. */
import ts from 'typescript'
import { digest } from './runtime.ts'
import type { FunctionDeclaration, FunctionSource, Schema } from './types.ts'

export function describeFunction(source: FunctionSource, files: Record<string, string>): FunctionDeclaration {
  const matches: { file: ts.SourceFile; factory: ts.FunctionLikeDeclaration; fn: ts.FunctionExpression | ts.FunctionDeclaration }[] = []
  for (const [path, text] of Object.entries(files)) {
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.ES2024, true, ts.ScriptKind.JS)
    const visit = (node: ts.Node) => {
      if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && node.getText(file) === source.factory) {
        const inner = (child: ts.Node) => {
          if ((ts.isFunctionDeclaration(child) || ts.isFunctionExpression(child)) && child.getText(file) === source.implementation) matches.push({ file, factory: node, fn: child })
          ts.forEachChild(child, inner)
        }
        if (node.body) ts.forEachChild(node.body, inner)
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
  }
  if (matches.length !== 1) throw Object.assign(new Error('factory and returned named function must have one identifiable source declaration'), { field: 'functions.' + source.name })
  const { file, fn } = matches[0]!
  const locationOf = (node: ts.Node) => { const position = file.getLineAndCharacterOfPosition(node.getStart(file)); return { path: file.fileName, line: position.line + 1, column: position.character + 1 } }
  const location = locationOf(fn)
  const fail = (message: string, node: ts.Node = fn): never => { throw Object.assign(new Error(message), { diagnostic: { code: 'invalid-jsdoc', stage: 'declaration', message, location: locationOf(node) } }) }
  if (!fn.name || fn.name.text !== source.name || fn.asteriskToken || fn.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) fail('tool must be a synchronous named ordinary function')
  if (source.name === 'run_code') fail('tool name run_code is reserved by the host')
  const docs = ts.getJSDocCommentsAndTags(fn).filter(ts.isJSDoc)
  if (docs.length !== 1) fail('tool function requires one JSDoc comment')
  const text = (comment: string | ts.NodeArray<ts.JSDocComment> | undefined) => ts.getTextOfJSDocComment(comment)?.trim() ?? ''
  const description = text(docs[0]!.comment)
  if (!description) fail('tool function requires a JSDoc description')
  const aliases = new Map<string, ts.JSDocTypedefTag>()
  const collect = (node: ts.Node) => {
    // The parsed JSDoc array retains consecutive declarations; getJSDocTags selects only the last block.
    const comments = (node as ts.Node & { readonly jsDoc?: readonly ts.JSDoc[] }).jsDoc ?? []
    for (const comment of comments) for (const tag of comment.tags ?? []) if (ts.isJSDocTypedefTag(tag)) {
      const name = tag.fullName?.getText(file) ?? tag.name?.text
      if (!name) fail('typedef requires a name')
      if (aliases.has(name!) && aliases.get(name!) !== tag) fail('ambiguous typedef ' + name, tag)
      aliases.set(name!, tag)
    }
    ts.forEachChild(node, collect)
  }
  collect(file)
  const active = new Set<string>()
  const objectType = (members: readonly ts.TypeElement[]): Schema => {
    const properties: Record<string, Schema> = Object.create(null), required: string[] = []
    let additional: Schema | undefined
    for (const member of members) {
      if (ts.isIndexSignatureDeclaration(member)) {
        if (additional || member.parameters.length !== 1 || member.parameters[0]!.type?.kind !== ts.SyntaxKind.StringKeyword || !member.type) fail('dictionary requires one string index signature and an explicit JSON value type', member)
        additional = convert(member.type!); continue
      }
      if (!ts.isPropertySignature(member) || !member.type || !member.name || !(ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) fail('object members require named properties or a string index signature with explicit JSON types', member)
      const prop = member as ts.PropertySignature, name = (prop.name as ts.Identifier | ts.StringLiteral).text
      if (Object.hasOwn(properties, name)) fail('duplicate object property ' + name)
      properties[name] = convert(prop.type!)
      if (!prop.questionToken && !ts.isJSDocOptionalType(prop.type!)) required.push(name)
    }
    return { type: 'object', properties, required, additionalProperties: additional ?? false }
  }
  const convert = (node: ts.TypeNode | ts.JSDocTypeLiteral): Schema => {
    if (ts.isParenthesizedTypeNode(node) || ts.isJSDocOptionalType(node) || ts.isJSDocNonNullableType(node)) return convert(node.type)
    if (ts.isJSDocNullableType(node)) return { anyOf: [convert(node.type), { type: 'null' }] }
    switch (node.kind) {
      case ts.SyntaxKind.StringKeyword: return { type: 'string' }
      case ts.SyntaxKind.NumberKeyword: return { type: 'number' }
      case ts.SyntaxKind.BooleanKeyword: return { type: 'boolean' }
      case ts.SyntaxKind.ObjectKeyword: return fail('object requires declared fields or a typed string-key dictionary', node)
    }
    if (ts.isLiteralTypeNode(node)) {
      const literal = node.literal
      if (literal.kind === ts.SyntaxKind.NullKeyword) return { type: 'null' }
      if (literal.kind === ts.SyntaxKind.TrueKeyword) return { type: 'boolean', const: true }
      if (literal.kind === ts.SyntaxKind.FalseKeyword) return { type: 'boolean', const: false }
      if (ts.isStringLiteral(literal)) return { type: 'string', const: literal.text }
      if (ts.isNumericLiteral(literal)) return { type: 'number', const: Number(literal.text) }
      if (ts.isPrefixUnaryExpression(literal) && literal.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(literal.operand)) return { type: 'number', const: -Number(literal.operand.text) }
    }
    if (ts.isArrayTypeNode(node)) return { type: 'array', items: convert(node.elementType) }
    if (ts.isUnionTypeNode(node)) return { anyOf: node.types.map(convert) }
    if (ts.isTypeLiteralNode(node)) return objectType(node.members)
    if (ts.isJSDocTypeLiteral(node)) {
      const properties: Record<string, Schema> = Object.create(null), required: string[] = []
      for (const property of node.jsDocPropertyTags ?? []) {
        if (!ts.isIdentifier(property.name) || !property.typeExpression) fail('typedef properties require explicit types and simple names')
        const name = property.name.getText(file)
        if (Object.hasOwn(properties, name)) fail('duplicate typedef property ' + name)
        properties[name] = { ...convert(property.typeExpression!.type), ...(text(property.comment) ? { description: text(property.comment) } : {}) }
        if (!property.isBracketed && !ts.isJSDocOptionalType(property.typeExpression!.type)) required.push(name)
      }
      return { type: 'object', properties, required, additionalProperties: false }
    }
    if (ts.isTypeReferenceNode(node)) {
      const name = node.typeName.getText(file)
      if (name === 'Array' && node.typeArguments?.length === 1) return { type: 'array', items: convert(node.typeArguments[0]!) }
      if (name === 'Record' || name === 'Object') {
        if (node.typeArguments?.length !== 2 || node.typeArguments[0]!.kind !== ts.SyntaxKind.StringKeyword) fail('dictionary requires a string key and an explicit JSON value type', node)
        return { type: 'object', additionalProperties: convert(node.typeArguments![1]!) }
      }
      if (node.typeArguments?.length) fail('generic types are not supported', node)
      const alias = aliases.get(name)
      if (!alias || !alias.typeExpression) fail('type is not declared by a same-file @typedef: ' + name, node)
      if (active.has(name)) fail('recursive typedef ' + name, node)
      active.add(name)
      const result = convert(ts.isJSDocTypeExpression(alias!.typeExpression!) ? alias!.typeExpression!.type : alias!.typeExpression! as ts.JSDocTypeLiteral)
      active.delete(name)
      return result
    }
    return fail('unsupported JSDoc JSON type: ' + node.getText(file), node)
  }
  const tags = ts.getJSDocTags(fn)
  if (tags.some(ts.isJSDocTemplateTag)) fail('generic functions are not supported')
  const parameters = tags.filter(ts.isJSDocParameterTag), returns = tags.filter(ts.isJSDocReturnTag)
  if (parameters.length !== fn.parameters.length) fail('each function parameter requires exactly one matching @param')
  const properties: Record<string, Schema> = Object.create(null), required: string[] = [], args: string[] = []
  for (const param of fn.parameters) {
    if (!ts.isIdentifier(param.name) || param.dotDotDotToken) fail('tool parameters must be named; rest and destructured parameters are not supported')
    const name = param.name.getText(file), matching = parameters.filter(p => p.name.getText(file) === name)
    if (matching.length !== 1 || !matching[0]!.typeExpression) fail('parameter requires an explicit matching JSDoc type: ' + name)
    const tag = matching[0]!
    properties[name] = { ...convert(tag.typeExpression!.type), ...(text(tag.comment) ? { description: text(tag.comment) } : {}) }
    if (!tag.isBracketed && !param.initializer && !ts.isJSDocOptionalType(tag.typeExpression!.type)) required.push(name)
    args.push(name)
  }
  if (returns.length !== 1 || !returns[0]!.typeExpression) fail('tool function requires exactly one explicit @returns type')
  return { name: source.name, description, parameters: { type: 'object', properties, required, additionalProperties: false }, output: { ...convert(returns[0]!.typeExpression!.type), ...(text(returns[0]!.comment) ? { description: text(returns[0]!.comment) } : {}) }, arguments: args,
    factoryHash: digest(source.factory), functionHash: digest(source.implementation), location }
}
