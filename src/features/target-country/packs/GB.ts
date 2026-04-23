import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const GB_PACK = makeProfile({
  country_code: 'GB',
  country_name_en: 'United Kingdom',
  primary_local_language: 'en',
  english_taught_widely_available: true,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'GB.ukcisa.qualifications',
      source_type: 'recognized_third_party',
      url: 'https://www.ukcisa.org.uk/Information--Advice/Studying--living-in-the-UK/Qualifications-needed',
      title: 'UKCISA — qualifications needed for UK higher education',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'GB.ukvi.english',
      source_type: 'official_gov',
      url: 'https://www.gov.uk/student-visa/knowledge-of-english',
      title: 'UK Student visa — knowledge of English',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'GB.ucas.foundation',
      source_type: 'recognized_third_party',
      url: 'https://www.ucas.com/undergraduate/what-and-where-study/types-undergraduate-courses/foundation-years',
      title: 'UCAS — Foundation years overview',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('GB.path.foundation', 'foundation', true, {
      notes: 'International foundation year widely offered for non-UK secondary holders.',
      evidence_ids: ['GB.ucas.foundation'],
    }),
    makePathway('GB.path.bridging', 'bridging', true, {
      notes: 'Pre-sessional English / academic bridging at most universities.',
      evidence_ids: ['GB.ukvi.english'],
    }),
    makePathway('GB.path.short_cycle', 'short_cycle', true, {
      notes: 'HND / Foundation Degree (level 4–5) accept international applicants.',
      evidence_ids: ['GB.ukcisa.qualifications'],
    }),
    makePathway('GB.path.bachelor_entry', 'bachelor_entry', true, {
      min_secondary_grade_pct: 70,
      accepted_secondary_kinds: ['general'],
      notes: 'Direct entry typical for strong general secondary; vocational often routed to foundation.',
      evidence_ids: ['GB.ukcisa.qualifications'],
    }),
  ],
  language_rules: [
    makeLangRule('GB.lang.english.bachelor', {
      language: 'english',
      english_test_min: { ielts: 6.0, toefl_ibt: 78, duolingo: 105, pte: 59 },
      local_test_min: undefined,
      applies_to_paths: ['bachelor_entry'],
      exemption_basis: ['english_medium_secondary', 'majority_english_country'],
      evidence_ids: ['GB.ukvi.english'],
    }),
    makeLangRule('GB.lang.english.foundation', {
      language: 'english',
      english_test_min: { ielts: 5.0, toefl_ibt: 60, duolingo: 90, pte: 42 },
      applies_to_paths: ['foundation', 'bridging', 'short_cycle'],
      exemption_basis: ['english_medium_secondary'],
      evidence_ids: ['GB.ukvi.english'],
    }),
  ],
  document_rules: [
    makeDocRule('GB.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'en',
      applies_to_paths: ['foundation', 'bridging', 'short_cycle', 'bachelor_entry'],
      evidence_ids: ['GB.ukcisa.qualifications'],
    }),
    makeDocRule('GB.doc.passport', {
      required_document: 'passport',
      applies_to_paths: ['foundation', 'bridging', 'short_cycle', 'bachelor_entry'],
      evidence_ids: ['GB.ukvi.english'],
    }),
  ],
});
