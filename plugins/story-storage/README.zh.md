# 剧本存储

[English](README.md) | 中文

本模块保存项目、剧本、可变草稿、共享的不可变修订版本及发布记录，提供独立的 Node API 和 Cordis 服务插件。[人工编辑器](../story-editor/README.zh.md)通过 PaperMoon profile 叠加配置挂载它，原版 Web 不挂载。

## 归属与内容

项目包含独立剧本。每份剧本拥有一份草稿和有序修订版本目录。目录项引用不可变修订版本；复制历史时只复制引用，不重写修订版本正文。发布记录属于具体剧本，引用该剧本目录中的修订版本，不包含审核流程或编译产物。

内容是字符串到 JSON 值的映射。草稿和修订版本条目分表保存，每个顶层键值对占一行，值内部的对象仍保存为 JSON。模块不将键解释为路径、代码、语言或文案，这些约定及其业务格式版本由调用方维护。

JSON 对象采用确定的成员顺序，数组顺序和字符串内容保持原意，负零序列化为零。键缺失与键存在但值为 null 不同。模块拒绝未定义值、非有限数值、循环对象、访问器、稀疏数组和自定义原型对象。键和直接存储的文本必须是格式正确且不含 NUL 的 Unicode 字符串，当前 Node SQLite 文本读取器会在 NUL 处截断。JSON 值内部仍可包含 NUL。读取返回独立的数据，修改返回对象不会修改存储。

## 草稿与修订版本

新草稿的序号从零开始。每次接受的批量写入都将序号增加一次，空批次也一样；批次内的修改按顺序执行。写入、恢复和提交必须提供预期序号，不匹配时拒绝整个操作。项目和剧本元数据更新替换所提供的字段，不检查草稿序号。名称必须包含非空白文字，但不要求唯一。createScript 接受 initialContent 和 draftMetadata，在序号为零时与新剧本一同保存。writeDraft 可以将草稿元数据与内容一同原子替换。

保存只修改草稿。提交在数据库内部将全部草稿条目复制到新修订版本，追加历史序号，更新草稿的起点修订版本并推进草稿序号，草稿仍可编辑。每次独立提交都会创建不同的修订版本，即使内容相同或说明为空。修订版本的元数据、说明、来源身份和内容均没有更新接口。目录项也有不可变元数据，提交时通过 historyMetadata 提供。草稿元数据保留在草稿上，不转成修订版本元数据。

恢复会用任意仍被保留的修订版本完整替换草稿内容，保留已有历史和草稿元数据，不创建新修订版本。起点修订版本、副本来源和额外参考只用于溯源，不增加历史，也不阻止删除；这些资料可以在目标被删除后继续保留。

## 复制、发布与删除

复制请求明确指定源剧本、草稿序号或历史修订版本、目标项目、名称，以及历史和发布记录的复制范围。需要携带历史时，草稿源对应完整历史，修订版本源对应截至该修订版本的目录前缀。仅复制内容时，新剧本的历史为空。新草稿序号均从零开始。草稿源携带草稿元数据，修订版本源则使用空草稿元数据；两者均可通过 draftMetadata 覆盖。新剧本采用所提供的元数据；未提供时复制源剧本的元数据。

复制后的历史保留相同的不可变修订版本 ID、目录序号和目录项元数据，之后各自追加。复制发布记录必须同时复制历史，且只包含被保留目录项对应的记录。发布副本获得新 ID，保留原登记时间和元数据。复制不修改源剧本，也不创建修订版本。

同一剧本修订版本可以登记多次发布。存储只检查目录归属，不提供批准、撤销或默认版本选择策略。

删除剧本会删除其草稿、历史引用和发布记录。删除项目时级联处理所属剧本。不再被引用的修订版本及其条目在同一事务内删除；其他剧本的历史仍引用时，共享修订版本继续保留。本模块不提供单条历史删除、自动历史裁剪或独立修订版本之间的内容去重。

## API 与分页

[公共类型](src/types.ts)定义请求和结果，[StoryStorage](src/storage.ts)提供同步操作。失败使用 [StorageError](src/error.ts) 错误码：invalid-input、not-found、conflict、busy、closed、format-mismatch、corrupt 和 database-error。调用在事务提交后返回。关闭后的调用失败，关闭操作本身幂等。

| 操作组 | 方法 |
|---|---|
| 生命周期 | constructor, close |
| 项目 | createProject, getProject, listProjects, updateProject, deleteProject |
| 剧本 | createScript, getScript, listScripts, queryScripts, updateScript, copyScript, deleteScript |
| 草稿 | getDraft, writeDraft, restoreDraft |
| 修订版本 | commitRevision, getRevision, getHistoryEntry, listRevisions |
| 发布 | createPublication, getPublication, listPublications |
| 内容 | readContent, readSnapshot, readEntry, listEntries, compare |

