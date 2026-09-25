import { randomUUID } from 'node:crypto'
import type { AgentOwner, TextConversation, TextConversations } from '../../text-conversations/src/service.ts'
import { exampleEvents, prompt } from './example.ts'
import { Progress, newAttempt, type Attempt } from './state.ts'
import { StoryError } from './errors.ts'
import { en } from './locales.ts'

export const SYSTEM_PROMPT = prompt
export interface StoryHost extends AgentOwner {
  textConversations: TextConversations
  sessionPersistence: { stat(id: string): Promise<unknown | undefined> }
}
export class StoryMode {
  private tail: Promise<unknown> = Promise.resolve()
  private conversation: TextConversation | undefined
  private example: TextConversation | undefined
  private closed = false
  constructor(private readonly host: StoryHost, private readonly progress: Progress) {}
  /** Serialize browser tabs and step changes; a stale attempt can never mutate its replacement. */
  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(() => { if (this.closed) throw new StoryError('disabled'); return task() })
    this.tail = next.catch(() => {})
    return next
  }
  async state(restore = false) {
    let attempt = await this.progress.load()
    if (attempt.sessionId && (restore || this.conversation)) {
      const conversation = await this.practice(attempt)
      const turn = conversation.view().successfulTurn
      if (attempt.step === 4 && turn !== undefined) {
        await conversation.flush()
        attempt = { ...attempt, step: 5, successfulTurn: turn }
        await this.progress.save(attempt)
      }
    }
    if (restore && (attempt.step === 2 || attempt.step === 3)) await this.exampleConversation(attempt)
    return { attempt, conversation: this.conversation?.view(), example: this.example?.view() }
  }
  async act(id: string, action: 'example-seen' | 'trajectory-seen' | 'continue' | 'restart' | 'stop') {
    let attempt = await this.current(id)
    if (action === 'restart') {
      await this.conversation?.dispose()
      await this.example?.dispose()
      this.example = undefined
      this.conversation = undefined
      await this.progress.save(newAttempt())
      return this.state()
    }
    if (action === 'stop') { this.conversation?.stop(); return this.state() }
    if (action === 'example-seen' && attempt.step === 3) attempt = { ...attempt, exampleSeen: true }
    else if (action === 'trajectory-seen' && attempt.step === 5) attempt = { ...attempt, trajectorySeen: true }
    else if (action === 'continue') {
      if (attempt.step === 1) {
        if (!(await this.host.textConversations.models()).some(model => model.ready)) throw new StoryError('configurationMissing')
        attempt = { ...attempt, step: 2 }
      } else if (attempt.step === 2) attempt = { ...attempt, step: 3 }
      else if (attempt.step === 3 && attempt.exampleSeen) attempt = { ...attempt, step: 4, sessionId: randomUUID() }
      else if (attempt.step === 5 && attempt.trajectorySeen) attempt = { ...attempt, step: 6 }
      else throw new StoryError('notReady')
    } else throw new StoryError('wrongStep')
    await this.progress.save(attempt)
    return this.state(true)
  }
  private async current(id: string) {
    const attempt = await this.progress.load()
    if (id !== attempt.id) throw new StoryError('staleAttempt')
    return attempt
  }
  private async practice(attempt: Attempt): Promise<TextConversation> {
    if (this.conversation) return this.conversation
    if (!attempt.sessionId) throw new StoryError('practiceNotReady')
    const resume = !!await this.host.sessionPersistence.stat(attempt.sessionId)
    const selected = this.host.textConversations.defaultSelection()
    // Only pin a valid existing selection on creation; never pick another model for the user.
    const model = !resume && selected ? (await this.host.textConversations.models()).find(model => model.ready && model.provider === selected.provider && model.id === selected.model) : undefined
    const validEffort = selected?.reasoningEffort === undefined || !model?.reasoning?.efforts.length || model.reasoning.efforts.some(effort => effort.id === selected.reasoningEffort)
    const choice = model && selected && validEffort
      ? await this.host.textConversations.validate(selected) : undefined
    this.conversation = await this.host.textConversations.open(this.host, {
      id: attempt.sessionId, resume, title: en.practiceTitle, prompt: SYSTEM_PROMPT, choice,
      native: { readOnly: false, beforePrompt: () => this.run(async () => {
        const current = (await this.state()).attempt
        if (current.id !== attempt.id || current.step < 4) throw new StoryError('cannotSend')
        const selection = this.conversation?.selected()
        if (!selection) throw new StoryError('configurationMissing')
        await this.host.textConversations.validate(selection)
      }) },
    })
    return this.conversation
  }
  private async exampleConversation(attempt: Attempt): Promise<TextConversation> {
    if (this.example) return this.example
    this.example = await this.host.textConversations.open(this.host, {
      id: attempt.id, resume: !!await this.host.sessionPersistence.stat(attempt.id), title: en.exampleTitle, prompt: SYSTEM_PROMPT,
      native: { readOnly: true }, seed: exampleEvents,
    })
    return this.example
  }
  async dispose() {
    this.closed = true
    this.conversation?.stop()
    await this.tail
    await this.conversation?.dispose()
    await this.example?.dispose()
  }
}
