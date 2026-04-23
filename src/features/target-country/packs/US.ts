import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const US_PACK = makeProfile({
  country_code: 'US',
  country_name_en: 'United States',
  primary_local_language: 'en',
  english_taught_widely_available: true,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'US.educationusa.undergrad',
      source_type: 'official_gov',
      url: 'https://educationusa.state.gov/your-5-steps-us-study/research-your-options/undergraduate',
      title: 'EducationUSA — Undergraduate study',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'US.nces.communitycollege',
      source_type: 'official_gov',
      url: 'https://nces.ed.gov/programs/coe/indicator/cha',
      title: 'NCES — Community colleges (associate/short-cycle)',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('US.path.foundation', 'foundation', true, {
      notes: 'Pathway/INTO/Shorelight programs at many universities.',
      evidence_ids: ['US.educationusa.undergrad'],
    }),
    makePathway('US.path.bridging', 'bridging', true, {
      notes: 'Conditional admission with intensive English (IEP) common.',
      evidence_ids: ['US.educationusa.undergrad'],
    }),
    makePathway('US.path.short_cycle', 'short_cycle', true, {
      notes: 'Community college 2-year associate degree, transfer-friendly.',
      evidence_ids: ['US.nces.communitycollege'],
    }),
    makePathway('US.path.bachelor_entry', 'bachelor_entry', true, {
      accepted_secondary_kinds: ['general'],
      notes: 'Direct freshman admission requires holistic file; selectivity varies widely.',
      evidence_ids: ['US.educationusa.undergrad'],
    }),
  ],
  language_rules: [
    makeLangRule('US.lang.english.bachelor', {
      language: 'english',
      english_test_min: { toefl_ibt: 71, ielts: 6.0, duolingo: 100 },
      applies_to_paths: ['bachelor_entry'],
      exemption_basis: ['english_medium_secondary', 'majority_english_country'],
      evidence_ids: ['US.educationusa.undergrad'],
    }),
    makeLangRule('US.lang.english.lower', {
      language: 'english',
      english_test_min: { toefl_ibt: 45, ielts: 4.5, duolingo: 75 },
      applies_to_paths: ['foundation', 'bridging', 'short_cycle'],
      exemption_basis: ['english_medium_secondary', 'conditional_admission'],
      evidence_ids: ['US.educationusa.undergrad'],
    }),
  ],
  document_rules: [
    makeDocRule('US.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'en',
      applies_to_paths: ['foundation', 'bridging', 'short_cycle', 'bachelor_entry'],
      evidence_ids: ['US.educationusa.undergrad'],
    }),
    makeDocRule('US.doc.passport', {
      required_document: 'passport',
      applies_to_paths: ['foundation', 'bridging', 'short_cycle', 'bachelor_entry'],
      evidence_ids: ['US.educationusa.undergrad'],
    }),
  ],
});
