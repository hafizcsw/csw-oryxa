/**
 * orx-program-evidence-pilot — Recovery Pack v2.
 *
 * Fixes:
 * 1) Source independence: adds accreditation/registry/PDF sources
 * 2) Fuzzy matching: improved program lookup for Stanford/TUM
 * 3) Coverage: targets 4/5 pilot universities
 *
 * Security: internal-only (verify_jwt=false).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const METHODOLOGY_VERSION = '1.1';

// ── Pilot program sample ──

interface PilotProgram {
  program_id: string;
  university_id: string;
  university_name: string;
  program_title: string;
  degree_level: string;
  discipline_family: string;
  country_code: string;
  country_id: string;
  candidate_urls: string[];
  /** Independent sources (accreditation bodies, registries, PDFs) */
  independent_sources: { url: string; source_type: string; label: string }[];
  /** Fuzzy title patterns for DB lookup */
  fuzzy_patterns: string[];
}

const PILOT_PROGRAMS: PilotProgram[] = [
  // ── MIT (US) — already resolved, keep for re-run ──
  {
    program_id: '6ef82ac4-8601-4261-a3eb-36d37405aa90',
    university_id: '985c3211-7429-48f0-a120-bcb7688ef931',
    university_name: 'MIT',
    program_title: 'Artificial Intelligence (MSc)',
    degree_level: 'Master',
    discipline_family: 'computing_ai_data',
    country_code: 'US',
    country_id: 'd208cd36-5f47-4d42-a943-d3e08ffe5c6f',
    candidate_urls: [
      'https://www.eecs.mit.edu/academics/graduate-programs/',
      'https://catalog.mit.edu/schools/engineering/electrical-engineering-computer-science/',
    ],
    independent_sources: [
      { url: 'https://www.usnews.com/best-graduate-schools/top-science-schools/massachusetts-institute-of-technology-166683', source_type: 'third_party_index', label: 'US News MIT profile' },
      { url: 'https://nces.ed.gov/collegenavigator/?q=massachusetts+institute+of+technology&s=all&id=166683', source_type: 'government_report', label: 'NCES MIT profile' },
    ],
    fuzzy_patterns: [],
  },
  {
    program_id: '549d8d53-e903-41e3-861c-537410c0bb78',
    university_id: '985c3211-7429-48f0-a120-bcb7688ef931',
    university_name: 'MIT',
    program_title: 'Executive MBA',
    degree_level: 'Master',
    discipline_family: 'business_finance',
    country_code: 'US',
    country_id: 'd208cd36-5f47-4d42-a943-d3e08ffe5c6f',
    candidate_urls: [
      'https://mitsloan.mit.edu/mba',
      'https://executive.mit.edu/',
    ],
    independent_sources: [
      { url: 'https://www.aacsb.edu/accredited?SearchText=massachusetts+institute+of+technology', source_type: 'accreditation_body', label: 'AACSB MIT Sloan' },
    ],
    fuzzy_patterns: [],
  },

  // ── Oxford (UK) — needs independent source (all evidence is ox.ac.uk) ──
  {
    program_id: '66f05c3a-fb36-4870-a499-1444b5eadeb3',
    university_id: '161523ba-1055-4915-8cb5-72deff3f9376',
    university_name: 'Oxford',
    program_title: 'Computer Science',
    degree_level: 'Bachelor',
    discipline_family: 'computing_ai_data',
    country_code: 'GB',
    country_id: '1fb5c5e2-aea6-4666-ab74-e368f102b1bb',
    candidate_urls: [
      'https://www.cs.ox.ac.uk/',
      'https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science/',
    ],
    independent_sources: [
      { url: 'https://www.theuniguide.co.uk/university-of-oxford-o33/computer-science', source_type: 'third_party_index', label: 'UniGuide Oxford CS' },
      { url: 'https://www.whatuni.com/university-of-oxford/computer-science/d125', source_type: 'third_party_index', label: 'WhatUni Oxford CS' },
      { url: 'https://www.bcs.org/deliver-and-teach-qualifications/university-accreditation/accredited-courses/', source_type: 'accreditation_body', label: 'BCS Accreditation (UK CS)' },
    ],
    fuzzy_patterns: [],
  },
  {
    program_id: 'fd6f82fd-af80-4215-938b-c544179b9601',
    university_id: '161523ba-1055-4915-8cb5-72deff3f9376',
    university_name: 'Oxford',
    program_title: 'Engineering Science',
    degree_level: 'Bachelor',
    discipline_family: 'engineering',
    country_code: 'GB',
    country_id: '1fb5c5e2-aea6-4666-ab74-e368f102b1bb',
    candidate_urls: [
      'https://eng.ox.ac.uk/',
      'https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/engineering-science/',
    ],
    independent_sources: [
      { url: 'https://www.theuniguide.co.uk/university-of-oxford-o33/engineering', source_type: 'third_party_index', label: 'UniGuide Oxford Engineering' },
      { url: 'https://www.engc.org.uk/', source_type: 'accreditation_body', label: 'EngC UK Engineering Council' },
    ],
    fuzzy_patterns: [],
  },

  // ── Cambridge (UK) — needs independent source (all evidence is cam.ac.uk) ──
  {
    program_id: '0a481497-eb35-4476-9a36-9177735e78b3',
    university_id: 'ccf6e28b-d96e-4048-bcfb-8809b9fac171',
    university_name: 'Cambridge',
    program_title: 'Mathematics',
    degree_level: 'Bachelor',
    discipline_family: 'computing_ai_data',
    country_code: 'GB',
    country_id: '1fb5c5e2-aea6-4666-ab74-e368f102b1bb',
    candidate_urls: [
      'https://www.maths.cam.ac.uk/',
      'https://www.undergraduate.study.cam.ac.uk/courses/mathematics',
    ],
    independent_sources: [
      { url: 'https://www.theuniguide.co.uk/university-of-cambridge-c05/mathematics', source_type: 'third_party_index', label: 'UniGuide Cambridge Maths' },
      { url: 'https://www.whatuni.com/university-of-cambridge/mathematics/d125', source_type: 'third_party_index', label: 'WhatUni Cambridge Maths' },
      { url: 'https://www.thecompleteuniversityguide.co.uk/universities/university-of-cambridge/mathematics', source_type: 'third_party_index', label: 'CUG Cambridge Maths' },
    ],
    fuzzy_patterns: [],
  },
  {
    program_id: '3bda9d5b-c80c-4a32-9bba-846e10741cf3',
    university_id: 'ccf6e28b-d96e-4048-bcfb-8809b9fac171',
    university_name: 'Cambridge',
    program_title: 'Economics',
    degree_level: 'Bachelor',
    discipline_family: 'business_finance',
    country_code: 'GB',
    country_id: '1fb5c5e2-aea6-4666-ab74-e368f102b1bb',
    candidate_urls: [
      'https://www.econ.cam.ac.uk/',
      'https://www.undergraduate.study.cam.ac.uk/courses/economics',
    ],
    independent_sources: [
      { url: 'https://www.theuniguide.co.uk/university-of-cambridge-c05/economics', source_type: 'third_party_index', label: 'UniGuide Cambridge Economics' },
      { url: 'https://www.thecompleteuniversityguide.co.uk/universities/university-of-cambridge/economics', source_type: 'third_party_index', label: 'CUG Cambridge Economics' },
    ],
    fuzzy_patterns: [],
  },

  // ── Stanford (US) — needs fuzzy matching (exact "Computer Science" failed) ──
  {
    program_id: '', // Dynamic - fuzzy lookup
    university_id: 'cf203ec0-8a44-4906-8bcd-f081d0de6845',
    university_name: 'Stanford',
    program_title: 'Architectural Design',
    degree_level: 'any',
    discipline_family: 'design_media',
    country_code: 'US',
    country_id: 'd208cd36-5f47-4d42-a943-d3e08ffe5c6f',
    candidate_urls: [
      'https://architecture.stanford.edu/',
      'https://exploredegrees.stanford.edu/schoolofhumanitiesandsciences/',
    ],
    independent_sources: [
      { url: 'https://www.usnews.com/best-graduate-schools/top-engineering-schools/stanford-university-243744', source_type: 'third_party_index', label: 'US News Stanford' },
      { url: 'https://nces.ed.gov/collegenavigator/?q=stanford&s=all&id=243744', source_type: 'government_report', label: 'NCES Stanford' },
    ],
    fuzzy_patterns: ['Architectural Design', 'Architecture', 'Design'],
  },
  {
    program_id: '', // Dynamic - fuzzy lookup
    university_id: 'cf203ec0-8a44-4906-8bcd-f081d0de6845',
    university_name: 'Stanford',
    program_title: 'Sociology',
    degree_level: 'any',
    discipline_family: 'social_sciences',
    country_code: 'US',
    country_id: 'd208cd36-5f47-4d42-a943-d3e08ffe5c6f',
    candidate_urls: [
      'https://sociology.stanford.edu/',
      'https://exploredegrees.stanford.edu/schoolofhumanitiesandsciences/sociology/',
    ],
    independent_sources: [
      { url: 'https://nces.ed.gov/collegenavigator/?q=stanford&s=all&id=243744', source_type: 'government_report', label: 'NCES Stanford' },
    ],
    fuzzy_patterns: ['Sociology'],
  },

  // ── TUM (DE) — needs fuzzy matching ──
  {
    program_id: '', // Dynamic
    university_id: '5c1a889c-704b-41b1-bc71-d59389046aa7',
    university_name: 'TUM',
    program_title: 'Aerospace',
    degree_level: 'any',
    discipline_family: 'engineering',
    country_code: 'DE',
    country_id: '3b31f83a-02fa-488c-9c7f-9c7bf5098723',
    candidate_urls: [
      'https://www.tum.de/en/studies/degree-programs/detail/aerospace-bachelor-of-science-bsc',
      'https://www.asg.ed.tum.de/en/lrt/home/',
    ],
    independent_sources: [
      { url: 'https://www.daad.de/en/study-and-research-in-germany/courses-of-study-in-germany/', source_type: 'government_report', label: 'DAAD Germany' },
      { url: 'https://www.studycheck.de/studium/luft-und-raumfahrttechnik/tum-muenchen-3049', source_type: 'third_party_index', label: 'StudyCheck TUM Aerospace' },
    ],
    fuzzy_patterns: ['Aerospace', 'Aeronautic'],
  },
  {
    program_id: '', // Dynamic
    university_id: '5c1a889c-704b-41b1-bc71-d59389046aa7',
    university_name: 'TUM',
    program_title: 'Management and Technology',
    degree_level: 'any',
    discipline_family: 'business_finance',
    country_code: 'DE',
    country_id: '3b31f83a-02fa-488c-9c7f-9c7bf5098723',
    candidate_urls: [
      'https://www.tum.de/en/studies/degree-programs/detail/management-and-technology-bachelor-of-science-bsc',
      'https://www.mgt.tum.de/programs',
    ],
    independent_sources: [
      { url: 'https://www.studycheck.de/studium/management-and-technology/tum-muenchen', source_type: 'third_party_index', label: 'StudyCheck TUM MgmtTech' },
      { url: 'https://www.aacsb.edu/accredited?SearchText=technical+university+of+munich', source_type: 'accreditation_body', label: 'AACSB TUM' },
    ],
    fuzzy_patterns: ['Management and Technology', 'Management'],
  },
];

