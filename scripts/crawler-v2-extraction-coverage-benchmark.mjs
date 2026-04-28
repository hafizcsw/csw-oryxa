#!/usr/bin/env node

import { writeFileSync } from 'node:fs';

const VERIFICATION_STATEMENT =
  'This extraction coverage benchmark is offline and diagnostic-only. It did not read Supabase, run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility production, CRM automation, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, AI providers, rendering, OCR, PDF extraction, or language/i18n changes.';

const DECISIONS = new Set(['prioritize', 'review', 'reject', 'blocked', 'skip']);
const PRIORITIES = new Set(['high', 'medium', 'low', 'blocked']);
const COST_TIERS = new Set(['low', 'medium', 'high', 'blocked']);

const PRODUCTION_GUARDS = Object.freeze({
  crawler_execution_allowed: false,
  run_all_allowed: false,
  country_crawl_allowed: false,
  publish_allowed: false,
  canonical_writes_allowed: false,
  orx_scoring_allowed: false,
  student_eligibility_production_allowed: false,
  crm_automation_allowed: false,
  render_allowed: false,
  ocr_allowed: false,
  pdf_extraction_allowed: false,
  external_api_allowed: false,
});

const CASES = [
  {
    case_id: 'DISC-001',
    domain: 'Discovery Intelligence',
    input_summary: 'Official university homepage',
    source_type: 'official_homepage_url',
    url_path: '/',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'official homepage anchors domain and run context',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-002',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /admissions page',
    source_type: 'official_url',
    url_path: '/admissions',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'admissions page is a high-value discovery target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-003',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /international/admissions page',
    source_type: 'official_url',
    url_path: '/international/admissions',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'international admissions page is a high-value discovery target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-004',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /programs page',
    source_type: 'official_url',
    url_path: '/programs',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'program listing is a high-value discovery target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-005',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /programmes page',
    source_type: 'official_url',
    url_path: '/programmes',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'programmes listing is a high-value discovery target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-006',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /education/programs page',
    source_type: 'official_url',
    url_path: '/education/programs',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'education program listing is a high-value discovery target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-007',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /tuition-fees page',
    source_type: 'official_url',
    url_path: '/tuition-fees',
    official: true,
    high_impact: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'tuition and fees are high-impact extraction targets',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-008',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /scholarships page',
    source_type: 'official_url',
    url_path: '/scholarships',
    official: true,
    high_impact: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'scholarship information is high-impact for review and student evaluation',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-009',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /accommodation page',
    source_type: 'official_url',
    url_path: '/accommodation',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'accommodation page supports student fit and country/budget risk context',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-010',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /career-services page',
    source_type: 'official_url',
    url_path: '/career-services',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'career services page supports Door 4 and Door 5 evidence discovery',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-011',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /quality-assurance page',
    source_type: 'official_url',
    url_path: '/quality-assurance',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'quality assurance page supports accreditation and quality evidence',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-012',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /annual-report page',
    source_type: 'official_url',
    url_path: '/annual-report',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'annual reports can contain outcome and quality metrics',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-013',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /strategic-plan page',
    source_type: 'official_url',
    url_path: '/strategic-plan',
    official: true,
    important_official_page: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'strategic plans can support future-readiness evidence discovery',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-014',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /sitemap.xml discovery metadata',
    source_type: 'discovery_metadata',
    url_path: '/sitemap.xml',
    official: true,
    discovery_metadata: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'sitemap is discovery metadata, not a content fact source',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-015',
    domain: 'Discovery Intelligence',
    input_summary: 'Official /robots.txt discovery metadata',
    source_type: 'discovery_metadata',
    url_path: '/robots.txt',
    official: true,
    discovery_metadata: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'robots file is discovery and ethics metadata, not a content fact source',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-016',
    domain: 'Discovery Intelligence',
    input_summary: 'Irrelevant official news article',
    source_type: 'official_news_url',
    url_path: '/news/campus-festival',
    official: true,
    irrelevant: true,
    expected_decision: 'skip',
    expected_priority: 'low',
    expected_reason: 'irrelevant news page should not outrank official academic evidence',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-017',
    domain: 'Discovery Intelligence',
    input_summary: 'Official blog page without admissions or program evidence',
    source_type: 'official_blog_url',
    url_path: '/blog/student-life-post',
    official: true,
    irrelevant: true,
    expected_decision: 'skip',
    expected_priority: 'low',
    expected_reason: 'low-value blog content is deprioritized',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-018',
    domain: 'Discovery Intelligence',
    input_summary: 'Social media profile link',
    source_type: 'social_media_url',
    url_path: 'https://social.example/university',
    external: true,
    social: true,
    expected_decision: 'reject',
    expected_priority: 'low',
    expected_reason: 'social links are not trusted content facts by default',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DISC-019',
    domain: 'Discovery Intelligence',
    input_summary: 'Official trusted application portal linked from university admissions page',
    source_type: 'official_linked_external_portal',
    url_path: 'https://apply.vendor.example/university',
    external: true,
    official_link_provenance: true,
    expected_decision: 'review',
    expected_priority: 'medium',
    expected_reason: 'third-party portal requires official link provenance review before trust',
    expected_human_review: true,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-001',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Program name with official source and quote',
    source_type: 'official_program_page',
    field: 'program_name',
    official: true,
    source_present: true,
    quote_present: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'program name is a core program extraction target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-002',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Degree level listed on official program page',
    source_type: 'official_program_page',
    field: 'degree_level',
    official: true,
    source_present: true,
    quote_present: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'degree level is a core program extraction target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-003',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Program field listed on official program page',
    source_type: 'official_program_page',
    field: 'field',
    official: true,
    source_present: true,
    quote_present: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'field supports catalog grouping and student matching',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-004',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Duration listed as two academic years',
    source_type: 'official_program_page',
    field: 'duration',
    official: true,
    source_present: true,
    quote_present: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'duration is a program comparison and student planning target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-005',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Credits and ECTS listed in curriculum block',
    source_type: 'official_program_page',
    field: 'credits_ects',
    official: true,
    source_present: true,
    quote_present: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'credits and ECTS support program structure evidence',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-006',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Tuition value with official source but missing quote',
    source_type: 'official_tuition_page',
    field: 'tuition',
    official: true,
    source_present: true,
    quote_present: false,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'blocked',
    expected_priority: 'blocked',
    expected_reason: 'high-impact tuition value is blocked without source quote',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'DEEP-007',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Deadline value appears ambiguous across intake text',
    source_type: 'official_admissions_page',
    field: 'deadline',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    ambiguous: true,
    extraction_target: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'ambiguous high-impact deadline requires review',
    expected_human_review: true,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-008',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Start date listed on official program page',
    source_type: 'official_program_page',
    field: 'start_date',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'start date is high-impact planning evidence',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-009',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Language of instruction listed in admissions table',
    source_type: 'official_program_page',
    field: 'language_of_instruction',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'language of instruction is high-impact student evaluation evidence',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-010',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'IELTS minimum score listed with source and quote',
    source_type: 'official_admissions_page',
    field: 'ielts',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'IELTS minimum is a high-impact requirement extraction target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-011',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'TOEFL minimum score listed with source and quote',
    source_type: 'official_admissions_page',
    field: 'toefl',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'TOEFL minimum is a high-impact requirement extraction target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-012',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'PTE minimum score listed with source and quote',
    source_type: 'official_admissions_page',
    field: 'pte',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'PTE minimum is a high-impact requirement extraction target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-013',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Duolingo minimum score listed with source and quote',
    source_type: 'official_admissions_page',
    field: 'duolingo',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'Duolingo minimum is a high-impact requirement extraction target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-014',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'CEFR level listed with source and quote',
    source_type: 'official_admissions_page',
    field: 'cefr',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'CEFR level is a high-impact requirement extraction target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-015',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Campus listed on official program page',
    source_type: 'official_program_page',
    field: 'campus',
    official: true,
    source_present: true,
    quote_present: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'campus supports program comparison and student planning',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-016',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Delivery mode listed on official program page',
    source_type: 'official_program_page',
    field: 'delivery_mode',
    official: true,
    source_present: true,
    quote_present: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'delivery mode supports program comparison and fit',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-017',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Apply URL expected but source URL is missing',
    source_type: 'official_admissions_page',
    field: 'apply_url',
    official: true,
    source_present: false,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'blocked',
    expected_priority: 'blocked',
    expected_reason: 'high-impact apply URL is blocked without source URL provenance',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'DEEP-018',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Documents required list on official admissions page',
    source_type: 'official_admissions_page',
    field: 'documents_required',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'required documents are high-impact student evaluation evidence',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-019',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Admission requirements listed in official admissions block',
    source_type: 'official_admissions_page',
    field: 'admission_requirements',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'admission requirements are high-impact extraction targets',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-020',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Scholarship eligibility text with ambiguous wording',
    source_type: 'official_scholarship_page',
    field: 'scholarships',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    ambiguous: true,
    extraction_target: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'ambiguous scholarship evidence requires review',
    expected_human_review: true,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-021',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Career outcomes listed in published outcomes report',
    source_type: 'official_employment_report',
    field: 'career_outcomes',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'career outcomes are high-impact ORX and student-evaluation evidence',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-022',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Curriculum modules listed in official catalog',
    source_type: 'official_catalog_page',
    field: 'curriculum_modules',
    official: true,
    source_present: true,
    quote_present: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'curriculum modules are priority evidence for extraction and ORX signals',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-023',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Learning outcomes listed in official catalog',
    source_type: 'official_catalog_page',
    field: 'learning_outcomes',
    official: true,
    source_present: true,
    quote_present: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'learning outcomes support skills and ORX future-readiness benchmarks',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-024',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Required internship/co-op/capstone listed on program page',
    source_type: 'official_program_page',
    field: 'internship_coop_capstone',
    official: true,
    source_present: true,
    quote_present: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'practical learning evidence is a Door 4 and Door 5 extraction target',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DEEP-025',
    domain: 'Deep Program Extraction Target Coverage',
    input_summary: 'Accreditation listed on official quality page',
    source_type: 'official_accreditation_page',
    field: 'accreditation',
    official: true,
    source_present: true,
    quote_present: true,
    high_impact: true,
    extraction_target: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'accreditation is high-impact evidence requiring provenance',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'PDF-001',
    domain: 'PDF Intelligence Decisioning',
    input_summary: 'Official program catalogue PDF',
    source_type: 'official_pdf',
    artifact_type: 'program_catalogue_pdf',
    official: true,
    high_value_pdf: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'program catalogue PDF is high-value official extraction evidence',
    expected_human_review: false,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'PDF-002',
    domain: 'PDF Intelligence Decisioning',
    input_summary: 'Official tuition table PDF',
    source_type: 'official_pdf',
    artifact_type: 'tuition_table_pdf',
    official: true,
    high_value_pdf: true,
    table_heavy: true,
    high_impact: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'table-heavy tuition PDF is high value but table extraction remains future work',
    expected_human_review: false,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'PDF-003',
    domain: 'PDF Intelligence Decisioning',
    input_summary: 'Official admissions guide PDF',
    source_type: 'official_pdf',
    artifact_type: 'admissions_guide_pdf',
    official: true,
    high_value_pdf: true,
    high_impact: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'admissions guide PDF is high-value requirement evidence',
    expected_human_review: false,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'PDF-004',
    domain: 'PDF Intelligence Decisioning',
    input_summary: 'Official scholarship PDF',
    source_type: 'official_pdf',
    artifact_type: 'scholarship_pdf',
    official: true,
    high_value_pdf: true,
    high_impact: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'scholarship PDF is high-value student planning evidence',
    expected_human_review: false,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'PDF-005',
    domain: 'PDF Intelligence Decisioning',
    input_summary: 'Official annual report PDF',
    source_type: 'official_pdf',
    artifact_type: 'annual_report_pdf',
    official: true,
    high_value_pdf: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'annual report PDF can contain ORX outcome and quality evidence',
    expected_human_review: false,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'PDF-006',
    domain: 'PDF Intelligence Decisioning',
    input_summary: 'Scanned official PDF marked OCR-needed',
    source_type: 'official_pdf',
    artifact_type: 'scanned_pdf',
    official: true,
    scanned: true,
    expensive_operation: 'ocr',
    expected_decision: 'review',
    expected_priority: 'medium',
    expected_reason: 'scanned PDF is marked OCR-needed but OCR is not executed in this benchmark',
    expected_human_review: true,
    expected_cost_tier: 'high',
  },
  {
    case_id: 'PDF-007',
    domain: 'PDF Intelligence Decisioning',
    input_summary: 'Generic official marketing brochure PDF',
    source_type: 'official_pdf',
    artifact_type: 'generic_brochure_pdf',
    official: true,
    marketing_only: true,
    expected_decision: 'review',
    expected_priority: 'low',
    expected_reason: 'generic brochure is low-priority marketing evidence',
    expected_human_review: true,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'PDF-008',
    domain: 'PDF Intelligence Decisioning',
    input_summary: 'Unrelated PDF linked from unrelated department',
    source_type: 'unrelated_pdf',
    artifact_type: 'unrelated_pdf',
    irrelevant: true,
    expected_decision: 'reject',
    expected_priority: 'low',
    expected_reason: 'unrelated PDF is rejected from extraction coverage',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'JS-001',
    domain: 'JS-render Fallback Decisioning',
    input_summary: 'High-priority static HTML page with low text density',
    source_type: 'official_html_page',
    official: true,
    high_priority_page: true,
    low_text_density: true,
    render_candidate: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'high-priority low-text page can justify future JS-render fallback review',
    expected_human_review: true,
    expected_cost_tier: 'high',
  },
  {
    case_id: 'JS-002',
    domain: 'JS-render Fallback Decisioning',
    input_summary: 'Script-heavy official program page with likely rendered content',
    source_type: 'official_html_page',
    official: true,
    high_priority_page: true,
    script_heavy: true,
    render_candidate: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'script-heavy high-priority page requires render fallback review',
    expected_human_review: true,
    expected_cost_tier: 'high',
  },
  {
    case_id: 'JS-003',
    domain: 'JS-render Fallback Decisioning',
    input_summary: 'Normal static official program page with enough text',
    source_type: 'official_html_page',
    official: true,
    high_priority_page: true,
    static_text_sufficient: true,
    expected_decision: 'skip',
    expected_priority: 'low',
    expected_reason: 'normal static page does not need render fallback cost',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'JS-004',
    domain: 'JS-render Fallback Decisioning',
    input_summary: 'Broken official page',
    source_type: 'official_html_page',
    official: true,
    broken: true,
    expected_decision: 'blocked',
    expected_priority: 'blocked',
    expected_reason: 'broken page is blocked until source availability is resolved',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'JS-005',
    domain: 'JS-render Fallback Decisioning',
    input_summary: 'Client-side admissions portal linked from official site',
    source_type: 'official_linked_portal',
    official_link_provenance: true,
    high_priority_page: true,
    script_heavy: true,
    render_candidate: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'client-side admissions portal needs provenance and render-cost review',
    expected_human_review: true,
    expected_cost_tier: 'high',
  },
  {
    case_id: 'JS-006',
    domain: 'JS-render Fallback Decisioning',
    input_summary: 'Admissions page requiring login',
    source_type: 'login_required_page',
    login_required: true,
    expected_decision: 'blocked',
    expected_priority: 'blocked',
    expected_reason: 'login-required page is blocked and must not be rendered automatically',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'DOMAIN-001',
    domain: 'Multi-domain Official Handling',
    input_summary: 'Main university domain',
    source_type: 'main_university_domain',
    official: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'main university domain is the baseline official source',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DOMAIN-002',
    domain: 'Multi-domain Official Handling',
    input_summary: 'Admissions subdomain controlled by university',
    source_type: 'official_subdomain',
    official: true,
    official_subdomain: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'official admissions subdomain is trusted with domain reason',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DOMAIN-003',
    domain: 'Multi-domain Official Handling',
    input_summary: 'Faculty subdomain controlled by university',
    source_type: 'official_subdomain',
    official: true,
    official_subdomain: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'official faculty subdomain is trusted with scope reason',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DOMAIN-004',
    domain: 'Multi-domain Official Handling',
    input_summary: 'Official application portal on university domain',
    source_type: 'official_application_portal',
    official: true,
    high_impact: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'official application portal is high-impact apply evidence',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DOMAIN-005',
    domain: 'Multi-domain Official Handling',
    input_summary: 'Third-party application vendor linked from official admissions page',
    source_type: 'third_party_application_vendor',
    external: true,
    official_link_provenance: true,
    high_impact: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'third-party vendor requires official link provenance review',
    expected_human_review: true,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DOMAIN-006',
    domain: 'Multi-domain Official Handling',
    input_summary: 'Unrelated external domain',
    source_type: 'unrelated_domain',
    external: true,
    unrelated_domain: true,
    expected_decision: 'reject',
    expected_priority: 'low',
    expected_reason: 'unrelated domain must not be blindly trusted',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'DOMAIN-007',
    domain: 'Multi-domain Official Handling',
    input_summary: 'Social media page for university',
    source_type: 'social_media_page',
    external: true,
    social: true,
    expected_decision: 'reject',
    expected_priority: 'low',
    expected_reason: 'social page is not official evidence by default',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'MEDIA-001',
    domain: 'Media / File Artifact Classification',
    input_summary: 'Official image gallery',
    source_type: 'official_media',
    artifact_type: 'image_gallery',
    official: true,
    marketing_only: true,
    expected_decision: 'skip',
    expected_priority: 'low',
    expected_reason: 'image gallery is low-value for evidence extraction',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'MEDIA-002',
    domain: 'Media / File Artifact Classification',
    input_summary: 'Official program brochure',
    source_type: 'official_media',
    artifact_type: 'program_brochure',
    official: true,
    marketing_only: true,
    expected_decision: 'review',
    expected_priority: 'low',
    expected_reason: 'program brochure may contain facts but is marketing-heavy',
    expected_human_review: true,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'MEDIA-003',
    domain: 'Media / File Artifact Classification',
    input_summary: 'Official course catalogue',
    source_type: 'official_media',
    artifact_type: 'course_catalogue',
    official: true,
    high_value_artifact: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'course catalogue is high-value curriculum evidence',
    expected_human_review: false,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'MEDIA-004',
    domain: 'Media / File Artifact Classification',
    input_summary: 'Official video transcript about admissions requirements',
    source_type: 'official_media',
    artifact_type: 'video_transcript',
    official: true,
    high_value_artifact: true,
    high_impact: true,
    expected_decision: 'review',
    expected_priority: 'medium',
    expected_reason: 'video transcript can support evidence but needs review before high-impact use',
    expected_human_review: true,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'MEDIA-005',
    domain: 'Media / File Artifact Classification',
    input_summary: 'Official press release about new program launch',
    source_type: 'official_media',
    artifact_type: 'press_release',
    official: true,
    news_like: true,
    expected_decision: 'review',
    expected_priority: 'medium',
    expected_reason: 'press release is official but less authoritative than catalog/program pages',
    expected_human_review: true,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'MEDIA-006',
    domain: 'Media / File Artifact Classification',
    input_summary: 'Official admissions PDF artifact',
    source_type: 'official_media',
    artifact_type: 'admissions_pdf',
    official: true,
    high_value_artifact: true,
    high_impact: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'admissions PDF is high-value requirement evidence',
    expected_human_review: false,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'MEDIA-007',
    domain: 'Media / File Artifact Classification',
    input_summary: 'Official annual report artifact',
    source_type: 'official_media',
    artifact_type: 'annual_report',
    official: true,
    high_value_artifact: true,
    expected_decision: 'prioritize',
    expected_priority: 'medium',
    expected_reason: 'annual report can support quality and outcomes evidence',
    expected_human_review: false,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'MEDIA-008',
    domain: 'Media / File Artifact Classification',
    input_summary: 'Official accreditation certificate artifact',
    source_type: 'official_media',
    artifact_type: 'accreditation_certificate',
    official: true,
    high_value_artifact: true,
    high_impact: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'accreditation certificate is high-impact official evidence',
    expected_human_review: false,
    expected_cost_tier: 'medium',
  },
  {
    case_id: 'ETHICS-001',
    domain: 'Crawl Ethics / Politeness Decision Rules',
    input_summary: 'Robots disallow marker for candidate path',
    source_type: 'robots_policy',
    robots_disallow: true,
    expected_decision: 'blocked',
    expected_priority: 'blocked',
    expected_reason: 'robots disallow blocks crawl coverage attempt',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'ETHICS-002',
    domain: 'Crawl Ethics / Politeness Decision Rules',
    input_summary: 'Rate-limited domain marker',
    source_type: 'telemetry_marker',
    rate_limited: true,
    expected_decision: 'blocked',
    expected_priority: 'blocked',
    expected_reason: 'rate limit marker blocks or delays further crawl attempts',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'ETHICS-003',
    domain: 'Crawl Ethics / Politeness Decision Rules',
    input_summary: 'Repeated failures on same target path',
    source_type: 'telemetry_marker',
    repeated_failures: true,
    expected_decision: 'review',
    expected_priority: 'medium',
    expected_reason: 'repeated failures require diagnosis before more crawl cost',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'ETHICS-004',
    domain: 'Crawl Ethics / Politeness Decision Rules',
    input_summary: 'HTTP 403 on official page',
    source_type: 'http_status_marker',
    http_status: 403,
    expected_decision: 'blocked',
    expected_priority: 'blocked',
    expected_reason: 'HTTP 403 blocks automated crawl attempts',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'ETHICS-005',
    domain: 'Crawl Ethics / Politeness Decision Rules',
    input_summary: 'HTTP 429 on official page',
    source_type: 'http_status_marker',
    http_status: 429,
    expected_decision: 'blocked',
    expected_priority: 'blocked',
    expected_reason: 'HTTP 429 rate limiting blocks further automated crawl attempts',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'ETHICS-006',
    domain: 'Crawl Ethics / Politeness Decision Rules',
    input_summary: 'Timeout on official high-value page',
    source_type: 'telemetry_marker',
    timeout: true,
    expected_decision: 'review',
    expected_priority: 'medium',
    expected_reason: 'timeout requires diagnostics before retry or fallback planning',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'ETHICS-007',
    domain: 'Crawl Ethics / Politeness Decision Rules',
    input_summary: 'High-depth crawl request',
    source_type: 'admin_request',
    high_depth_crawl_request: true,
    expected_decision: 'blocked',
    expected_priority: 'blocked',
    expected_reason: 'high-depth crawl request is blocked until crawl ethics and cost gates close',
    expected_human_review: true,
    expected_cost_tier: 'blocked',
  },
  {
    case_id: 'COST-001',
    domain: 'Crawler Cost Brain',
    input_summary: 'Basic extraction already sufficient for official static page',
    source_type: 'cost_candidate',
    basic_extraction_sufficient: true,
    expected_decision: 'skip',
    expected_priority: 'low',
    expected_reason: 'basic extraction is sufficient; no expensive fallback is justified',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'COST-002',
    domain: 'Crawler Cost Brain',
    input_summary: 'AI may be needed due ambiguous official requirement wording',
    source_type: 'cost_candidate',
    ambiguous: true,
    expensive_operation: 'ai',
    high_impact: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'AI-cost path needs high-impact justification and review',
    expected_human_review: true,
    expected_cost_tier: 'high',
  },
  {
    case_id: 'COST-003',
    domain: 'Crawler Cost Brain',
    input_summary: 'Render may be needed due low text density on program page',
    source_type: 'cost_candidate',
    low_text_density: true,
    high_priority_page: true,
    expensive_operation: 'render',
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'render-cost path needs high-value low-text justification',
    expected_human_review: true,
    expected_cost_tier: 'high',
  },
  {
    case_id: 'COST-004',
    domain: 'Crawler Cost Brain',
    input_summary: 'PDF table extraction may be needed for tuition table',
    source_type: 'cost_candidate',
    table_heavy: true,
    high_impact: true,
    expensive_operation: 'pdf_table',
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'table extraction is justified for high-impact tuition evidence but remains unexecuted',
    expected_human_review: true,
    expected_cost_tier: 'high',
  },
  {
    case_id: 'COST-005',
    domain: 'Crawler Cost Brain',
    input_summary: 'OCR too costly for generic brochure',
    source_type: 'cost_candidate',
    scanned: true,
    marketing_only: true,
    expensive_operation: 'ocr',
    expected_decision: 'skip',
    expected_priority: 'low',
    expected_reason: 'OCR cost is not justified for low-value marketing material',
    expected_human_review: false,
    expected_cost_tier: 'high',
  },
  {
    case_id: 'COST-006',
    domain: 'Crawler Cost Brain',
    input_summary: 'Duplicate page candidate',
    source_type: 'cost_candidate',
    duplicate: true,
    expected_decision: 'skip',
    expected_priority: 'low',
    expected_reason: 'duplicate page is skipped to avoid repeated cost',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'COST-007',
    domain: 'Crawler Cost Brain',
    input_summary: 'Low-value page candidate',
    source_type: 'cost_candidate',
    low_value: true,
    expected_decision: 'skip',
    expected_priority: 'low',
    expected_reason: 'low-value page should not consume expansion cost',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'FRESH-001',
    domain: 'Evidence Freshness / Change Detection Readiness',
    input_summary: 'Deadline changed between snapshots',
    source_type: 'change_marker',
    changed_field: 'deadline',
    high_impact_change: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'deadline change is high-impact and requires review before alerts or writes',
    expected_human_review: true,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'FRESH-002',
    domain: 'Evidence Freshness / Change Detection Readiness',
    input_summary: 'Tuition changed between snapshots',
    source_type: 'change_marker',
    changed_field: 'tuition',
    high_impact_change: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'tuition change is high-impact and requires review before canonical use',
    expected_human_review: true,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'FRESH-003',
    domain: 'Evidence Freshness / Change Detection Readiness',
    input_summary: 'Apply URL changed between snapshots',
    source_type: 'change_marker',
    changed_field: 'apply_url',
    high_impact_change: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'apply URL change is high-impact and requires review',
    expected_human_review: true,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'FRESH-004',
    domain: 'Evidence Freshness / Change Detection Readiness',
    input_summary: 'Language requirement changed between snapshots',
    source_type: 'change_marker',
    changed_field: 'language_requirement',
    high_impact_change: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'language requirement change is high-impact and requires review',
    expected_human_review: true,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'FRESH-005',
    domain: 'Evidence Freshness / Change Detection Readiness',
    input_summary: 'Curriculum updated with new module',
    source_type: 'change_marker',
    changed_field: 'curriculum',
    high_impact_change: true,
    expected_decision: 'review',
    expected_priority: 'high',
    expected_reason: 'curriculum change can affect ORX signal candidates and requires review',
    expected_human_review: true,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'FRESH-006',
    domain: 'Evidence Freshness / Change Detection Readiness',
    input_summary: 'Footer date changed only',
    source_type: 'change_marker',
    changed_field: 'footer_date',
    cosmetic_change: true,
    expected_decision: 'skip',
    expected_priority: 'low',
    expected_reason: 'footer/date-only change is not an extraction coverage priority',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'FRESH-007',
    domain: 'Evidence Freshness / Change Detection Readiness',
    input_summary: 'Cosmetic text changed only',
    source_type: 'change_marker',
    changed_field: 'cosmetic_text',
    cosmetic_change: true,
    expected_decision: 'skip',
    expected_priority: 'low',
    expected_reason: 'cosmetic text change does not justify production alerts',
    expected_human_review: false,
    expected_cost_tier: 'low',
  },
  {
    case_id: 'GUARD-001',
    domain: 'Production Guard',
    input_summary: 'High-value official program catalogue candidate with complete mock provenance',
    source_type: 'production_guard',
    official: true,
    high_value_artifact: true,
    source_present: true,
    quote_present: true,
    expected_decision: 'prioritize',
    expected_priority: 'high',
    expected_reason: 'benchmark can recommend priority without authorizing crawler execution or production effects',
    expected_human_review: false,
    expected_cost_tier: 'medium',
  },
];

