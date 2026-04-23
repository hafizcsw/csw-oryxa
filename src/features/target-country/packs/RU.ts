import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const RU_PACK = makeProfile({
  country_code: 'RU',
  country_name_en: 'Russia',
  primary_local_language: 'ru',
  english_taught_widely_available: true,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'RU.studyinrussia.intl',
      source_type: 'official_gov',
      url: 'https://studyinrussia.ru/en/',
      title: 'Study in Russia — official portal for international students',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'RU.minobr.preparatory',
      source_type: 'official_ministry',
      url: 'https://studyinrussia.ru/en/study-in-russia/info/preparatory/',
      title: 'Preparatory faculty (подфак) — Russian-language prep year',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('RU.path.foundation', 'foundation', true, {
      notes: 'Подготовительный факультет (preparatory faculty) — 1 year, near-universal.',
      evidence_ids: ['RU.minobr.preparatory'],
    }),
    makePathway('RU.path.bridging', 'bridging', true, {
      notes: 'Russian-language bridging integrated into preparatory year.',
      evidence_ids: ['RU.minobr.preparatory'],
    }),
    makePathway('RU.path.short_cycle', 'short_cycle', true, {
      notes: 'СПО (среднее профессиональное образование) accessible to internationals at some institutions.',
      evidence_ids: ['RU.studyinrussia.intl'],
    }),
    makePathway('RU.path.bachelor_entry', 'bachelor_entry', true, {
      accepted_secondary_kinds: ['general', 'vocational', 'technical'],
      evidence_ids: ['RU.studyinrussia.intl'],
    }),
  ],
  language_rules: [
    makeLangRule('RU.lang.ru.bachelor', {
      language: 'local',
      local_language_code: 'ru',
      english_test_min: null,
      local_test_min: { test_name: 'TORFL', level_or_score: 'B1 (TRKI-1)' },
      applies_to_paths: ['bachelor_entry'],
      evidence_ids: ['RU.studyinrussia.intl'],
    }),
    makeLangRule('RU.lang.en.intl', {
      language: 'english',
      english_test_min: { ielts: 5.5, toefl_ibt: 70 },
      applies_to_paths: ['bachelor_entry'],
      exemption_basis: ['english_medium_secondary'],
      evidence_ids: ['RU.studyinrussia.intl'],
    }),
  ],
  document_rules: [
    makeDocRule('RU.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'ru',
      must_be_legalized: true,
      applies_to_paths: ['foundation', 'bridging', 'short_cycle', 'bachelor_entry'],
      evidence_ids: ['RU.studyinrussia.intl'],
    }),
    makeDocRule('RU.doc.passport', {
      required_document: 'passport',
      applies_to_paths: ['foundation', 'bridging', 'short_cycle', 'bachelor_entry'],
      evidence_ids: ['RU.studyinrussia.intl'],
    }),
  ],
});
