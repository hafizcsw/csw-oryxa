#!/usr/bin/env node

import { writeFileSync } from 'node:fs';

const VERIFICATION_STATEMENT =
  'This review quality benchmark is offline and diagnostic-only. It did not read Supabase, run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, AI providers, or language/i18n changes.';

const HIGH_IMPACT_FIELDS = new Set([
  'tuition',
  'fees',
  'deadline',
  'language_requirement',
  'admission_requirement',
  'apply_url',
  'scholarship',
  'accreditation',
  'career_outcome',
  'orx_signal',
  'student_eligibility_requirement',
]);

const WEAK_MARKETING_PATTERNS = [
  /\bworld-class\b/i,
  /\bfuture-ready\b/i,
  /\binnovative education\b/i,
  /\bglobal leader\b/i,
  /\bexcellent career opportunities\b/i,
];

const PRODUCTION_ACTIONS = Object.freeze({
  publish_allowed: false,
  orx_scoring_allowed: false,
  student_eligibility_production_allowed: false,
  crm_automation_allowed: false,
});

const MOCK_CASES = [
  {
    case_id: 'CONF-001',
    domain: 'Confidence Engine',
    summary: 'Official program page with exact quote, fresh timestamp, and no conflict.',
    field: 'program_name',
    source_type: 'official_program_page',
    source_url: 'https://university.example/programs/ms-data-science',
    quote: 'Master of Science in Data Science',
    observed_days_ago: 14,
    extraction_method: 'basic_extract',
    conflict: false,
    draft_candidate: true,
    expected_lane: 'Ready for Draft',
    expected_human_review: false,
  },
  {
    case_id: 'CONF-002',
    domain: 'Confidence Engine',
    summary: 'Official source with weak quote and stale timestamp.',
    field: 'program_summary',
    source_type: 'official_general_page',
    source_url: 'https://university.example/about',
    quote: 'Our programs prepare leaders for tomorrow.',
    quote_strength: 'weak',
    observed_days_ago: 520,
    extraction_method: 'basic_extract',
    expected_lane: 'Low Confidence',
    expected_human_review: false,
  },
  {
    case_id: 'CONF-003',
    domain: 'Confidence Engine',
    summary: 'Evidence is missing a supporting quote.',
    field: 'language_requirement',
    source_type: 'official_admissions_page',
    source_url: 'https://university.example/admissions/language',
    quote: '',
    observed_days_ago: 20,
    extraction_method: 'basic_extract',
    expected_lane: 'Needs Evidence',
    expected_human_review: true,
  },
  {
    case_id: 'CONF-004',
    domain: 'Confidence Engine',
    summary: 'Evidence is missing source URL.',
    field: 'admission_requirement',
    source_type: 'official_admissions_page',
    source_url: '',
    quote: 'Applicants must submit an official transcript.',
    observed_days_ago: 12,
    extraction_method: 'basic_extract',
    expected_lane: 'Needs Evidence',
    expected_human_review: true,
  },
  {
    case_id: 'CONF-005',
    domain: 'Confidence Engine',
    summary: 'AI-derived high-impact field without model/provider metadata.',
    field: 'tuition',
    source_type: 'official_tuition_page',
    source_url: 'https://university.example/tuition',
    quote: 'Tuition for the program is 18000 EUR per year.',
    observed_days_ago: 40,
    extraction_method: 'ai_extract',
    ai_derived: true,
    model: '',
    provider: '',
    expected_lane: 'Critical',
    expected_human_review: true,
  },
  {
    case_id: 'CONF-006',
    domain: 'Confidence Engine',
    summary: 'High-impact deadline has low confidence.',
    field: 'deadline',
    source_type: 'official_admissions_page',
    source_url: 'https://university.example/admissions/deadlines',
    quote: 'Application dates may vary by intake.',
    quote_strength: 'weak',
    observed_days_ago: 365,
    extraction_method: 'basic_extract',
    expected_lane: 'Critical',
    expected_human_review: true,
  },
  {
    case_id: 'CONF-007',
    domain: 'Confidence Engine',
    summary: 'AI-derived low-impact field without model/provider metadata.',
    field: 'campus_description',
    source_type: 'official_general_page',
    source_url: 'https://university.example/campus',
    quote: 'The main campus is located downtown.',
    observed_days_ago: 30,
    extraction_method: 'ai_extract',
    ai_derived: true,
    model: '',
    provider: '',
    expected_lane: 'Low Confidence',
    expected_human_review: false,
  },
  {
    case_id: 'CONFLICT-001',
    domain: 'Official Conflict Resolver',
    summary: 'Program page and general admissions page disagree on a requirement.',
    field: 'admission_requirement',
    source_type: 'official_program_page',
    source_url: 'https://university.example/programs/ms-ai/admissions',
    quote: 'GRE is not required for this program.',
    observed_days_ago: 25,
    extraction_method: 'basic_extract',
    conflict: true,
    conflict_detail: 'Program page says GRE not required; general admissions page says GRE required.',
    expected_lane: 'Conflicts',
    expected_human_review: true,
  },
  {
    case_id: 'CONFLICT-002',
    domain: 'Official Conflict Resolver',
    summary: 'Tuition page and marketing page disagree on tuition.',
    field: 'tuition',
    source_type: 'official_tuition_page',
    source_url: 'https://university.example/tuition',
    quote: 'Tuition is 22000 EUR per academic year.',
    observed_days_ago: 18,
    extraction_method: 'basic_extract',
    conflict: true,
    conflict_detail: 'Tuition page says 22000 EUR; marketing page says affordable tuition from 12000 EUR.',
    expected_lane: 'Conflicts',
    expected_human_review: true,
  },
  {
    case_id: 'CONFLICT-003',
    domain: 'Official Conflict Resolver',
    summary: 'Latest dated official document conflicts with an old PDF.',
    field: 'deadline',
    source_type: 'official_document',
    source_url: 'https://university.example/admissions/2026-deadlines.pdf',
    quote: 'Applications close on 30 June 2026.',
    observed_days_ago: 8,
    extraction_method: 'pdf_extract',
    conflict: true,
    conflict_detail: '2026 admissions document says 30 June 2026; 2023 PDF says 15 May 2023.',
    expected_lane: 'Conflicts',
    expected_human_review: true,
  },
  {
    case_id: 'CONFLICT-004',
    domain: 'Official Conflict Resolver',
    summary: 'Two official pages provide conflicting deadline values.',
    field: 'deadline',
    source_type: 'official_admissions_page',
    source_url: 'https://university.example/admissions',
    quote: 'Priority deadline is 1 March 2026.',
    observed_days_ago: 6,
    extraction_method: 'basic_extract',
    conflict: true,
    conflict_detail: 'Admissions page says 1 March 2026; program page says 15 March 2026.',
    expected_lane: 'Conflicts',
    expected_human_review: true,
  },
  {
    case_id: 'CONFLICT-005',
    domain: 'Official Conflict Resolver',
    summary: 'Two high-authority sources provide close but conflicting tuition values.',
    field: 'tuition',
    source_type: 'official_tuition_page',
    source_url: 'https://university.example/finance/tuition',
    quote: 'Tuition is 21000 EUR.',
    observed_days_ago: 5,
    extraction_method: 'basic_extract',
    conflict: true,
    authority_close: true,
    conflict_detail: 'Finance page says 21000 EUR; official catalog says 21500 EUR.',
    expected_lane: 'Conflicts',
    expected_human_review: true,
  },
  {
    case_id: 'MARKETING-001',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Weak claim: world-class.',
    field: 'orx_signal',
    source_type: 'official_marketing_page',
    source_url: 'https://university.example/why-us',
    quote: 'We provide a world-class student experience.',
    observed_days_ago: 30,
    extraction_method: 'basic_extract',
    orx_candidate: true,
    expected_lane: 'Needs Evidence',
    expected_human_review: true,
  },
  {
    case_id: 'MARKETING-002',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Weak claim: future-ready.',
    field: 'orx_signal',
    source_type: 'official_marketing_page',
    source_url: 'https://university.example/future',
    quote: 'Our future-ready curriculum helps students thrive.',
    observed_days_ago: 42,
    extraction_method: 'basic_extract',
    orx_candidate: true,
    expected_lane: 'Needs Evidence',
    expected_human_review: true,
  },
  {
    case_id: 'MARKETING-003',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Weak claim: innovative education.',
    field: 'orx_signal',
    source_type: 'official_marketing_page',
    source_url: 'https://university.example/innovation',
    quote: 'Students benefit from innovative education across disciplines.',
    observed_days_ago: 25,
    extraction_method: 'basic_extract',
    orx_candidate: true,
    expected_lane: 'Needs Evidence',
    expected_human_review: true,
  },
  {
    case_id: 'MARKETING-004',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Weak claim: global leader.',
    field: 'orx_signal',
    source_type: 'official_marketing_page',
    source_url: 'https://university.example/rankings',
    quote: 'The university is a global leader in modern education.',
    observed_days_ago: 60,
    extraction_method: 'basic_extract',
    orx_candidate: true,
    expected_lane: 'Needs Evidence',
    expected_human_review: true,
  },
  {
    case_id: 'MARKETING-005',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Weak claim: excellent career opportunities.',
    field: 'career_outcome',
    source_type: 'official_marketing_page',
    source_url: 'https://university.example/careers',
    quote: 'Graduates enjoy excellent career opportunities.',
    observed_days_ago: 55,
    extraction_method: 'basic_extract',
    orx_candidate: true,
    expected_lane: 'Needs Evidence',
    expected_human_review: true,
  },
  {
    case_id: 'STRONG-001',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Strong evidence: named AI module added in curriculum.',
    field: 'orx_signal',
    source_type: 'official_catalog',
    source_url: 'https://university.example/catalog/ms-ai',
    quote: 'New required module: Applied Machine Learning Systems.',
    observed_days_ago: 21,
    extraction_method: 'basic_extract',
    orx_candidate: true,
    expected_lane: 'Ready for ORX',
    expected_human_review: false,
  },
  {
    case_id: 'STRONG-002',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Strong evidence: named employer partnership.',
    field: 'orx_signal',
    source_type: 'official_partner_page',
    source_url: 'https://university.example/partners/acme-cloud',
    quote: 'ACME Cloud will provide project mentors for the Cybersecurity MSc.',
    observed_days_ago: 33,
    extraction_method: 'basic_extract',
    orx_candidate: true,
    expected_lane: 'Ready for ORX',
    expected_human_review: false,
  },
  {
    case_id: 'STRONG-003',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Strong evidence: required internship/co-op/capstone.',
    field: 'orx_signal',
    source_type: 'official_program_page',
    source_url: 'https://university.example/programs/software-engineering',
    quote: 'All students complete a required industry capstone project.',
    observed_days_ago: 17,
    extraction_method: 'basic_extract',
    orx_candidate: true,
    expected_lane: 'Ready for ORX',
    expected_human_review: false,
  },
  {
    case_id: 'STRONG-004',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Strong evidence: published employment outcome.',
    field: 'career_outcome',
    source_type: 'official_outcomes_report',
    source_url: 'https://university.example/reports/employment-2025.pdf',
    quote: '87% of 2025 graduates were employed or in further study within six months.',
    observed_days_ago: 70,
    extraction_method: 'pdf_extract',
    orx_candidate: true,
    expected_lane: 'Ready for ORX',
    expected_human_review: false,
  },
  {
    case_id: 'STRONG-005',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Strong evidence: official accreditation.',
    field: 'accreditation',
    source_type: 'official_quality_page',
    source_url: 'https://university.example/accreditation',
    quote: 'The Business School is accredited by AACSB through 2030.',
    observed_days_ago: 90,
    extraction_method: 'basic_extract',
    orx_candidate: true,
    expected_lane: 'Ready for ORX',
    expected_human_review: false,
  },
  {
    case_id: 'STRONG-006',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Strong evidence: dated curriculum revision.',
    field: 'orx_signal',
    source_type: 'official_catalog',
    source_url: 'https://university.example/catalog/revisions-2026',
    quote: 'Curriculum revision approved on 12 January 2026 adds Data Automation Lab.',
    observed_days_ago: 16,
    extraction_method: 'basic_extract',
    orx_candidate: true,
    expected_lane: 'Ready for ORX',
    expected_human_review: false,
  },
  {
    case_id: 'STRONG-007',
    domain: 'Weak Marketing Claim Detector',
    summary: 'Strong evidence: official annual report metric.',
    field: 'orx_signal',
    source_type: 'official_annual_report',
    source_url: 'https://university.example/reports/annual-2025.pdf',
    quote: 'The university launched 14 industry-sponsored AI projects in 2025.',
    observed_days_ago: 100,
    extraction_method: 'pdf_extract',
    orx_candidate: true,
    expected_lane: 'Ready for ORX',
    expected_human_review: false,
  },
  {
    case_id: 'REVIEW-001',
    domain: 'Human Review Triggers',
    summary: 'Scholarship value is AI-only and high impact.',
    field: 'scholarship',
    source_type: 'official_scholarship_page',
    source_url: 'https://university.example/scholarships',
    quote: 'Merit scholarships may cover up to 50% of tuition.',
    observed_days_ago: 28,
    extraction_method: 'ai_extract',
    ai_derived: true,
    model: 'mock-model',
    provider: 'mock-provider',
    expected_lane: 'Critical',
    expected_human_review: true,
  },
  {
    case_id: 'REVIEW-002',
    domain: 'Human Review Triggers',
    summary: 'Apply URL is missing quote support.',
    field: 'apply_url',
    source_type: 'official_admissions_page',
    source_url: 'https://university.example/apply',
    quote: '',
    observed_days_ago: 10,
    extraction_method: 'basic_extract',
    expected_lane: 'Needs Evidence',
    expected_human_review: true,
  },
  {
    case_id: 'LANE-001',
    domain: 'Review Workbench Lanes',
    summary: 'Runtime gate blocks production exposure.',
    field: 'public_trust_badge',
    source_type: 'official_quality_page',
    source_url: 'https://university.example/quality',
    quote: 'Evidence completeness is 100% for the reviewed sample.',
    observed_days_ago: 5,
    extraction_method: 'benchmark_label',
    blocked_by_gate: 'Verify/Publish Gate runtime-open',
    expected_lane: 'Blocked',
    expected_human_review: false,
  },
  {
    case_id: 'GUARD-001',
    domain: 'No-Publish / No-Production Guard',
    summary: 'Otherwise strong review item still cannot authorize production actions.',
    field: 'program_name',
    source_type: 'official_program_page',
    source_url: 'https://university.example/programs/ms-robotics',
    quote: 'MSc Robotics and Autonomous Systems',
    observed_days_ago: 4,
    extraction_method: 'basic_extract',
    draft_candidate: true,
    expected_lane: 'Ready for Draft',
    expected_human_review: false,
  },
];