function parseArgs(argv) {
  const options = {
    format: 'json',
    strict: false,
    out: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--format') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--format requires json or markdown');
      }
      options.format = value;
      index += 1;
    } else if (arg.startsWith('--format=')) {
      options.format = arg.slice('--format='.length);
    } else if (arg === '--out') {
      const value = argv[index + 1];
      if (value && !value.startsWith('--')) {
        options.out = value;
        index += 1;
      } else {
        options.out = 'crawler-v2-extraction-coverage-benchmark-report.json';
      }
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length) || 'crawler-v2-extraction-coverage-benchmark-report.json';
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['json', 'markdown'].includes(options.format)) {
    throw new Error('--format must be json or markdown');
  }

  return options;
}

function printHelp() {
  console.log(`Crawler v2 Extraction Coverage Benchmark

Usage:
  node scripts/crawler-v2-extraction-coverage-benchmark.mjs [--format json|markdown] [--strict] [--out [path]]

Options:
  --format json|markdown  Output format. Defaults to json.
  --strict                Exit non-zero if any benchmark case fails.
  --out [path]            Write the JSON report to a local file. Defaults to crawler-v2-extraction-coverage-benchmark-report.json when no path is provided.
  --help                  Show this help.

This benchmark is deterministic and offline. It requires no environment variables and performs no network, database, crawler, rendering, OCR, or PDF extraction calls.`);
}