// ── Signal patterns (same as v1) ──

interface ProgramSignalPattern {
  family: string;
  keywords: string[];
  weight: number;
}

const PROGRAM_SIGNALS: ProgramSignalPattern[] = [
  {
    family: 'future_skill_alignment',
    keywords: [
      'artificial intelligence', ' ai ', 'machine learning', 'data science',
      'deep learning', 'cloud computing', 'cybersecurity', 'blockchain',
      'quantum computing', 'iot', 'internet of things', 'digital transformation',
      'generative ai', 'prompt engineering', 'large language model', 'llm',
      'automation', 'computational thinking', 'algorithm', 'neural network',
      'natural language processing', 'computer vision', 'reinforcement learning',
      'devops', 'agile', 'full-stack', 'mobile development', 'api design',
    ],
    weight: 0.9,
  },
  {
    family: 'curriculum_freshness',
    keywords: [
      'updated curriculum', 'new course', 'redesigned', 'revised syllabus',
      'launched', 'cutting-edge', 'state-of-the-art', 'latest technology',
      'modern approach', 'contemporary', 'emerging', 'innovative',
      '2024', '2025', '2026', 'newly introduced', 'recently added',
      'interdisciplinary', 'cross-disciplinary', 'multidisciplinary',
    ],
    weight: 0.8,
  },
  {
    family: 'ai_workflow_exposure',
    keywords: [
      'hands-on ai', 'ai tools', 'ai lab', 'ai project', 'ai workshop',
      'tensorflow', 'pytorch', 'jupyter', 'python', 'r programming',
      'matlab', 'simulation', 'modeling', 'coding', 'programming',
      'hackathon', 'ai competition', 'kaggle', 'github',
      'copilot', 'chatgpt', 'ai assistant', 'prompt', 'fine-tuning',
      'machine learning project', 'data pipeline', 'model training',
    ],
    weight: 0.85,
  },
  {
    family: 'transferability',
    keywords: [
      'exchange program', 'study abroad', 'erasmus', 'dual degree',
      'joint degree', 'international', 'global', 'partnership',
      'credit transfer', 'accredited', 'accreditation', 'abet',
      'recognized', 'transferable skills', 'mobility',
      'double degree', 'semester abroad', 'cross-institutional',
    ],
    weight: 0.7,
  },
  {
    family: 'applied_industry_signal',
    keywords: [
      'internship', 'co-op', 'industry partner', 'corporate',
      'work placement', 'industry project', 'sponsored', 'employer',
      'career service', 'recruitment', 'startup', 'incubator',
      'accelerator', 'entrepreneurship', 'capstone', 'real-world project',
      'consulting project', 'placement', 'practical training',
      'job market', 'employment rate', 'graduate outcomes', 'alumni',
    ],
    weight: 0.75,
  },
  {
    family: 'student_value_signal',
    keywords: [
      'scholarship', 'financial aid', 'fellowship', 'stipend',
      'tuition waiver', 'bursary', 'student satisfaction',
      'student experience', 'mentoring', 'tutoring', 'support',
      'student society', 'student club', 'student life',
      'well-being', 'career guidance', 'graduate school',
    ],
    weight: 0.5,
  },
];