function parseArgs(argv) {
  const options = {
    format: 'json',
    strict: false,
    out: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--format') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--format requires json or markdown');
      }
      options.format = value;
      i += 1;
    } else if (arg.startsWith('--format=')) {
      options.format = arg.slice('--format='.length);
    } else if (arg === '--out') {
      const value = argv[i + 1];
      if (value && !value.startsWith('--')) {
        options.out = value;
        i += 1;
      } else {
        options.out = 'crawler-v2-review-quality-benchmark-report.json';
      }
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length) || 'crawler-v2-review-quality-benchmark-report.json';
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
  console.log(`Crawler v2 Review Quality Benchmark

Usage:
  node scripts/crawler-v2-review-quality-benchmark.mjs [--format json|markdown] [--strict] [--out [path]]

Options:
  --format json|markdown  Output format. Defaults to json.
  --strict                Exit non-zero if any benchmark case fails.
  --out [path]            Write the JSON report to a file. Defaults to crawler-v2-review-quality-benchmark-report.json when no path is provided.
  --help                  Show this help.

This benchmark is deterministic and offline. It requires no environment variables and performs no network or database calls.`);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sourceScore(sourceType) {
  if (!sourceType) return 0;
  if (sourceType.includes('official_tuition_page')) return 0.95;
  if (sourceType.includes('official_program_page')) return 0.9;
  if (sourceType.includes('official_admissions_page')) return 0.88;
  if (sourceType.includes('official_catalog')) return 0.88;
  if (sourceType.includes('official_document')) return 0.86;
  if (sourceType.includes('official_outcomes_report')) return 0.84;
  if (sourceType.includes('official_annual_report')) return 0.84;
  if (sourceType.includes('official_quality_page')) return 0.82;
  if (sourceType.includes('official_partner_page')) return 0.8;
  if (sourceType.includes('official_marketing_page')) return 0.55;
  if (sourceType.includes('official_general_page')) return 0.6;
  return 0.45;
}

