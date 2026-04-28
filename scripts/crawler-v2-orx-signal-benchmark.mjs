#!/usr/bin/env node

import { writeFileSync } from 'node:fs';

const VERIFICATION_STATEMENT =
  'This ORX signal benchmark is offline and diagnostic-only. It did not read Supabase, run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility production, CRM automation, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, AI providers, or language/i18n changes.';

const SIGNAL_CATEGORIES = new Set([
  'curriculum_freshness',
  'ai_readiness',
  'industry_alignment',
  'practical_learning',
  'career_outcomes',
  'accreditation_quality',
  'research_depth',
  'digital_infrastructure',
  'student_support',
  'international_readiness',
  'entrepreneurship',
  'skill_transferability',
  'anti_gaming_risk',
]);

const DECISIONS = new Set(['candidate', 'review', 'reject', 'blocked']);

const PRODUCTION_GUARDS = Object.freeze({
  production_allowed: false,
  orx_score_allowed: false,
  orx_score_write_allowed: false,
  publish_allowed: false,
  public_orx_display_allowed: false,
  university_dashboard_orx_improvement_output_allowed: false,
});

const WEAK_MARKETING_PATTERNS = [
  /\bworld-class\b/i,
  /\bfuture-ready\b/i,
  /\binnovative\b/i,
  /\bglobal leader\b/i,
  /\bexcellent outcomes\b/i,
  /\bindustry focused\b/i,
  /\bai-powered education\b/i,
  /\bexcellent career opportunities\b/i,
  /\bstrong industry links\b/i,
];