function productionAllowed() {
  return Object.values(PRODUCTION_GUARDS).some(Boolean);
}

function deriveDecision(testCase) {
  if (
    testCase.robots_disallow ||
    testCase.rate_limited ||
    testCase.http_status === 403 ||
    testCase.http_status === 429 ||
    testCase.high_depth_crawl_request ||
    testCase.login_required ||
    testCase.broken
  ) {
    return 'blocked';
  }

  if (
    testCase.source_present === false ||
    testCase.quote_present === false
  ) {
    return 'blocked';
  }

  if (testCase.unrelated_domain || testCase.social || testCase.source_type === 'unrelated_pdf' || testCase.irrelevant && testCase.source_type === 'unrelated_pdf') {
    return 'reject';
  }

  if (testCase.scanned && testCase.marketing_only) {
    return 'skip';
  }

  if (
    testCase.ambiguous ||
    testCase.official_link_provenance ||
    testCase.scanned ||
    testCase.render_candidate ||
    testCase.repeated_failures ||
    testCase.timeout ||
    testCase.table_heavy && testCase.source_type === 'cost_candidate' ||
    testCase.high_impact_change ||
    testCase.artifact_type === 'program_brochure' ||
    testCase.artifact_type === 'video_transcript' ||
    testCase.artifact_type === 'press_release' ||
    testCase.source_type === 'official_pdf' && testCase.marketing_only
  ) {
    return 'review';
  }

  if (
    testCase.irrelevant ||
    testCase.static_text_sufficient ||
    testCase.basic_extraction_sufficient ||
    testCase.duplicate ||
    testCase.low_value ||
    testCase.cosmetic_change ||
    testCase.artifact_type === 'image_gallery' ||
    testCase.scanned && testCase.marketing_only
  ) {
    return 'skip';
  }

  if (
    testCase.important_official_page ||
    testCase.discovery_metadata ||
    testCase.extraction_target ||
    testCase.high_value_pdf ||
    testCase.high_value_artifact ||
    testCase.official ||
    testCase.source_type === 'production_guard'
  ) {
    return 'prioritize';
  }

  return 'review';
}