function detectWeakMarketingClaim(text) {
  const matched_patterns = WEAK_MARKETING_PATTERNS
    .filter((pattern) => pattern.test(text || ''))
    .map((pattern) => pattern.source.replaceAll('\\b', '').replaceAll('\\', ''));

  return {
    is_weak_marketing_claim: matched_patterns.length > 0,
    matched_patterns,
  };
}

function calculateConfidence(testCase, weakMarketing) {
  let score = sourceScore(testCase.source_type);
  const reasons = [];

  if (!testCase.source_url) {
    score -= 0.45;
    reasons.push('missing source_url');
  }

  if (!testCase.quote) {
    score -= 0.35;
    reasons.push('missing evidence quote');
  }

  if (testCase.quote_strength === 'weak') {
    score -= 0.22;
    reasons.push('weak quote');
  }

  if (typeof testCase.observed_days_ago === 'number' && testCase.observed_days_ago > 365) {
    score -= 0.22;
    reasons.push('old timestamp');
  }

  if (testCase.conflict) {
    score -= 0.2;
    reasons.push('conflicting official evidence');
  }

  if (weakMarketing.is_weak_marketing_claim) {
    score -= 0.2;
    reasons.push('weak marketing claim');
  }

  if (testCase.ai_derived && (!testCase.model || !testCase.provider)) {
    score -= 0.25;
    reasons.push('AI-derived evidence missing model/provider');
  }

  if (testCase.ai_derived && testCase.model && testCase.provider) {
    score -= 0.08;
    reasons.push('AI-only high-impact evidence needs corroboration');
  }

  return {
    score: Number(clamp(score, 0, 1).toFixed(2)),
    reasons,
  };
}