列表默认返回 100 项，允许将上限设为 1 至 1000。项目、剧本和发布列表按稳定 ID 排序，历史默认按目录序号升序排列，也可通过 descending 倒序读取。after 游标遵循所选顺序。元数据分页不包含修订版本正文。不同调用之间不会冻结目录，并发目录变化可能影响后续页。

queryScripts 可跨项目或在一个项目内筛选，使用 SQLite 的字面名称匹配。结果包含项目名和最新目录序号，不加载正文。getHistoryEntry 返回仍被保留修订版本的剧本内序号与目录元数据，不属于该剧本的修订版本会被拒绝。

readSnapshot 在一次读取事务中返回实体属性和全部内容，明确区分草稿与修订版本，不拼接分别读取的元数据和内容。

内容引用标识一个修订版本或一份草稿，草稿可以附带序号以固定读取版本。内容结果返回已解析的引用，将其传给后续分页和详情读取，就能在草稿变化时拒绝继续读取。条目或比较结果续页时，每个草稿引用都必须携带已固定的序号。键分页按 SQLite BINARY 顺序排列，不包含 after 键，包含 lower 下界，不包含 upper 上界。仅在还有结果时返回 next 游标。

比较在同一读取事务中确定双方内容，返回新增、删除或修改的条目，明确两侧是否存在及其值。相同值在 SQL 中过滤。查询可能扫描全部相关条目，不保证成本仅与变化数量有关。文本行 diff、业务结构解释和展示由调用方负责。

```ts
import { StoryStorage } from './src/index.ts'

export function createExample(path: string) {
  const storage = new StoryStorage({ path })
  try {
    const project = storage.createProject({ name: 'Example' })
    const script = storage.createScript({ projectId: project.id, name: 'Draft' })
    const draft = storage.writeDraft({
      scriptId: script.id,
      expectedSequence: 0,
      changes: [{ kind: 'set', key: 'opening', value: { en: 'Hello' } }],
    })
    return storage.commitRevision({
      scriptId: script.id,
      expectedSequence: draft.sequence,
      description: 'Initial content',
    })
  } finally {
    storage.close()
  }
}
```

## 数据库与插件

一个存储实例使用一个数据库保存全部项目。构造函数和插件 Config 要求提供 path，以进程工作目录为基准解析文件路径。请将数据库放在运行数据目录中，例如 `.papermoon/story.sqlite`，不要放入受管的 DSH 工作区。不支持内存数据库，测试使用临时文件。平台支持时，新建目录和文件仅允许所有者访问；既有权限保持不变。

模块使用 Node 内置的 SQLite 连接，采用 DELETE 日志、EXTRA 同步、启用外键、零占用等待和关闭自动空间整理。数据库忙时立即报错。事务不等待模型调用或外部工作。删除后的空闲页可以复用，文件不一定缩小；缓存和页设置沿用 SQLite 默认值。

数据库通过专用应用 ID 和格式版本 2 标识。版本 1 文件会被拒绝，不迁移、替换或删除。空数据库在一个事务中建立结构。既有数据库必须匹配身份、版本和声明的结构，并通过完整性检查。不支持或损坏的文件会被拒绝，不迁移、替换或修复。数据不与 DSH 会话数据库混存。备份应使用能保证一致性的数据库备份方式，或在全部连接关闭后复制文件。

构建后的包导出 `@papermoon/story-storage`、`@papermoon/story-storage/plugin` 和 `@papermoon/story-storage/value`。value 入口导出确定性 encodeJson 函数和 JSON 类型，不加载 Node 内置模块，业务模块无需打开存储即可复用其值规则。插件通过宿主的 provide/effect 接口注册 papermoonStoryStorage。生成器 effect 同时持有两个清理函数，先注销服务并等待依赖退出，再关闭连接；注册失败也会释放连接。最小宿主接口让 DSH 类型留在核心之外，独立集成检查使用真实 Cordis 声明和运行时验证它。

## 构建与验证

在仓库根目录运行 `pnpm build:plugins`，生成包的 lib 目录。运行时只依赖 Node。`pnpm typecheck`、`pnpm lint` 和 `pnpm test` 无需 DSH 即可检查源码和单元测试。`pnpm check:plugins:dsh` 还需要已构建的插件与 DSH 产物，用真实 Cordis 检查宿主类型、导入构建产物、验证依赖清理和重新挂载，不启动 Web 或调用模型。

[存储决策](../../.agents/notes/implemented/architecture/2026-09-12-script-storage.zh.md)记录替代方案和归属选择。主库与集成检查遵循[测试规范](../../docs/testing.zh.md)。