function derivePriority(testCase, decision) {
  if (decision === 'blocked') return 'blocked';
  if (decision === 'reject' || decision === 'skip') return 'low';
  if (testCase.expected_priority) return testCase.expected_priority;
  if (testCase.high_impact || testCase.high_priority_page || testCase.high_impact_change) return 'high';
  if (testCase.high_value_pdf || testCase.high_value_artifact) return 'medium';
  return 'medium';
}

function deriveCostTier(testCase, decision) {
  if (decision === 'blocked') return 'blocked';
  if (testCase.repeated_failures || testCase.timeout) return 'blocked';
  if (
    testCase.scanned ||
    testCase.render_candidate ||
    testCase.expensive_operation === 'ai' ||
    testCase.expensive_operation === 'render' ||
    testCase.expensive_operation === 'ocr' ||
    testCase.expensive_operation === 'pdf_table'
  ) {
    return 'high';
  }
  if (
    testCase.source_type === 'official_pdf' ||
    testCase.source_type === 'official_media' &&
      !['image_gallery', 'press_release'].includes(testCase.artifact_type) ||
    testCase.high_value_artifact ||
    testCase.high_value_pdf ||
    testCase.source_type === 'production_guard'
  ) {
    return 'medium';
  }
  return 'low';
}

function deriveHumanReview(testCase, decision) {
  if (decision === 'blocked' || decision === 'review') return true;
  if (testCase.ambiguous || testCase.high_impact_change || testCase.official_link_provenance) return true;
  return false;
}

