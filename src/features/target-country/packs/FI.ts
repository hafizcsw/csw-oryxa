import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const FI_PACK = makeProfile({
  country_code: 'FI',
  country_name_en: 'Finland',
  primary_local_language: 'fi',
  english_taught_widely_available: true,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'FI.studyinfinland.intl',
      source_type: 'official_gov',
      url: 'https://www.studyinfinland.fi/admissions',
      title: 'Study in Finland — admissions for international students',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'FI.oph.recognition',
      source_type: 'official_ministry',
      url: 'https://www.oph.fi/en/services/recognition-qualifications-finland',
      title: 'Finnish National Agency for Education — recognition of qualifications',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('FI.path.foundation', 'foundation', false, {
      notes: 'No general international foundation programme; entrance exam / SAT used instead.',
      evidence_ids: ['FI.studyinfinland.intl'],
    }),
    makePathway('FI.path.bridging', 'bridging', false, {
      notes: 'No standard bridging route for English-taught bachelors.',
      evidence_ids: ['FI.studyinfinland.intl'],
    }),
    makePathway('FI.path.short_cycle', 'short_cycle', true, {
      notes: 'UAS (ammattikorkeakoulu) bachelor degrees are applied/short-cycle in spirit.',
      evidence_ids: ['FI.studyinfinland.intl'],
    }),
    makePathway('FI.path.bachelor_entry', 'bachelor_entry', true, {
      min_secondary_grade_pct: 60,
      accepted_secondary_kinds: ['general'],
      notes: 'Entry via entrance exam + secondary certificate recognized by EDUFI.',
      evidence_ids: ['FI.studyinfinland.intl', 'FI.oph.recognition'],
    }),
  ],
  language_rules: [
    makeLangRule('FI.lang.en.bachelor', {
      language: 'english',
      english_test_min: { ielts: 6.0, toefl_ibt: 79, pte: 53 },
      applies_to_paths: ['bachelor_entry', 'short_cycle'],
      exemption_basis: ['english_medium_secondary'],
      evidence_ids: ['FI.studyinfinland.intl'],
    }),
    makeLangRule('FI.lang.fi.bachelor', {
      language: 'local',
      local_language_code: 'fi',
      english_test_min: null,
      local_test_min: { test_name: 'YKI', level_or_score: 'Level 4' },
      applies_to_paths: ['bachelor_entry'],
      evidence_ids: ['FI.studyinfinland.intl'],
    }),
  ],
  document_rules: [
    makeDocRule('FI.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'en',
      applies_to_paths: ['short_cycle', 'bachelor_entry'],
      evidence_ids: ['FI.studyinfinland.intl'],
    }),
    makeDocRule('FI.doc.passport', {
      required_document: 'passport',
      applies_to_paths: ['short_cycle', 'bachelor_entry'],
      evidence_ids: ['FI.studyinfinland.intl'],
    }),
  ],
});
