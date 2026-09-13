/** Writer-specific services extend the shared script-session host face. */
export type { Host, Agent, Dispose, InputMessage, Decision, Workspace } from '../../story-workspaces/src/host.ts'
export interface Services {
  core: import('@papermoon/story-core/repository').StoryRepository
  writers: import('../../writers/src/repository.ts').WriterRepository
  compiler?: import('@papermoon/story-compiler/service').CompilationService
}
