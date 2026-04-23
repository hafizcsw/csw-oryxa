import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const IT_PACK = makeProfile({
  country_code: 'IT',
  country_name_en: 'Italy',
  primary_local_language: 'it',
  english_taught_widely_available: true,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'IT.universitaly.intl',
      source_type: 'official_gov',
      url: 'https://www.universitaly.it/index.php/students/stranieri',
      title: 'Universitaly — international student admission to Italian HE',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'IT.miur.dichvalore',
      source_type: 'official_ministry',
      url: 'https://www.studiare-in-italia.it/studentistranieri/',
      title: 'MIUR — Dichiarazione di Valore / CIMEA statements',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('IT.path.foundation', 'foundation', true, {
      notes: 'Foundation/Marco Polo year for students with <12 years of schooling.',
      evidence_ids: ['IT.universitaly.intl'],
    }),
    makePathway('IT.path.bridging', 'bridging', true, {
      notes: 'Italian-language preparatory courses required when secondary <12 years.',
      evidence_ids: ['IT.miur.dichvalore'],
    }),
    makePathway('IT.path.short_cycle', 'short_cycle', true, {
      notes: 'ITS (Istituti Tecnologici Superiori) — 2-year tertiary, limited intl access.',
      evidence_ids: ['IT.universitaly.intl'],
    }),
    makePathway('IT.path.bachelor_entry', 'bachelor_entry', true, {
      min_secondary_grade_pct: 60,
      accepted_secondary_kinds: ['general'],
      notes: 'Requires CIMEA statement of comparability + 12-year schooling or foundation.',
      evidence_ids: ['IT.miur.dichvalore'],
    }),
  ],
  language_rules: [
    makeLangRule('IT.lang.it.bachelor', {
      language: 'local',
      local_language_code: 'it',
      english_test_min: null,
      local_test_min: { test_name: 'CILS/CELI', level_or_score: 'B2' },
      applies_to_paths: ['bachelor_entry'],
      evidence_ids: ['IT.universitaly.intl'],
    }),
    makeLangRule('IT.lang.en.intl', {
      language: 'english',
      english_test_min: { ielts: 6.0, toefl_ibt: 80 },
      applies_to_paths: ['bachelor_entry'],
      exemption_basis: ['english_medium_secondary'],
      evidence_ids: ['IT.universitaly.intl'],
    }),
  ],
  document_rules: [
    makeDocRule('IT.doc.recognition', {
      required_document: 'recognition_statement',
      applies_to_paths: ['bachelor_entry'],
      evidence_ids: ['IT.miur.dichvalore'],
    }),
    makeDocRule('IT.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'it',
      must_be_legalized: true,
      applies_to_paths: ['foundation', 'bridging', 'bachelor_entry'],
      evidence_ids: ['IT.universitaly.intl'],
    }),
  ],
});
