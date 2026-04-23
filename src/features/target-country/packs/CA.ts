import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const CA_PACK = makeProfile({
  country_code: 'CA',
  country_name_en: 'Canada',
  primary_local_language: 'en',
  english_taught_widely_available: true,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'CA.educanada.bachelor',
      source_type: 'official_gov',
      url: 'https://www.educanada.ca/study-plan-etudes/before-avant/index.aspx?lang=eng',
      title: 'EduCanada — Plan your studies',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'CA.colleges.short',
      source_type: 'official_university_assoc',
      url: 'https://www.collegesinstitutes.ca/the-difference/our-network/',
      title: 'Colleges and Institutes Canada — diplomas/associate',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('CA.path.foundation', 'foundation', true, {
      notes: 'University pathway colleges (e.g. ICM, FIC) widely available.',
      evidence_ids: ['CA.educanada.bachelor'],
    }),
    makePathway('CA.path.bridging', 'bridging', true, {
      notes: 'ESL/EAP bridging at most universities and colleges.',
      evidence_ids: ['CA.educanada.bachelor'],
    }),
    makePathway('CA.path.short_cycle', 'short_cycle', true, {
      notes: 'College diplomas (1–3 years) accept international applicants.',
      evidence_ids: ['CA.colleges.short'],
    }),
    makePathway('CA.path.bachelor_entry', 'bachelor_entry', true, {
      min_secondary_grade_pct: 70,
      accepted_secondary_kinds: ['general'],
      evidence_ids: ['CA.educanada.bachelor'],
    }),
  ],
  language_rules: [
    makeLangRule('CA.lang.english.bachelor', {
      language: 'english',
      english_test_min: { ielts: 6.5, toefl_ibt: 86, duolingo: 115 },
      applies_to_paths: ['bachelor_entry'],
      exemption_basis: ['english_medium_secondary', 'majority_english_country'],
      evidence_ids: ['CA.educanada.bachelor'],
    }),
    makeLangRule('CA.lang.english.lower', {
      language: 'english',
      english_test_min: { ielts: 5.5, toefl_ibt: 60, duolingo: 95 },
      applies_to_paths: ['foundation', 'bridging', 'short_cycle'],
      exemption_basis: ['english_medium_secondary'],
      evidence_ids: ['CA.educanada.bachelor'],
    }),
  ],
  document_rules: [
    makeDocRule('CA.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'en',
      applies_to_paths: ['foundation', 'bridging', 'short_cycle', 'bachelor_entry'],
      evidence_ids: ['CA.educanada.bachelor'],
    }),
    makeDocRule('CA.doc.passport', {
      required_document: 'passport',
      applies_to_paths: ['foundation', 'bridging', 'short_cycle', 'bachelor_entry'],
      evidence_ids: ['CA.educanada.bachelor'],
    }),
  ],
});
