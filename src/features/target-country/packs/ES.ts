import { makeProfile, makePathway, makeLangRule, makeDocRule, makeEvidence } from '../pack-helpers';

export const ES_PACK = makeProfile({
  country_code: 'ES',
  country_name_en: 'Spain',
  primary_local_language: 'es',
  english_taught_widely_available: false,
  pack_version: '2026.04-v1',
  evidence: [
    makeEvidence({
      evidence_id: 'ES.uned.acceso',
      source_type: 'official_university_assoc',
      url: 'https://accesoextranjeros.uned.es/',
      title: 'UNED — Acceso para estudiantes internacionales (UNEDasiss)',
      observed_year: 2024,
    }),
    makeEvidence({
      evidence_id: 'ES.educacion.homologacion',
      source_type: 'official_ministry',
      url: 'https://www.educacionfpydeportes.gob.es/servicios-al-ciudadano/catalogo/gestion-titulos/estudios-no-universitarios/titulos-extranjeros.html',
      title: 'Ministerio de Educación — homologación de títulos no universitarios',
      observed_year: 2024,
    }),
  ],
  pathways: [
    makePathway('ES.path.foundation', 'foundation', false, {
      notes: 'Foundation year not a standard route; UNEDasiss + EBAU/PCE used instead.',
      evidence_ids: ['ES.uned.acceso'],
    }),
    makePathway('ES.path.bridging', 'bridging', true, {
      notes: 'Spanish-language preparation through Instituto Cervantes / university courses.',
      evidence_ids: ['ES.uned.acceso'],
    }),
    makePathway('ES.path.short_cycle', 'short_cycle', true, {
      notes: 'Ciclos Formativos de Grado Superior (CFGS) — 2-year vocational HE.',
      evidence_ids: ['ES.educacion.homologacion'],
    }),
    makePathway('ES.path.bachelor_entry', 'bachelor_entry', true, {
      min_secondary_grade_pct: 60,
      accepted_secondary_kinds: ['general'],
      notes: 'Requires homologación + UNEDasiss credencial; PCE may be needed for selective programmes.',
      evidence_ids: ['ES.uned.acceso', 'ES.educacion.homologacion'],
    }),
  ],
  language_rules: [
    makeLangRule('ES.lang.es.bachelor', {
      language: 'local',
      local_language_code: 'es',
      english_test_min: null,
      local_test_min: { test_name: 'DELE', level_or_score: 'B2' },
      applies_to_paths: ['bachelor_entry', 'short_cycle'],
      evidence_ids: ['ES.uned.acceso'],
    }),
    makeLangRule('ES.lang.en.intl', {
      language: 'english',
      english_test_min: { ielts: 6.0, toefl_ibt: 80 },
      applies_to_paths: ['bachelor_entry'],
      exemption_basis: ['english_medium_secondary'],
      evidence_ids: ['ES.uned.acceso'],
    }),
  ],
  document_rules: [
    makeDocRule('ES.doc.recognition', {
      required_document: 'recognition_statement',
      applies_to_paths: ['bachelor_entry', 'short_cycle'],
      evidence_ids: ['ES.educacion.homologacion'],
    }),
    makeDocRule('ES.doc.transcript', {
      required_document: 'transcript',
      must_be_translated_to: 'es',
      must_be_legalized: true,
      applies_to_paths: ['short_cycle', 'bachelor_entry'],
      evidence_ids: ['ES.uned.acceso'],
    }),
  ],
});
