# CommonJS 剧本 API

[English](api.md) | 中文

## 声明

默认入口是虚拟根目录中的 story.js。明确指定的入口必须是相对路径下的 .js 文件。通过 module.exports 导出一份声明，defineStory 原样返回传入的声明。systemPrompt 和 messages 必填，systemPromptName 及每条消息的 name 可选。角色支持 user 和 assistant，不要求交替。未知字段、访问器和不支持的值会导致编译失败。

```js
const { defineStory, t } = require('@papermoon/story');
const messages = require('./opening.js');
module.exports = defineStory({
  systemPromptName: 'Setting',
  systemPrompt: t('opening.system'),
  messages,
});
```

依赖文件 opening.js 导出消息序列：

```js
const { t } = require('@papermoon/story');
module.exports = [
  { name: 'Background', role: 'user', content: t('opening.background') },
  { name: 'Narration', role: 'assistant', content: t('opening.narration') },
];
```

文案目录需要为这三个键提供编译语言的译文。名称用于预览管理，不会作为前缀加入消息正文。空字符串、空白、换行和类似模板的文本均按原样保留。平台不添加身份、创作指导或其他消息。程序中的直接字符串仍按字符串处理，编译不会扫描源码来强制要求使用文案目录。

## 模块与文案

require 仅接受 @papermoon/story 或明确带 .js 扩展名的相对路径。相对引用从当前虚拟文件所在目录解析，不能离开程序范围。Node 内置模块、包导入、绝对路径、扩展名推断、目录入口和 JSON 模块均不可用。同次编译中每个模块只求值一次，循环依赖会失败并给出完整引用链。未引用文件不解析、不执行。

程序以严格模式同步执行，不支持 ESM 导入导出、动态 import、async 函数和 await。编译不转译、不打包。require 没有运行期阶段，产物只包含已解析文本。

t(key) 只接受一个字符串键，仅读取本次选定的已登记语言。缺少文案键和缺少译文分别给出诊断，空译文有效。它不回退到其他语言、不替换变量、不执行文案。未使用的条目及其他语言可以保留缺译。

## 内部编译调用

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

直接调用编译器不会保存结果。[服务层](README.zh.md)负责快照归属和产物持久化，UI 与模型通过该服务调用。服务返回来源身份和诊断；成功时另返回已保存的产物身份及初始化上下文。编译失败不保存失败记录，也不改变创作内容。

story_compile 的 ref 可以是携带 sequence 的草稿，也可以是携带 revisionId 的修订版本；entry 和 language 可选。目标剧本由工具作用域确定。序号过期后，需通过正常工具重新读取。编译不会绕过并发校验，也不会授予修改所需的读取权限。按需调用 story_help 的 compilation 主题，可以取得相同的声明和加载用法。