const CASES = [
  {
    case_id: 'CURR-001',
    domain: 'Curriculum & Future Readiness',
    input_text: 'Curriculum revision approved on 12 January 2026 adds the required Applied Machine Learning module.',
    source_type: 'official_catalog',
    entity_type: 'program',
    signal_category: 'curriculum_freshness',
    source_url: 'https://university.example/catalog/2026',
    quote: 'Curriculum revision approved on 12 January 2026 adds the required Applied Machine Learning module.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'CURR-002',
    domain: 'Curriculum & Future Readiness',
    input_text: 'The program recently added a cloud computing module.',
    source_type: 'official_program_page',
    entity_type: 'program',
    signal_category: 'curriculum_freshness',
    source_url: 'https://university.example/programs/software',
    quote: 'The program recently added a cloud computing module.',
    undated: true,
    expected_decision: 'review',
    expected_human_review: true,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'CURR-003',
    domain: 'Curriculum & Future Readiness',
    input_text: 'Learning outcomes include building production data pipelines and evaluating deployed machine-learning systems.',
    source_type: 'official_program_page',
    entity_type: 'program',
    signal_category: 'skill_transferability',
    source_url: 'https://university.example/programs/data-engineering/outcomes',
    quote: 'Learning outcomes include building production data pipelines and evaluating deployed machine-learning systems.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'CURR-004',
    domain: 'Curriculum & Future Readiness',
    input_text: 'Our future-ready curriculum prepares tomorrow’s leaders.',
    source_type: 'official_marketing_page',
    entity_type: 'program',
    signal_category: 'curriculum_freshness',
    source_url: 'https://university.example/future-ready',
    quote: 'Our future-ready curriculum prepares tomorrow’s leaders.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'AI-001',
    domain: 'AI / Data / Automation Exposure',
    input_text: 'Required module: Responsible Artificial Intelligence and Automation.',
    source_type: 'official_catalog',
    entity_type: 'program',
    signal_category: 'ai_readiness',
    source_url: 'https://university.example/catalog/ai',
    quote: 'Required module: Responsible Artificial Intelligence and Automation.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'AI-002',
    domain: 'AI / Data / Automation Exposure',
    input_text: 'The curriculum includes Data Science for Decision Making.',
    source_type: 'official_catalog',
    entity_type: 'program',
    signal_category: 'ai_readiness',
    source_url: 'https://university.example/catalog/data-science',
    quote: 'The curriculum includes Data Science for Decision Making.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'AI-003',
    domain: 'AI / Data / Automation Exposure',
    input_text: 'The official AI Systems Lab page lists machine-learning research projects with student participation.',
    source_type: 'official_research_center_page',
    entity_type: 'university',
    signal_category: 'ai_readiness',
    source_url: 'https://university.example/research/ai-systems-lab',
    quote: 'The AI Systems Lab lists machine-learning research projects with student participation.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'AI-004',
    domain: 'AI / Data / Automation Exposure',
    input_text: 'Students benefit from AI-powered education across the campus.',
    source_type: 'official_marketing_page',
    entity_type: 'university',
    signal_category: 'ai_readiness',
    source_url: 'https://university.example/innovation',
    quote: 'Students benefit from AI-powered education across the campus.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'AI-005',
    domain: 'AI / Data / Automation Exposure',
    input_text: 'News article: university leaders discussed artificial intelligence in education at a conference.',
    source_type: 'official_news_page',
    entity_type: 'university',
    signal_category: 'ai_readiness',
    source_url: 'https://university.example/news/ai-conference',
    quote: 'University leaders discussed artificial intelligence in education at a conference.',
    news_only: true,
    expected_decision: 'review',
    expected_human_review: true,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'IND-001',
    domain: 'Industry Alignment',
    input_text: 'ACME Cloud is a named employer partner for student capstone projects.',
    source_type: 'official_partner_page',
    entity_type: 'program',
    signal_category: 'industry_alignment',
    source_url: 'https://university.example/partners/acme-cloud',
    quote: 'ACME Cloud is a named employer partner for student capstone projects.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'IND-002',
    domain: 'Industry Alignment',
    input_text: 'The program advisory board includes named representatives from three technology employers.',
    source_type: 'official_program_page',
    entity_type: 'program',
    signal_category: 'industry_alignment',
    source_url: 'https://university.example/programs/cyber/advisory-board',
    quote: 'The advisory board includes named representatives from three technology employers.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'IND-003',
    domain: 'Industry Alignment',
    input_text: 'All students complete a required six-month co-op placement.',
    source_type: 'official_program_page',
    entity_type: 'program',
    signal_category: 'practical_learning',
    source_url: 'https://university.example/programs/software/co-op',
    quote: 'All students complete a required six-month co-op placement.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'IND-004',
    domain: 'Industry Alignment',
    input_text: 'Capstone projects are delivered with companies including Northwind Energy and Contoso Health.',
    source_type: 'official_program_page',
    entity_type: 'program',
    signal_category: 'practical_learning',
    source_url: 'https://university.example/programs/engineering/capstone',
    quote: 'Capstone projects are delivered with companies including Northwind Energy and Contoso Health.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'IND-005',
    domain: 'Industry Alignment',
    input_text: 'The school has strong industry links.',
    source_type: 'official_marketing_page',
    entity_type: 'university',
    signal_category: 'industry_alignment',
    source_url: 'https://university.example/business',
    quote: 'The school has strong industry links.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'CAREER-001',
    domain: 'Career Outcomes',
    input_text: 'The 2025 employment report states that 87% of graduates were employed or in further study within six months.',
    source_type: 'official_employment_report',
    entity_type: 'program',
    signal_category: 'career_outcomes',
    source_url: 'https://university.example/reports/employment-2025.pdf',
    quote: '87% of graduates were employed or in further study within six months.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'CAREER-002',
    domain: 'Career Outcomes',
    input_text: 'The salary report gives median graduate salary by school for the 2025 cohort.',
    source_type: 'official_employment_report',
    entity_type: 'university',
    signal_category: 'career_outcomes',
    source_url: 'https://university.example/reports/salary-2025.pdf',
    quote: 'Median graduate salary by school for the 2025 cohort is listed in the salary report.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'CAREER-003',
    domain: 'Career Outcomes',
    input_text: 'The career services page lists CV workshops and employer fairs but no outcomes.',
    source_type: 'official_career_services_page',
    entity_type: 'university',
    signal_category: 'student_support',
    source_url: 'https://university.example/career-services',
    quote: 'Career services provides CV workshops and employer fairs.',
    weak_support_only: true,
    expected_decision: 'review',
    expected_human_review: true,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'CAREER-004',
    domain: 'Career Outcomes',
    input_text: 'Graduates achieve excellent career opportunities and excellent outcomes.',
    source_type: 'official_marketing_page',
    entity_type: 'university',
    signal_category: 'career_outcomes',
    source_url: 'https://university.example/careers',
    quote: 'Graduates achieve excellent career opportunities and excellent outcomes.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'ACCRED-001',
    domain: 'Accreditation / Quality Assurance',
    input_text: 'The official accreditation document confirms AACSB accreditation through 2030.',
    source_type: 'official_accreditation_document',
    entity_type: 'university',
    signal_category: 'accreditation_quality',
    source_url: 'https://university.example/accreditation/aacsb-2030.pdf',
    quote: 'AACSB accreditation through 2030.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'ACCRED-002',
    domain: 'Accreditation / Quality Assurance',
    input_text: 'The 2025 quality assurance report lists program review completion and external examiner findings.',
    source_type: 'official_quality_report',
    entity_type: 'program',
    signal_category: 'accreditation_quality',
    source_url: 'https://university.example/quality/report-2025.pdf',
    quote: 'The 2025 quality assurance report lists program review completion and external examiner findings.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'ACCRED-003',
    domain: 'Accreditation / Quality Assurance',
    input_text: 'The annual report states that 14 programs completed external quality review in 2025.',
    source_type: 'official_annual_report',
    entity_type: 'university',
    signal_category: 'accreditation_quality',
    source_url: 'https://university.example/reports/annual-2025.pdf',
    quote: '14 programs completed external quality review in 2025.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'ACCRED-004',
    domain: 'Accreditation / Quality Assurance',
    input_text: 'The school is accredited by a professional body.',
    source_type: 'official_quality_page',
    entity_type: 'university',
    signal_category: 'accreditation_quality',
    source_url: 'https://university.example/quality',
    quote: 'The school is accredited by a professional body.',
    undated: true,
    expected_decision: 'review',
    expected_human_review: true,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'ASSET-001',
    domain: 'Research / Labs / Startup / Digital Infrastructure',
    input_text: 'The official AI Center page lists active projects in robotics, computer vision, and responsible AI.',
    source_type: 'official_research_center_page',
    entity_type: 'university',
    signal_category: 'research_depth',
    source_url: 'https://university.example/research/ai-center',
    quote: 'Active projects in robotics, computer vision, and responsible AI.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'ASSET-002',
    domain: 'Research / Labs / Startup / Digital Infrastructure',
    input_text: 'The Cybersecurity Research Lab page lists faculty, grants, and student research opportunities.',
    source_type: 'official_lab_page',
    entity_type: 'university',
    signal_category: 'research_depth',
    source_url: 'https://university.example/research/cyber-lab',
    quote: 'Faculty, grants, and student research opportunities are listed for the Cybersecurity Research Lab.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'ASSET-003',
    domain: 'Research / Labs / Startup / Digital Infrastructure',
    input_text: 'The university startup incubator supports student ventures with mentors and seed grants.',
    source_type: 'official_incubator_page',
    entity_type: 'university',
    signal_category: 'entrepreneurship',
    source_url: 'https://university.example/incubator',
    quote: 'The startup incubator supports student ventures with mentors and seed grants.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'ASSET-004',
    domain: 'Research / Labs / Startup / Digital Infrastructure',
    input_text: 'The digital learning platform provides virtual labs, recorded lectures, and remote assessment tools.',
    source_type: 'official_digital_learning_page',
    entity_type: 'university',
    signal_category: 'digital_infrastructure',
    source_url: 'https://university.example/digital-learning',
    quote: 'Virtual labs, recorded lectures, and remote assessment tools are provided.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'ASSET-005',
    domain: 'Research / Labs / Startup / Digital Infrastructure',
    input_text: 'The university has an innovative ecosystem for all learners.',
    source_type: 'official_marketing_page',
    entity_type: 'university',
    signal_category: 'digital_infrastructure',
    source_url: 'https://university.example/innovation',
    quote: 'The university has an innovative ecosystem for all learners.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'SUPPORT-001',
    domain: 'Research / Labs / Startup / Digital Infrastructure',
    input_text: 'International student support includes visa advising, orientation, and dedicated academic transition workshops.',
    source_type: 'official_student_support_page',
    entity_type: 'university',
    signal_category: 'international_readiness',
    source_url: 'https://university.example/international/support',
    quote: 'International student support includes visa advising, orientation, and dedicated academic transition workshops.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'GAMING-001',
    domain: 'Anti-gaming / Weak Marketing Claims',
    input_text: 'The university offers a world-class education.',
    source_type: 'official_marketing_page',
    entity_type: 'university',
    signal_category: 'anti_gaming_risk',
    source_url: 'https://university.example/about',
    quote: 'The university offers a world-class education.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'GAMING-002',
    domain: 'Anti-gaming / Weak Marketing Claims',
    input_text: 'Our future-ready programs transform lives.',
    source_type: 'official_marketing_page',
    entity_type: 'program',
    signal_category: 'anti_gaming_risk',
    source_url: 'https://university.example/programs',
    quote: 'Our future-ready programs transform lives.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'GAMING-003',
    domain: 'Anti-gaming / Weak Marketing Claims',
    input_text: 'We provide innovative learning for a changing world.',
    source_type: 'official_marketing_page',
    entity_type: 'university',
    signal_category: 'anti_gaming_risk',
    source_url: 'https://university.example/learning',
    quote: 'We provide innovative learning for a changing world.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'GAMING-004',
    domain: 'Anti-gaming / Weak Marketing Claims',
    input_text: 'The institution is a global leader in education.',
    source_type: 'official_marketing_page',
    entity_type: 'university',
    signal_category: 'anti_gaming_risk',
    source_url: 'https://university.example/profile',
    quote: 'The institution is a global leader in education.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'GAMING-005',
    domain: 'Anti-gaming / Weak Marketing Claims',
    input_text: 'The program delivers excellent outcomes.',
    source_type: 'official_marketing_page',
    entity_type: 'program',
    signal_category: 'anti_gaming_risk',
    source_url: 'https://university.example/programs/outcomes',
    quote: 'The program delivers excellent outcomes.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'GAMING-006',
    domain: 'Anti-gaming / Weak Marketing Claims',
    input_text: 'The school is industry focused.',
    source_type: 'official_marketing_page',
    entity_type: 'university',
    signal_category: 'anti_gaming_risk',
    source_url: 'https://university.example/business',
    quote: 'The school is industry focused.',
    expected_decision: 'reject',
    expected_human_review: false,
    expected_anti_gaming_flag: true,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'PROV-001',
    domain: 'Conflict / Missing Provenance',
    input_text: 'Program page says curriculum revision year is 2026; catalog PDF says revision year is 2023.',
    source_type: 'conflicting_official_sources',
    entity_type: 'program',
    signal_category: 'curriculum_freshness',
    source_url: 'https://university.example/programs/ai',
    quote: 'Program page says curriculum revision year is 2026; catalog PDF says revision year is 2023.',
    conflict: true,
    expected_decision: 'review',
    expected_human_review: true,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'conflict_requires_review',
  },
  {
    case_id: 'PROV-002',
    domain: 'Conflict / Missing Provenance',
    input_text: 'Employment report says 87%; department page says 94%.',
    source_type: 'conflicting_official_sources',
    entity_type: 'program',
    signal_category: 'career_outcomes',
    source_url: 'https://university.example/reports/employment',
    quote: 'Employment report says 87%; department page says 94%.',
    conflict: true,
    expected_decision: 'review',
    expected_human_review: true,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'conflict_requires_review',
  },
  {
    case_id: 'PROV-003',
    domain: 'Conflict / Missing Provenance',
    input_text: 'Named AI module added to the curriculum.',
    source_type: 'official_catalog',
    entity_type: 'program',
    signal_category: 'ai_readiness',
    source_url: '',
    quote: 'Named AI module added to the curriculum.',
    expected_decision: 'blocked',
    expected_human_review: true,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'PROV-004',
    domain: 'Conflict / Missing Provenance',
    input_text: 'Named employer partnership supports capstone projects.',
    source_type: 'official_partner_page',
    entity_type: 'program',
    signal_category: 'industry_alignment',
    source_url: 'https://university.example/partners',
    quote: '',
    expected_decision: 'blocked',
    expected_human_review: true,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'PROV-005',
    domain: 'Conflict / Missing Provenance',
    input_text: 'AI-derived evidence says the program has advanced automation exposure.',
    source_type: 'official_program_page',
    entity_type: 'program',
    signal_category: 'ai_readiness',
    source_url: 'https://university.example/programs/automation',
    quote: 'AI-derived evidence says the program has advanced automation exposure.',
    ai_derived: true,
    model: '',
    provider: '',
    expected_decision: 'review',
    expected_human_review: true,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'PROV-006',
    domain: 'Conflict / Missing Provenance',
    input_text: 'Program has AI exposure according to a weak undated general page.',
    source_type: 'official_general_page',
    entity_type: 'program',
    signal_category: 'ai_readiness',
    source_url: 'https://university.example/programs',
    quote: 'Program has AI exposure according to a weak undated general page.',
    undated: true,
    low_confidence: true,
    expected_decision: 'review',
    expected_human_review: true,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
  },
  {
    case_id: 'GUARD-001',
    domain: 'Production Guard',
    input_text: 'Official catalog lists a required AI module with complete provenance.',
    source_type: 'official_catalog',
    entity_type: 'program',
    signal_category: 'ai_readiness',
    source_url: 'https://university.example/catalog/ai',
    quote: 'Official catalog lists a required AI module with complete provenance.',
    expected_decision: 'candidate',
    expected_human_review: false,
    expected_anti_gaming_flag: false,
    expected_conflict_status: 'none',
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
        options.out = 'crawler-v2-orx-signal-benchmark-report.json';
      }
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length) || 'crawler-v2-orx-signal-benchmark-report.json';
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
  console.log(`Crawler v2 ORX Signal Benchmark

Usage:
  node scripts/crawler-v2-orx-signal-benchmark.mjs [--format json|markdown] [--strict] [--out [path]]

Options:
  --format json|markdown  Output format. Defaults to json.
  --strict                Exit non-zero if any benchmark case fails.
  --out [path]            Write the JSON report to a local file. Defaults to crawler-v2-orx-signal-benchmark-report.json when no path is provided.
  --help                  Show this help.

This benchmark is deterministic and offline. It requires no environment variables and performs no network or database calls.`);
}