function classifyImpact(field) {
  return {
    is_high_impact: HIGH_IMPACT_FIELDS.has(field),
    field,
  };
}

function requiresHumanReview(testCase, confidence, weakMarketing, impact) {
  const reasons = [];

  if (testCase.conflict) reasons.push('conflict exists');
  if (!testCase.source_url) reasons.push('source_url missing');
  if (!testCase.quote) reasons.push('evidence quote missing');
  if (weakMarketing.is_weak_marketing_claim && (testCase.orx_candidate || impact.is_high_impact)) {
    reasons.push('marketing-only claim affects protected use');
  }
  if (impact.is_high_impact && confidence.score < 0.7) reasons.push('high-impact field has low confidence');
  if (impact.is_high_impact && testCase.ai_derived) reasons.push('high-impact field is AI-only');

  return {
    required: reasons.length > 0,
    reasons,
  };
}

function routeLane(testCase, confidence, weakMarketing, impact) {
  if (testCase.blocked_by_gate) return 'Blocked';
  if (testCase.conflict) return 'Conflicts';
  if (!testCase.source_url || !testCase.quote || weakMarketing.is_weak_marketing_claim) return 'Needs Evidence';
  if (impact.is_high_impact && (confidence.score < 0.7 || testCase.ai_derived)) return 'Critical';
  if (confidence.score < 0.7) return 'Low Confidence';
  if (testCase.orx_candidate) return 'Ready for ORX';
  if (testCase.draft_candidate) return 'Ready for Draft';
  return 'Low Confidence';
}

