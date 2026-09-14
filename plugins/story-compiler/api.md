# CommonJS script API

English | [中文](api.zh.md)

## Declaration

The default entry is the virtual root file story.js. An explicit entry must be a relative .js file. Export one declaration through module.exports; defineStory returns the supplied declaration unchanged. systemPrompt and messages are required. systemPromptName and each message's name are optional. Roles are user or assistant, with no alternation requirement. Unknown fields, accessors and unsupported values fail compilation.

```js
const { defineStory, t } = require('@papermoon/story');
const messages = require('./opening.js');
module.exports = defineStory({
  systemPromptName: 'Setting',
  systemPrompt: t('opening.system'),
  messages,
});
```

The opening.js dependency exports its messages:

```js
const { t } = require('@papermoon/story');
module.exports = [
  { name: 'Background', role: 'user', content: t('opening.background') },
  { name: 'Narration', role: 'assistant', content: t('opening.narration') },
];
```

The text catalog must provide these three keys in the compilation language. Names describe preview entries and never prefix message content. Empty strings, whitespace, line breaks and literal template-like text remain unchanged. The platform adds no identity, creative guidance or other messages. Direct program strings remain strings; compilation does not enforce text-catalog use by scanning source.

## Modules and text

require accepts only @papermoon/story or relative paths with explicit .js extensions. Relative references resolve from the importing virtual file and cannot leave the program. Node built-ins, package imports, absolute paths, inferred extensions, directory entries and JSON modules are unavailable. Modules evaluate once per compilation or invocation. Cycles fail with the complete reference chain. Unreferenced files are not parsed or executed.

Programs execute synchronously in strict mode. ESM imports and exports, dynamic import, async functions and await are unsupported. There is no transpilation or bundling. require is available during module initialization, not during factory or function calls. Artifacts freeze loaded source and selected-language text.

t(key) accepts exactly one string key. It reads only the selected registered language. Missing keys and missing translations have separate diagnostics; empty translations are valid. It never falls back to another language, substitutes variables or executes text. Unused text entries and other languages can remain incomplete.

## Internal compilation calls

```ts
import { createContent, applyOperations } from '@papermoon/story-core'
import { compile } from '@papermoon/story-compiler'
import { initialize } from '@papermoon/story-compiler/runtime'

const content = applyOperations(createContent({ defaultLanguage: 'en' }), [
  { kind: 'create-file', path: 'story.js', source: 'module.exports={systemPrompt:"",messages:[]};' },
])
const result = await compile(content, { entry: 'story.js', language: 'en' })
if (result.ok) initialize(result.artifact)
```

The direct compiler does not save its result. The [service](README.md) adds snapshot ownership and artifact persistence. UI and model callers use that service. It returns source identity, diagnostics and, on success, a saved artifact identity plus initialized context. Failed compilation neither saves a failure record nor changes authored content.

story_compile takes a draft ref with sequence, plus optional entry and language. Submitted revisions cannot be compiled again; their artifacts are read from frozen attachments. Its target script comes from the tool scope. A stale sequence must be reread through normal tools; compilation does not bypass concurrency checks or grant edit observations. story_help with topic compilation provides the same declaration and loading guidance on demand.

## State and closure functions

state and functions are optional. Omitting state selects an empty object with no allowed properties; omitting functions creates no tools. Explicit state requires an initial JSON object and a JSON Schema accepted by the compiler's Ajv validator. Factories receive {state} and return an ordinary named function. Factories cannot write state. Only registered return functions become tools; helpers remain private.

```js
const { defineStory } = require('@papermoon/story');
function createIncrement({ state }) {
  /** Increase the count.
   * @param {number} [amount] Increment.
   * @returns {number} Updated count.
   */
  return function increment(amount = 1) {
    if (amount <= 0 || state.count + amount > 10) throw new Error('Invalid increment');
    state.count += amount;
    return state.count;
  };
}
module.exports = defineStory({
  systemPrompt: '', messages: [],
  state: {
    initial: { count: 0 },
    schema: { type: 'object', properties: { count: { type: 'number' } }, required: ['count'], additionalProperties: false },
  },
  functions: [createIncrement],
});
```

The moderator receives a tool named increment with optional numeric amount. Calling it with {"amount":3} invokes increment(3) and returns 3. Missing amount reaches the JavaScript default. No status wrapper, state, prefix or prompt is added. Returning normally commits valid candidate state; throwing discards it. An object that says "rejected" has no special meaning: accompanying state changes still commit. Query functions can return without changing state.

Each returned function needs one JSDoc description, exactly one typed @param for each named parameter, and one typed @returns. Parameter names must match. The converter supports strings, finite numbers, booleans, null, arrays, explicit object properties, literals and inclusive unions, plus same-file nonrecursive @typedef. Optional JSDoc parameters and JavaScript defaults omit the required property; the adapter never inserts values. It passes positional arguments in declaration order without coercion.

Consecutive same-file @typedef blocks are supported, including @property declarations and references to earlier or later nonrecursive aliases. A string-key dictionary can use Record<string, T>, Object<string, T> or {[key:string]: T}. T must describe JSON values; every dictionary value is validated. Bare object does not declare its fields or value type and is rejected. Diagnostics locate the unsupported annotation or alias declaration when available.

Destructuring, rest parameters, other generic or recursive types, imported types, unresolved aliases and ambiguous function sources fail with diagnostics. Function names must match [A-Za-z_][A-Za-z0-9_]{0,63} and be unique. The host reserves run_code. Factories and returned implementations must have a unique source location; dynamically generated functions are unsupported. Return types must describe JSON values, so undefined and void are unavailable.

Every invocation reconstructs closures from frozen modules and checks their identities. Local variables reset; persistent values belong in state. t(key) reads the frozen language during calls as well as initialization. Only texts actually read must be present; a missing runtime translation fails that call without committing state. No language fallback or interpolation is added.

story_simulate accepts calls in the form [{name:"increment",args:{amount:3}}] and optional entry/language. It compiles the current draft snapshot and returns per-call results, errors and state changes without saving them. story_help topic functions supplies factory, JSDoc and simulation usage. Neither command adds automatic checking requirements.
