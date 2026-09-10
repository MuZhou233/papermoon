/** PaperMoon's closed Note classification and lifecycle vocabulary. */
export const AGENT_NOTE_CLASSES = ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing'] as const
export const NOTE_STATES = ['proposed', 'implemented', 'rejected'] as const
export type NoteState = typeof NOTE_STATES[number]
export const noteHeadings: Record<NoteState, string[]> = {
  proposed: ['Problem', 'Proposal', 'Alternatives considered', 'Acceptance criteria', 'Risks'],
  implemented: ['Problem', 'Decision', 'Alternatives considered', 'Consequences'],
  rejected: ['Problem', 'Proposal', 'Alternatives considered'],
}
export const chineseHeadings: Record<string, string> = {
  Problem: '问题', Proposal: '方案', 'Alternatives considered': '考虑过的替代方案',
  'Acceptance criteria': '验收条件', Risks: '风险', Decision: '决定', Consequences: '影响',
}