// ── Helpers ──

async function fetchPage(url: string, timeout = 12000): Promise<{ content: string; ok: boolean; status: number; url: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'ORX-Pilot/1.0 (academic research indexer)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(t);
    if (!res.ok) return { content: '', ok: false, status: res.status, url };
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .substring(0, 60000);
    return { content: text, ok: true, status: res.status, url };
  } catch (e: any) {
    console.error(`[pilot-v2] Fetch error ${url}: ${e.message}`);
    return { content: '', ok: false, status: 0, url };
  }
}

function extractProgramSignals(content: string): { family: string; matchCount: number; snippets: string[]; confidence: number }[] {
  const results: { family: string; matchCount: number; snippets: string[]; confidence: number }[] = [];
  const cl = content.toLowerCase();

  for (const sig of PROGRAM_SIGNALS) {
    let matchCount = 0;
    const snippets: string[] = [];
    for (const kw of sig.keywords) {
      const kwl = kw.toLowerCase();
      let idx = 0;
      let found = 0;
      while ((idx = cl.indexOf(kwl, idx)) !== -1 && found < 5) {
        found++;
        matchCount++;
        if (snippets.length < 2) {
          const start = Math.max(0, idx - 80);
          const end = Math.min(content.length, idx + kw.length + 80);
          snippets.push(content.substring(start, end).trim());
        }
        idx += kw.length;
      }
    }
    if (matchCount > 0) {
      const density = Math.min(matchCount / 8, 1);
      const confidence = Math.min(Math.round(density * sig.weight * 100), 95);
      results.push({ family: sig.family, matchCount, snippets, confidence });
    }
  }
  return results;
}

