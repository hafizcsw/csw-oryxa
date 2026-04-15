/**
 * qs-enrichment-proof-run
 * 
 * Fetches 8 evidence URLs from QS, extracts sections, classifies entities,
 * applies trust tiers, and returns a structured evidence pack.
 * 
 * Strategy: raw fetch + HTML parse FIRST → Firecrawl fallback only on parse failure
 */
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const QS_BASE = 'https://www.topuniversities.com';

// All known QS profile sections
const ALL_SECTIONS = [
  'about', 'university_info', 'admissions', 'students_staff', 'facilities',
  'student_life', 'careers_employability', 'cost_of_living', 'tuition_fees',
  'rankings_ratings', 'faqs', 'programmes', 'brochures', 'videos_media',
  'photos_gallery', 'campus_locations', 'similar_universities', 'social_links',
  'official_website',
] as const;

type SectionStatus = 'extracted' | 'not_present' | 'requires_js' | 'explicitly_ignored' | 'quarantined';

interface SectionResult {
  status: SectionStatus;
  data?: unknown;
  ignore_reason?: string;
  quarantine_reason?: string;
}

interface EvidenceSample {
  url: string;
  sample_type: string;
  entity_type: string;
  fetch_method: 'raw' | 'firecrawl';
  fetched_at: string;
  profile_tier: string;
  section_presence: Record<string, SectionResult>;
  trust_tiers: Record<string, string>;
  quarantine_reasons: string[];
  parsed_json: Record<string, unknown>;
  error?: string;
}

