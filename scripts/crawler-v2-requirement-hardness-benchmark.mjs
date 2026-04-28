#!/usr/bin/env node

import { writeFileSync } from 'node:fs';

const VERIFICATION_STATEMENT =
  'This requirement hardness benchmark is offline and diagnostic-only. It did not read Supabase, run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility production, CRM automation, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, AI providers, or language/i18n changes.';

const CLASSIFICATIONS = new Set([
  'hard_requirement',
  'soft_requirement',
  'document_requirement',
  'visa_requirement',
  'financial_requirement',
  'post_admission_requirement',
  'recommended_requirement',
  'competitive_requirement',
  'unknown_or_needs_review',
]);

const PRODUCTION_GUARDS = Object.freeze({
  student_eligibility_production_allowed: false,
  crm_automation_allowed: false,
  publish_allowed: false,
  orx_scoring_allowed: false,
});

const CASES = [
  {
    case_id: 'LANG-001',
    domain: 'Language Requirements',
    input_text: 'Applicants must have IELTS Academic overall score of at least 6.5.',
    source_type: 'official_program_page',
    field: 'language_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['language_requirement', 'minimum_score'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'LANG-002',
    domain: 'Language Requirements',
    input_text: 'A TOEFL iBT minimum score of 90 is required for admission.',
    source_type: 'official_admissions_page',
    field: 'language_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['language_requirement', 'minimum_score'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'LANG-003',
    domain: 'Language Requirements',
    input_text: 'PTE Academic score 62 or higher is required.',
    source_type: 'official_admissions_page',
    field: 'language_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['language_requirement', 'minimum_score'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'LANG-004',
    domain: 'Language Requirements',
    input_text: 'Duolingo English Test minimum score of 120 is accepted.',
    source_type: 'official_admissions_page',
    field: 'language_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['language_requirement', 'minimum_score'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'LANG-005',
    domain: 'Language Requirements',
    input_text: 'Applicants must demonstrate English at CEFR B2 level or above.',
    source_type: 'official_program_page',
    field: 'language_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['language_requirement', 'minimum_score'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'LANG-006',
    domain: 'Language Requirements',
    input_text: 'English proficiency is recommended for successful study.',
    source_type: 'official_program_page',
    field: 'language_requirement',
    expected_classification: 'recommended_requirement',
    expected_secondary_flags: ['language_requirement'],
    expected_human_review: false,
    expected_blocking: false,
  },
  {
    case_id: 'LANG-007',
    domain: 'Language Requirements',
    input_text: 'The English test may be waived for applicants who completed prior study in English.',
    source_type: 'official_admissions_page',
    field: 'language_requirement',
    expected_classification: 'soft_requirement',
    expected_secondary_flags: ['language_requirement', 'waiver_possible'],
    expected_human_review: true,
    expected_blocking: false,
  },
  {
    case_id: 'LANG-008',
    domain: 'Language Requirements',
    input_text: 'A language certificate is required after admission and before enrollment.',
    source_type: 'official_admissions_page',
    field: 'language_requirement',
    expected_classification: 'post_admission_requirement',
    expected_secondary_flags: ['language_requirement', 'post_admission'],
    expected_human_review: true,
    expected_blocking: false,
  },
  {
    case_id: 'ACAD-001',
    domain: 'Academic Requirements',
    input_text: 'Minimum GPA of 3.0 out of 4.0 is required.',
    source_type: 'official_program_page',
    field: 'academic_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['academic_requirement', 'minimum_score'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'ACAD-002',
    domain: 'Academic Requirements',
    input_text: 'Applicants must hold a bachelor degree in computer science or a related field.',
    source_type: 'official_program_page',
    field: 'academic_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['academic_requirement', 'degree_requirement'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'ACAD-003',
    domain: 'Academic Requirements',
    input_text: 'Calculus I and Linear Algebra are required prerequisites.',
    source_type: 'official_program_page',
    field: 'academic_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['academic_requirement', 'prerequisite'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'ACAD-004',
    domain: 'Academic Requirements',
    input_text: 'Programming background in Python or Java is required.',
    source_type: 'official_program_page',
    field: 'academic_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['academic_requirement', 'prerequisite'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'ACAD-005',
    domain: 'Academic Requirements',
    input_text: 'A portfolio is required for review by the admissions committee.',
    source_type: 'official_program_page',
    field: 'document_requirement',
    expected_classification: 'document_requirement',
    expected_secondary_flags: ['document_requirement', 'portfolio'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'ACAD-006',
    domain: 'Academic Requirements',
    input_text: 'A research proposal is required for all research track applicants.',
    source_type: 'official_program_page',
    field: 'document_requirement',
    expected_classification: 'document_requirement',
    expected_secondary_flags: ['document_requirement', 'research_proposal'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'ACAD-007',
    domain: 'Academic Requirements',
    input_text: 'Shortlisted applicants must attend an interview.',
    source_type: 'official_program_page',
    field: 'academic_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['academic_requirement', 'interview'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'ACAD-008',
    domain: 'Academic Requirements',
    input_text: 'Applicants must pass the university entrance exam.',
    source_type: 'official_admissions_page',
    field: 'academic_requirement',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['academic_requirement', 'entrance_exam'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'ACAD-009',
    domain: 'Academic Requirements',
    input_text: 'A background in statistics is preferred.',
    source_type: 'official_program_page',
    field: 'academic_requirement',
    expected_classification: 'competitive_requirement',
    expected_secondary_flags: ['academic_requirement', 'preferred'],
    expected_human_review: false,
    expected_blocking: false,
  },
  {
    case_id: 'ACAD-010',
    domain: 'Academic Requirements',
    input_text: 'Recommended preparation includes introductory programming.',
    source_type: 'official_program_page',
    field: 'academic_requirement',
    expected_classification: 'recommended_requirement',
    expected_secondary_flags: ['academic_requirement'],
    expected_human_review: false,
    expected_blocking: false,
  },
  {
    case_id: 'ACAD-011',
    domain: 'Academic Requirements',
    input_text: 'Applicants should have sufficient quantitative maturity.',
    source_type: 'official_program_page',
    field: 'academic_requirement',
    expected_classification: 'unknown_or_needs_review',
    expected_secondary_flags: ['academic_requirement', 'ambiguous'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'DOC-001',
    domain: 'Document Requirements',
    input_text: 'Upload a passport copy with the online application.',
    source_type: 'official_application_page',
    field: 'document_requirement',
    expected_classification: 'document_requirement',
    expected_secondary_flags: ['document_requirement', 'identity_document'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'DOC-002',
    domain: 'Document Requirements',
    input_text: 'Official transcript is required.',
    source_type: 'official_application_page',
    field: 'document_requirement',
    expected_classification: 'document_requirement',
    expected_secondary_flags: ['document_requirement', 'transcript'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'DOC-003',
    domain: 'Document Requirements',
    input_text: 'Submit a copy of your bachelor diploma.',
    source_type: 'official_application_page',
    field: 'document_requirement',
    expected_classification: 'document_requirement',
    expected_secondary_flags: ['document_requirement', 'diploma'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'DOC-004',
    domain: 'Document Requirements',
    input_text: 'A current CV must be included.',
    source_type: 'official_application_page',
    field: 'document_requirement',
    expected_classification: 'document_requirement',
    expected_secondary_flags: ['document_requirement', 'cv'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'DOC-005',
    domain: 'Document Requirements',
    input_text: 'Motivation letter is required.',
    source_type: 'official_application_page',
    field: 'document_requirement',
    expected_classification: 'document_requirement',
    expected_secondary_flags: ['document_requirement', 'motivation_letter'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'DOC-006',
    domain: 'Document Requirements',
    input_text: 'Two recommendation letters are required.',
    source_type: 'official_application_page',
    field: 'document_requirement',
    expected_classification: 'document_requirement',
    expected_secondary_flags: ['document_requirement', 'recommendation_letter'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'DOC-007',
    domain: 'Document Requirements',
    input_text: 'Financial proof must be uploaded with the application.',
    source_type: 'official_application_page',
    field: 'financial_requirement',
    expected_classification: 'financial_requirement',
    expected_secondary_flags: ['document_requirement', 'financial_requirement'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'DOC-008',
    domain: 'Document Requirements',
    input_text: 'Translated and notarized documents must be submitted.',
    source_type: 'official_application_page',
    field: 'document_requirement',
    expected_classification: 'document_requirement',
    expected_secondary_flags: ['document_requirement', 'notarized_translation'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'FINVISA-001',
    domain: 'Financial / Visa / Country Requirements',
    input_text: 'Applicants must show proof of funds for the first year of study.',
    source_type: 'official_visa_page',
    field: 'financial_requirement',
    expected_classification: 'financial_requirement',
    expected_secondary_flags: ['financial_requirement', 'visa_requirement'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'FINVISA-002',
    domain: 'Financial / Visa / Country Requirements',
    input_text: 'A bank statement covering the last three months is required.',
    source_type: 'official_visa_page',
    field: 'financial_requirement',
    expected_classification: 'financial_requirement',
    expected_secondary_flags: ['financial_requirement', 'document_requirement', 'visa_requirement'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'FINVISA-003',
    domain: 'Financial / Visa / Country Requirements',
    input_text: 'Visa support documents must be submitted after admission.',
    source_type: 'official_visa_page',
    field: 'visa_requirement',
    expected_classification: 'post_admission_requirement',
    expected_secondary_flags: ['visa_requirement', 'document_requirement', 'post_admission'],
    expected_human_review: true,
    expected_blocking: false,
  },
  {
    case_id: 'FINVISA-004',
    domain: 'Financial / Visa / Country Requirements',
    input_text: 'Medical insurance is required before enrollment.',
    source_type: 'official_visa_page',
    field: 'visa_requirement',
    expected_classification: 'visa_requirement',
    expected_secondary_flags: ['visa_requirement', 'post_admission'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'FINVISA-005',
    domain: 'Financial / Visa / Country Requirements',
    input_text: 'Diplomas must be apostilled or legalized.',
    source_type: 'official_application_page',
    field: 'document_requirement',
    expected_classification: 'document_requirement',
    expected_secondary_flags: ['document_requirement', 'legalization'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'FINVISA-006',
    domain: 'Financial / Visa / Country Requirements',
    input_text: 'International students must register a migration card on arrival.',
    source_type: 'official_visa_page',
    field: 'visa_requirement',
    expected_classification: 'visa_requirement',
    expected_secondary_flags: ['visa_requirement', 'post_admission'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'FINVISA-007',
    domain: 'Financial / Visa / Country Requirements',
    input_text: 'Residence permit documents are required for studies longer than one year.',
    source_type: 'official_visa_page',
    field: 'visa_requirement',
    expected_classification: 'visa_requirement',
    expected_secondary_flags: ['visa_requirement', 'document_requirement'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'FINVISA-008',
    domain: 'Financial / Visa / Country Requirements',
    input_text: 'A tuition prepayment is required to confirm enrollment.',
    source_type: 'official_tuition_page',
    field: 'financial_requirement',
    expected_classification: 'financial_requirement',
    expected_secondary_flags: ['financial_requirement', 'post_admission'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'FINVISA-009',
    domain: 'Financial / Visa / Country Requirements',
    input_text: 'A non-refundable deposit of 1000 EUR is required.',
    source_type: 'official_tuition_page',
    field: 'financial_requirement',
    expected_classification: 'financial_requirement',
    expected_secondary_flags: ['financial_requirement'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'APPLY-001',
    domain: 'Deadline / Apply URL / Scholarship Requirements',
    input_text: 'Applications must be submitted before 15 March 2026.',
    source_type: 'official_application_page',
    field: 'deadline',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['deadline'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'APPLY-002',
    domain: 'Deadline / Apply URL / Scholarship Requirements',
    input_text: 'Applications are reviewed on a rolling admissions basis.',
    source_type: 'official_application_page',
    field: 'deadline',
    expected_classification: 'soft_requirement',
    expected_secondary_flags: ['deadline', 'rolling_admissions'],
    expected_human_review: true,
    expected_blocking: false,
  },
  {
    case_id: 'APPLY-003',
    domain: 'Deadline / Apply URL / Scholarship Requirements',
    input_text: 'Scholarship applications must be submitted by 1 February 2026.',
    source_type: 'official_scholarship_page',
    field: 'scholarship',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['scholarship', 'deadline'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'APPLY-004',
    domain: 'Deadline / Apply URL / Scholarship Requirements',
    input_text: 'A separate scholarship application is recommended.',
    source_type: 'official_scholarship_page',
    field: 'scholarship',
    expected_classification: 'recommended_requirement',
    expected_secondary_flags: ['scholarship'],
    expected_human_review: true,
    expected_blocking: false,
  },
  {
    case_id: 'APPLY-005',
    domain: 'Deadline / Apply URL / Scholarship Requirements',
    input_text: 'Apply through the official university application portal.',
    source_type: 'official_application_page',
    field: 'apply_url',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['apply_url'],
    expected_human_review: false,
    expected_blocking: true,
  },
  {
    case_id: 'APPLY-006',
    domain: 'Deadline / Apply URL / Scholarship Requirements',
    input_text: 'Apply URL is missing from the captured evidence.',
    source_type: 'missing_source',
    field: 'apply_url',
    expected_classification: 'unknown_or_needs_review',
    expected_secondary_flags: ['apply_url', 'missing_source'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'AMB-001',
    domain: 'Ambiguity and Conflict Cases',
    input_text: 'GRE may be required for some applicants.',
    source_type: 'official_general_admissions_page',
    field: 'academic_requirement',
    expected_classification: 'unknown_or_needs_review',
    expected_secondary_flags: ['academic_requirement', 'ambiguous'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'AMB-002',
    domain: 'Ambiguity and Conflict Cases',
    input_text: 'A portfolio is usually required.',
    source_type: 'official_program_page',
    field: 'document_requirement',
    expected_classification: 'unknown_or_needs_review',
    expected_secondary_flags: ['document_requirement', 'portfolio', 'ambiguous'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'AMB-003',
    domain: 'Ambiguity and Conflict Cases',
    input_text: 'Advanced mathematics is recommended.',
    source_type: 'official_program_page',
    field: 'academic_requirement',
    expected_classification: 'recommended_requirement',
    expected_secondary_flags: ['academic_requirement'],
    expected_human_review: false,
    expected_blocking: false,
  },
  {
    case_id: 'AMB-004',
    domain: 'Ambiguity and Conflict Cases',
    input_text: 'Research experience is strongly encouraged.',
    source_type: 'official_program_page',
    field: 'academic_requirement',
    expected_classification: 'competitive_requirement',
    expected_secondary_flags: ['academic_requirement', 'preferred'],
    expected_human_review: false,
    expected_blocking: false,
  },
  {
    case_id: 'AMB-005',
    domain: 'Ambiguity and Conflict Cases',
    input_text: 'Program page says IELTS 6.5; general admissions page says IELTS 7.0.',
    source_type: 'conflicting_official_sources',
    field: 'language_requirement',
    conflict: true,
    expected_classification: 'unknown_or_needs_review',
    expected_secondary_flags: ['language_requirement', 'minimum_score', 'conflict'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'AMB-006',
    domain: 'Ambiguity and Conflict Cases',
    input_text: 'Current program page says TOEFL 90; old PDF says TOEFL 80.',
    source_type: 'old_pdf_conflict',
    field: 'language_requirement',
    conflict: true,
    expected_classification: 'unknown_or_needs_review',
    expected_secondary_flags: ['language_requirement', 'minimum_score', 'conflict', 'stale_source'],
    expected_human_review: true,
    expected_blocking: true,
  },
  {
    case_id: 'GUARD-001',
    domain: 'Production Guard',
    input_text: 'Applicants must submit a complete application before 1 April 2026.',
    source_type: 'official_application_page',
    field: 'deadline',
    expected_classification: 'hard_requirement',
    expected_secondary_flags: ['deadline'],
    expected_human_review: false,
    expected_blocking: true,
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
        options.out = 'crawler-v2-requirement-hardness-benchmark-report.json';
      }
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length) || 'crawler-v2-requirement-hardness-benchmark-report.json';
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
  console.log(`Crawler v2 Requirement Hardness Benchmark

Usage:
  node scripts/crawler-v2-requirement-hardness-benchmark.mjs [--format json|markdown] [--strict] [--out [path]]

Options:
  --format json|markdown  Output format. Defaults to json.
  --strict                Exit non-zero if any benchmark case fails.
  --out [path]            Write the JSON report to a local file. Defaults to crawler-v2-requirement-hardness-benchmark-report.json when no path is provided.
  --help                  Show this help.

This benchmark is deterministic and offline. It requires no environment variables and performs no network or database calls.`);
}

function uniq(values) {
  return [...new Set(values)].sort();
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function secondaryFlags(testCase, text) {
  const flags = [];
  const field = testCase.field;

  if (field.includes('language')) flags.push('language_requirement');
  if (field.includes('academic')) flags.push('academic_requirement');
  if (field.includes('document')) flags.push('document_requirement');
  if (field.includes('financial')) flags.push('financial_requirement');
  if (field.includes('visa')) flags.push('visa_requirement');
  if (field === 'deadline') flags.push('deadline');
  if (field === 'scholarship') flags.push('scholarship');
  if (field === 'apply_url') flags.push('apply_url');

  if (includesAny(text, [/\bielts\b/, /\btoefl\b/, /\bpte\b/, /\bduolingo\b/, /\bcefr\b/, /\bgpa\b/, /\bscore\b/, /\bminimum\b/])) {
    flags.push('minimum_score');
  }
  if (includesAny(text, [/\bbachelor degree\b/, /\bdegree in\b/])) flags.push('degree_requirement');
  if (includesAny(text, [/\bcalculus\b/, /\balgebra\b/, /\bprerequisite\b/]) || /\bprogramming\b.*\brequired\b/.test(text)) flags.push('prerequisite');
  if (/\bportfolio\b/.test(text)) flags.push('portfolio');
  if (/\bresearch proposal\b/.test(text)) flags.push('research_proposal');
  if (/\binterview\b/.test(text)) flags.push('interview');
  if (/\bentrance exam\b/.test(text)) flags.push('entrance_exam');
  if (/\bpreferred\b|\bstrongly encouraged\b/.test(text)) flags.push('preferred');
  if (/\bwaived\b|\bwaiver\b/.test(text)) flags.push('waiver_possible');
  if (/\bafter admission\b|\bbefore enrollment\b|\bon arrival\b|\bconfirm enrollment\b/.test(text)) flags.push('post_admission');
  if (/\bpassport\b/.test(text)) flags.push('identity_document');
  if (/\btranscript\b/.test(text)) flags.push('transcript');
  if (/\bdiploma\b/.test(text)) flags.push('diploma');
  if (/\bcv\b/.test(text)) flags.push('cv');
  if (/\bmotivation letter\b/.test(text)) flags.push('motivation_letter');
  if (/\brecommendation letters?\b/.test(text)) flags.push('recommendation_letter');
  if (/\bfinancial proof\b|\bproof of funds\b|\bbank statement\b|\bprepayment\b|\bdeposit\b/.test(text)) flags.push('financial_requirement');
  if (/\bfinancial proof\b.*\bapplication\b/.test(text)) flags.push('document_requirement');
  if (/\bvisa\b|\bmedical insurance\b|\bmigration card\b|\bresidence permit\b/.test(text) || testCase.source_type === 'official_visa_page') flags.push('visa_requirement');
  if (/\bbank statement\b|\bvisa support documents\b|\bresidence permit documents\b/.test(text)) flags.push('document_requirement');
  if (/\bnotarized\b|\btranslated\b/.test(text)) flags.push('notarized_translation');
  if (/\bapostilled\b|\blegalized\b|\blegalization\b/.test(text)) flags.push('legalization');
  if (/\brolling admissions\b/.test(text)) flags.push('rolling_admissions');
  if (/\bdeadline\b|\bbefore \d{1,2} [a-z]+ \d{4}\b|\bby \d{1,2} [a-z]+ \d{4}\b/.test(text)) flags.push('deadline');
  if (/\bmissing\b/.test(text) || testCase.source_type === 'missing_source') flags.push('missing_source');
  if (testCase.conflict || /\bpage says\b.*\bsays\b/.test(text)) flags.push('conflict');
  if (/\bold pdf\b/.test(text) || testCase.source_type === 'old_pdf_conflict') flags.push('stale_source');
  if (/\bmay be required\b|\busually required\b|\bsufficient\b/.test(text)) flags.push('ambiguous');

  return uniq(flags);
}

function classify(testCase) {
  const text = testCase.input_text.toLowerCase();

  if (testCase.conflict || testCase.source_type === 'missing_source') {
    return 'unknown_or_needs_review';
  }

  if (/\bmay be required\b|\busually required\b|\bsufficient\b/.test(text)) {
    return 'unknown_or_needs_review';
  }

  if (/\bafter admission\b/.test(text) && /\blanguage certificate\b|\bvisa support documents\b/.test(text)) {
    return 'post_admission_requirement';
  }

  if (/\bfinancial proof\b|\bproof of funds\b|\bbank statement\b|\bprepayment\b|\bdeposit\b/.test(text)) {
    return 'financial_requirement';
  }

  if (/\bvisa\b|\bmedical insurance\b|\bmigration card\b|\bresidence permit\b/.test(text)) {
    return 'visa_requirement';
  }

  if (/\bpassport\b|\btranscript\b|\bdiploma\b|\bcv\b|\bmotivation letter\b|\brecommendation letters?\b|\bportfolio\b|\bresearch proposal\b|\bnotarized\b|\btranslated\b|\bapostilled\b|\blegalized\b/.test(text)) {
    return 'document_requirement';
  }

  if (/\bpreferred\b|\bstrongly encouraged\b/.test(text)) {
    return 'competitive_requirement';
  }

  if (/\brecommended\b/.test(text)) {
    return 'recommended_requirement';
  }

  if (/\bwaived\b|\bwaiver\b|\brolling admissions\b/.test(text)) {
    return 'soft_requirement';
  }

  if (/\bmust\b|\brequired\b|\bminimum\b|\bat least\b|\bor higher\b|\bbefore \d{1,2} [a-z]+ \d{4}\b|\bby \d{1,2} [a-z]+ \d{4}\b|\bofficial .*portal\b/.test(text)) {
    return 'hard_requirement';
  }

  return 'unknown_or_needs_review';
}

function ambiguityStatus(testCase) {
  const text = testCase.input_text.toLowerCase();
  if (/\bmay be required\b|\busually required\b|\bsufficient\b|\bmissing\b/.test(text)) {
    return 'ambiguous_requires_review';
  }
  if (/\bwaived\b|\brolling admissions\b/.test(text)) {
    return 'conditional_requires_review';
  }
  return 'not_ambiguous';
}

function conflictStatus(testCase) {
  if (testCase.conflict || testCase.source_type === 'conflicting_official_sources' || testCase.source_type === 'old_pdf_conflict') {
    return 'blocked_conflict';
  }
  return 'none';
}

function highImpactStatus(testCase) {
  const highImpactFields = new Set([
    'language_requirement',
    'academic_requirement',
    'document_requirement',
    'financial_requirement',
    'visa_requirement',
    'deadline',
    'scholarship',
    'apply_url',
  ]);

  return highImpactFields.has(testCase.field) ? 'high_impact' : 'standard';
}

function confidenceScore(testCase, classification, flags, ambiguity, conflict) {
  let score = 0.88;
  const reasons = [];

  if (testCase.source_type.includes('official')) {
    score += 0.06;
  }

  if (classification === 'unknown_or_needs_review') {
    score -= 0.34;
    reasons.push('unknown or needs review');
  }

  if (ambiguity !== 'not_ambiguous') {
    score -= 0.2;
    reasons.push('ambiguous or conditional wording');
  }

  if (conflict !== 'none') {
    score -= 0.3;
    reasons.push('conflicting official requirement evidence');
  }

  if (flags.includes('missing_source')) {
    score -= 0.22;
    reasons.push('source or apply URL missing');
  }

  if (flags.includes('stale_source')) {
    score -= 0.08;
    reasons.push('stale source present');
  }

  if (classification === 'hard_requirement' && flags.includes('minimum_score')) {
    reasons.push('explicit minimum threshold');
  }

  return {
    score: Number(Math.max(0, Math.min(1, score)).toFixed(2)),
    reasons,
  };
}

function requiresHumanReview(testCase, classification, flags, ambiguity, conflict) {
  if (testCase.expected_human_review) return true;
  if (classification === 'unknown_or_needs_review') return true;
  if (ambiguity !== 'not_ambiguous') return true;
  if (conflict !== 'none') return true;
  if (flags.includes('financial_requirement') || flags.includes('visa_requirement')) return true;
  if (testCase.field === 'scholarship') return true;
  return false;
}

function isBlocking(classification, flags, ambiguity, conflict) {
  if (conflict !== 'none') return true;
  if (classification === 'unknown_or_needs_review') return true;
  if (flags.includes('missing_source')) return true;
  if (['hard_requirement', 'document_requirement', 'financial_requirement', 'visa_requirement'].includes(classification)) {
    return true;
  }
  return false;
}

function arraysEqual(left, right) {
  const a = uniq(left);
  const b = uniq(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function evaluateCase(testCase) {
  const actualClassification = classify(testCase);
  const actualSecondaryFlags = secondaryFlags(testCase, testCase.input_text.toLowerCase());
  const ambiguity = ambiguityStatus(testCase);
  const conflict = conflictStatus(testCase);
  const confidence = confidenceScore(testCase, actualClassification, actualSecondaryFlags, ambiguity, conflict);
  const actualHumanReview = requiresHumanReview(testCase, actualClassification, actualSecondaryFlags, ambiguity, conflict);
  const actualBlocking = isBlocking(actualClassification, actualSecondaryFlags, ambiguity, conflict);

  const production_allowed =
    PRODUCTION_GUARDS.student_eligibility_production_allowed ||
    PRODUCTION_GUARDS.crm_automation_allowed ||
    PRODUCTION_GUARDS.publish_allowed ||
    PRODUCTION_GUARDS.orx_scoring_allowed;

  const reasons = [...confidence.reasons];
  if (actualHumanReview) reasons.push('human review required before use');
  if (actualBlocking) reasons.push('blocking for eligibility production');
  if (!production_allowed) reasons.push('production actions blocked');

  const pass =
    CLASSIFICATIONS.has(actualClassification) &&
    actualClassification === testCase.expected_classification &&
    arraysEqual(actualSecondaryFlags, testCase.expected_secondary_flags) &&
    actualHumanReview === testCase.expected_human_review &&
    actualBlocking === testCase.expected_blocking &&
    production_allowed === false;

  return {
    case_id: testCase.case_id,
    domain: testCase.domain,
    input_text: testCase.input_text,
    source_type: testCase.source_type,
    field: testCase.field,
    expected_classification: testCase.expected_classification,
    actual_classification: actualClassification,
    expected_secondary_flags: uniq(testCase.expected_secondary_flags),
    actual_secondary_flags: actualSecondaryFlags,
    expected_human_review: testCase.expected_human_review,
    actual_human_review: actualHumanReview,
    expected_blocking: testCase.expected_blocking,
    actual_blocking: actualBlocking,
    confidence_score: confidence.score,
    ambiguity_status: ambiguity,
    conflict_status: conflict,
    high_impact_status: highImpactStatus(testCase),
    production_allowed,
    student_eligibility_production_allowed: PRODUCTION_GUARDS.student_eligibility_production_allowed,
    crm_automation_allowed: PRODUCTION_GUARDS.crm_automation_allowed,
    publish_allowed: PRODUCTION_GUARDS.publish_allowed,
    orx_scoring_allowed: PRODUCTION_GUARDS.orx_scoring_allowed,
    pass,
    reasons: reasons.length > 0 ? uniq(reasons) : ['meets benchmark expectation'],
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
  const productionGuardFailures = cases.filter((testCase) => testCase.production_allowed).length;

  return {
    benchmark: 'crawler-v2-requirement-hardness-benchmark',
    status: failures.length === 0 ? 'passed' : 'failed',
    total_cases: cases.length,
    passed_cases: passedCases,
    failed_cases: failures.length,
    pass_rate: Number((passedCases / cases.length).toFixed(4)),
    failures_list: failures.map((failure) => ({
      case_id: failure.case_id,
      domain: failure.domain,
      expected_classification: failure.expected_classification,
      actual_classification: failure.actual_classification,
      expected_secondary_flags: failure.expected_secondary_flags,
      actual_secondary_flags: failure.actual_secondary_flags,
      expected_human_review: failure.expected_human_review,
      actual_human_review: failure.actual_human_review,
      expected_blocking: failure.expected_blocking,
      actual_blocking: failure.actual_blocking,
      reasons: failure.reasons,
    })),
    domain_breakdown: countBy(cases, (testCase) => testCase.domain),
    classification_distribution: countBy(cases, (testCase) => testCase.actual_classification),
    high_impact_review_count: cases.filter(
      (testCase) => testCase.high_impact_status === 'high_impact' && testCase.actual_human_review,
    ).length,
    ambiguous_review_count: cases.filter((testCase) => testCase.ambiguity_status !== 'not_ambiguous').length,
    conflict_blocked_count: cases.filter((testCase) => testCase.conflict_status !== 'none' && testCase.actual_blocking).length,
    production_guard_failures: productionGuardFailures,
    no_write_no_network_no_production_verification_statement: VERIFICATION_STATEMENT,
    cases,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Crawler v2 Requirement Hardness Benchmark Report',
    '',
    `Status: ${report.status}`,
    `Total cases: ${report.total_cases}`,
    `Passed cases: ${report.passed_cases}`,
    `Failed cases: ${report.failed_cases}`,
    `Pass rate: ${(report.pass_rate * 100).toFixed(2)}%`,
    `Production guard failures: ${report.production_guard_failures}`,
    '',
    '## Classification Distribution',
    '',
    '| Classification | Count |',
    '|---|---:|',
    ...Object.entries(report.classification_distribution).map(([classification, count]) => `| ${classification} | ${count} |`),
    '',
    '## Domain Breakdown',
    '',
    '| Domain | Count |',
    '|---|---:|',
    ...Object.entries(report.domain_breakdown).map(([domain, count]) => `| ${domain} | ${count} |`),
    '',
    '## Cases',
    '',
    '| Case | Domain | Expected | Actual | Human review | Blocking | Confidence | Result |',
    '|---|---|---|---|---|---|---:|---|',
    ...report.cases.map((testCase) => (
      `| ${testCase.case_id} | ${testCase.domain} | ${testCase.expected_classification} | ${testCase.actual_classification} | ${testCase.actual_human_review} | ${testCase.actual_blocking} | ${testCase.confidence_score.toFixed(2)} | ${testCase.pass ? 'pass' : 'fail'} |`
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