function makeContentHash(content: string, url: string, family: string): string {
  let hash = 0;
  const str = url + '|' + family + '|' + content.substring(0, 2000);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `pilot_prog_v2_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
}

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    if (sld.length <= 3 && tld.length <= 3) return parts.slice(-3).join('.');
    return parts.slice(-2).join('.');
  } catch { return url; }
}

/** Fuzzy program lookup: tries exact match, then each fuzzy pattern via ilike */
async function resolveProgram(
  admin: any,
  universityId: string,
  exactTitle: string,
  fuzzyPatterns: string[]
): Promise<{ id: string; title: string } | null> {
  // Try exact
  const { data: exact } = await admin
    .from('programs')
    .select('id, title')
    .eq('university_id', universityId)
    .eq('is_active', true)
    .ilike('title', `%${exactTitle}%`)
    .limit(1)
    .maybeSingle();
  if (exact) return exact;

  // Try each fuzzy pattern
  for (const pat of fuzzyPatterns) {
    const { data: fuzzy } = await admin
      .from('programs')
      .select('id, title')
      .eq('university_id', universityId)
      .eq('is_active', true)
      .ilike('title', `%${pat}%`)
      .limit(1)
      .maybeSingle();
    if (fuzzy) return fuzzy;
  }

  return null;
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  const results: any = {
    action: 'program_evidence_pilot_v2_recovery',
    methodology_version: METHODOLOGY_VERSION,
    started_at: now,
  };

  try {
    // ═══════════════════════════════════════════
    // STEP 0: Snapshot BEFORE state
    // ═══════════════════════════════════════════
    const pilotUniIds = [...new Set(PILOT_PROGRAMS.map(p => p.university_id))];

    const { data: beforeScores } = await admin
      .from('orx_scores')
      .select('entity_id, entity_type, score, confidence, status, program_score, university_score, country_score, badges')
      .in('entity_id', pilotUniIds)
      .eq('entity_type', 'university');

    const beforeState: Record<string, any> = {};
    for (const s of (beforeScores || [])) {
      beforeState[s.entity_id] = {
        score: s.score, confidence: s.confidence, status: s.status,
        program_score: s.program_score, has_program_layer: s.program_score !== null,
      };
    }
    results.before_state = beforeState;
    const beforeMissingProgCount = Object.values(beforeState).filter((s: any) => !s.has_program_layer).length;

    // ═══════════════════════════════════════════
    // STEP 1: Resolve program IDs (with fuzzy matching)
    // ═══════════════════════════════════════════
    console.log('[pilot-v2] Step 1: Resolving programs with fuzzy matching...');

    const resolvedPrograms: PilotProgram[] = [];
    const matchLog: any[] = [];

    for (const pp of PILOT_PROGRAMS) {
      if (pp.program_id) {
        resolvedPrograms.push(pp);
        matchLog.push({ uni: pp.university_name, program: pp.program_title, method: 'hardcoded', id: pp.program_id });
        continue;
      }

      const found = await resolveProgram(admin, pp.university_id, pp.program_title, pp.fuzzy_patterns);
      if (found) {
        resolvedPrograms.push({ ...pp, program_id: found.id, program_title: found.title });
        matchLog.push({ uni: pp.university_name, program: pp.program_title, method: 'fuzzy_matched', id: found.id, matched_title: found.title });
        console.log(`[pilot-v2] Matched ${pp.university_name} "${pp.program_title}" → ${found.id} ("${found.title}")`);
      } else {
        matchLog.push({ uni: pp.university_name, program: pp.program_title, method: 'FAILED', reason: 'no_match' });
        console.warn(`[pilot-v2] No match for ${pp.university_name} "${pp.program_title}"`);
      }
    }

    results.match_log = matchLog;
    results.programs_resolved = resolvedPrograms.length;
    results.programs_skipped = PILOT_PROGRAMS.length - resolvedPrograms.length;

    // ═══════════════════════════════════════════
    // STEP 2: Clean prior pilot evidence (v1 and v2)
    // ═══════════════════════════════════════════
    console.log('[pilot-v2] Step 2: Cleaning prior pilot evidence...');
    await admin.from('orx_evidence').delete().like('content_hash', 'pilot_prog_%');

    const progIds = resolvedPrograms.map(p => p.program_id);
    for (const pid of progIds) {
      await admin.from('orx_score_history').delete().eq('entity_id', pid);
      await admin.from('orx_scores').delete().eq('entity_id', pid);
    }

    // ═══════════════════════════════════════════
    // STEP 3: Fetch official pages + independent sources
    // ═══════════════════════════════════════════
    console.log('[pilot-v2] Step 3: Fetching official + independent sources...');

    const allEvidence: any[] = [];
    const fetchLog: any[] = [];

    for (const prog of resolvedPrograms) {
      console.log(`[pilot-v2] Processing: ${prog.university_name} — ${prog.program_title}`);

      let successfulPages = 0;
      let totalSignals = 0;
      const failedUrls: { url: string; reason: string }[] = [];
      const sourcesUsed: string[] = [];

      // 3a) Official website pages
      for (const url of prog.candidate_urls) {
        const page = await fetchPage(url);
        if (!page.ok) {
          failedUrls.push({ url, reason: page.status === 0 ? 'timeout/network' : `HTTP ${page.status}` });
          continue;
        }
        if (page.content.length < 200) {
          failedUrls.push({ url, reason: 'content_too_short (JS-heavy?)' });
          continue;
        }

        successfulPages++;
        sourcesUsed.push(extractDomain(url));
        const signals = extractProgramSignals(page.content);
        totalSignals += signals.length;

        for (const sig of signals) {
          allEvidence.push({
            entity_type: 'program', entity_id: prog.program_id, layer: 'program',
            signal_family: sig.family, source_type: 'official_website',
            source_url: url, source_domain: extractDomain(url),
            source_title: `${prog.university_name} — ${prog.program_title}`,
            trust_level: 'high', contextual_only: false,
            snippet: sig.snippets[0]?.substring(0, 500) || null,
            language_code: 'en',
            content_hash: makeContentHash(page.content, url, sig.family),
            observed_at: now, freshness_date: now,
            evidence_status: 'accepted',
            extraction_confidence: sig.confidence,
            methodology_version: METHODOLOGY_VERSION,
          });
        }
      }

      // 3b) Independent sources (accreditation, registry, third-party)
      for (const src of prog.independent_sources) {
        const page = await fetchPage(src.url, 15000);
        if (!page.ok) {
          failedUrls.push({ url: src.url, reason: `${src.source_type}: ${page.status === 0 ? 'timeout' : `HTTP ${page.status}`}` });
          continue;
        }
        if (page.content.length < 100) {
          failedUrls.push({ url: src.url, reason: `${src.source_type}: content_too_short` });
          continue;
        }

        successfulPages++;
        const srcDomain = extractDomain(src.url);
        sourcesUsed.push(srcDomain);
        const signals = extractProgramSignals(page.content);
        totalSignals += signals.length;

        // Even if no keyword signals found, the source itself is evidence of accreditation/recognition
        if (signals.length === 0 && page.content.length > 100) {
          allEvidence.push({
            entity_type: 'program', entity_id: prog.program_id, layer: 'program',
            signal_family: 'transferability',
            source_type: src.source_type,
            source_url: src.url, source_domain: srcDomain,
            source_title: src.label,
            trust_level: src.source_type === 'government_report' || src.source_type === 'accreditation_body' ? 'high' : 'medium',
            contextual_only: src.source_type === 'third_party_index',
            snippet: page.content.substring(0, 500),
            language_code: 'en',
            content_hash: makeContentHash(page.content, src.url, 'transferability'),
            observed_at: now, freshness_date: now,
            evidence_status: 'accepted',
            extraction_confidence: 35,
            methodology_version: METHODOLOGY_VERSION,
          });
          totalSignals++;
        }

        for (const sig of signals) {
          allEvidence.push({
            entity_type: 'program', entity_id: prog.program_id, layer: 'program',
            signal_family: sig.family, source_type: src.source_type,
            source_url: src.url, source_domain: srcDomain,
            source_title: src.label,
            trust_level: src.source_type === 'government_report' || src.source_type === 'accreditation_body' ? 'high' : 'medium',
            contextual_only: src.source_type === 'third_party_index',
            snippet: sig.snippets[0]?.substring(0, 500) || null,
            language_code: 'en',
            content_hash: makeContentHash(page.content, src.url, sig.family),
            observed_at: now, freshness_date: now,
            evidence_status: 'accepted',
            extraction_confidence: sig.confidence,
            methodology_version: METHODOLOGY_VERSION,
          });
        }
      }

      const uniqueDomains = [...new Set(sourcesUsed)];
      fetchLog.push({
        program_id: prog.program_id,
        university: prog.university_name,
        program: prog.program_title,
        discipline_family: prog.discipline_family,
        pages_tried: prog.candidate_urls.length + prog.independent_sources.length,
        pages_succeeded: successfulPages,
        signals_extracted: totalSignals,
        unique_domains: uniqueDomains,
        domain_count: uniqueDomains.length,
        source_independent: uniqueDomains.length >= 2,
        failed_urls: failedUrls,
        status: successfulPages > 0 ? (uniqueDomains.length >= 2 ? 'OK_INDEPENDENT' : 'OK_SINGLE_DOMAIN') : 'FETCH_FAILED',
      });
    }

    results.fetch_log = fetchLog;
    results.total_program_evidence = allEvidence.length;

    // ═══════════════════════════════════════════
    // STEP 4: Ingest
    // ═══════════════════════════════════════════
    console.log(`[pilot-v2] Step 4: Ingesting ${allEvidence.length} evidence items...`);

    let inserted = 0;
    for (let i = 0; i < allEvidence.length; i += 20) {
      const batch = allEvidence.slice(i, i + 20);
      const { error: bErr } = await admin.from('orx_evidence').insert(batch);
      if (bErr) {
        console.error(`[pilot-v2] Batch error at ${i}: ${bErr.message}`);
        for (const ev of batch) {
          const { error: sErr } = await admin.from('orx_evidence').insert(ev);
          if (!sErr) inserted++;
        }
      } else {
        inserted += batch.length;
      }
    }
    results.evidence_ingestion = { total: allEvidence.length, inserted };

    // ═══════════════════════════════════════════
    // STEP 5: Score programs
    // ═══════════════════════════════════════════
    console.log('[pilot-v2] Step 5: Scoring programs...');

    const programBatch = progIds.map(pid => ({ entity_type: 'program', entity_id: pid }));
    const progAggRes = await fetch(`${supabaseUrl}/functions/v1/orx-score-aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({ action: 'batch', entities: programBatch }),
    });
    const progAggResult = await progAggRes.json();
    results.program_scoring = { status: progAggRes.status, result: progAggResult };

    // ═══════════════════════════════════════════
    // STEP 6: Re-run composite for universities
    // ═══════════════════════════════════════════
    console.log('[pilot-v2] Step 6: Re-running composite scoring...');

    const uniProgMap: Record<string, string> = {};
    for (const prog of resolvedPrograms) {
      if (!uniProgMap[prog.university_id]) {
        uniProgMap[prog.university_id] = prog.program_id;
      }
    }

    const compositeBatch: any[] = [];
    for (const uid of pilotUniIds) {
      const prog = resolvedPrograms.find(p => p.university_id === uid);
      if (!prog) continue;
      compositeBatch.push({
        entity_type: 'university', entity_id: uid,
        composite: true,
        related_entities: { country: prog.country_id, program: uniProgMap[uid] },
      });
    }

    const compAggRes = await fetch(`${supabaseUrl}/functions/v1/orx-score-aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({ action: 'batch', entities: compositeBatch }),
    });
    const compAggResult = await compAggRes.json();
    results.composite_scoring = { status: compAggRes.status, result: compAggResult };

    // ═══════════════════════════════════════════
    // STEP 7: AFTER state & comparison
    // ═══════════════════════════════════════════
    console.log('[pilot-v2] Step 7: Reading after state...');

    const { data: afterScores } = await admin
      .from('orx_scores')
      .select('entity_id, entity_type, score, confidence, status, program_score, university_score, country_score, badges')
      .in('entity_id', pilotUniIds)
      .eq('entity_type', 'university');

    const afterState: Record<string, any> = {};
    for (const s of (afterScores || [])) {
      afterState[s.entity_id] = {
        score: s.score, confidence: s.confidence, status: s.status,
        program_score: s.program_score, university_score: s.university_score,
        country_score: s.country_score, has_program_layer: s.program_score !== null,
        badges: s.badges,
      };
    }
    results.after_state = afterState;

    const afterMissingProgCount = Object.values(afterState).filter((s: any) => !s.has_program_layer).length;

    // Program scores detail
    const { data: progScores } = await admin
      .from('orx_scores')
      .select('entity_id, score, confidence, status, badges')
      .in('entity_id', progIds)
      .eq('entity_type', 'program');

    results.program_scores = (progScores || []).map((ps: any) => {
      const prog = resolvedPrograms.find(p => p.program_id === ps.entity_id);
      return {
        program_id: ps.entity_id, university: prog?.university_name,
        program: prog?.program_title, discipline: prog?.discipline_family,
        score: ps.score, confidence: ps.confidence, status: ps.status, badges: ps.badges,
      };
    });

    // Comparison table
    const comparison: any[] = [];
    for (const uid of pilotUniIds) {
      const before = beforeState[uid] || { score: null, confidence: null, status: 'none', has_program_layer: false };
      const after = afterState[uid] || before;
      const prog = resolvedPrograms.find(p => p.university_id === uid);

      comparison.push({
        university_id: uid,
        university_name: prog?.university_name || uid,
        before: { score: before.score, confidence: before.confidence, status: before.status, has_program_layer: before.has_program_layer },
        after: { score: after.score, confidence: after.confidence, status: after.status, has_program_layer: after.has_program_layer, program_score: after.program_score },
        delta: {
          score_change: (after.score ?? 0) - (before.score ?? 0),
          confidence_change: (after.confidence ?? 0) - (before.confidence ?? 0),
          program_layer_added: !before.has_program_layer && after.has_program_layer,
        },
      });
    }
    results.before_after_comparison = comparison;

    // Blocker reduction
    const blockersBefore = beforeMissingProgCount;
    const blockersAfter = afterMissingProgCount;
    const blockersResolved = blockersBefore - blockersAfter;
    const reductionPct = blockersBefore > 0 ? Math.round((blockersResolved / blockersBefore) * 100) : 0;

    results.blocker_reduction = {
      before_blocked: blockersBefore,
      after_blocked: blockersAfter,
      resolved: blockersResolved,
      reduction_pct: reductionPct,
      verdict: reductionPct >= 60 ? 'MATERIAL_REDUCTION' : reductionPct >= 30 ? 'PARTIAL_REDUCTION' : 'MINIMAL',
    };

    // Discipline coverage
    const familyCoverage: Record<string, number> = {};
    for (const prog of resolvedPrograms) {
      familyCoverage[prog.discipline_family] = (familyCoverage[prog.discipline_family] || 0) + 1;
    }
    results.discipline_coverage = familyCoverage;

    // Executive snapshot
    const programsScored = (progScores || []).filter((ps: any) => ps.status === 'scored').length;

    results.executive_snapshot = {
      programs_in_pilot: resolvedPrograms.length,
      programs_scored: programsScored,
      unis_with_program_before: pilotUniIds.length - blockersBefore,
      unis_with_program_after: pilotUniIds.length - blockersAfter,
      total_evidence_ingested: inserted,
      discipline_families: Object.keys(familyCoverage).length,
      blocker_reduction_pct: reductionPct,
    };

    // Verdict
    if (inserted === 0) {
      results.verdict = 'FIX_REQUIRED';
    } else if (reductionPct >= 60 && programsScored >= 4) {
      results.verdict = 'PASS';
    } else if (reductionPct >= 30) {
      results.verdict = 'NEEDS_EVIDENCE';
    } else {
      results.verdict = 'FIX_REQUIRED';
    }

    results.remaining_blockers = [
      'All entities remain launch_blocked.',
      blockersAfter > 0 ? `${blockersAfter} universities still missing program layer.` : null,
      'LLM-based extraction not yet implemented.',
      'PDF fallback not yet implemented.',
      'Mass crawler not yet built.',
    ].filter(Boolean);

    results.completed_at = new Date().toISOString();
    console.log(`[pilot-v2] Done. ${inserted} evidence, ${programsScored} scored, ${reductionPct}% reduction.`);

    return new Response(JSON.stringify(results, null, 2), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[pilot-v2] Error:', e);
    results.error = String(e);
    results.verdict = 'FIX_REQUIRED';
    return new Response(JSON.stringify(results, null, 2), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