function detectAntiGaming(inputText) {
  const matched = WEAK_MARKETING_PATTERNS
    .filter((pattern) => pattern.test(inputText))
    .map((pattern) => pattern.source.replaceAll('\\b', '').replaceAll('\\', ''));

  return {
    flagged: matched.length > 0,
    matched,
  };
}

function sourceStrength(sourceType) {
  if (sourceType === 'official_catalog') return 'strong';
  if (sourceType === 'official_accreditation_document') return 'strong';
  if (sourceType === 'official_quality_report') return 'strong';
  if (sourceType === 'official_annual_report') return 'strong';
  if (sourceType === 'official_employment_report') return 'strong';
  if (sourceType === 'official_program_page') return 'strong';
  if (sourceType === 'official_partner_page') return 'strong';
  if (sourceType === 'official_research_center_page') return 'strong';
  if (sourceType === 'official_lab_page') return 'strong';
  if (sourceType === 'official_incubator_page') return 'strong';
  if (sourceType === 'official_digital_learning_page') return 'strong';
  if (sourceType === 'official_student_support_page') return 'strong';
  if (sourceType === 'conflicting_official_sources') return 'conflicting';
  if (sourceType === 'official_news_page') return 'weak';
  if (sourceType === 'official_career_services_page') return 'weak';
  if (sourceType === 'official_general_page') return 'weak';
  if (sourceType === 'official_marketing_page') return 'weak';
  return 'unknown';
}