function deriveReason(testCase, decision) {
  if (testCase.expected_reason) return testCase.expected_reason;
  if (decision === 'blocked') return 'blocked by safety or missing provenance';
  if (decision === 'reject') return 'rejected as untrusted or irrelevant';
  if (decision === 'skip') return 'skipped because coverage value is low or already sufficient';
  if (decision === 'review') return 'requires human review before any future expansion work';
  return 'prioritized as official high-value extraction coverage input';
}

function guardFailuresForCase(testCase) {
  const failures = [];
  if (testCase.actual_production_allowed) failures.push('production_allowed');
  if (testCase.crawler_execution_allowed) failures.push('crawler_execution_allowed');
  if (testCase.render_allowed) failures.push('render_allowed');
  if (testCase.ocr_allowed) failures.push('ocr_allowed');
  if (testCase.pdf_extraction_allowed) failures.push('pdf_extraction_allowed');
  return failures;
}

function evaluateCase(testCase) {
  const actualDecision = deriveDecision(testCase);
  const actualPriority = derivePriority(testCase, actualDecision);
  const actualCostTier = deriveCostTier(testCase, actualDecision);
  const actualHumanReview = deriveHumanReview(testCase, actualDecision);
  const actualProductionAllowed = productionAllowed();
  const actualReason = deriveReason(testCase, actualDecision);

  const evaluated = {
    case_id: testCase.case_id,
    domain: testCase.domain,
    input_summary: testCase.input_summary,
    source_type: testCase.source_type,
    expected_decision: testCase.expected_decision,
    actual_decision: actualDecision,
    expected_priority: testCase.expected_priority,
    actual_priority: actualPriority,
    expected_reason: testCase.expected_reason,
    actual_reason: actualReason,
    expected_human_review: testCase.expected_human_review,
    actual_human_review: actualHumanReview,
    expected_cost_tier: testCase.expected_cost_tier,
    actual_cost_tier: actualCostTier,
    expected_production_allowed: false,
    actual_production_allowed: actualProductionAllowed,
    crawler_execution_allowed: PRODUCTION_GUARDS.crawler_execution_allowed,
    run_all_allowed: PRODUCTION_GUARDS.run_all_allowed,
    country_crawl_allowed: PRODUCTION_GUARDS.country_crawl_allowed,
    publish_allowed: PRODUCTION_GUARDS.publish_allowed,
    canonical_writes_allowed: PRODUCTION_GUARDS.canonical_writes_allowed,
    orx_scoring_allowed: PRODUCTION_GUARDS.orx_scoring_allowed,
    student_eligibility_production_allowed: PRODUCTION_GUARDS.student_eligibility_production_allowed,
    crm_automation_allowed: PRODUCTION_GUARDS.crm_automation_allowed,
    render_allowed: PRODUCTION_GUARDS.render_allowed,
    ocr_allowed: PRODUCTION_GUARDS.ocr_allowed,
    pdf_extraction_allowed: PRODUCTION_GUARDS.pdf_extraction_allowed,
    external_api_allowed: PRODUCTION_GUARDS.external_api_allowed,
  };

  const reasons = [];
  if (actualDecision === testCase.expected_decision) reasons.push(`decision matched: ${actualDecision}`);
  if (actualPriority === testCase.expected_priority) reasons.push(`priority matched: ${actualPriority}`);
  if (actualCostTier === testCase.expected_cost_tier) reasons.push(`cost tier matched: ${actualCostTier}`);
  if (actualHumanReview === testCase.expected_human_review) reasons.push(`human review matched: ${actualHumanReview}`);
  if (!actualProductionAllowed) reasons.push('production actions remain blocked');

  const pass =
    DECISIONS.has(actualDecision) &&
    PRIORITIES.has(actualPriority) &&
    COST_TIERS.has(actualCostTier) &&
    actualDecision === testCase.expected_decision &&
    actualPriority === testCase.expected_priority &&
    actualReason === testCase.expected_reason &&
    actualHumanReview === testCase.expected_human_review &&
    actualCostTier === testCase.expected_cost_tier &&
    actualProductionAllowed === false &&
    guardFailuresForCase(evaluated).length === 0;

  return {
    ...evaluated,
    pass,
    reasons: pass ? reasons : [
      ...reasons,
      actualDecision !== testCase.expected_decision
        ? `decision mismatch: expected ${testCase.expected_decision}, got ${actualDecision}`
        : null,
      actualPriority !== testCase.expected_priority
        ? `priority mismatch: expected ${testCase.expected_priority}, got ${actualPriority}`
        : null,
      actualReason !== testCase.expected_reason
        ? `reason mismatch: expected "${testCase.expected_reason}", got "${actualReason}"`
        : null,
      actualHumanReview !== testCase.expected_human_review
        ? `human review mismatch: expected ${testCase.expected_human_review}, got ${actualHumanReview}`
        : null,
      actualCostTier !== testCase.expected_cost_tier
        ? `cost tier mismatch: expected ${testCase.expected_cost_tier}, got ${actualCostTier}`
        : null,
      actualProductionAllowed
        ? 'production guard failed'
        : null,
    ].filter(Boolean),
  };
}

