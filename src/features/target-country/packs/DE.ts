import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const DE_PACK = makeProfile({
  country_code: 'DE',
  country_name_en: 'Germany',
  primary_local_language: 'de',
  english_taught_widely_available: false,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'DE.anabin.kmk',
      source_type: 'official_ministry',
      url: 'https://anabin.kmk.org/anabin.html',
      title: 'KMK Anabin — recognition of foreign secondary qualifications',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'DE.daad.studienkolleg',
      source_type: 'recognized_third_party',
      url: 'https://www.daad.de/en/study-and-research-in-germany/plan-your-studies/requirements/',
      title: 'DAAD — Studienkolleg / direct entry requirements',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'DE.daad.english',
      source_type: 'recognized_third_party',
      url: 'https://www.daad.de/en/study-and-research-in-germany/plan-your-studies/international-programmes/',
      title: 'DAAD — international (English-taught) programmes',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('DE.path.foundation', 'foundation', true, {
      notes: 'Studienkolleg required when secondary cert not directly recognized (Anabin).',
      evidence_ids: ['DE.anabin.kmk', 'DE.daad.studienkolleg'],
    }),
    makePathway('DE.path.bridging', 'bridging', true, {
      notes: 'German pre-sessional / DSH-Vorbereitung courses.',
      evidence_ids: ['DE.daad.studienkolleg'],
    }),
    makePathway('DE.path.short_cycle', 'short_cycle', false, {
      notes: 'No widely-available short-cycle international entry equivalent at university level.',
      evidence_ids: ['DE.daad.studienkolleg'],
    }),
    makePathway('DE.path.bachelor_entry', 'bachelor_entry', true, {
      min_secondary_grade_pct: 70,
      accepted_secondary_kinds: ['general'],
      notes: 'Direct entry only when secondary qualification is recognized in Anabin.',
      evidence_ids: ['DE.anabin.kmk'],
    }),
  ],
  language_rules: [
    makeLangRule('DE.lang.german.bachelor', {
      language: 'local',
      local_language_code: 'de',
      english_test_min: null,
      local_test_min: { test_name: 'TestDaF/DSH', level_or_score: 'TDN 4 / DSH-2' },
      applies_to_paths: ['bachelor_entry'],
      evidence_ids: ['DE.daad.studienkolleg'],
    }),
    makeLangRule('DE.lang.english.intl', {
      language: 'english',
      english_test_min: { ielts: 6.5, toefl_ibt: 88 },
      applies_to_paths: ['bachelor_entry', 'foundation', 'bridging'],
      exemption_basis: ['english_medium_secondary'],
      evidence_ids: ['DE.daad.english'],
      local_test_min: undefined,
    }),
  ],
  document_rules: [
    makeDocRule('DE.doc.recognition', {
      required_document: 'recognition_statement',
      applies_to_paths: ['bachelor_entry'],
      evidence_ids: ['DE.anabin.kmk'],
    }),
    makeDocRule('DE.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'de',
      must_be_legalized: true,
      applies_to_paths: ['foundation', 'bridging', 'bachelor_entry'],
      evidence_ids: ['DE.anabin.kmk'],
    }),
  ],
});
