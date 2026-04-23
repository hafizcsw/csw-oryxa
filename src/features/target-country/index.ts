// Public surface for Door 2 (target-country)
export * from './types';
export { COUNTRY_PACKS, getPack } from './packs';
export { buildApplicantTruth } from './applicant-normalize';
export type { ApplicantTruth } from './applicant-normalize';
export { computeCountryMatrix } from './engine';
export { FIXTURE_APPLICANT } from './fixture';
