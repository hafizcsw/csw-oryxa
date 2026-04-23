import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const CN_PACK = makeProfile({
  country_code: 'CN',
  country_name_en: 'China',
  primary_local_language: 'zh',
  english_taught_widely_available: true,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'CN.csc.intl',
      source_type: 'official_gov',
      url: 'https://www.campuschina.org/',
      title: 'CSC / CampusChina — international student admission',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'CN.moe.intl',
      source_type: 'official_ministry',
      url: 'http://en.moe.gov.cn/',
      title: 'Ministry of Education of the PRC — international students',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('CN.path.foundation', 'foundation', true, {
      notes: 'Chinese-language preparatory year (预科) widely offered.',
      evidence_ids: ['CN.csc.intl'],
    }),
    makePathway('CN.path.bridging', 'bridging', true, {
      notes: 'HSK preparation programmes at host universities.',
      evidence_ids: ['CN.csc.intl'],
    }),
    makePathway('CN.path.short_cycle', 'short_cycle', false, {
      notes: 'Vocational short-cycle generally restricted to domestic students.',
      evidence_ids: ['CN.moe.intl'],
    }),
    makePathway('CN.path.bachelor_entry', 'bachelor_entry', true, {
      accepted_secondary_kinds: ['general'],
      evidence_ids: ['CN.moe.intl'],
    }),
  ],
  language_rules: [
    makeLangRule('CN.lang.zh.bachelor', {
      language: 'local',
      local_language_code: 'zh',
      english_test_min: null,
      local_test_min: { test_name: 'HSK', level_or_score: 'HSK 4 (typical)' },
      applies_to_paths: ['bachelor_entry'],
      evidence_ids: ['CN.csc.intl'],
    }),
    makeLangRule('CN.lang.en.bachelor', {
      language: 'english',
      english_test_min: { ielts: 6.0, toefl_ibt: 80 },
      applies_to_paths: ['bachelor_entry'],
      exemption_basis: ['english_medium_secondary', 'majority_english_country'],
      evidence_ids: ['CN.csc.intl'],
    }),
  ],
  document_rules: [
    makeDocRule('CN.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'zh',
      must_be_legalized: true,
      applies_to_paths: ['foundation', 'bridging', 'bachelor_entry'],
      evidence_ids: ['CN.csc.intl'],
    }),
    makeDocRule('CN.doc.passport', {
      required_document: 'passport',
      applies_to_paths: ['foundation', 'bridging', 'bachelor_entry'],
      evidence_ids: ['CN.csc.intl'],
    }),
  ],
});
