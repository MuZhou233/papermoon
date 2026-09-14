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

require 仅接受 @papermoon/story 或明确带 .js 扩展名的相对路径。相对引用从当前虚拟文件所在目录解析，不能离开程序范围。Node 内置模块、包导入、绝对路径、扩展名推断、目录入口和 JSON 模块均不可用。每次编译或调用中，每个模块只求值一次，循环依赖会失败并给出完整引用链。未引用文件不解析、不执行。

程序以严格模式同步执行，不支持 ESM 导入导出、动态 import、async 函数和 await。编译不转译、不打包。require 只在模块初始化时可用，工厂和函数调用期间不可用。产物冻结已加载源码和所选语言文案。

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

story_compile 的 ref 只接受携带 sequence 的草稿，entry 和 language 可选。已提交的修订版本不能再次编译，其产物从冻结附件读取。目标剧本由工具作用域确定。序号过期后，需通过正常工具重新读取。编译不会绕过并发校验，也不会授予修改所需的读取权限。按需调用 story_help 的 compilation 主题，可以取得相同的声明和加载用法。

## 状态与闭包函数

state 与 functions 均可省略。省略 state 时采用不允许任何属性的空对象；省略 functions 时不生成工具。显式状态必须提供初始 JSON 对象，以及编译器 Ajv 校验器支持的 JSON Schema。工厂接收 {state}，返回普通命名函数，构造期间不能写入状态。只有登记工厂返回的函数成为工具，辅助函数不会暴露。

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

主持人获得名为 increment 的工具，参数 amount 为可选数值。传入 {"amount":3} 时调用 increment(3)，原样返回 3。省略 amount 时由 JavaScript 默认参数处理。不增加状态包装、状态数据、名称前缀或提示词。正常返回后提交合法的候选状态，抛错则丢弃。返回对象中的 "rejected" 没有特殊含义，同时发生的状态变化仍会提交。查询函数可以正常返回而不修改状态。

每个返回函数需要一份 JSDoc 说明、与每个具名参数对应的显式类型 @param，以及一个显式类型 @returns，参数名必须一致。转换器支持字符串、有限数值、布尔、null、数组、显式对象属性、字面量和包含式联合，以及同文件的非递归 @typedef。可选 JSDoc 参数和 JavaScript 默认参数不会标为必填；适配器不补值，只按声明顺序传入参数，不转换类型。

同一文件支持连续的 @typedef 注释块，包括 @property 声明，以及对前后非递归别名的引用。字符串键字典可写为 Record<string, T>、Object<string, T> 或 {[key:string]: T}。T 必须描述 JSON 值，每个字典值都会校验。单独的 object 没有声明字段或值类型，因此会被拒绝。诊断尽可能定位到不支持的类型注解或别名声明。

解构、剩余参数、其他泛型或递归类型、外部类型导入、无法解析的别名，以及来源不明确的函数都会产生诊断。函数名必须符合 [A-Za-z_][A-Za-z0-9_]{0,63} 且不重复，宿主保留 run_code。工厂及返回函数必须能唯一对应源码位置，不支持动态生成的函数。返回类型必须描述 JSON 值，因此不支持 undefined 和 void。

每次调用都从冻结模块重新构造闭包并核对身份。局部变量重置，需要持久保存的值写入 state。t(key) 在初始化和调用时均读取冻结语言。只要求实际读取的文案存在；运行时缺译会使该次调用失败，不提交状态。不增加语言回退或插值。

story_simulate 接受 [{name:"increment",args:{amount:3}}] 形式的 calls，以及可选入口和语言。它编译当前草稿快照，返回逐次调用结果、错误和状态变化，不保存这些变化。story_help 的 functions 主题说明工厂、JSDoc 和模拟用法。两者都不增加自动检查要求。
