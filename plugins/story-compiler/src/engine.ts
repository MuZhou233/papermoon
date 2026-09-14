/** Bounded CommonJS evaluation shared by compilation and frozen function execution. */
import vm from 'node:vm'
import { posix } from 'node:path'
import { parse } from 'acorn'
import type { Diagnostic, WorkerInput, EvaluatedDeclaration, JsonObject, JsonValue } from './types.ts'

export function evaluate(input: WorkerInput) {
const { files, texts, options } = input
const timeout = options.limits.executionMs
const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false }, microtaskMode: 'afterEvaluate' })
const execute = (source: string, filename = 'papermoon:internal', lineOffset = 0): unknown => new vm.Script(source, { filename, lineOffset }).runInContext(context, { timeout })
function fail(code: string, stage: Diagnostic['stage'], message: string, location?: Diagnostic['location'], chain?: string[]): never {
  throw Object.assign(new Error(message), { diagnostic: { code, stage, message, ...(location ? { location } : {}), ...(chain ? { chain } : {}) } })
}
function syntax(source: string, path: string) {
  let tree: unknown
  try { tree = parse('"use strict";\n' + source, { ecmaVersion: 2024, sourceType: 'script', locations: true, allowReturnOutsideFunction: true, allowImportExportEverywhere: true }) }
  catch (error) {
    const e = error as Error & { loc?: { line: number; column: number } }
    fail('syntax-error', 'parse', 'Invalid CommonJS syntax: ' + e.message.replace(/ \(\d+:\d+\)$/, ''), { path, ...(e.loc ? { line: Math.max(1, e.loc.line - 1), column: e.loc.column + 1 } : {}) })
  }
  const pending: unknown[] = [tree]
  while (pending.length) {
    const value = pending.pop()
    if (!value || typeof value !== 'object') continue
    if (Array.isArray(value)) { pending.push(...value); continue }
    const node = value as Record<string, unknown>
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportDefaultDeclaration', 'ExportAllDeclaration'].includes(String(node.type)) ||
      (node.type === 'MetaProperty' && (node.meta as { name: string }).name === 'import')) {
      const loc = node.loc as { start: { line: number; column: number } }
      fail('unsupported-syntax', 'parse', 'ES module syntax is not supported. Story programs use CommonJS require() and module.exports.', { path, line: loc.start.line - 1, column: loc.start.column + 1 })
    }
    if (node.type === 'ImportExpression' || node.type === 'AwaitExpression' || node.async === true) {
      const loc = node.loc as { start: { line: number; column: number } }
      fail('unsupported-syntax', 'parse', 'asynchronous code and dynamic import are not supported', { path, line: loc.start.line - 1, column: loc.start.column + 1 })
    }
    for (const [key, child] of Object.entries(node)) if (key !== 'loc') pending.push(child)
  }
}
function diagnose(error: unknown, path?: string): Diagnostic {
  const e = error as { diagnostic?: Diagnostic; code?: string; message?: string; stack?: string; field?: string; textKey?: string; language?: string; reason?: string }
  if (e?.diagnostic) return e.diagnostic
  const message = typeof e?.message === 'string' ? e.message : 'script threw a non-Error value'
  if (Buffer.byteLength(message) > options.limits.outputBytes) return { code: 'output-limit', stage: 'execution', message: 'error exceeds outputBytes' }
  const frame = typeof e?.stack === 'string' ? /story:([^\n]*?):(\d+)(?::(\d+))?/.exec(e.stack) : null
  const location: NonNullable<Diagnostic['location']> = {
    ...(frame ? { path: frame[1], line: Number(frame[2]), ...(frame[3] ? { column: Number(frame[3]) } : {}) } : path ? { path } : {}),
    ...(typeof e?.field === 'string' ? { field: e.field } : {}),
    ...(typeof e?.textKey === 'string' ? { key: e.textKey, language: options.language } : {}),
  }
  return { code: e?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' ? 'timeout' : e?.textKey !== undefined ? (e.reason ?? 'missing-text') : e?.field !== undefined ? 'invalid-declaration' : 'evaluation-error', stage: e?.field !== undefined ? 'declaration' : 'evaluate', message, ...(Object.keys(location).length ? { location } : {}) }
}

try {
  // Trusted closures capture their own intrinsics before any authored module runs.
  const bootstrap = execute(`(() => {
    const parse = JSON.parse, stringify = JSON.stringify, keys = Object.keys;
    const descriptors = Object.getOwnPropertyDescriptors, ownKeys = Reflect.ownKeys;
    const prototype = Object.getPrototypeOf, plain = Object.prototype, isArray = Array.isArray;
    const ErrorType = Error, freeze = Object.freeze, has = Object.hasOwn;
    const functionText = Function.prototype.toString, apply = Reflect.apply, get = Reflect.get;
    const ProxyType = Proxy, WeakMapType = WeakMap, WeakSetType = WeakSet, finite = Number.isFinite;
    const catalog = parse(${JSON.stringify(JSON.stringify(texts))});
    const invalid = (field, message) => { const error = new ErrorType(message); error.field = field; throw error; };
    const member = (field, key) => field === 'module.exports' ? key : field + '.' + key;
    const data = (value, allowed, field) => {
      if (!value || typeof value !== 'object' || isArray(value) || ![plain, null].includes(prototype(value))) invalid(field, 'expected a plain object');
      const props = descriptors(value);
      for (const key of ownKeys(props)) {
        if (typeof key !== 'string') invalid(field, 'symbol declaration fields are not supported');
        if (!allowed.includes(key)) invalid(member(field, key), 'unknown declaration field ' + stringify(key) + '; allowed fields: ' + stringify(allowed));
        if (!has(props[key], 'value')) invalid(member(field, key), 'accessor fields are not supported');
      }
      return props;
    };
    const string = (props, key, field, optional = false) => {
      if (!has(props, key)) { if (optional) return undefined; invalid(field, 'required string is missing'); }
      if (typeof props[key].value !== 'string') invalid(field, 'expected a string');
      return props[key].value;
    };
    const normalize = (value) => {
      const props = data(value, ['systemPrompt', 'systemPromptName', 'messages', 'state', 'functions'], 'module.exports');
      const systemPrompt = string(props, 'systemPrompt', 'systemPrompt');
      const systemPromptName = string(props, 'systemPromptName', 'systemPromptName', true);
      const array = props.messages?.value;
      if (!isArray(array)) invalid('messages', 'messages must be an array');
      const entries = descriptors(array), length = entries.length.value, messages = [];
      if (ownKeys(entries).length !== length + 1) invalid('messages', 'sparse arrays or extra array fields are not supported');
      for (let i = 0; i < length; i++) {
        const descriptor = entries[i];
        if (!descriptor || !has(descriptor, 'value')) invalid('messages.' + i, 'message must be a data value');
        const p = data(descriptor.value, ['role', 'name', 'content'], 'messages.' + i);
        const role = string(p, 'role', 'messages.' + i + '.role');
        if (role !== 'user' && role !== 'assistant') invalid('messages.' + i + '.role', 'unsupported message role');
        const content = string(p, 'content', 'messages.' + i + '.content');
        const name = string(p, 'name', 'messages.' + i + '.name', true);
        messages.push({ role, content, ...(name === undefined ? {} : { name }) });
      }
      return stringify({ systemPrompt, ...(systemPromptName === undefined ? {} : { systemPromptName }), messages });
    };
    const json = (value, field, active = new WeakSetType()) => {
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
      if (typeof value === 'number' && finite(value)) return;
      if (!value || typeof value !== 'object' || active.has(value)) invalid(field, 'expected lossless JSON without cycles');
      active.add(value);
      const props = descriptors(value), array = isArray(value);
      if (!array && ![plain, null].includes(prototype(value))) invalid(field, 'expected a plain JSON object');
      if (array && ownKeys(props).length !== props.length.value + 1) invalid(field, 'sparse arrays or extra fields are not JSON');
      for (const key of ownKeys(props)) {
        if (array && key === 'length') continue;
        if (typeof key !== 'string' || !has(props[key], 'value') || !props[key].enumerable) invalid(field, 'JSON properties must be enumerable data values');
        json(props[key].value, field + '.' + key, active);
      }
      active.delete(value);
    };
    let writing = false, current, callable = [];
    const proxies = new WeakMapType();
    const mutable = () => { if (!writing) invalid('functions', 'function factories cannot modify state'); };
    const view = value => {
      if (!value || typeof value !== 'object') return value;
      if (proxies.has(value)) return proxies.get(value);
      const proxy = new ProxyType(value, {
        get: (target, key, receiver) => view(get(target, key, receiver)),
        getOwnPropertyDescriptor: (target, key) => {
          const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
          return descriptor && has(descriptor, 'value') ? { ...descriptor, value: view(descriptor.value) } : descriptor;
        },
        set: (target, key, value) => { mutable(); return Reflect.set(target, key, value); },
        deleteProperty: (target, key) => { mutable(); return Reflect.deleteProperty(target, key); },
        defineProperty: (target, key, descriptor) => {
          mutable();
          if (descriptor.configurable !== true && descriptor.value && typeof descriptor.value === 'object') invalid('state', 'object state properties must remain configurable');
          return Reflect.defineProperty(target, key, descriptor);
        },
        setPrototypeOf: () => invalid('state', 'state prototypes cannot change'),
        preventExtensions: () => invalid('state', 'state must remain editable')
      });
      proxies.set(value, proxy);
      return proxy;
    };
    const prepare = (value, override) => {
      const context = parse(normalize(value));
      const props = descriptors(value);
      let state = { initial: {}, schema: { type: 'object', additionalProperties: false } };
      if (has(props, 'state')) {
        const p = data(props.state.value, ['initial', 'schema'], 'state');
        if (!has(p, 'initial') || !has(p, 'schema')) invalid('state', 'initial and schema are required');
        state = { initial: p.initial.value, schema: p.schema.value };
      }
      json(state, 'state');
      if (!state.initial || typeof state.initial !== 'object' || isArray(state.initial)) invalid('state.initial', 'initial state must be an object');
      if (!state.schema || typeof state.schema !== 'object' || isArray(state.schema)) invalid('state.schema', 'state schema must be an object');
      current = parse(stringify(override === undefined ? state.initial : override));
      const factories = has(props, 'functions') ? props.functions.value : [];
      if (!isArray(factories)) invalid('functions', 'functions must be an array');
      const entries = descriptors(factories), length = entries.length.value, sources = [];
      if (ownKeys(entries).length !== length + 1) invalid('functions', 'functions must be a dense array');
      for (let i = 0; i < length; i++) {
        if (!entries[i] || !has(entries[i], 'value') || typeof entries[i].value !== 'function') invalid('functions.' + i, 'expected a function factory');
        const factory = entries[i].value, fn = apply(factory, undefined, [freeze({ state: view(current) })]);
        if (typeof fn !== 'function') invalid('functions.' + i, 'factory must return an ordinary named function');
        const descriptor = descriptors(fn).name;
        if (!descriptor || !has(descriptor, 'value') || typeof descriptor.value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(descriptor.value)) invalid('functions.' + i, 'function requires a valid tool name');
        if (sources.some(source => source.name === descriptor.value)) invalid('functions.' + i, 'duplicate tool name');
        sources.push({ name: descriptor.value, factory: apply(functionText, factory, []), implementation: apply(functionText, fn, []) });
        callable.push(fn);
      }
      return stringify({ context, state, functions: sources });
    };
    const invoke = (index, names, args) => {
      const ordered = names.map(name => has(args, name) ? args[name] : undefined);
      let value;
      writing = true;
      try { value = apply(callable[index], undefined, ordered); } finally { writing = false; }
      json(current, 'state'); json(value, 'return');
      return stringify({ state: current, value });
    };
    const api = freeze({
      defineStory: value => value,
      t: function(key) {
        if (arguments.length !== 1 || typeof key !== 'string') invalid('t', 't expects exactly one text key');
        const exists = has(catalog, key);
        if (!exists || catalog[key] === null) {
          const error = new ErrorType(exists ? 'translation is missing' : 'text entry is missing');
          error.textKey = key; error.reason = exists ? 'missing-translation' : 'missing-text'; throw error;
        }
        return catalog[key];
      }
    });
    const requireFactory = bridge => function require(specifier) {
      const response = bridge(specifier);
      if (response.error !== undefined) { const d = parse(response.error), error = new ErrorType(d.message); error.diagnostic = d; throw error; }
      return response.value;
    };
    for (const key of ['process', 'Buffer', 'fetch', 'Date', 'Intl', 'performance', 'crypto', 'Promise', 'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask', 'console', 'WebAssembly'])
      Object.defineProperty(globalThis, key, { value: undefined, writable: false, configurable: false });
    Object.defineProperty(Math, 'random', { value: () => { throw new ErrorType('randomness is unavailable'); }, writable: false, configurable: false });
    return { api, prepare, invoke, requireFactory };
  })()`) as { api: unknown; prepare: unknown; invoke: unknown; requireFactory: unknown }
  const modules = new Map<string, { exports: unknown }>(), visiting: string[] = []
  let loading = true
  function load(path: string): unknown {
    if (visiting.includes(path)) fail('module-cycle', 'load', 'circular module dependency', { path }, [...visiting, path])
    if (modules.has(path)) return modules.get(path)!.exports
    if (!Object.hasOwn(files, path)) fail('module-not-found', 'load', 'program file does not exist', { path }, [...visiting, path])
    if (modules.size >= options.limits.modules) fail('module-limit', 'load', 'module count exceeds limit', { path })
    const source = files[path]!
    syntax(source, path)
    const module = execute('({ exports: {} })') as { exports: unknown }
    modules.set(path, module); visiting.push(path)
    const bridge = (specifier: unknown) => {
      try {
        if (!loading) fail('module-phase', 'load', 'require is only available during initialization', { path })
        if (specifier === '@papermoon/story') return { value: bootstrap.api }
        if (typeof specifier !== 'string' || !/^(\.\/|\.\.\/).*\.js$/.test(specifier) || specifier.includes('\\') || specifier.includes('\0'))
          fail('module-forbidden', 'load', 'require expects a relative .js path or @papermoon/story', { path })
        const target = posix.normalize(posix.join(posix.dirname(path), specifier))
        if (target.startsWith('../') || target.startsWith('/')) fail('module-forbidden', 'load', 'module path escapes the program', { path })
        return { value: load(target) }
      } catch (error) { return { error: JSON.stringify(diagnose(error, path)) } }
    }
    context.__bridge = bridge; context.__factory = bootstrap.requireFactory
    const require = execute('__factory(__bridge)')
    delete context.__bridge; delete context.__factory
    context.__require = require; context.__module = module
    try { execute('(function(require, module, exports) {"use strict";\n' + source + '\n})(__require, __module, __module.exports)', 'story:' + path, -1) }
    finally { visiting.pop(); delete context.__require; delete context.__module }
    return module.exports
  }
  const result = load(options.entry)
  loading = false
  context.__prepare = bootstrap.prepare; context.__result = result
  context.__override = input.invocation ? execute('JSON.parse(' + JSON.stringify(JSON.stringify(input.invocation.state)) + ')') : undefined
  const serialized = execute('__prepare(__result, __override)') as string
  if (Buffer.byteLength(serialized) > options.limits.outputBytes) fail('output-limit', 'declaration', 'initial context exceeds outputBytes')
  const declaration = JSON.parse(serialized) as EvaluatedDeclaration
  return { declaration, program: { files: Object.fromEntries([...modules.keys()].map(path => [path, files[path]!])), texts },
    invoke(index: number, names: readonly string[], args: JsonObject): { state: JsonObject; value: JsonValue } {
      context.__invoke = bootstrap.invoke
      context.__arguments = execute('JSON.parse(' + JSON.stringify(JSON.stringify({ names, args })) + ')')
      let output: string
      try { output = execute('__invoke(' + index + ', __arguments.names, __arguments.args)') as string }
      catch (error) { throw { diagnostic: diagnose(error) } }
      if (Buffer.byteLength(output) > options.limits.outputBytes) fail('output-limit', 'execution', 'state and return value exceed outputBytes')
      return JSON.parse(output) as { state: JsonObject; value: JsonValue }
    }
  }
} catch (error) {
  throw { diagnostic: diagnose(error) }
}
}