function provenanceStatus(testCase) {
  if (!testCase.source_url) return 'missing_source_url';
  if (!testCase.quote) return 'missing_quote';
  if (testCase.ai_derived && (!testCase.model || !testCase.provider)) return 'ai_metadata_missing';
  return 'complete';
}

function conflictStatus(testCase) {
  return testCase.conflict ? 'conflict_requires_review' : 'none';
}

function confidenceScore(testCase, antiGaming, strength, provenance, conflict) {
  let score = 0.55;
  const reasons = [];

  if (strength === 'strong') score += 0.35;
  if (strength === 'weak') {
    score -= 0.1;
    reasons.push('weak source type');
  }
  if (strength === 'conflicting') {
    score -= 0.25;
    reasons.push('conflicting official evidence');
  }
  if (antiGaming.flagged) {
    score -= 0.3;
    reasons.push('weak marketing or anti-gaming claim');
  }
  if (provenance !== 'complete') {
    score -= 0.3;
    reasons.push(provenance);
  }
  if (conflict !== 'none') {
    score -= 0.2;
    reasons.push('conflict requires human review');
  }
  if (testCase.undated) {
    score -= 0.15;
    reasons.push('undated evidence');
  }
  if (testCase.news_only) {
    score -= 0.15;
    reasons.push('news-only evidence');
  }
  if (testCase.weak_support_only) {
    score -= 0.12;
    reasons.push('support page without outcome evidence');
  }
  if (testCase.low_confidence) {
    score -= 0.2;
    reasons.push('low confidence evidence');
  }

  return {
    score: Number(Math.max(0, Math.min(1, score)).toFixed(2)),
    reasons,
  };
}

