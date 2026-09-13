/** Authored initialization contains literal text, not executable runtime values. */
export interface OpeningMessage { readonly role: 'user' | 'assistant'; readonly name?: string; readonly content: string }
export interface OpeningContext {
  readonly systemPrompt: string
  readonly systemPromptName?: string
  readonly messages: readonly OpeningMessage[]
}
export interface Diagnostic {
  code: string
  stage: 'input' | 'parse' | 'load' | 'evaluate' | 'declaration' | 'execution'
  message: string
  location?: { path?: string; line?: number; column?: number; field?: string; key?: string; language?: string }
  chain?: string[]
}
export interface Limits {
  inputBytes: number
  modules: number
  outputBytes: number
  executionMs: number
  totalMs: number
  concurrency: number
  memoryMb: number
}
export interface CompileOptions { entry?: string; language?: string; limits?: Partial<Limits> }
export interface ResolvedOptions { entry: string; language: string; limits: Limits }
export interface Artifact {
  readonly format: 'papermoon.opening'
  readonly version: 1
  readonly apiVersion: 1
  readonly compiler: 'papermoon.commonjs/1'
  readonly id: string
  readonly sourceHash: string
  readonly options: ResolvedOptions
  readonly context: OpeningContext
  readonly checksum: string
}
export type CompileResult =
  | { ok: true; artifact: Artifact; diagnostics: Diagnostic[] }
  | { ok: false; failure: 'script' | 'operation'; diagnostics: Diagnostic[] }
export interface WorkerInput {
  files: Record<string, string>
  texts: Record<string, string | null>
  options: ResolvedOptions
}
export type WorkerResult = { ok: true; context: OpeningContext } | { ok: false; diagnostic: Diagnostic }