function countBy(items, keyFn) {
  return items.reduce((accumulator, item) => {
    const key = keyFn(item);
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function buildReport() {
  const cases = CASES.map(evaluateCase);
  const failures = cases.filter((testCase) => !testCase.pass);
  const passedCases = cases.length - failures.length;
  const productionGuardFailures = cases.filter((testCase) => (
    testCase.actual_production_allowed ||
    testCase.crawler_execution_allowed ||
    testCase.run_all_allowed ||
    testCase.country_crawl_allowed ||
    testCase.publish_allowed ||
    testCase.canonical_writes_allowed ||
    testCase.orx_scoring_allowed ||
    testCase.student_eligibility_production_allowed ||
    testCase.crm_automation_allowed ||
    testCase.render_allowed ||
    testCase.ocr_allowed ||
    testCase.pdf_extraction_allowed ||
    testCase.external_api_allowed
  )).length;

  return {
    benchmark: 'crawler-v2-extraction-coverage-benchmark',
    status: failures.length === 0 ? 'passed' : 'failed',
    total_cases: cases.length,
    passed_cases: passedCases,
    failed_cases: failures.length,
    pass_rate: Number((passedCases / cases.length).toFixed(4)),
    failures_list: failures.map((failure) => ({
      case_id: failure.case_id,
      domain: failure.domain,
      expected_decision: failure.expected_decision,
      actual_decision: failure.actual_decision,
      expected_priority: failure.expected_priority,
      actual_priority: failure.actual_priority,
      expected_human_review: failure.expected_human_review,
      actual_human_review: failure.actual_human_review,
      expected_cost_tier: failure.expected_cost_tier,
      actual_cost_tier: failure.actual_cost_tier,
      reasons: failure.reasons,
    })),
    domain_breakdown: countBy(cases, (testCase) => testCase.domain),
    decision_distribution: countBy(cases, (testCase) => testCase.actual_decision),
    priority_distribution: countBy(cases, (testCase) => testCase.actual_priority),
    cost_tier_distribution: countBy(cases, (testCase) => testCase.actual_cost_tier),
    human_review_count: cases.filter((testCase) => testCase.actual_human_review).length,
    blocked_count: cases.filter((testCase) => testCase.actual_decision === 'blocked').length,
    production_guard_failures: productionGuardFailures,
    no_write_no_network_no_production_verification_statement: VERIFICATION_STATEMENT,
    cases,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Crawler v2 Extraction Coverage Benchmark Report',
    '',
    `Status: ${report.status}`,
    `Total cases: ${report.total_cases}`,
    `Passed cases: ${report.passed_cases}`,
    `Failed cases: ${report.failed_cases}`,
    `Pass rate: ${(report.pass_rate * 100).toFixed(2)}%`,
    `Production guard failures: ${report.production_guard_failures}`,
    '',
    '## Decision Distribution',
    '',
    '| Decision | Count |',
    '|---|---:|',
    ...Object.entries(report.decision_distribution).map(([decision, count]) => `| ${decision} | ${count} |`),
    '',
    '## Priority Distribution',
    '',
    '| Priority | Count |',
    '|---|---:|',
    ...Object.entries(report.priority_distribution).map(([priority, count]) => `| ${priority} | ${count} |`),
    '',
    '## Cost Tier Distribution',
    '',
    '| Cost tier | Count |',
    '|---|---:|',
    ...Object.entries(report.cost_tier_distribution).map(([tier, count]) => `| ${tier} | ${count} |`),
    '',
    '## Domain Breakdown',
    '',
    '| Domain | Count |',
    '|---|---:|',
    ...Object.entries(report.domain_breakdown).map(([domain, count]) => `| ${domain} | ${count} |`),
    '',
    '## Cases',
    '',
    '| Case | Domain | Expected | Actual | Priority | Human review | Cost tier | Result |',
    '|---|---|---|---|---|---|---|---|',
    ...report.cases.map((testCase) => (
      `| ${testCase.case_id} | ${testCase.domain} | ${testCase.expected_decision} | ${testCase.actual_decision} | ${testCase.actual_priority} | ${testCase.actual_human_review} | ${testCase.actual_cost_tier} | ${testCase.pass ? 'pass' : 'fail'} |`
    )),
    '',
    '## Verification',
    '',
    report.no_write_no_network_no_production_verification_statement,
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  if (options.help) {
    printHelp();
    return;
  }

  const report = buildReport();

  if (options.out) {
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  if (options.format === 'markdown') {
    process.stdout.write(renderMarkdown(report));
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }

  if (options.strict && report.failed_cases > 0) {
    process.exitCode = 1;
  }
}

main();