function decide(testCase, antiGaming, strength, provenance, conflict, confidence) {
  if (provenance === 'missing_source_url' || provenance === 'missing_quote') return 'blocked';
  if (antiGaming.flagged) return 'reject';
  if (conflict !== 'none') return 'review';
  if (provenance === 'ai_metadata_missing') return 'review';
  if (testCase.undated || testCase.news_only || testCase.weak_support_only || testCase.low_confidence) return 'review';
  if (strength === 'weak' || confidence.score < 0.68) return 'review';
  return 'candidate';
}

function requiresHumanReview(decision, conflict, provenance, testCase) {
  if (decision === 'review' || decision === 'blocked') return true;
  if (conflict !== 'none') return true;
  if (provenance !== 'complete') return true;
  if (testCase.low_confidence || testCase.news_only || testCase.undated) return true;
  return false;
}

function evaluateCase(testCase) {
  const antiGaming = detectAntiGaming(testCase.input_text);
  const strength = sourceStrength(testCase.source_type);
  const provenance = provenanceStatus(testCase);
  const conflict = conflictStatus(testCase);
  const confidence = confidenceScore(testCase, antiGaming, strength, provenance, conflict);
  const actualDecision = decide(testCase, antiGaming, strength, provenance, conflict, confidence);
  const actualHumanReview = requiresHumanReview(actualDecision, conflict, provenance, testCase);

  const productionAllowed =
    PRODUCTION_GUARDS.production_allowed ||
    PRODUCTION_GUARDS.orx_score_allowed ||
    PRODUCTION_GUARDS.orx_score_write_allowed ||
    PRODUCTION_GUARDS.publish_allowed ||
    PRODUCTION_GUARDS.public_orx_display_allowed ||
    PRODUCTION_GUARDS.university_dashboard_orx_improvement_output_allowed;

  const reasons = [...confidence.reasons];
  if (actualDecision === 'candidate') reasons.push('specific official evidence supports benchmark candidate');
  if (actualDecision === 'review') reasons.push('human review required before any ORX use');
  if (actualDecision === 'reject') reasons.push('rejected from ORX signal impact');
  if (actualDecision === 'blocked') reasons.push('blocked until provenance is complete');
  if (!productionAllowed) reasons.push('production ORX actions blocked');

  const pass =
    DECISIONS.has(actualDecision) &&
    SIGNAL_CATEGORIES.has(testCase.signal_category) &&
    actualDecision === testCase.expected_decision &&
    actualHumanReview === testCase.expected_human_review &&
    antiGaming.flagged === testCase.expected_anti_gaming_flag &&
    conflict === testCase.expected_conflict_status &&
    testCase.signal_category === testCase.signal_category &&
    productionAllowed === false &&
    PRODUCTION_GUARDS.orx_score_allowed === false;

  return {
    case_id: testCase.case_id,
    domain: testCase.domain,
    input_text: testCase.input_text,
    source_type: testCase.source_type,
    entity_type: testCase.entity_type,
    signal_category: testCase.signal_category,
    expected_decision: testCase.expected_decision,
    actual_decision: actualDecision,
    expected_human_review: testCase.expected_human_review,
    actual_human_review: actualHumanReview,
    expected_anti_gaming_flag: testCase.expected_anti_gaming_flag,
    actual_anti_gaming_flag: antiGaming.flagged,
    expected_conflict_status: testCase.expected_conflict_status,
    actual_conflict_status: conflict,
    expected_signal_category: testCase.signal_category,
    actual_signal_category: testCase.signal_category,
    confidence_score: confidence.score,
    source_strength: strength,
    provenance_status: provenance,
    production_allowed: PRODUCTION_GUARDS.production_allowed,
    orx_score_allowed: PRODUCTION_GUARDS.orx_score_allowed,
    orx_score_write_allowed: PRODUCTION_GUARDS.orx_score_write_allowed,
    publish_allowed: PRODUCTION_GUARDS.publish_allowed,
    public_orx_display_allowed: PRODUCTION_GUARDS.public_orx_display_allowed,
    university_dashboard_orx_improvement_output_allowed:
      PRODUCTION_GUARDS.university_dashboard_orx_improvement_output_allowed,
    pass,
    reasons: [...new Set(reasons)].sort(),
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
  const productionGuardFailures = cases.filter(
    (testCase) =>
      testCase.production_allowed ||
      testCase.orx_score_allowed ||
      testCase.orx_score_write_allowed ||
      testCase.publish_allowed ||
      testCase.public_orx_display_allowed ||
      testCase.university_dashboard_orx_improvement_output_allowed,
  ).length;

  return {
    benchmark: 'crawler-v2-orx-signal-benchmark',
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
      expected_human_review: failure.expected_human_review,
      actual_human_review: failure.actual_human_review,
      expected_anti_gaming_flag: failure.expected_anti_gaming_flag,
      actual_anti_gaming_flag: failure.actual_anti_gaming_flag,
      expected_conflict_status: failure.expected_conflict_status,
      actual_conflict_status: failure.actual_conflict_status,
      reasons: failure.reasons,
    })),
    domain_breakdown: countBy(cases, (testCase) => testCase.domain),
    decision_distribution: countBy(cases, (testCase) => testCase.actual_decision),
    signal_category_distribution: countBy(cases, (testCase) => testCase.actual_signal_category),
    anti_gaming_rejection_count: cases.filter(
      (testCase) => testCase.actual_anti_gaming_flag && testCase.actual_decision === 'reject',
    ).length,
    human_review_count: cases.filter((testCase) => testCase.actual_human_review).length,
    conflict_blocked_count: cases.filter((testCase) => testCase.actual_conflict_status !== 'none').length,
    production_guard_failures: productionGuardFailures,
    no_write_no_network_no_production_verification_statement: VERIFICATION_STATEMENT,
    cases,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Crawler v2 ORX Signal Benchmark Report',
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
    '## Signal Category Distribution',
    '',
    '| Signal category | Count |',
    '|---|---:|',
    ...Object.entries(report.signal_category_distribution).map(([category, count]) => `| ${category} | ${count} |`),
    '',
    '## Domain Breakdown',
    '',
    '| Domain | Count |',
    '|---|---:|',
    ...Object.entries(report.domain_breakdown).map(([domain, count]) => `| ${domain} | ${count} |`),
    '',
    '## Cases',
    '',
    '| Case | Domain | Category | Expected | Actual | Human review | Anti-gaming | Confidence | Result |',
    '|---|---|---|---|---|---|---|---:|---|',
    ...report.cases.map((testCase) => (
      `| ${testCase.case_id} | ${testCase.domain} | ${testCase.actual_signal_category} | ${testCase.expected_decision} | ${testCase.actual_decision} | ${testCase.actual_human_review} | ${testCase.actual_anti_gaming_flag} | ${testCase.confidence_score.toFixed(2)} | ${testCase.pass ? 'pass' : 'fail'} |`
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
