/** Writer-specific services extend the shared playbook-session host face. */
export type { Host, Agent, Dispose, InputMessage, Decision, Workspace } from '../../playbook-workspaces/src/host.ts'
export interface Services {
  core: import('@papermoon/playbook-core/repository').PlaybookRepository
  writers: import('../../writers/src/repository.ts').WriterRepository
  compiler?: import('@papermoon/playbook-compiler/service').CompilationService
}
