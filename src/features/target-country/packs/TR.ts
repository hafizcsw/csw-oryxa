// ═══════════════════════════════════════════════════════════════
// Country-11 — Türkiye (TR)
// ═══════════════════════════════════════════════════════════════
// Door 3 extensibility proof: added DATA-ONLY.
// No schema changes. No application code changes.
// No rule-engine logic changes. Only a new pack object + 1 entry
// in COUNTRY_PACKS map + CountryCode union literal.
// ═══════════════════════════════════════════════════════════════
import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const TR_PACK = makeProfile({
  country_code: 'TR' as any, // proof: type union extended in types.ts only
  country_name_en: 'Türkiye',
  primary_local_language: 'tr',
  english_taught_widely_available: true,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'TR.yok.intl',
      source_type: 'official_ministry',
      url: 'https://www.yok.gov.tr/en/international-students',
      title: 'YÖK — Council of Higher Education, international students',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'TR.studyinturkiye',
      source_type: 'official_gov',
      url: 'https://www.studyinturkiye.gov.tr/',
      title: 'Study in Türkiye — official portal',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'TR.yos',
      source_type: 'official_university_assoc',
      url: 'https://www.studyinturkiye.gov.tr/admission-yos',
      title: 'YÖS — Foreign Student Examination',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('TR.path.foundation', 'foundation', true, {
      notes: 'Turkish-language preparation year (Hazırlık) when local-language program chosen.',
      evidence_ids: ['TR.studyinturkiye'],
    }),
    makePathway('TR.path.bridging', 'bridging', true, {
      notes: 'English/Turkish pre-sessional preparation programs.',
      evidence_ids: ['TR.studyinturkiye'],
    }),
    makePathway('TR.path.short_cycle', 'short_cycle', true, {
      notes: '2-year associate (Önlisans) programs available to international students.',
      evidence_ids: ['TR.yok.intl'],
    }),
    makePathway('TR.path.bachelor_entry', 'bachelor_entry', true, {
      min_secondary_grade_pct: 50,
      accepted_secondary_kinds: ['general', 'vocational', 'technical'],
      notes: 'Direct entry typically via YÖS or accepted equivalents (SAT, etc.).',
      evidence_ids: ['TR.yos', 'TR.yok.intl'],
    }),
  ],
  language_rules: [
    makeLangRule('TR.lang.turkish.bachelor', {
      language: 'local',
      local_language_code: 'tr',
      english_test_min: null,
      local_test_min: { test_name: 'TÖMER', level_or_score: 'C1' },
      applies_to_paths: ['bachelor_entry'],
      evidence_ids: ['TR.studyinturkiye'],
    }),
    makeLangRule('TR.lang.english.intl', {
      language: 'english',
      english_test_min: { ielts: 6.0, toefl_ibt: 79 },
      applies_to_paths: ['bachelor_entry', 'foundation', 'bridging', 'short_cycle'],
      exemption_basis: ['english_medium_secondary'],
      evidence_ids: ['TR.yok.intl'],
      local_test_min: undefined,
    }),
  ],
  document_rules: [
    makeDocRule('TR.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'tr',
      must_be_legalized: true,
      applies_to_paths: ['foundation', 'bridging', 'short_cycle', 'bachelor_entry'],
      evidence_ids: ['TR.yok.intl'],
    }),
    makeDocRule('TR.doc.passport', {
      required_document: 'passport',
      applies_to_paths: ['foundation', 'bridging', 'short_cycle', 'bachelor_entry'],
      evidence_ids: ['TR.yok.intl'],
    }),
  ],
});
