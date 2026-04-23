import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const CH_PACK = makeProfile({
  country_code: 'CH',
  country_name_en: 'Switzerland',
  primary_local_language: 'de',
  english_taught_widely_available: false,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'CH.swissuniversities.recognition',
      source_type: 'official_university_assoc',
      url: 'https://www.swissuniversities.ch/en/topics/studying/recognition-of-foreign-qualifications',
      title: 'swissuniversities — recognition of foreign secondary qualifications',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'CH.swissuniversities.intl',
      source_type: 'official_university_assoc',
      url: 'https://www.swissuniversities.ch/en/topics/studying/international-students',
      title: 'swissuniversities — international students entry conditions',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('CH.path.foundation', 'foundation', true, {
      notes: 'Passerelle / preparatory year required for many non-EU secondary diplomas.',
      evidence_ids: ['CH.swissuniversities.recognition'],
    }),
    makePathway('CH.path.bridging', 'bridging', true, {
      notes: 'Local-language preparation (DE/FR/IT) typically required.',
      evidence_ids: ['CH.swissuniversities.intl'],
    }),
    makePathway('CH.path.short_cycle', 'short_cycle', false, {
      notes: 'No general international short-cycle entry.',
      evidence_ids: ['CH.swissuniversities.intl'],
    }),
    makePathway('CH.path.bachelor_entry', 'bachelor_entry', true, {
      min_secondary_grade_pct: 75,
      accepted_secondary_kinds: ['general'],
      notes: 'Strict recognition list per canton/university; many non-EU certs need top-up exam.',
      evidence_ids: ['CH.swissuniversities.recognition'],
    }),
  ],
  language_rules: [
    makeLangRule('CH.lang.de.bachelor', {
      language: 'local',
      local_language_code: 'de',
      english_test_min: null,
      local_test_min: { test_name: 'Goethe/TestDaF', level_or_score: 'C1 / TDN 4' },
      applies_to_paths: ['bachelor_entry'],
      evidence_ids: ['CH.swissuniversities.intl'],
    }),
    makeLangRule('CH.lang.en.intl', {
      language: 'english',
      english_test_min: { ielts: 6.5, toefl_ibt: 88 },
      applies_to_paths: ['bachelor_entry'],
      exemption_basis: ['english_medium_secondary'],
      evidence_ids: ['CH.swissuniversities.intl'],
    }),
  ],
  document_rules: [
    makeDocRule('CH.doc.recognition', {
      required_document: 'recognition_statement',
      applies_to_paths: ['bachelor_entry'],
      evidence_ids: ['CH.swissuniversities.recognition'],
    }),
    makeDocRule('CH.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'de',
      must_be_legalized: true,
      applies_to_paths: ['foundation', 'bridging', 'bachelor_entry'],
      evidence_ids: ['CH.swissuniversities.recognition'],
    }),
  ],
});
