// ═══════════════════════════════════════════════════════════════
// Foundation — Truth Model & Processing States (official, V1)
// ═══════════════════════════════════════════════════════════════
// Truth states are FOUR mutually exclusive surfaces:
//   - extracted     : machine produced a value from the document
//   - proposed      : engine suggests a value but it is NOT truth yet
//   - verified      : a human (or a strict gate) confirmed the value
//   - missing       : nothing was produced, and that is admitted
// And one orthogonal flag:
//   - needs_review  : human attention required (does not imply truth)
//
// CRITICAL: 'extracted' MUST NEVER be displayed to the student as
// "verified". UI surfaces must read truth_state directly.
// ═══════════════════════════════════════════════════════════════

export type TruthState =
  | 'extracted'
  | 'proposed'
  | 'verified'
  | 'missing'
  | 'needs_review';

export const ALL_TRUTH_STATES: TruthState[] = [
  'extracted',
  'proposed',
  'verified',
  'missing',
  'needs_review',
];

/** Lifecycle of the document itself, independent of its field-level truth. */
export type ProcessingState =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'extracted'
  | 'needs_review'
  | 'verified'
  | 'failed';

export const ALL_PROCESSING_STATES: ProcessingState[] = [
  'uploaded',
  'queued',
  'processing',
  'extracted',
  'needs_review',
  'verified',
  'failed',
];

/** Hard guard: prevent silently mixing truth surfaces in code. */
export function assertTruthState(s: string): TruthState {
  if (!(ALL_TRUTH_STATES as string[]).includes(s)) {
    throw new Error(`[truth-model] invalid truth_state: ${s}`);
  }
  return s as TruthState;
}

export function assertProcessingState(s: string): ProcessingState {
  if (!(ALL_PROCESSING_STATES as string[]).includes(s)) {
    throw new Error(`[truth-model] invalid processing_state: ${s}`);
  }
  return s as ProcessingState;
}
