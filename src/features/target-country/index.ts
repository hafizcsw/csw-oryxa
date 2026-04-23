// Public surface for Door 2 (target-country) + Door 3 (measurement-lite + harness)
export * from './types';
export { COUNTRY_PACKS, getPack } from './packs';
export { buildApplicantTruth } from './applicant-normalize';
export type { ApplicantTruth } from './applicant-normalize';
export { computeCountryMatrix } from './engine';
export { FIXTURE_APPLICANT } from './fixture';
// Door 3
export {
  buildMeasurementSnapshot,
  extractTopBlockers,
  MEASUREMENT_VERSION,
} from './measurement';
export type {
  MeasurementSnapshot,
  ClusPayload,
  EiusPayload,
  LpusBasicPayload,
  ProfileTier,
  TopBlocker,
} from './measurement';
export { runHarness } from './harness';
export type { HarnessArtifact, HarnessMode } from './harness';
