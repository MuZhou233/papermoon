/** Edits survive panel unmounts. Save/discard decisions never rewrite newer server settings. */
import type { Writer, WriterDefinition } from '../model.ts'
import { createWriterTemplate } from '../model.ts'
import type { Api } from './api.ts'
import type { Results } from '../service.ts'
export interface State {
  writers: Writer[]
  saved?: Writer
  draft?: WriterDefinition
  catalog: Results['catalog']
  busy: boolean
  error: string
  tab: 'prompts' | 'tools' | 'settings'
  editing: boolean
  pending?: () => unknown | Promise<unknown>
  deleting?: Writer
  creating?: { sourceId?: string; name: string; description: string }
}
function definition(writer: Writer): WriterDefinition {
  return structuredClone({
    name: writer.name,
    ...(writer.description === undefined
      ? {}
      : { description: writer.description }),
    systemPrompt: writer.systemPrompt,
    ...(writer.systemPromptName === undefined
      ? {}
      : { systemPromptName: writer.systemPromptName }),
    messages: writer.messages,
    metadata: writer.metadata,
  })
}
export class WriterStore {
  private state: State = {
    writers: [],
    catalog: [],
    busy: false,
    error: '',
    tab: 'prompts',
    editing: false,
  }
  private listeners = new Set<() => void>()
  constructor(
    readonly api: Api,
    private readonly remember: (id: string | undefined, tab: State['tab']) => void,
  ) {}
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  get dirty() {
    return (
      !!this.state.saved &&
      JSON.stringify(this.state.draft) !==
        JSON.stringify(definition(this.state.saved))
    )
  }
  async load(id?: string, tab: State['tab'] = this.state.tab) {
    await this.perform(async () => {
      const [writers, catalog] = await Promise.all([
        this.api.call('list', {}),
        this.api.call('catalog', {}),
      ])
      this.set({ writers, catalog, tab })
      this.accept(writers.find((writer) => writer.id === id) ?? writers[0])
    })
  }
  private accept(writer: Writer | undefined, editing = false) {
    this.set({ saved: writer, draft: writer && definition(writer), error: '', editing })
    this.remember(writer?.id, this.state.tab)
  }
  beginEditing() {
    if (!this.state.busy && this.state.saved)
      this.set({ editing: true })
  }
  exitEditing() {
    this.request(() => this.set({ editing: false }))
  }
  edit(patch: Partial<WriterDefinition>) {
    if (
      !this.state.editing && (
        'systemPrompt' in patch || 'systemPromptName' in patch || 'messages' in patch
      )
    ) return
    if (!this.state.busy && this.state.draft)
      this.set({ draft: { ...this.state.draft, ...patch }, error: '' })
  }
  tab(tab: State['tab']) {
    if (tab === this.state.tab) return
    this.request(() => {
      this.set({ tab, editing: false })
      if (this.state.saved) this.remember(this.state.saved.id, tab)
    })
  }
  request(action: () => unknown | Promise<unknown>) {
    if (this.state.busy || this.state.pending) return
    if (this.dirty) this.set({ pending: action })
    else void action()
  }
  async choose(choice: 'save' | 'discard' | 'cancel') {
    const action = this.state.pending
    if (!action || this.state.busy) return
    if (choice === 'cancel') {
      this.set({ pending: undefined })
      return
    }
    if (choice === 'save' && !(await this.save())) return
    if (choice === 'discard' && this.state.saved) this.accept(this.state.saved)
    this.set({ pending: undefined })
    await action()
  }
  select(writer: Writer) {
    this.request(() =>
      this.perform(async () =>
        this.accept(await this.api.call('get', { id: writer.id })),
      ),
    )
  }
  async save(): Promise<boolean> {
    const { saved, draft } = this.state
    if (!saved || !draft) return false
    return this.perform(async () => {
      const writer = await this.api.call('update', {
        id: saved.id,
        expectedSequence: saved.sequence,
        definition: draft,
      })
      this.set({
        writers: this.state.writers.map((item) =>
          item.id === writer.id ? writer : item,
        ),
      })
      this.accept(writer, this.state.editing)
    })
  }
  requestCreate(name: string) {
    this.request(() => this.set({ creating: { name, description: '' }, error: '' }))
  }
  requestCopy(suffix: string) {
    this.request(() => {
      const source = this.state.saved
      if (!source) return
      this.set({
        creating: { sourceId: source.id, name: source.name + suffix, description: source.description ?? '' },
        error: '',
      })
    })
  }
  editCreation(patch: { name?: string; description?: string }) {
    if (this.state.creating && !this.state.busy)
      this.set({ creating: { ...this.state.creating, ...patch }, error: '' })
  }
  cancelCreation() {
    if (!this.state.busy) this.set({ creating: undefined, error: '' })
  }
  async confirmCreation(): Promise<boolean> {
    const creating = this.state.creating
    if (!creating || !creating.name.trim()) return false
    return this.perform(async () => {
      const writer = creating.sourceId === undefined
        ? await this.api.call('create', createWriterTemplate(creating.name, creating.description))
        : await this.api.call('copy', {
          id: creating.sourceId, name: creating.name, description: creating.description,
        })
      this.set({ writers: [...this.state.writers, writer], creating: undefined, tab: 'prompts' })
      this.accept(writer)
    })
  }
  requestDelete() {
    this.request(() => {
      this.set({ deleting: this.state.saved })
    })
  }
  cancelDelete() {
    this.set({ deleting: undefined })
  }
  async remove() {
    const writer = this.state.deleting
    if (!writer) return
    await this.perform(async () => {
      await this.api.call('delete', {
        id: writer.id,
        expectedSequence: writer.sequence,
      })
      const writers = this.state.writers.filter((item) => item.id !== writer.id)
      this.set({ writers, deleting: undefined })
      this.accept(writers[0])
    })
  }
  async perform(action: () => unknown | Promise<unknown>): Promise<boolean> {
    if (this.state.busy) return false
    this.set({ busy: true, error: '' })
    try {
      await action()
      return true
    } catch (error) {
      this.set({
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    } finally {
      this.set({ busy: false })
    }
  }
}