// ── Evidence URLs ──
const EVIDENCE_URLS: { url: string; type: string; label: string }[] = [
  { url: '/world-university-rankings', type: 'ranking', label: 'Ranking page' },
  { url: '/universities/university-oxford', type: 'university_basic', label: 'Oxford (basic)' },
  { url: '/universities/abu-dhabi-university', type: 'university_advanced', label: 'ADU (advanced)' },
  { url: '/universities/american-university-ras-al-khaimah-aurak', type: 'university_advanced', label: 'AURAK (advanced)' },
  { url: '/universities/massachusetts-institute-technology-mit', type: 'university_parent', label: 'MIT parent' },
  { url: '/universities/massachusetts-institute-technology-mit/mit-sloan-school-management', type: 'school', label: 'MIT Sloan' },
  { url: '/universities/university-oxford/postgrad/msc-financial-economics', type: 'programme_fresh', label: 'Oxford MSc FinEcon' },
  { url: '/universities/massachusetts-institute-technology-mit/mit-sloan-school-management/mba/executive-mba', type: 'programme_stale', label: 'MIT Sloan EMBA' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const singleIndex = body?.sample_index; // optional: run only one sample
    const useFirecrawl = body?.force_firecrawl === true;

    const targets = typeof singleIndex === 'number'
      ? [EVIDENCE_URLS[singleIndex]].filter(Boolean)
      : EVIDENCE_URLS;

    const results: EvidenceSample[] = [];

    for (const target of targets) {
      const sample = await processEvidenceSample(target, useFirecrawl);
      results.push(sample);
    }

    // Summary
    const summary = {
      total_samples: results.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      entity_types: [...new Set(results.map(r => r.entity_type))],
      sections_coverage: buildSectionsCoverage(results),
    };

    return new Response(JSON.stringify({ ok: true, summary, samples: results }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[qs-proof-run] Fatal:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

async function processEvidenceSample(
  target: { url: string; type: string; label: string },
  forceFirecrawl: boolean,
): Promise<EvidenceSample> {
  const fullUrl = `${QS_BASE}${target.url}`;
  const fetchedAt = new Date().toISOString();

  const sample: EvidenceSample = {
    url: fullUrl,
    sample_type: target.type,
    entity_type: classifyEntity(target.url, target.type),
    fetch_method: 'raw',
    fetched_at: fetchedAt,
    profile_tier: 'unknown',
    section_presence: {},
    trust_tiers: {},
    quarantine_reasons: [],
    parsed_json: {},
  };

  try {
    // Step 1: Raw fetch
    let html = '';
    let markdown = '';

    if (!forceFirecrawl) {
      const resp = await fetch(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (resp.ok) {
        html = await resp.text();
      }
    }

    // Check if raw fetch got meaningful content
    const rawUsable = html.length > 5000 && !html.includes('__NEXT_DATA__') && html.includes('topuniversities');

    // Step 2: If raw fetch failed or not usable, try Firecrawl
    if (!rawUsable || forceFirecrawl) {
      sample.fetch_method = 'firecrawl';
      const fcResult = await firecrawlScrape(fullUrl);
      if (fcResult) {
        markdown = fcResult.markdown || '';
        html = fcResult.html || html; // keep raw html if firecrawl didn't return it
      }
    }

    // Step 3: Parse based on type
    if (target.type === 'ranking') {
      parseRankingPage(sample, html, markdown);
    } else if (target.type.startsWith('programme')) {
      parseProgrammePage(sample, html, markdown, target.type);
    } else {
      parseUniversityPage(sample, html, markdown);
    }

    // Detect profile tier from content
    sample.profile_tier = detectProfileTier(html, markdown);

  } catch (err) {
    sample.error = String(err);
  }

  return sample;
}

// ── Entity Classification ──
function classifyEntity(url: string, hintType: string): string {
  const path = url.replace('/universities/', '');
  const segments = path.split('/').filter(Boolean);

  if (hintType === 'ranking') return 'ranking_page';

  // Programme: has /postgrad/, /undergrad/, /mba/, /phd/ in path
  if (/\/(postgrad|undergrad|mba|phd)\//.test(url)) return 'programme';

  // School/center: 2+ segments under /universities/, no programme level marker
  if (segments.length >= 2 && !/(postgrad|undergrad|mba|phd)/.test(segments[1])) {
    const slug = segments[1].toLowerCase();
    if (slug.includes('school') || slug.includes('business')) return 'school';
    if (slug.includes('center') || slug.includes('centre')) return 'center';
    return 'school'; // sub-entity default
  }

  return 'university';
}

// ── Profile Tier Detection ──
function detectProfileTier(html: string, markdown: string): string {
  const content = html + markdown;
  if (/advancedPrivate|advancedPublic|advanced_profile/i.test(content)) return 'advanced';
  // Advanced profiles typically have cost of living, facilities, FAQs
  if (/cost.of.living|facilities|student.life|career.services/i.test(content)) return 'advanced';
  return 'basic';
}

// ── Ranking Page Parser ──
function parseRankingPage(sample: EvidenceSample, html: string, markdown: string) {
  const content = markdown || html;

  // Count university entries (look for ranking patterns)
  const rankMatches = content.match(/\d+\s*\n\s*[A-Z][a-z]/g) || [];
  const uniLinks = (content.match(/\/universities\/[a-z0-9-]+/g) || []);
  const uniqueLinks = [...new Set(uniLinks)];

  // Extract score patterns
  const scoreMatches = content.match(/\d{1,2}\.\d/g) || [];

  sample.parsed_json = {
    estimated_university_count: uniqueLinks.length,
    unique_university_links_sample: uniqueLinks.slice(0, 10),
    rank_pattern_matches: rankMatches.length,
    score_patterns_found: scoreMatches.length > 0,
    content_length: content.length,
    has_pagination: /page|next|prev|›|»/i.test(content),
  };

  sample.section_presence.ranking_list = {
    status: uniqueLinks.length > 0 ? 'extracted' : 'requires_js',
    data: { count: uniqueLinks.length },
  };

  // Mark all non-applicable sections
  for (const s of ALL_SECTIONS) {
    if (!sample.section_presence[s]) {
      sample.section_presence[s] = { status: 'not_present', ignore_reason: 'Not applicable to ranking page' };
    }
  }
}

// ── University/School Page Parser ──
function parseUniversityPage(sample: EvidenceSample, html: string, markdown: string) {
  const content = markdown || html;
  const lc = content.toLowerCase();

  // About
  const aboutMatch = content.match(/(?:about|overview)[:\s]*\n([\s\S]{50,2000}?)(?=\n#{1,3}\s|\n\*\*|$)/i);
  sample.section_presence.about = {
    status: aboutMatch ? 'extracted' : (lc.includes('about') ? 'requires_js' : 'not_present'),
    data: aboutMatch ? { text_length: aboutMatch[1].trim().length, preview: aboutMatch[1].trim().slice(0, 200) } : undefined,
  };

  // Admissions
  const hasAdmissions = /admission|entry.requirement|test.score|sat|toefl|ielts|gmat|gre/i.test(content);
  if (hasAdmissions) {
    const testScores: Record<string, string> = {};
    const patterns: [string, RegExp][] = [
      ['sat', /SAT[:\s]*(\d{3,4})/i],
      ['toefl', /TOEFL[:\s]*(\d{2,3})/i],
      ['ielts', /IELTS[:\s]*([\d.]+)/i],
      ['gmat', /GMAT[:\s]*(\d{3})/i],
      ['gre', /GRE[:\s]*(\d{3})/i],
      ['det', /DET[:\s]*(\d{2,3})/i],
      ['pte', /PTE[:\s]*(\d{2,3})/i],
    ];
    for (const [key, re] of patterns) {
      const m = content.match(re);
      if (m) testScores[key] = m[1];
    }
    sample.section_presence.admissions = { status: 'extracted', data: { test_scores: testScores } };
    sample.parsed_json.admission_summary = testScores;
  } else {
    sample.section_presence.admissions = { status: 'not_present' };
  }

  // Students & Staff
  const studentsMatch = content.match(/total.students?[:\s]*([\d,]+)/i);
  const intlMatch = content.match(/international.students?[:\s]*([\d,]+)/i);
  sample.section_presence.students_staff = {
    status: studentsMatch ? 'extracted' : (lc.includes('student') ? 'requires_js' : 'not_present'),
    data: studentsMatch ? {
      total_students: studentsMatch[1],
      intl_students: intlMatch?.[1] || null,
    } : undefined,
  };

  // Cost of Living (dual extractor — _amount columns, not _usd)
  const hasCostSection = /cost.of.living|accommodation|living.cost/i.test(content);
  if (hasCostSection) {
    const structured: Record<string, string | boolean> = { is_approx: true };
    const costPatterns: [string, RegExp][] = [
      ['accommodation_amount', /accommodation[:\s]*[\$€£]?([\d,]+)/i],
      ['food_amount', /food[:\s]*[\$€£]?([\d,]+)/i],
      ['transport_amount', /transport(?:ation)?[:\s]*[\$€£]?([\d,]+)/i],
      ['utilities_amount', /utilit(?:ies|y)[:\s]*[\$€£]?([\d,]+)/i],
    ];
    let hasStructured = false;
    for (const [key, re] of costPatterns) {
      const m = content.match(re);
      if (m) { structured[key] = m[1]; hasStructured = true; }
    }
    if (/approx/i.test(content)) structured.is_approx = true;

    // Currency detection
    const currDetect = content.match(/(?:cost|accommodation|food)[\s\S]{0,30}?(USD|EUR|GBP|AED|CAD|AUD|\$|€|£)/i);

    // Text fallback (raw_text)
    const costTextMatch = content.match(/cost.of.living[\s\S]{0,50}?\n([\s\S]{20,500}?)(?=\n#{1,3}|\n\*\*|$)/i);

    sample.section_presence.cost_of_living = {
      status: 'extracted',
      data: {
        type: hasStructured ? 'structured' : 'text_only',
        structured: hasStructured ? structured : null,
        currency: currDetect?.[1] || null,
        raw_text: costTextMatch?.[1]?.trim().slice(0, 300) || null,
      },
    };
    sample.parsed_json.cost_of_living = sample.section_presence.cost_of_living.data;
  } else {
    sample.section_presence.cost_of_living = { status: 'not_present' };
  }

  // Facilities
  const hasFacilities = /facilities/i.test(content);
  sample.section_presence.facilities = {
    status: hasFacilities ? 'extracted' : 'not_present',
    data: hasFacilities ? { present: true } : undefined,
  };

  // Student Life (with extraction for qs_student_life table)
  const hasStudentLife = /student.life|dorm|counselling|campus.life|residence|housing/i.test(content);
  if (hasStudentLife) {
    const hasDorms = /dorm|residence|housing|on.campus.living/i.test(content);
    const hasCounselling = /counsell|mental.health|support.services/i.test(content);
    const clubsMatch = content.match(/(?:clubs?|societ|organization|association)[\s\S]{0,200}/gi) || [];
    sample.section_presence.student_life = {
      status: 'extracted',
      data: {
        dorms_available: hasDorms,
        counselling_available: hasCounselling,
        clubs_hint: clubsMatch.length,
      },
    };
    sample.parsed_json.student_life = sample.section_presence.student_life.data;
  } else {
    sample.section_presence.student_life = { status: 'not_present' };
  }

  // Careers / Employability
  const hasCareers = /career|employability|placement|internship/i.test(content);
  sample.section_presence.careers_employability = {
    status: hasCareers ? 'extracted' : 'not_present',
    data: hasCareers ? { has_service_list: /career.guidance|alumni.network|job.fairs/i.test(content) } : undefined,
  };

  // Rankings
  const rankMatch = content.match(/QS.World.University.Rankings.*?#?(\d+)/i);
  const overallMatch = content.match(/overall.score[:\s]*([\d.]+)/i);
  sample.section_presence.rankings_ratings = {
    status: rankMatch ? 'extracted' : (lc.includes('ranking') ? 'requires_js' : 'not_present'),
    data: rankMatch ? { world_rank: rankMatch[1], overall_score: overallMatch?.[1] } : undefined,
  };

  // FAQs
  const faqMatches = content.match(/(?:FAQ|frequently.asked)/gi) || [];
  sample.section_presence.faqs = {
    status: faqMatches.length > 0 ? 'extracted' : 'not_present',
    data: faqMatches.length > 0 ? { count_hint: faqMatches.length } : undefined,
  };

  // Programmes
  const programLinks = (content.match(/\/(postgrad|undergrad|mba|phd)\/[a-z0-9-]+/g) || []);
  const uniquePrograms = [...new Set(programLinks)];
  sample.section_presence.programmes = {
    status: uniquePrograms.length > 0 ? 'extracted' : (lc.includes('programme') ? 'requires_js' : 'not_present'),
    data: { count: uniquePrograms.length, sample: uniquePrograms.slice(0, 5) },
  };
  sample.parsed_json.programme_count = uniquePrograms.length;

  // Videos / Media
  const hasVideos = /youtube|video|media/i.test(content);
  sample.section_presence.videos_media = { status: hasVideos ? 'extracted' : 'not_present' };

  // Photos / Gallery
  sample.section_presence.photos_gallery = {
    status: /gallery|slideshow|photo/i.test(content) ? 'extracted' : 'not_present',
  };

  // Campus Locations
  const hasCampus = /campus.location|campus.address/i.test(content);
  sample.section_presence.campus_locations = { status: hasCampus ? 'extracted' : 'not_present' };

  // Brochures
  sample.section_presence.brochures = {
    status: /brochure|download.*pdf/i.test(content) ? 'extracted' : 'not_present',
  };

  // Similar Universities (with extraction for qs_similar_entities)
  const similarMatches = content.match(/similar.universit[\s\S]{0,500}/i);
  if (similarMatches) {
    const similarLinks = (similarMatches[0].match(/\/universities\/([a-z0-9-]+)/g) || [])
      .map((l: string) => l.replace('/universities/', ''));
    sample.section_presence.similar_universities = {
      status: similarLinks.length > 0 ? 'extracted' : 'requires_js',
      data: { count: similarLinks.length, slugs: similarLinks.slice(0, 5) },
    };
    if (similarLinks.length > 0) sample.parsed_json.similar_entities = similarLinks;
  } else {
    sample.section_presence.similar_universities = { status: 'not_present' };
  }

  // Social Links
  const socialLinks: string[] = [];
  const socialPatterns = [/facebook\.com/i, /twitter\.com|x\.com/i, /linkedin\.com/i, /instagram\.com/i, /youtube\.com/i];
  for (const p of socialPatterns) {
    if (p.test(content)) socialLinks.push(p.source.replace(/\\./g, '.').replace(/\|.*/, ''));
  }
  sample.section_presence.social_links = {
    status: socialLinks.length > 0 ? 'extracted' : 'not_present',
    data: socialLinks.length > 0 ? { platforms: socialLinks } : undefined,
  };

  // Official Website
  const websiteMatch = content.match(/(?:official.website|visit.website|university.website)[:\s]*(https?:\/\/[^\s"<]+)/i);
  sample.section_presence.official_website = {
    status: websiteMatch ? 'extracted' : (lc.includes('website') ? 'requires_js' : 'not_present'),
    data: websiteMatch ? { url: websiteMatch[1] } : undefined,
  };

  // Tuition
  sample.section_presence.tuition_fees = {
    status: /tuition|fee|cost.*study/i.test(content) ? 'extracted' : 'not_present',
  };

  // University Info
  sample.section_presence.university_info = {
    status: /type.*private|type.*public|founded|institution.type/i.test(content) ? 'extracted' : 'not_present',
  };

  // School sub-entity discovery
  const schoolLinks = (content.match(/\/universities\/[a-z0-9-]+\/[a-z0-9-]+-(?:school|center|centre|business)/g) || []);
  if (schoolLinks.length > 0) {
    sample.parsed_json.discovered_sub_entities = [...new Set(schoolLinks)];
  }

  // Scholarships — QUARANTINE as editorial
  const hasScholarships = /scholarship/i.test(content);
  if (hasScholarships) {
    const isEditorial = /scholarship.*article|scholarship.*guide|qs.*scholarship/i.test(content);
    sample.section_presence['scholarships_editorial'] = {
      status: 'quarantined',
      quarantine_reason: isEditorial
        ? 'QS editorial scholarship articles — NOT university-specific grants'
        : 'Scholarship section detected but requires manual review to determine if editorial vs institutional',
    };
    sample.quarantine_reasons.push('scholarships_editorial');
  }

  // Logo
  const logoMatch = content.match(/(https?:\/\/[^\s"]+(?:logo|crest|emblem|brand)[^\s"]*\.(?:png|jpg|svg|webp))/i)
    || content.match(/(https?:\/\/[^\s"]*\/(?:sites|images)\/[^\s"]+\.(?:png|jpg|svg|webp))/i);
  sample.parsed_json.logo_url = logoMatch?.[1] || null;
}

// ── Programme Page Parser ──
function parseProgrammePage(sample: EvidenceSample, html: string, markdown: string, hintType: string) {
  const content = markdown || html;

  // Title
  const titleMatch = content.match(/(?:^|\n)#\s*(.+)/m) || content.match(/<h1[^>]*>([^<]+)/i);
  sample.parsed_json.title = titleMatch?.[1]?.trim() || null;

  // Degree + Level
  const degreeMatch = content.match(/(?:degree|qualification)[:\s]*(MSc|MBA|MA|BSc|BA|PhD|MPhil|LLM|MEng|BEng)/i);
  sample.parsed_json.degree = degreeMatch?.[1] || null;

  const levelMatch = content.match(/(?:level|study.level)[:\s]*(Masters?|Bachelor|Postgraduate|Undergraduate|Doctoral|PhD|MBA)/i);
  sample.parsed_json.level = levelMatch?.[1] || null;

  // Duration
  const durMatch = content.match(/(?:duration|length)[:\s]*(\d+\s*(?:month|year|semester|week)s?)/i);
  sample.parsed_json.duration = durMatch?.[1] || null;

  // Tuition (separate domestic vs international)
  const tuitionPatterns = [
    { key: 'tuition_international', re: /(?:international|overseas).*?(?:tuition|fee)[:\s]*[\$€£]?([\d,]+)/i },
    { key: 'tuition_domestic', re: /(?:domestic|home|uk|eu).*?(?:tuition|fee)[:\s]*[\$€£]?([\d,]+)/i },
    { key: 'tuition_generic', re: /(?:tuition|fee|cost)[:\s]*[\$€£]?([\d,]+)/i },
  ];
  for (const { key, re } of tuitionPatterns) {
    const m = content.match(re);
    if (m) sample.parsed_json[key] = m[1];
  }

  // Currency
  const currMatch = content.match(/(USD|EUR|GBP|AED|RUB|CAD|AUD)\b/i)
    || content.match(/[\$€£]/);
  sample.parsed_json.tuition_currency = currMatch?.[1] || currMatch?.[0] || null;

  // Admission requirements
  const admReqs: Record<string, string> = {};
  const admPatterns: [string, RegExp][] = [
    ['toefl', /TOEFL[:\s]*(\d{2,3})/i],
    ['ielts', /IELTS[:\s]*([\d.]+)/i],
    ['gpa', /GPA[:\s]*([\d.]+)/i],
    ['gmat', /GMAT[:\s]*(\d{3})/i],
    ['gre', /GRE[:\s]*(\d{3})/i],
    ['sat', /SAT[:\s]*(\d{3,4})/i],
    ['cae', /CAE[:\s]*(\d{2,3})/i],
    ['det', /DET[:\s]*(\d{2,3})/i],
    ['pte', /PTE[:\s]*(\d{2,3})/i],
  ];
  for (const [key, re] of admPatterns) {
    const m = content.match(re);
    if (m) admReqs[key] = m[1];
  }
  sample.parsed_json.admission_requirements = admReqs;

  // Start months (array, not single)
  const startMatches = content.match(/(?:start|begin|intake)[:\s]*(January|February|March|April|May|June|July|August|September|October|November|December)/gi) || [];
  const uniqueMonths = [...new Set(startMatches.map((m: string) => {
    const monthMatch = m.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
    return monthMatch?.[1] || '';
  }).filter(Boolean))];
  sample.parsed_json.start_months = uniqueMonths;

  // Deadline + dynamic trust tier (uses current year, not hardcoded 2025)
  const currentYear = new Date().getFullYear();
  const staleThreshold = currentYear; // anything before current year = stale

  const deadlineMatches = content.match(/(?:deadline|closing.date|apply.by)[:\s]*([A-Za-z]+[\s-]\d{1,2}[,\s]*\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi) || [];
  const deadlinesJsonb: { raw: string; confidence: string }[] = [];

  for (const dm of deadlineMatches) {
    const raw = dm.replace(/^(?:deadline|closing.date|apply.by)[:\s]*/i, '').trim();
    const yearMatch = raw.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : 0;
    let confidence: string;

    if (year < 2000 || /Jan-2000|00-00/i.test(raw)) {
      confidence = 'malformed';
    } else if (year < staleThreshold) {
      confidence = 'stale';
    } else {
      confidence = 'fresh';
    }
    deadlinesJsonb.push({ raw, confidence });
  }

  if (deadlinesJsonb.length > 0) {
    sample.parsed_json.deadline_raw = deadlinesJsonb[0].raw;
    sample.parsed_json.deadlines_jsonb = deadlinesJsonb;
    // Overall trust = worst confidence
    const worst = deadlinesJsonb.some(d => d.confidence === 'malformed') ? 'malformed'
      : deadlinesJsonb.some(d => d.confidence === 'stale') ? 'stale' : 'fresh';
    sample.trust_tiers.deadline = worst;
    if (worst === 'malformed') sample.quarantine_reasons.push('malformed_deadline');
  }

  // Study mode
  const modeMatch = content.match(/(?:study.mode|attendance)[:\s]*(Full[- ]?time|Part[- ]?time|Online|Distance|Blended)/i);
  sample.parsed_json.study_mode = modeMatch?.[1] || null;

  // Subject area
  const subjectMatch = content.match(/(?:subject|discipline|field)[:\s]*([A-Za-z &,]+)/i);
  sample.parsed_json.subject_area = subjectMatch?.[1]?.trim() || null;

  // School name (for programme under school)
  const schoolMatch = content.match(/(?:school|faculty|department)[:\s]*([A-Za-z &']+(?:School|Faculty|Department|College)[A-Za-z &']*)/i);
  sample.parsed_json.school_name = schoolMatch?.[1]?.trim() || null;

  // Mark sections
  for (const s of ALL_SECTIONS) {
    if (!sample.section_presence[s]) {
      sample.section_presence[s] = { status: 'not_present', ignore_reason: 'Programme page — section not applicable' };
    }
  }
  sample.section_presence.programmes = { status: 'extracted', data: sample.parsed_json };
}

// ── Firecrawl Fallback ──
async function firecrawlScrape(url: string): Promise<{ markdown?: string; html?: string } | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.warn('[qs-proof-run] FIRECRAWL_API_KEY not set — skipping fallback');
    return null;
  }

  try {
    const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        waitFor: 5000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[qs-proof-run] Firecrawl error ${resp.status}:`, errText.slice(0, 200));
      return null;
    }

    const data = await resp.json();
    return {
      markdown: data.data?.markdown || data.markdown || '',
      html: data.data?.html || data.html || '',
    };
  } catch (err) {
    console.error('[qs-proof-run] Firecrawl fetch failed:', err);
    return null;
  }
}

// ── Section Coverage Summary ──
function buildSectionsCoverage(results: EvidenceSample[]): Record<string, Record<SectionStatus, number>> {
  const coverage: Record<string, Record<string, number>> = {};
  for (const s of ALL_SECTIONS) {
    coverage[s] = {};
    for (const r of results) {
      const status = r.section_presence[s]?.status || 'not_present';
      coverage[s][status] = (coverage[s][status] || 0) + 1;
    }
  }
  return coverage;
}
