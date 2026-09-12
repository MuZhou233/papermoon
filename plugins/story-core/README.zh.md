# 剧本逻辑核心

[English](README.md) | 中文

本包定义程序与多语言文案，变换内容快照，并将业务操作接入[剧本存储](../story-storage/README.zh.md)。它提供内部 TypeScript API 和可加载的 Cordis 服务，[人工编辑器](../story-editor/README.zh.md)通过 PaperMoon profile 叠加配置挂载它，原版 Web 不挂载。

## 职责与入口

`@papermoon/story-core` 导出[内容模型](src/model.ts)、创建函数、纯编辑操作、查询、恢复和 KV 编码。该入口不加载 SQLite、文件系统或 Cordis 代码。快照使用只读类型；编辑返回独立候选内容，不修改输入，也不宣称已取得新的持久序号。调用方应将返回的集合视为只读数据。

`@papermoon/story-core/repository` 导出 [StoryRepository](src/repository.ts)，接收已有 StoryStorage，读取并校验内容，执行业务修改，再调用原子存储操作。它不维护权威内存缓存，也不拥有数据库连接。共享 JSON 编码器来自纯入口 `@papermoon/story-storage/value`，与存储使用相同的序列化规则。

`@papermoon/story-core/plugin` 注册 papermoonStoryCore，并声明依赖 papermoonStoryStorage。Cordis 等待提供者可用后挂载核心。移除提供者时，先注销核心并等待依赖清理，再关闭存储；只移除核心则保留存储连接。

编译、产物持久化、会话权限、模型工具、审核和运行版本选择由调用方或其他模块负责。编译器可以接收固定内容快照和显式配置，无需访问存储。本核心不执行源码，也不插值文案。

## 内容与元数据

项目包含剧本，每份剧本拥有独立草稿和修订版本目录，目录项引用共享的不可变修订版本。草稿或修订版本正文保存 StoryContent，包括格式身份、内容元数据、程序及文案目录。程序包含文件。文案目录包含已登记语言、默认语言和文案条目；每个条目保存可选的共用用途说明及各语言译文。

所有实体均有 JSON 对象元数据，新建时默认为空对象。内容、程序、文件、目录、语言、条目和译文的元数据跟随正文，在修订版本中冻结。项目、剧本和草稿的管理元数据留在各自实体上。修订版本、目录项和发布记录的元数据在创建时确定，没有更新接口。更新元数据会替换整个对象，不合并嵌套值。

草稿管理元数据使用草稿序号，可以与内容一同原子修改。提交不会将它转成修订版本元数据，恢复正文时也会保留它。项目和剧本的管理更新不推进草稿序号。复制当前草稿时复制其管理元数据，从修订版本复制时新草稿的管理元数据为空；调用方均可显式覆盖。复制目录项时保留其元数据，继续引用同一修订版本正文。

程序使用区分大小写、以 `/` 分隔的虚拟相对路径，拒绝绝对路径、盘符路径、反斜杠、空路径段、`.`、`..` 和 NUL。同一路径不能既是文件又是父目录。目录从文件推导，不保存空目录。源码可以为空或尚未写完，不要求扩展名或入口文件。重命名保留文件元数据，不改写源码引用。

语言标识是精确、非空且不含 NUL 的 Unicode 字符串，不从宿主推断，也不归并为语言族。文案目录必须包含默认语言。文案键使用同样的标识规则，在目录内唯一。条目可以没有译文；空字符串表示译文存在。用途说明可选，由各语言共享，也可以为空。删除语言会删除对应译文；若删除默认语言，同批操作必须选定另一个已登记语言。

lookupTranslation 分别表示语言、条目和译文缺失，不回退到默认语言或其他语言。修改默认语言不会补齐文案。保存和提交允许翻译不完整。类似模板的文字按原文保存，模板语法和运行所需的完整性检查由后续调用方负责。

```ts
import { createContent, applyOperations, lookupTranslation } from './src/index.ts'

const content = applyOperations(createContent({ defaultLanguage: 'zh-CN' }), [
  { kind: 'create-file', path: 'entry.mjs', source: 't("welcome")' },
  { kind: 'add-language', language: 'en' },
  { kind: 'create-text', key: 'welcome', description: 'Opening greeting' },
  { kind: 'set-translation', key: 'welcome', language: 'zh-CN', text: '欢迎。' },
])
const translation = lookupTranslation(content, 'welcome', 'en')
if (translation.kind === 'missing') console.log(translation.reason)
```