function recommendSafeAction(lane) {
  const recommendations = {
    Critical: 'copy handoff for human review; keep blocked',
    Conflicts: 'mark conflict; preserve both sources',
    'Needs Evidence': 'needs source',
    'Low Confidence': 'human review if promoted; otherwise keep internal',
    'Ready for Draft': 'approve for draft simulation only',
    'Ready for ORX': 'approve as ORX candidate only; no score production',
    Blocked: 'keep blocked until runtime gate closes',
  };

  return recommendations[lane] || 'keep blocked';
}

function evaluateCase(testCase) {
  const weakMarketing = detectWeakMarketingClaim(testCase.quote);
  const confidence = calculateConfidence(testCase, weakMarketing);
  const impact = classifyImpact(testCase.field);
  const humanReview = requiresHumanReview(testCase, confidence, weakMarketing, impact);
  const actualLane = routeLane(testCase, confidence, weakMarketing, impact);
  const safeReviewRecommendation = recommendSafeAction(actualLane);
  const actual = {
    ...PRODUCTION_ACTIONS,
    lane: actualLane,
    human_review: humanReview.required,
  };

  const reasons = [
    ...confidence.reasons,
    ...humanReview.reasons,
  ];

  if (testCase.blocked_by_gate) {
    reasons.push(`blocked by ${testCase.blocked_by_gate}`);
  }

  const productionGuardsPassed =
    actual.publish_allowed === false &&
    actual.orx_scoring_allowed === false &&
    actual.student_eligibility_production_allowed === false &&
    actual.crm_automation_allowed === false;

  const passed =
    actualLane === testCase.expected_lane &&
    humanReview.required === testCase.expected_human_review &&
    actual.publish_allowed === false &&
    productionGuardsPassed;

  return {
    case_id: testCase.case_id,
    domain: testCase.domain,
    input_summary: testCase.summary,
    expected_lane: testCase.expected_lane,
    actual_lane: actualLane,
    expected_human_review: testCase.expected_human_review,
    actual_human_review: humanReview.required,
    expected_publish_allowed: false,
    actual_publish_allowed: actual.publish_allowed,
    orx_scoring_allowed: actual.orx_scoring_allowed,
    student_eligibility_production_allowed: actual.student_eligibility_production_allowed,
    crm_automation_allowed: actual.crm_automation_allowed,
    confidence_score: confidence.score,
    conflict_status: testCase.conflict ? 'requires_review' : 'none',
    weak_marketing_claim_status: weakMarketing.is_weak_marketing_claim ? 'rejected_for_score_impact' : 'not_detected',
    high_impact_field_status: impact.is_high_impact ? 'high_impact' : 'standard',
    safe_review_recommendation: safeReviewRecommendation,
    pass: passed,
    reasons: reasons.length > 0 ? reasons : ['meets benchmark expectation'],
  };
}

function countBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildReport() {
  const cases = MOCK_CASES.map(evaluateCase);
  const failures = cases.filter((testCase) => !testCase.pass);
  const passedCases = cases.length - failures.length;

  return {
    benchmark: 'crawler-v2-review-quality-benchmark',
    status: failures.length === 0 ? 'passed' : 'failed',
    total_cases: cases.length,
    passed_cases: passedCases,
    failed_cases: failures.length,
    pass_rate: Number((passedCases / cases.length).toFixed(4)),
    failures_list: failures.map((failure) => ({
      case_id: failure.case_id,
      domain: failure.domain,
      expected_lane: failure.expected_lane,
      actual_lane: failure.actual_lane,
      expected_human_review: failure.expected_human_review,
      actual_human_review: failure.actual_human_review,
      reasons: failure.reasons,
    })),
    domain_breakdown: countBy(cases, (testCase) => testCase.domain),
    lane_distribution: countBy(cases, (testCase) => testCase.actual_lane),
    high_impact_review_count: cases.filter(
      (testCase) => testCase.high_impact_field_status === 'high_impact' && testCase.actual_human_review,
    ).length,
    weak_marketing_rejection_count: cases.filter(
      (testCase) => testCase.weak_marketing_claim_status === 'rejected_for_score_impact',
    ).length,
    conflict_review_count: cases.filter((testCase) => testCase.conflict_status === 'requires_review').length,
    no_write_no_network_no_production_verification_statement: VERIFICATION_STATEMENT,
    cases,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Crawler v2 Review Quality Benchmark Report',
    '',
    `Status: ${report.status}`,
    `Total cases: ${report.total_cases}`,
    `Passed cases: ${report.passed_cases}`,
    `Failed cases: ${report.failed_cases}`,
    `Pass rate: ${(report.pass_rate * 100).toFixed(2)}%`,
    '',
    '## Lane Distribution',
    '',
    '| Lane | Count |',
    '|---|---:|',
    ...Object.entries(report.lane_distribution).map(([lane, count]) => `| ${lane} | ${count} |`),
    '',
    '## Domain Breakdown',
    '',
    '| Domain | Count |',
    '|---|---:|',
    ...Object.entries(report.domain_breakdown).map(([domain, count]) => `| ${domain} | ${count} |`),
    '',
    '## Cases',
    '',
    '| Case | Domain | Expected lane | Actual lane | Human review | Confidence | Result |',
    '|---|---|---|---|---|---:|---|',
    ...report.cases.map((testCase) => (
      `| ${testCase.case_id} | ${testCase.domain} | ${testCase.expected_lane} | ${testCase.actual_lane} | ${testCase.actual_human_review} | ${testCase.confidence_score.toFixed(2)} | ${testCase.pass ? 'pass' : 'fail'} |`
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
