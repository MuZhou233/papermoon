/** Frozen compiler data and per-invocation JSON messages. */
import type { JsonObject, JsonValue } from '@papermoon/story-core'
export type { JsonObject, JsonValue }
export type Schema = Record<string, JsonValue>
export interface OpeningMessage { readonly role: 'user' | 'assistant'; readonly name?: string; readonly content: string }
export interface OpeningContext { readonly systemPrompt: string; readonly systemPromptName?: string; readonly messages: readonly OpeningMessage[] }
export interface Diagnostic {
  code: string
  stage: 'input' | 'parse' | 'load' | 'evaluate' | 'declaration' | 'execution'
  message: string
  location?: { path?: string; line?: number; column?: number; field?: string; key?: string; language?: string }
  chain?: string[]
}
export interface Limits { inputBytes: number; modules: number; outputBytes: number; executionMs: number; totalMs: number; concurrency: number; memoryMb: number }
export interface CompileOptions { entry?: string; language?: string; limits?: Partial<Limits> }
export interface ResolvedOptions { entry: string; language: string; limits: Limits }
export interface FunctionDeclaration {
  readonly name: string
  readonly description: string
  readonly parameters: Schema
  readonly output: Schema
  readonly arguments: readonly string[]
  readonly factoryHash: string
  readonly functionHash: string
  readonly location: { path: string; line: number; column: number }
}
export interface StateDeclaration { readonly initial: JsonObject; readonly schema: Schema }
export interface ProgramBundle { readonly files: Record<string, string>; readonly texts: Record<string, string | null> }
export interface Artifact {
  readonly format: 'papermoon.story'
  readonly version: 2
  readonly apiVersion: 2
  readonly compiler: 'papermoon.commonjs/2'
  readonly id: string
  readonly sourceHash: string
  readonly options: ResolvedOptions
  readonly context: OpeningContext
  readonly state: StateDeclaration
  readonly functions: readonly FunctionDeclaration[]
  readonly program: ProgramBundle
  readonly checksum: string
}
export type CompileResult = { ok: true; artifact: Artifact; diagnostics: Diagnostic[] } | { ok: false; failure: 'script' | 'operation'; diagnostics: Diagnostic[] }
export interface Invocation { state: JsonObject; name: string; args: JsonObject; artifact: Pick<Artifact, 'context' | 'state' | 'functions'> }
export interface WorkerInput extends ProgramBundle { options: ResolvedOptions; invocation?: Invocation }
export interface FunctionSource { name: string; factory: string; implementation: string }
export interface EvaluatedDeclaration { context: OpeningContext; state: StateDeclaration; functions: FunctionSource[] }
export interface CompiledDeclaration { context: OpeningContext; state: StateDeclaration; functions: readonly FunctionDeclaration[]; program: ProgramBundle }
export type InvocationResult = { ok: true; state: JsonObject; value: JsonValue } | { ok: false; failure: 'script' | 'operation'; diagnostics: Diagnostic[] }
export type WorkerResult = { ok: true; compiled: CompiledDeclaration } | { ok: true; state: JsonObject; value: JsonValue } | { ok: false; diagnostic: Diagnostic }