仓库通过 queryScripts 筛选元数据目录，通过 getHistoryEntry 查询确定的目录归属，并通过 listRevisions 升序或倒序分页。这些查询沿用[存储分页规则](../story-storage/README.zh.md#api-与分页)。

## 编辑与历史

applyOperations 按顺序执行有类型的 ContentOperation，在最终内容上检查跨实体规则。创建时拒绝重复身份；编辑和删除要求目标存在。重命名要求源存在、目标未被占用，但允许保持原名；源码引用不会随之修改。set-translation 省略元数据时保留已有值，新译文则使用空元数据。set-description 接受 null 来移除说明。set-metadata 替换任意内容实体的元数据。

StoryRepository.editDraft 读取完整快照，在内存中变换，计算变化的 KV 条目，再携带预期序号写入。存储事务重新检查该序号，只有写入成功才返回新的持久快照。每次接受的保存推进一次序号，空批次和内容未变化的批次也一样。失败或冲突不会保存部分内容，也不会自动重试或合并。

commitRevision 要求说明包含非空白文字，并保留原文。它检查内容结构，不编译，也不要求翻译完整。存储事务复制全部草稿、追加目录项、更新创作起点并推进草稿序号。独立提交始终生成不同修订版本。metadata 和 historyMetadata 分别描述修订版本与目录项，references 仅用于溯源。

restoreDraft 可以选择全部内容、整个程序、整个文案目录、单个文件或单条文案。完整恢复会改变草稿的起点修订版本；部分恢复保持起点和无关内容不变。恢复的对象包含其元数据。源对象缺失时操作失败，不会删除目标。恢复文案条目不会登记缺少的语言，调用方需先显式登记。恢复不删除历史，也不提交修订版本。

copyScript 沿用存储层显式指定的内容、历史和发布记录范围，校验选定内容但不编译，继续在数据库中复用修订版本。registerPublication 保存既有剧本目录归属与元数据，不要求编译或审核；重复登记会创建独立记录。删除和引用回收遵循存储 API。名称无需唯一，创建项目或剧本不会创建会话。

```ts
import type { StoryStorage } from '@papermoon/story-storage'
import { StoryRepository } from './src/repository.ts'

export function author(storage: StoryStorage) {
  const stories = new StoryRepository(storage)
  const project = stories.createProject({ name: 'Example' })
  const script = stories.createScript({
    projectId: project.id, name: 'First direction', defaultLanguage: 'zh-CN',
  })
  const saved = stories.editDraft({
    scriptId: script.id, expectedSequence: 0,
    operations: [{ kind: 'create-file', path: 'entry.mjs', source: 'unfinished {' }],
  })
  return stories.commitRevision({
    scriptId: script.id, expectedSequence: saved.draft.sequence,
    description: 'Establish the first direction',
  })
}
```

## 读取、搜索与比较

readSnapshot 在一次存储读取事务内取得实体属性和内容。草稿结果携带确定序号，修订版本结果携带不可变修订版本身份。readFile、readText 和 readLanguage 返回目标对象与已解析来源。列表方法、listMissingTranslations、searchProgram 和 searchTexts 返回稳定分页及已解析来源。这些查询目前读取一份完整快照，编辑时只写入变化条目。

分页默认返回 100 项，最多 1000 项。文件、语言和文案按 UTF-8 二进制身份顺序排列。后续页需传入已返回的 ref 和 next。草稿续页没有提供序号时会被拒绝；序号变化后的读取也会失败。仅含元数据的历史列表沿用存储目录序号，项目、剧本和发布列表沿用 ID 顺序，目录不会跨调用冻结。

搜索使用区分大小写的字面匹配。结果按文件或文案条目分组，指出字段、语言及原文中不重叠匹配的 UTF-16 偏移。文案搜索默认检查键、用途说明和译文；省略语言时搜索全部译文，指定语言时只搜索该已登记语言。空查询会被拒绝。摘录与高亮由调用方负责。

compare 读取内容头和 SQL 筛选出的变化记录，不加载全部正文。它支持全部内容，或 settings、program、languages、texts 范围。每个变化的文件、语言、文案条目或设置记录占一个结果，包含两侧业务对象和字段路径，可表示说明、译文和元数据变化。新增和删除返回整个对象的值。元数据按整体比较，不提供文本行对齐、重命名推断或合并。

比较返回双方已解析来源，以及绑定来源和范围的 next 不透明游标。后续页需复用这些值，任一草稿变化都会使续页失败。修订版本说明、管理元数据和发布记录不参与内容比较。SQL 仍可能扫描全部相关条目，不保证查询成本只与变化行数有关。

## 格式与错误

业务格式为 papermoon.story，版本为 1。KV 编码保存一条内容头记录，每个程序文件、已登记语言和文案条目各占一条记录。内容头保存内容、程序、文案目录的元数据和默认语言；文案记录保存用途说明、元数据及全部译文。调用方使用有类型的 API，无需构造存储键。解码拒绝未声明记录、未知字段、不支持的格式及损坏的内容关系，不修补缺失数据。调用方的附加资料应放在元数据中。

新建剧本时，空程序、默认语言登记和内容头在同一事务中保存，草稿序号从零开始。所需存储格式为 2；版本 1 数据库会被拒绝，不迁移、替换或删除。业务值格式变化并不必然要求修改 SQL 表。

StoryError 提供 invalid-input、invalid-content、not-found 或 already-exists，并附带位置。conflict、busy、closed 和 format-mismatch 等存储错误保留原身份。译文缺失属于正常查询结果。错误不包含 UI 本地化文案或编译诊断。

## 构建与验证

在根目录执行 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm check:docs` 和 `pnpm check:notes`，无需 DSH。`pnpm build:plugins` 先构建存储，再构建核心。`pnpm check:plugins:pure` 阻止导入 Node 内置模块和 Cordis，再验证构建后的纯入口。`pnpm check:plugins:dsh` 还需要已构建的 DSH Cordis，验证真实依赖等待、使用者清理和重新挂载。测试使用临时数据库，不启动 Web 或调用模型。

[核心决策](../../.agents/notes/implemented/architecture/2026-09-12-script-core.zh.md)记录职责和替代方案，[开发指南](../../docs/development.zh.md)维护根目录命令。
