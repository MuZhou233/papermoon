/** Compilation and invocation share a loader; runtime jobs never import the JSDoc compiler. */
import { parentPort, workerData } from 'node:worker_threads'
import { evaluate } from './engine.ts'
import { canonical, digest } from './runtime.ts'
import { validateComposition, defaultComposition } from './composition.ts'
import { validate, checkSchema } from './schema.ts'
import type { Diagnostic, WorkerInput, WorkerResult } from './types.ts'
const input = workerData as WorkerInput
try {
  const loaded = evaluate(input), declaration = loaded.declaration
  checkSchema(declaration.state.schema, 'state.schema')
  validate(declaration.state.schema, declaration.state.initial, 'state.initial')
  let result: WorkerResult
  if (input.invocation || input.composition) {
    const artifact = (input.invocation ?? input.composition)!.artifact
    if (canonical(declaration.context) !== canonical(artifact.context) || canonical(declaration.state) !== canonical(artifact.state) || declaration.functions.length !== artifact.functions.length)
      throw new Error('runtime declaration differs from frozen artifact')
    if ((declaration.composition === null ? null : digest(declaration.composition)) !== (artifact.composition?.hash ?? null)) throw new Error('runtime composition differs from frozen artifact')
    for (let i = 0; i < artifact.functions.length; i++) {
      const frozen = artifact.functions[i]!, actual = declaration.functions[i]!
      if (actual.name !== frozen.name || digest(actual.factory) !== frozen.factoryHash || digest(actual.implementation) !== frozen.functionHash)
        throw new Error('runtime function differs from frozen declaration: ' + frozen.name)
    }
    if (input.composition) {
      validate(artifact.state.schema, input.composition.input.state, 'state')
      const plan = declaration.composition === null ? defaultComposition(input.composition.input) : loaded.compose(input.composition.input)
      validateComposition(plan, input.composition.input)
      result = { ok: true, plan }
    } else {
    const { name, state, args } = input.invocation!
    const index = artifact.functions.findIndex(fn => fn.name === name)
    if (index < 0) throw new Error('function does not exist: ' + name)
    const fn = artifact.functions[index]!
    validate(artifact.state.schema, state, 'state')
    validate(fn.parameters, args, 'arguments')
    const next = loaded.invoke(index, fn.arguments, args)
    validate(artifact.state.schema, next.state, 'state')
    validate(fn.output, next.value, 'return')
    result = { ok: true, ...next }
    }
  } else {
    const functions = declaration.functions.length ? await import('./jsdoc.ts').then(({describeFunction}) => declaration.functions.map(source => describeFunction(source, loaded.program.files))) : []
    for (const fn of functions) { checkSchema(fn.parameters, fn.name + '.parameters'); checkSchema(fn.output, fn.name + '.return') }
    result = { ok: true, compiled: { context: declaration.context, state: declaration.state, functions, composition: declaration.composition === null ? null : { hash: digest(declaration.composition) }, program: loaded.program } }
  }
  if (Buffer.byteLength(JSON.stringify(result)) > input.options.limits.outputBytes) throw new Error('execution result exceeds outputBytes')
  parentPort!.postMessage(result)
} catch (error) {
  const e = error as { diagnostic?: Diagnostic; message?: string; code?: string; field?: string }
  const diagnostic: Diagnostic = e.diagnostic ?? { code: e.code ?? ((input.invocation || input.composition) ? 'execution-error' : 'invalid-declaration'), stage: (input.invocation || input.composition) ? 'execution' : 'declaration', message: e.message ?? 'execution failed', ...(e.field ? { location: { field: e.field } } : {}) }
  parentPort!.postMessage({ ok: false, diagnostic: Buffer.byteLength(JSON.stringify(diagnostic)) > input.options.limits.outputBytes ? { code: 'output-limit', stage: 'execution', message: 'diagnostic exceeds outputBytes' } : diagnostic } satisfies WorkerResult)
}
