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

require accepts only @papermoon/story or relative paths with explicit .js extensions. Relative references resolve from the importing virtual file and cannot leave the program. Node built-ins, package imports, absolute paths, inferred extensions, directory entries and JSON modules are unavailable. Modules evaluate once per compilation. Cycles fail with the complete reference chain. Unreferenced files are not parsed or executed.

Programs execute synchronously in strict mode. ESM imports and exports, dynamic import, async functions and await are unsupported. There is no transpilation or bundling. require has no runtime phase; artifacts contain only resolved text.

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

story_compile takes ref as either a draft with sequence or a revision with revisionId, plus optional entry and language. Its target script comes from the tool scope. A stale sequence must be reread through normal tools; compilation does not bypass concurrency checks or grant edit observations. story_help with topic compilation provides the same declaration and loading guidance on demand.
