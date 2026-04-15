/**
 * Website Enrichment Worker v11 — Bounded Execution + Publish-Safe + Country Gate + Canonical-Homepage Gate
 * 
 * Two-lane architecture:
 *   Lane A — Registry fast-pass (OpenAlex/ROR in PARALLEL)
 *   Lane B — Free web discovery (DuckDuckGo HTML scraping)
 * 
 * v10 SAFETY changes (on top of v9 performance):
 *   1. Country-from-TLD extraction: maps domain ccTLD (.ac.kr → KR) to ISO country code
 *   2. Hard country mismatch gate: if domain TLD country ≠ university country → demote to review, NEVER publish
 *   3. Blocks cross-country academic domains (e.g. ghent.ac.kr for Belgian Ghent University)
 *   4. All v9 performance + v8 safety gates preserved
 * 
 * v9 PERFORMANCE changes (safety gates unchanged from v8):
 *   1. Hard 25s per-university deadline — every stage checks remaining time
 *   2. OpenAlex + ROR run in parallel under shared 6s budget
 *   3. DDG: max 2 queries, 4s timeout, no fixed inter-query sleep
 *   4. Top 2 candidates validated in parallel; 3rd only if needed + time remains
 *   5. Retry only for strong institutional candidates (academic TLD / domain coherence / searchTitle)
 *   6. Geo extraction only for matched status (skipped for review/failed)
 *   7. All v8 safety gates preserved: aggregator hard-block, publish gate, identity validation
 */
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-client-trace-id, x-orxya-ingress',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ========================
// Constants & Hard Blocks
// ========================

/** Absolute denylist — these domains can NEVER become official_website_domain */
const BLACKLISTED_DOMAINS = new Set([
  // Social / general
  'wikipedia.org', 'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
  'youtube.com', 'tiktok.com', 'wikidata.org', 'wikimedia.org',
  'x.com', 'reddit.com', 'quora.com', 'medium.com',
  'pinterest.com', 'flickr.com', 'tumblr.com',
  'google.com', 'google.co.uk', 'bing.com', 'yahoo.com', 'duckduckgo.com',
  // Rankings / directories / aggregators
  'uniranks.com', 'unirank.org', 'topuniversities.com', 'timeshighereducation.com',
  'webometrics.info', 'shanghairanking.com', 'cwur.org', 'usnews.com',
  '4icu.org', 'edurank.org', 'eduiq.org', 'educabras.com',
  'masterstudies.com', 'bachelorsportal.com', 'mastersportal.com', 'phdportal.com',
  'studyportals.com', 'niche.com', 'petersons.com', 'collegedunia.com', 'research.com',
  'hotcoursesabroad.com', 'hotcourses.com', 'keystone.edu', 'shiksha.com', 'careers360.com',
  'afterschool.my', 'easyuni.com', 'studymalaysia.com', 'whed.net',
  'unistats.ac.uk', 'ucas.com', 'whatuni.com', 'theuniguide.co.uk', 'discoveruni.gov.uk',
  'studyinrussia.ru', 'studyabroad.com', 'studyin.org', 'studyabroad101.com',
  'goabroad.com', 'educations.com', 'finduniversity.ph',
  'universityguru.com', 'collegevine.com', 'unigo.com', 'cappex.com',
  'campusexplorer.com', 'collegesimply.com', 'princetonreview.com',
  'gotouniversity.com', 'idp.com', 'studylink.com', 'applyboard.com',
  'leverage.edu', 'yocket.com', 'studyinternational.com',
  'standyou.com', 'satsphere.com', 'unipage.net',
  'gomap.az', 'kataloq.gomap.az', 'azerbaijan360.az',
  // Academic profile / research platforms (NOT institutional sites)
  'academia.edu', 'researchgate.net', 'orcid.org', 'scopus.com',
  'semanticscholar.org', 'googlescholar.com', 'scholar.google.com',
  // Job / review
  'glassdoor.com', 'indeed.com', 'crunchbase.com', 'bloomberg.com', 'reuters.com',
  'ratemyprofessors.com', 'trustpilot.com', 'sitejabber.com', 'mouthshut.com',
  'yellowpages.com', 'yelp.com', 'bbb.org',
  // MOOC
  'coursera.org', 'edx.org', 'udemy.com', 'futurelearn.com', 'classcentral.com', 'mooc.org',
  // Scholarships
  'wemakescholars.com', 'scholarshipportal.com', 'scholarships.com',
  // Code hosting / archive
  'github.com', 'gitlab.com', 'bitbucket.org', 'archive.org', 'web.archive.org',
  'slideshare.net', 'scribd.com', 'issuu.com',
  // Admission portals (country-level, not institutional)
  'admission.edu.ge',
  // Pseudo-university / directory-like / low-trust domains found in diagnostics
  '123university.net', 'zielonagorauni.online',
  'uni2study.com', 'educaedu-brasil.com', 'educaedu.com',
  'vouprafaculdade.com.br', 'altillo.com', 'guiadacarreira.com.br',
  'melhoresescolas.com.br', 'querobolsa.com.br',
  'topschool.com', 'schoolguide.com', 'uni-24.de',
  'fao.org', // NOT a university
  'en-academic.com', 'academic-accelerator.com', // encyclopedia/dictionary, not institutions
  'mypolishuniversity.com', // directory
]);

const DIRECTORY_PATTERNS = [
  /studyabroad|studyin|finduniversity|universityguru|collegevine/i,
  /ranking|webometrics|topuniversities|timeshigher/i,
  /wikipedia\.org|wikidata\.org/i,
  /web\.archive\.org/i,
  /(master|bachelor|phd)s?portal/i,
  /studyportals|hotcourses|keystone/i,
  /glassdoor|indeed|crunchbase/i,
  /unirank|eduiq|educabras|standyou|satsphere|unipage/i,
  /admission\.edu\.\w+/i,
  /gomap\.|kataloq\./i,
  /collegeboard|collegesearch|campusreel/i,
  /123university|zielonagorauni|uni2study|educaedu|vouprafaculdade/i,
  /altillo\.com|guiadacarreira|melhoresescolas|querobolsa/i,
];

const NON_HOMEPAGE_PATHS = [
  '/home.aspx', '/home.html', '/home.htm', '/index.html', '/index.htm', '/index.aspx',
  '/index.php', '/default.aspx', '/default.html', '/main.html',
  '/alumni', '/alumni/', '/about', '/about/', '/about-us', '/about-us/',
  '/en', '/en/', '/ar', '/ar/', '/de', '/de/', '/fr', '/fr/',
  '/Pages/home.aspx', '/Pages/default.aspx',
];

// v8: Academic domain patterns — used in decision logic, not cosmetic
const INSTITUTIONAL_DOMAIN_PATTERNS = [
  /\.edu$/i,
  /\.edu\.\w{2,3}$/i,       // .edu.az, .edu.br, .edu.co, .edu.tr
  /\.ac\.\w{2,3}$/i,        // .ac.uk, .ac.jp, .ac.kr, .ac.id, .ac.ir
  /\.uni-[\w]+\.\w{2}$/i,   // uni-*.de
  /\.gob\.\w{2}$/i,
  /\.nic\.in$/i,
];

function isAcademicDomain(domain: string): boolean {
  if (/\.(edu|ac)\./i.test(domain)) return true;
  if (/\.edu$/i.test(domain)) return true;
  for (const pat of INSTITUTIONAL_DOMAIN_PATTERNS) {
    if (pat.test(domain)) return true;
  }
  return false;
}

// ========================
// v10: Country-from-TLD extraction & mismatch detection
// ========================

/** Map ccTLD → ISO country code. Covers all major academic ccTLDs. */
const TLD_TO_COUNTRY: Record<string, string> = {
  'ac.uk': 'GB', 'co.uk': 'GB', 'org.uk': 'GB', 'uk': 'GB',
  'ac.jp': 'JP', 'co.jp': 'JP', 'jp': 'JP',
  'ac.kr': 'KR', 'co.kr': 'KR', 'kr': 'KR',
  'ac.id': 'ID', 'co.id': 'ID', 'id': 'ID',
  'ac.ir': 'IR', 'ir': 'IR',
  'ac.in': 'IN', 'co.in': 'IN', 'in': 'IN', 'nic.in': 'IN',
  'ac.th': 'TH', 'co.th': 'TH', 'th': 'TH',
  'ac.nz': 'NZ', 'co.nz': 'NZ', 'nz': 'NZ',
  'ac.za': 'ZA', 'co.za': 'ZA', 'za': 'ZA',
  'ac.il': 'IL', 'co.il': 'IL', 'il': 'IL',
  'ac.ke': 'KE', 'ke': 'KE',
  'ac.tz': 'TZ', 'tz': 'TZ',
  'ac.ug': 'UG', 'ug': 'UG',
  'ac.rw': 'RW', 'rw': 'RW',
  'ac.at': 'AT', 'at': 'AT',
  'ac.be': 'BE', 'be': 'BE',
  'ac.cn': 'CN', 'cn': 'CN', 'edu.cn': 'CN',
  'edu.au': 'AU', 'au': 'AU',
  'edu.br': 'BR', 'br': 'BR',
  'edu.co': 'CO', 'co': 'CO',
  'edu.mx': 'MX', 'mx': 'MX',
  'edu.ar': 'AR', 'ar': 'AR',
  'edu.pe': 'PE', 'pe': 'PE',
  'edu.cl': 'CL', 'cl': 'CL',
  'edu.tr': 'TR', 'tr': 'TR',
  'edu.eg': 'EG', 'eg': 'EG',
  'edu.sa': 'SA', 'sa': 'SA',
  'edu.pk': 'PK', 'pk': 'PK',
  'edu.ng': 'NG', 'ng': 'NG',
  'edu.gh': 'GH', 'gh': 'GH',
  'edu.ph': 'PH', 'ph': 'PH',
  'edu.my': 'MY', 'my': 'MY',
  'edu.sg': 'SG', 'sg': 'SG',
  'edu.vn': 'VN', 'vn': 'VN',
  'edu.tw': 'TW', 'tw': 'TW',
  'edu.hk': 'HK', 'hk': 'HK',
  'edu.bd': 'BD', 'bd': 'BD',
  'edu.lk': 'LK', 'lk': 'LK',
  'edu.az': 'AZ', 'az': 'AZ',
  'edu.ge': 'GE', 'ge': 'GE',
  'edu.kz': 'KZ', 'kz': 'KZ',
  'edu.ua': 'UA', 'ua': 'UA',
  'edu.pl': 'PL', 'pl': 'PL',
  'edu.ru': 'RU', 'ru': 'RU',
  'edu.et': 'ET', 'et': 'ET',
  'de': 'DE', 'fr': 'FR', 'it': 'IT', 'es': 'ES', 'pt': 'PT',
  'nl': 'NL', 'se': 'SE', 'no': 'NO', 'dk': 'DK', 'fi': 'FI',
  'ch': 'CH', 'cz': 'CZ', 'hu': 'HU', 'ro': 'RO', 'bg': 'BG',
  'hr': 'HR', 'rs': 'RS', 'si': 'SI', 'sk': 'SK', 'lt': 'LT',
  'lv': 'LV', 'ee': 'EE', 'gr': 'GR', 'ie': 'IE', 'ca': 'CA',
  'us': 'US', 'ma': 'MA', 'tn': 'TN', 'dz': 'DZ',
  'qa': 'QA', 'ae': 'AE', 'kw': 'KW', 'om': 'OM', 'bh': 'BH',
  'jo': 'JO', 'lb': 'LB', 'iq': 'IQ',
};

/**
 * Extract country code from a domain's TLD/ccTLD.
 * Returns null for generic TLDs (.com, .org, .net, .edu without country).
 */
function extractCountryFromDomain(domain: string): string | null {
  const parts = domain.split('.');
  if (parts.length < 2) return null;
  
  // Try progressively longer suffixes: ac.kr, then kr
  for (let i = Math.max(0, parts.length - 3); i < parts.length - 1; i++) {
    const suffix = parts.slice(i + 1).join('.');
    // Also try with the second-level: e.g. "ac.kr" from "ghent.ac.kr"
    const twoLevel = parts.slice(i).join('.');
    // Check compound TLD first (ac.kr, edu.br, etc.)
    for (let j = i; j < parts.length - 1; j++) {
      const compound = parts.slice(j).join('.');
      if (TLD_TO_COUNTRY[compound]) return TLD_TO_COUNTRY[compound];
    }
  }
  
  // Fallback: last part only
  const lastPart = parts[parts.length - 1];
  if (TLD_TO_COUNTRY[lastPart]) return TLD_TO_COUNTRY[lastPart];
  
  return null; // .com, .org, .net, .edu (US generic) → no country signal
}

/**
 * v10: Hard country mismatch check.
 * Returns true if the domain's TLD country CONFLICTS with the university's known country.
 * Only triggers when BOTH sides have country info and they differ.
 */
function hasCountryMismatch(domain: string, uniCountryCode: string | null): { mismatch: boolean; domainCountry: string | null; reason: string } {
  if (!uniCountryCode) return { mismatch: false, domainCountry: null, reason: 'no_uni_country' };
  
  const domainCountry = extractCountryFromDomain(domain);
  if (!domainCountry) return { mismatch: false, domainCountry: null, reason: 'generic_tld' };
  
  if (domainCountry.toUpperCase() === uniCountryCode.toUpperCase()) {
    return { mismatch: false, domainCountry, reason: 'country_match' };
  }
  
  return { mismatch: true, domainCountry, reason: `tld_country_${domainCountry}_vs_uni_country_${uniCountryCode}` };
}

// ========================
// v11: Canonical-Homepage Publish Gate
// ========================

/** Subdomain prefixes that indicate a non-canonical microsite */
const NON_CANONICAL_SUBDOMAINS = new Set([
  'admissions', 'admission', 'undergrad', 'undergraduate', 'graduate', 'grad',
  'gradschool', 'apply', 'enroll', 'enrollment', 'registration',
  // v12: academic-unit subdomains that are NOT the institutional root
  'college', 'school', 'faculty', 'department', 'departments', 'dept',
  'institute', 'center', 'centre', 'lab', 'labs', 'observatory',
  'engineering', 'medicine', 'law', 'business', 'nursing', 'pharmacy',
  'science', 'arts', 'education', 'dental', 'veterinary',
  'library', 'lib', 'catalog', 'catalogue', 'repositories',
  'events', 'news', 'blog', 'press', 'media', 'communications',
  'alumni', 'giving', 'donate', 'fundraising', 'foundation',
  'athletics', 'sports', 'recreation',
  'housing', 'dining', 'parking', 'facilities',
  'hr', 'jobs', 'careers', 'employment',
  'research', 'grants', 'innovation',
  'it', 'tech', 'helpdesk', 'support',
  'store', 'shop', 'bookstore',
  'summer', 'winter', 'camps', 'conferences',
  'online', 'distance', 'continuing', 'extension',
  'international', 'global', 'abroad',
  'health', 'wellness', 'counseling',
  'mail', 'email', 'webmail', 'portal', 'my', 'login', 'sso',
  // v12: campus/location-specific subdomains
  'campus', 'main', 'north', 'south', 'east', 'west',
  // v12: "start" portals (e.g. start.uni-stuttgart.de)
  'start', 'home', 'welcome', 'landing',
]);

/** Path prefixes that indicate a section page, not the institutional root */
const NON_CANONICAL_PATH_PREFIXES = [
  '/admissions', '/admission', '/apply', '/enroll',
  '/undergraduate', '/graduate', '/programs', '/academics',
  '/departments', '/faculties', '/schools', '/colleges',
  '/research', '/library', '/alumni', '/giving',
  '/athletics', '/sports', '/news', '/events', '/blog',
  '/about/', // note: /about as the full page is OK via NON_HOMEPAGE_PATHS, but /about/subpage is not
  '/housing', '/dining', '/campus-life', '/student-life',
  '/financial-aid', '/scholarships', '/tuition', '/fees',
  '/international', '/global',
];

/**
 * v11: Check if a URL is a non-canonical institutional page.
 * A published website must be the main homepage root, not a microsite/section.
 * Returns { nonCanonical: true, reason } if it should be demoted.
 */
function isNonCanonicalHomepage(url: string): { nonCanonical: boolean; reason: string } {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = u.pathname.toLowerCase().replace(/\/+$/, '');
    
    // Check subdomain: e.g. "undergrad.admissions.columbia.edu"
    // Split hostname, remove TLD parts, check remaining labels
    const hostParts = hostname.split('.');
    // For domains like "admissions.columbia.edu", hostParts = ['admissions','columbia','edu']
    // We want to check if any label before the institutional domain is a non-canonical indicator
    if (hostParts.length >= 3) {
      // Check all labels except the last 2 (domain + TLD) or last 3 for compound TLDs
      const isCompoundTLD = /\.(ac|edu|co|gov|org)\.\w{2,3}$/.test(hostname);
      const rootCount = isCompoundTLD ? 3 : 2;
      const subLabels = hostParts.slice(0, hostParts.length - rootCount);
      
      for (const label of subLabels) {
        if (NON_CANONICAL_SUBDOMAINS.has(label)) {
          return { nonCanonical: true, reason: `subdomain_microsite:${label}.${hostParts.slice(hostParts.length - rootCount).join('.')}` };
        }
        // v12: check hyphenated compound labels (e.g. "twin-cities" → check "cities")
        if (label.includes('-')) {
          const parts = label.split('-');
          for (const p of parts) {
            if (NON_CANONICAL_SUBDOMAINS.has(p)) {
              return { nonCanonical: true, reason: `subdomain_compound:${label}.${hostParts.slice(hostParts.length - rootCount).join('.')}` };
            }
          }
          // v12: hyphenated campus/location subdomains (e.g. twin-cities, kuala-lumpur)
          // If the subdomain is hyphenated and not a known abbreviation, treat as campus-specific
          if (parts.length >= 2) {
            return { nonCanonical: true, reason: `subdomain_campus_location:${label}.${hostParts.slice(hostParts.length - rootCount).join('.')}` };
          }
        }
      }
    }
    
    // Check path: e.g. "/admissions/undergraduate"
    if (pathname && pathname !== '/' && pathname.length > 1) {
      for (const prefix of NON_CANONICAL_PATH_PREFIXES) {
        if (pathname.startsWith(prefix)) {
          return { nonCanonical: true, reason: `section_path:${pathname}` };
        }
      }
      // Deep paths (3+ segments) are suspicious unless they're language prefixes
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length >= 2) {
        const firstSeg = segments[0];
        // Allow single language codes like /en, /ar, /de
        const isLangPrefix = /^[a-z]{2}(-[a-z]{2})?$/.test(firstSeg);
        if (!isLangPrefix) {
          return { nonCanonical: true, reason: `deep_path:${pathname}` };
        }
      }
    }
    
    return { nonCanonical: false, reason: 'canonical_root' };
  } catch {
    return { nonCanonical: false, reason: 'parse_error' };
  }
}

const MATCH_THRESHOLD = 88;
const REVIEW_THRESHOLD = 50;
const MIN_NAME_SIMILARITY = 0.45;
const LANE_A_MIN_SIMILARITY = 0.90;
const HARD_DEADLINE_MS = 25_000;  // v9: hard per-university deadline
const STALE_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const OPENALEX_BASE = 'https://api.openalex.org';
const DDG_URL = 'https://html.duckduckgo.com/html/';

// v9: Stage budgets (ms)
const STAGE_BUDGET = {
  REGISTRY_PARALLEL: 6_000,   // OpenAlex + ROR combined
  DDG_PER_QUERY: 4_000,       // per DDG query
  FETCH_FIRST: 6_000,         // first homepage fetch
  FETCH_RETRY: 8_000,         // retry fetch (strong candidates only)
  GEO_SUBPAGE: 4_000,         // per geo subpage fetch
  MIN_REMAINING: 2_000,       // minimum time to start a new stage
} as const;

// ========================
// Text Utilities
// ========================

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameToAcronym(name: string): string {
  const stopWords = new Set(['the','of','for','and','in','at','de','du','des','la','le','les','el','al','a','an']);
  return normalizeName(name)
    .split(' ')
    .filter(w => w.length > 1 && !stopWords.has(w))
    .map(w => w[0])
    .join('');
}

/**
 * v8: Entity normalization — generate variants of a university name
 * for matching against page titles, search titles, etc.
 */
function generateNameVariants(name: string): { canonical: string; acronym: string; distinctive: string[]; variants: string[] } {
  const canonical = normalizeName(name);
  const acronym = nameToAcronym(name);
  const distinctive = distinctiveWords(name);
  
  const variants: string[] = [canonical];
  
  // Acronym as variant
  if (acronym.length >= 2) variants.push(acronym);
  
  // Without generic words (e.g. "Zielona Gora" from "University of Zielona Góra")
  const stripped = canonical
    .replace(/\b(university|college|institute|school|academy|polytechnic|higher|vocational|of|the|and|for)\b/g, '')
    .replace(/\s+/g, ' ').trim();
  if (stripped.length >= 3 && stripped !== canonical) variants.push(stripped);
  
  // Distinctive words joined
  if (distinctive.length >= 1) variants.push(distinctive.join(' '));
  
  return { canonical, acronym, distinctive, variants };
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a), nb = normalizeName(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  
  const wa = new Set(na.split(' ').filter(w => w.length > 2));
  const wb = new Set(nb.split(' ').filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  
  const intersection = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  const jaccard = intersection / union;
  
  const shorter = wa.size <= wb.size ? wa : wb;
  const longer = wa.size > wb.size ? wa : wb;
  const recall = [...shorter].filter(w => longer.has(w)).length / shorter.size;
  
  return Math.max(jaccard, recall * 0.9);
}

/**
 * v8: Enhanced similarity that also checks acronym and distinctive words
 */
function enhancedNameMatch(uniName: string, targetText: string): { score: number; method: string } {
  if (!targetText || !uniName) return { score: 0, method: 'none' };
  
  const directSim = nameSimilarity(uniName, targetText);
  if (directSim >= 0.7) return { score: directSim, method: 'direct' };
  
  const { acronym, distinctive } = generateNameVariants(uniName);
  const targetNorm = normalizeName(targetText);
  
  // Acronym match: "ADU" in "ADU - Azerbaycan Dillər Universiteti"
  if (acronym.length >= 2 && acronym.length <= 6) {
    const targetWords = targetNorm.split(/[\s\-–—|:,]+/);
    if (targetWords.some(w => w === acronym)) {
      return { score: 0.7, method: 'acronym_exact' };
    }
    if (targetNorm.startsWith(acronym + ' ') || targetNorm.includes(' ' + acronym + ' ')) {
      return { score: 0.65, method: 'acronym_in_text' };
    }
  }
  
  // Distinctive word match: "zielona gora" in Polish page title
  if (distinctive.length >= 1) {
    const hits = distinctive.filter(w => targetNorm.includes(w)).length;
    if (hits >= 2 || (hits >= 1 && distinctive.length <= 2)) {
      return { score: Math.max(directSim, 0.6 + hits * 0.1), method: 'distinctive_words' };
    }
  }
  
  return { score: directSim, method: 'direct' };
}

function distinctiveWords(name: string): string[] {
  const generic = new Set(['university','college','institute','school','academy','polytechnic',
    'the','of','for','and','in','at','de','du','des','la','le','les','el','al',
    'national','state','federal','royal','imperial','public','private',
    'higher','education','technology','science','sciences','engineering',
    'applied','arts','technical','centre','center','foundation','vocational']);
  return normalizeName(name).split(' ').filter(w => w.length >= 3 && !generic.has(w));
}

// ========================
// URL Utilities
// ========================

function canonicalizeUrl(rawUrl: any): { canonical: string; raw: string } {
  if (!rawUrl || typeof rawUrl !== 'string') return { canonical: '', raw: String(rawUrl || '') };
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
  const raw = url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:') parsed.protocol = 'https:';
    const lp = parsed.pathname.toLowerCase();
    for (const p of NON_HOMEPAGE_PATHS) {
      if (lp === p.toLowerCase() || lp.startsWith(p.toLowerCase())) { parsed.pathname = '/'; break; }
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    parsed.search = ''; parsed.hash = '';
    return { canonical: parsed.toString().replace(/\/+$/, ''), raw };
  } catch { return { canonical: url.replace(/\/+$/, ''), raw }; }
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

function isBlacklisted(domain: string): boolean {
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (BLACKLISTED_DOMAINS.has(parts.slice(i).join('.'))) return true;
  }
  return DIRECTORY_PATTERNS.some(p => p.test(domain));
}

/**
 * v8: Check if a URL points to a subpage on another institution's domain
 * e.g. erasmusweek.agh.edu.pl/baku-higher-oil-school/ is NOT Baku Higher Oil School's website
 */
function isSubpageOnForeignDomain(url: string, domain: string, uniName: string): boolean {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const path = u.pathname.toLowerCase();
    // If there's a meaningful path (not homepage), AND domain coherence is very low,
    // this is likely a subpage about the university on someone else's site
    if (path.length > 5 && path !== '/' && path !== '/index.html') {
      const domCoh = domainNameCoherence(domain, uniName);
      if (domCoh < 0.3) {
        // Check if the path contains the university name fragments (confirming it's a page ABOUT this uni)
        const nameSlug = normalizeName(uniName).replace(/\s+/g, '-');
        const distinctive = distinctiveWords(uniName);
        const pathHasName = distinctive.some(w => path.includes(w));
        if (pathHasName) return true; // Confirmed: page about this uni on another site
      }
    }
    return false;
  } catch { return false; }
}

function domainNameCoherence(domain: string, uniName: string): number {
  const domBase = domain
    .replace(/\.(edu|ac|org|com|gov|net|ru|uk|de|fr|jp|cn|kr|in|br|mx|tr|sa|eg|my|id|th|vn|ph|ng|ke|za|pk|bd|lk|np|mm|cz|dk|sz|se|no|fi|nl|be|at|ch|pl|hu|ro|bg|hr|si|sk|lt|lv|ee|ua|ge|kz|uz|az)(\.\w{2,3})?$/i, '')
    .split('.').pop() || '';
  const nameWords = normalizeName(uniName).split(' ').filter(w => w.length > 2);
  let directMatches = 0;
  for (const word of nameWords) {
    if (domBase.includes(word.slice(0, 4)) || word.includes(domBase.slice(0, 4))) directMatches++;
  }
  if (directMatches > 0 && nameWords.length > 0) return Math.min(1, directMatches / Math.max(1, nameWords.length - 2));
  
  const acronym = nameToAcronym(uniName);
  if (acronym.length >= 2 && domBase.length >= 2) {
    if (domBase === acronym) return 0.75;
    if (domBase.startsWith(acronym) || acronym.startsWith(domBase)) return 0.7;
    const overlapLen = Math.min(domBase.length, acronym.length);
    let matchChars = 0;
    for (let i = 0; i < overlapLen; i++) { if (domBase[i] === acronym[i]) matchChars++; else break; }
    if (matchChars >= 2 && matchChars / Math.max(domBase.length, acronym.length) >= 0.5) return 0.6;
  }
  
  for (const word of nameWords) {
    if (word.length >= 5 && domBase.includes(word)) return 0.8;
    if (domBase.length >= 5 && word.includes(domBase)) return 0.6;
  }
  return 0;
}

// ========================================================
// LANE A — Registry Fast-Pass (very strict, exact matches)
// ========================================================

interface LaneAResult {
  hit: boolean;
  website?: string;
  domain?: string;
  city?: string;
  country_code?: string;
  display_name?: string;
  source: string;
  similarity: number;
  reasons: string[];
}

async function laneARegistryFastPass(name: string, countryCode: string | null, deadline: number): Promise<LaneAResult> {
  const noHit: LaneAResult = { hit: false, source: 'none', similarity: 0, reasons: [] };
  const regTimeout = Math.min(STAGE_BUDGET.REGISTRY_PARALLEL, Math.max(2000, deadline - Date.now() - 1000));
  if (regTimeout < 2000) return noHit;

  // v9: Run OpenAlex + ROR in PARALLEL under shared budget
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), regTimeout);

  const openAlexP = (async (): Promise<LaneAResult> => {
    try {
      const params = new URLSearchParams({
        search: name, per_page: '5',
        select: 'id,display_name,homepage_url,country_code,geo,works_count',
      });
      if (countryCode) params.set('filter', `country_code:${countryCode.toUpperCase()}`);
      const resp = await fetch(`${OPENALEX_BASE}/institutions?${params}`, {
        headers: { 'User-Agent': 'mailto:admin@lavista.app', 'Accept': 'application/json' },
        signal: controller.signal,
      });
      if (!resp.ok) return noHit;
      const data = await resp.json();
      for (const r of (data.results || [])) {
        const sim = nameSimilarity(name, r.display_name || '');
        const hp = r.homepage_url || '';
        const domain = hp ? extractDomain(hp) : null;
        const hasEdu = domain ? isAcademicDomain(domain) : false;
        const countryMatch = !countryCode || (r.country_code || '').toUpperCase() === countryCode.toUpperCase();
        if (sim >= LANE_A_MIN_SIMILARITY && hp && domain && !isBlacklisted(domain) && countryMatch) {
          const domCoh = domainNameCoherence(domain, name);
          if (domCoh >= 0.4 || hasEdu) {
            return {
              hit: true, website: hp, domain,
              city: r.geo?.city || undefined, country_code: r.country_code || undefined,
              display_name: r.display_name, source: 'openalex', similarity: sim,
              reasons: [`name_sim(${sim.toFixed(3)})`, `domain_coh(${domCoh.toFixed(2)})`, countryMatch ? 'country_match' : '', hasEdu ? 'academic_domain' : ''].filter(Boolean),
            };
          }
        }
      }
    } catch {}
    return noHit;
  })();

  const rorP = (async (): Promise<LaneAResult> => {
    try {
      const rorParams = new URLSearchParams({ query: name });
      const rorResp = await fetch(`https://api.ror.org/organizations?${rorParams}`, { signal: controller.signal });
      if (!rorResp.ok) return noHit;
      const rorData = await rorResp.json();
      for (const item of (rorData.items || []).slice(0, 3)) {
        const sim = nameSimilarity(name, item.name || '');
        const links = item.links || [];
        const hp = links[0] || '';
        const domain = hp ? extractDomain(hp) : null;
        const hasEdu = domain ? isAcademicDomain(domain) : false;
        const rorCountry = item.country?.country_code || '';
        const countryMatch = !countryCode || rorCountry.toUpperCase() === countryCode.toUpperCase();
        if (sim >= LANE_A_MIN_SIMILARITY && hp && domain && !isBlacklisted(domain) && countryMatch) {
          const domCoh = domainNameCoherence(domain, name);
          if (domCoh >= 0.4 || hasEdu) {
            return {
              hit: true, website: hp, domain,
              city: item.addresses?.[0]?.city || undefined, country_code: rorCountry || undefined,
              display_name: item.name, source: 'ror', similarity: sim,
              reasons: [`name_sim(${sim.toFixed(3)})`, `domain_coh(${domCoh.toFixed(2)})`, 'country_match', hasEdu ? 'academic_domain' : ''].filter(Boolean),
            };
          }
        }
      }
    } catch {}
    return noHit;
  })();

  try {
    const [oaResult, rorResult] = await Promise.allSettled([openAlexP, rorP]);
    clearTimeout(timer);
    const oa = oaResult.status === 'fulfilled' ? oaResult.value : noHit;
    const ror = rorResult.status === 'fulfilled' ? rorResult.value : noHit;
    // Return best hit (prefer higher similarity)
    if (oa.hit && ror.hit) return oa.similarity >= ror.similarity ? oa : ror;
    if (oa.hit) return oa;
    if (ror.hit) return ror;
  } catch { clearTimeout(timer); }
  return noHit;
}

// ========================================================
// LANE B — Free Web Discovery
// ========================================================

interface SearchCandidate {
  url: string;
  domain: string;
  title: string;
  snippet: string;
  searchRank: number;
}

function parseDDGResults(html: string): { url: string; title: string; snippet: string }[] {
  const results: { url: string; title: string; snippet: string }[] = [];
  const resultBlocks = html.split(/class="result\s/);
  for (const block of resultBlocks.slice(1, 16)) {
    const linkMatch = block.match(/class="result__a"[^>]*href="([^"]+)"/);
    if (!linkMatch) continue;
    let url = linkMatch[1];
    if (url.includes('uddg=')) {
      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
    }
    if (!url.startsWith('http')) continue;
    const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)/);
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([^<]{0,500})/);
    const snippet = snippetMatch ? snippetMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
    results.push({ url, title, snippet });
  }
  return results;
}

async function ddgSearch(query: string, timeoutMs: number = STAGE_BUDGET.DDG_PER_QUERY): Promise<SearchCandidate[]> {
  try {
    const formBody = new URLSearchParams({ q: query, b: '' });
    const resp = await fetch(DDG_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html',
      },
      body: formBody.toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) {
      console.error(`[DDG] HTTP ${resp.status} for query: ${query}`);
      return [];
    }
    const html = await resp.text();
    const parsed = parseDDGResults(html);
    return parsed.map((r, idx) => ({
      ...r,
      domain: extractDomain(r.url) || '',
      searchRank: idx + 1,
    }));
  } catch (e) {
    console.error('[DDG] Error:', e);
    return [];
  }
}

function generateSearchQueries(name: string, countryCode?: string | null, city?: string | null): string[] {
  const queries: string[] = [];
  queries.push(`${name} official website`);
  queries.push(`"${name}" official site`);
  if (countryCode) queries.push(`${name} ${countryCode} official website`);
  if (city) queries.push(`${name} ${city} official website`);
  const stripped = name.replace(/\b(university|college|institute|school|academy|polytechnic)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (stripped.length > 5 && stripped !== name) queries.push(`${stripped} university official site`);
  return queries;
}

async function discoverCandidates(name: string, countryCode: string | null, city: string | null, deadline: number): Promise<SearchCandidate[]> {
  const queries = generateSearchQueries(name, countryCode, city);
  const seenDomains = new Set<string>();
  const candidates: SearchCandidate[] = [];

  // v9: max 2 queries, no fixed sleep, budget-aware
  const maxQueries = 2;
  for (let i = 0; i < Math.min(queries.length, maxQueries); i++) {
    const remaining = deadline - Date.now();
    if (remaining < STAGE_BUDGET.MIN_REMAINING) break;
    
    const queryTimeout = Math.min(STAGE_BUDGET.DDG_PER_QUERY, remaining - 1000);
    if (queryTimeout < 2000) break;
    
    const results = await ddgSearch(queries[i], queryTimeout);
    for (const r of results) {
      if (!r.domain || isBlacklisted(r.domain)) continue;
      if (isSubpageOnForeignDomain(r.url, r.domain, name)) continue;
      if (seenDomains.has(r.domain)) continue;
      seenDomains.add(r.domain);
      candidates.push(r);
    }
    // v9: early exit if we have enough candidates after first query
    if (candidates.length >= 5 && i === 0) break;
    // v9: no fixed sleep — only yield if needed for rate limiting
  }

  return candidates;
}

// ========================
// Homepage Validation
// ========================

interface HomepageSignals {
  title: string;
  ogSiteName: string;
  metaDescription: string;
  hasEduDomain: boolean;
  hasSchemaOrg: boolean;
  schemaOrgName: string;
  fetchSuccess: boolean;
  fetchError?: string;
  bodyTextSample: string;
  retryUsed?: boolean;
}

/**
 * v9: Budget-aware fetch with conditional retry
 * Retry only if: academic domain OR strong domain coherence OR strong searchTitle
 */
async function fetchHomepageSignals(
  url: string, countryCode: string | null | undefined,
  deadline: number,
  retryEligible: boolean = false,
): Promise<HomepageSignals> {
  const empty: HomepageSignals = {
    title: '', ogSiteName: '', metaDescription: '', hasEduDomain: false,
    hasSchemaOrg: false, schemaOrgName: '', fetchSuccess: false, bodyTextSample: '',
  };

  const attempts: { timeout: number; headers: Record<string, string> }[] = [];
  
  // First attempt: bounded by stage budget or remaining time
  const firstTimeout = Math.min(STAGE_BUDGET.FETCH_FIRST, Math.max(2000, deadline - Date.now() - 2000));
  if (firstTimeout < 2000) return { ...empty, fetchError: 'no_time_budget' };
  
  attempts.push({ timeout: firstTimeout, headers: {
    'User-Agent': 'CSW-Enrichment/1.0 (+https://connectstudyworld.com)', 'Accept': 'text/html',
  }});
  
  // v9: Only add retry attempt if candidate is retry-eligible AND time permits
  if (retryEligible) {
    attempts.push({ timeout: -1, headers: { // timeout computed at runtime
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': countryCode ? `${countryCode.toLowerCase()},en;q=0.9` : 'en,*;q=0.5',
    }});
  }

  for (let attempt = 0; attempt < attempts.length; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < STAGE_BUDGET.MIN_REMAINING) {
      return { ...empty, fetchError: 'deadline_reached' };
    }
    
    try {
      const cfg = attempts[attempt];
      // v9: compute retry timeout dynamically from remaining budget
      const timeout = attempt === 0 ? cfg.timeout : Math.min(STAGE_BUDGET.FETCH_RETRY, remaining - 1000);
      if (timeout < 2000) {
        if (attempt === 0) continue;
        return { ...empty, fetchError: 'no_retry_budget' };
      }
      
      const resp = await fetch(url, {
        headers: cfg.headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      });
      if (!resp.ok) {
        if (attempt === 0 && retryEligible) continue;
        return { ...empty, fetchError: `HTTP ${resp.status}` };
      }
      const html = await resp.text();
      if (html.length < 100) {
        if (attempt === 0 && retryEligible) continue;
        return { ...empty, fetchError: 'empty_page' };
      }

      const titleMatch = html.match(/<title[^>]*>([^<]{1,500})<\/title>/i);
      const ogSiteNameMatch = html.match(/<meta\s+[^>]*property=["']og:site_name["'][^>]*content=["']([^"']{1,300})["']/i)
        || html.match(/<meta\s+[^>]*content=["']([^"']{1,300})["'][^>]*property=["']og:site_name["']/i);
      const metaDescMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']{1,500})["']/i)
        || html.match(/<meta\s+[^>]*content=["']([^"']{1,500})["'][^>]*name=["']description["']/i);

      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]{1,5000}?)<\/script>/gi) || [];
      let schemaName = '';
      let hasSchema = false;
      for (const m of jsonLdMatches) {
        const jsonContent = m.replace(/<script[^>]*>/, '').replace(/<\/script>/i, '').trim();
        try {
          const ld = JSON.parse(jsonContent);
          const checkLd = (obj: any) => {
            if (!obj) return;
            const types = ['EducationalOrganization', 'CollegeOrUniversity', 'University', 'Organization'];
            const t = obj['@type'];
            if (t && types.some(tt => (Array.isArray(t) ? t : [t]).includes(tt))) {
              hasSchema = true;
              schemaName = obj.name || '';
            }
          };
          if (Array.isArray(ld)) ld.forEach(checkLd); else checkLd(ld);
        } catch {}
      }

      const domain = extractDomain(url) || '';
      const hasEdu = isAcademicDomain(domain);
      const bodyText = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

      return {
        title: (titleMatch?.[1] || '').trim(),
        ogSiteName: (ogSiteNameMatch?.[1] || '').trim(),
        metaDescription: (metaDescMatch?.[1] || '').trim(),
        hasEduDomain: hasEdu,
        hasSchemaOrg: hasSchema,
        schemaOrgName: schemaName,
        fetchSuccess: true,
        bodyTextSample: bodyText,
        retryUsed: attempt > 0,
      };
    } catch (e: any) {
      if (attempt === 0 && retryEligible) continue;
      return { ...empty, fetchError: e?.message || 'fetch_failed' };
    }
  }
  return { ...empty, fetchError: 'all_attempts_failed' };
}

// ========================
// Geo Extraction (unchanged)
// ========================

interface GeoExtraction {
  city?: string; country?: string; country_code?: string; address?: string; source_page?: string;
}

function extractGeoFromHtml(html: string, pageUrl: string): GeoExtraction {
  const result: GeoExtraction = {};
  const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]{1,10000}?)<\/script>/gi) || [];
  for (const block of jsonLdBlocks) {
    const jsonContent = block.replace(/<script[^>]*>/, '').replace(/<\/script>/i, '').trim();
    try {
      const ld = JSON.parse(jsonContent);
      const extractAddr = (obj: any) => {
        if (!obj) return;
        const addr = obj.address || obj.location?.address || obj.location;
        if (addr) {
          if (typeof addr === 'string') { result.address = result.address || addr; }
          else {
            result.city = result.city || addr.addressLocality;
            result.country = result.country || addr.addressCountry;
            if (addr.addressCountry && addr.addressCountry.length === 2) result.country_code = addr.addressCountry;
            const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode, addr.addressCountry].filter(Boolean);
            if (parts.length > 0) result.address = result.address || parts.join(', ');
          }
        }
      };
      if (Array.isArray(ld)) ld.forEach(extractAddr); else extractAddr(ld);
    } catch {}
  }
  if (!result.city) {
    const text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const addressContext = text.match(/(?:address|location|campus|headquarters|located\s+in|based\s+in)[:\s]*([^.]{10,120})/i);
    if (addressContext) result.address = result.address || addressContext[1].trim();
  }
  if (result.city || result.country || result.country_code || result.address) result.source_page = pageUrl;
  return result;
}

function countryNameToCode(name: string): string | undefined {
  const map: Record<string, string> = {
    'united states': 'US', 'usa': 'US', 'united kingdom': 'GB', 'uk': 'GB',
    'canada': 'CA', 'australia': 'AU', 'germany': 'DE', 'france': 'FR', 'spain': 'ES',
    'italy': 'IT', 'japan': 'JP', 'china': 'CN', 'india': 'IN', 'brazil': 'BR',
    'mexico': 'MX', 'russia': 'RU', 'turkey': 'TR', 'south korea': 'KR', 'korea': 'KR',
    'netherlands': 'NL', 'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI',
    'poland': 'PL', 'switzerland': 'CH', 'austria': 'AT', 'belgium': 'BE', 'portugal': 'PT',
    'ireland': 'IE', 'new zealand': 'NZ', 'south africa': 'ZA', 'nigeria': 'NG',
    'kenya': 'KE', 'ghana': 'GH', 'egypt': 'EG', 'morocco': 'MA', 'tunisia': 'TN',
    'saudi arabia': 'SA', 'uae': 'AE', 'qatar': 'QA', 'kuwait': 'KW', 'oman': 'OM',
    'bahrain': 'BH', 'jordan': 'JO', 'lebanon': 'LB', 'iraq': 'IQ', 'iran': 'IR',
    'pakistan': 'PK', 'bangladesh': 'BD', 'sri lanka': 'LK', 'thailand': 'TH',
    'vietnam': 'VN', 'indonesia': 'ID', 'malaysia': 'MY', 'philippines': 'PH',
    'singapore': 'SG', 'taiwan': 'TW', 'hong kong': 'HK', 'colombia': 'CO',
    'argentina': 'AR', 'chile': 'CL', 'peru': 'PE', 'czech republic': 'CZ', 'czechia': 'CZ',
    'romania': 'RO', 'hungary': 'HU', 'ukraine': 'UA', 'greece': 'GR', 'croatia': 'HR',
    'serbia': 'RS', 'ethiopia': 'ET', 'azerbaijan': 'AZ', 'lithuania': 'LT', 'georgia': 'GE',
  };
  return map[name.toLowerCase().trim()];
}

async function extractGeoFromSubpages(baseUrl: string, deadline: number): Promise<GeoExtraction> {
  const merged: GeoExtraction = {};
  const subpaths = ['/contact', '/about', '/contact-us'];
  const base = baseUrl.replace(/\/+$/, '');
  for (const path of subpaths) {
    if (merged.city && merged.country_code) break;
    const remaining = deadline - Date.now();
    if (remaining < STAGE_BUDGET.MIN_REMAINING) break;
    const timeout = Math.min(STAGE_BUDGET.GEO_SUBPAGE, remaining - 500);
    if (timeout < 1500) break;
    try {
      const url = `${base}${path}`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'CSW-Enrichment/1.0 (+https://connectstudyworld.com)', 'Accept': 'text/html' },
        redirect: 'follow', signal: AbortSignal.timeout(timeout),
      });
      if (!resp.ok) continue;
      const html = await resp.text();
      if (html.length < 200) continue;
      const geo = extractGeoFromHtml(html, url);
      if (geo.city && !merged.city) merged.city = geo.city;
      if (geo.country_code && !merged.country_code) merged.country_code = geo.country_code;
      if (geo.country && !merged.country_code) {
        const code = countryNameToCode(geo.country);
        if (code) merged.country_code = code;
        merged.country = geo.country;
      }
      if (geo.address && !merged.address) merged.address = geo.address;
      if (geo.source_page) merged.source_page = geo.source_page;
    } catch {}
  }
  return merged;
}

// ========================
// v8: Enhanced Identity Validation
// ========================

function validateInstitutionalIdentity(
  signals: HomepageSignals, uniName: string, domain: string,
  searchTitle?: string,
): { valid: boolean; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let confidence = 0;
  const domCoh = domainNameCoherence(domain, uniName);
  const isAcademic = isAcademicDomain(domain);

  // ── FETCH FAILED PATH ──
  if (!signals.fetchSuccess) {
    // v8: Use searchTitle + domain + academic TLD to build floor confidence
    const stMatch = searchTitle ? enhancedNameMatch(uniName, searchTitle) : { score: 0, method: 'none' };
    
    if (stMatch.score >= 0.6) {
      confidence += 25;
      reasons.push(`search_title_${stMatch.method}(${stMatch.score.toFixed(2)})`);
    }
    if (isAcademic) {
      confidence += 15;
      reasons.push('academic_domain');
    }
    if (domCoh >= 0.5) {
      confidence += 15;
      reasons.push(`domain_coherence(${domCoh.toFixed(2)})`);
    }

    if (confidence > 0) {
      reasons.push('fetch_failed_with_signals');
      return { valid: confidence >= 35, confidence: Math.min(100, confidence), reasons };
    }
    return { valid: false, confidence: 0, reasons: ['fetch_failed_no_signals'] };
  }

  // ── FETCH SUCCESS PATH ──
  
  // v8: searchTitle as FIRST-CLASS signal (checked before pageTitle)
  if (searchTitle) {
    const stMatch = enhancedNameMatch(uniName, searchTitle);
    if (stMatch.score >= 0.6) {
      confidence += 30; // v8: raised from 25
      reasons.push(`search_title_${stMatch.method}(${stMatch.score.toFixed(2)})`);
    } else if (stMatch.score >= 0.45) {
      confidence += 15;
      reasons.push(`search_title_weak(${stMatch.score.toFixed(2)})`);
    }
  }

  // pageTitle — v8: use enhancedNameMatch for acronym/alias tolerance
  const titleMatch = enhancedNameMatch(uniName, signals.title);
  if (titleMatch.score >= 0.5) {
    confidence += 25;
    reasons.push(`title_${titleMatch.method}(${titleMatch.score.toFixed(2)})`);
  }

  // og:site_name
  if (signals.ogSiteName) {
    const ogMatch = enhancedNameMatch(uniName, signals.ogSiteName);
    if (ogMatch.score >= 0.5) {
      confidence += 15;
      reasons.push(`og_${ogMatch.method}(${ogMatch.score.toFixed(2)})`);
    }
  }

  // Schema.org
  if (signals.hasSchemaOrg && signals.schemaOrgName) {
    const schemaMatch = enhancedNameMatch(uniName, signals.schemaOrgName);
    if (schemaMatch.score >= 0.5) {
      confidence += 15;
      reasons.push(`schema_${schemaMatch.method}(${schemaMatch.score.toFixed(2)})`);
    }
  }

  // Academic domain
  if (isAcademic) {
    confidence += 15;
    reasons.push('academic_domain');
  }

  // Domain coherence
  if (domCoh >= 0.5) {
    confidence += 15;
    reasons.push(`domain_coherence(${domCoh.toFixed(2)})`);
  } else if (domCoh >= 0.3) {
    confidence += 8;
    reasons.push(`domain_coherence_weak(${domCoh.toFixed(2)})`);
  }

  // Body text distinctive words
  const bodyLower = signals.bodyTextSample.toLowerCase();
  const dWords = distinctiveWords(uniName);
  const bodyHits = dWords.filter(w => bodyLower.includes(w)).length;
  if (bodyHits >= 2 || (bodyHits >= 1 && dWords.length <= 2)) {
    confidence += 10;
    reasons.push(`body_text_match(${bodyHits}/${dWords.length})`);
  }

  const valid = confidence >= 35;
  return { valid, confidence: Math.min(100, confidence), reasons };
}

// ========================
// Candidate Scoring
// ========================

interface ScoredWebCandidate {
  url: string;
  domain: string;
  searchTitle: string;
  searchSnippet: string;
  searchRank: number;
  homepageSignals: HomepageSignals;
  identityValidation: { valid: boolean; confidence: number; reasons: string[] };
  nameSimilarityTitle: number;
  domainCoherence: number;
  score: number;
  status: 'matched' | 'review' | 'failed';
  rejection_reason: string[];
  reasons: string[];
}

function scoreCandidate(
  candidate: SearchCandidate,
  signals: HomepageSignals,
  identity: { valid: boolean; confidence: number; reasons: string[] },
  uniName: string,
  _uniCountry: string | null,
): ScoredWebCandidate {
  const reasons: string[] = [];
  const rejection_reason: string[] = [];

  const stMatch = enhancedNameMatch(uniName, candidate.title);
  const domCoh = domainNameCoherence(candidate.domain, uniName);
  const isAcademic = isAcademicDomain(candidate.domain);

  // v8: Relaxed rejection — don't reject if searchTitle or identity is valid
  if (stMatch.score < MIN_NAME_SIMILARITY && !identity.valid) {
    rejection_reason.push('low_identity_and_search_title');
  }

  let score = 0;
  // Identity confidence is PRIMARY (0-65 points)
  score += Math.round(identity.confidence * 0.65);
  reasons.push(`identity(${identity.confidence})`);

  if (candidate.searchRank <= 2) { score += 12; reasons.push('top_rank'); }
  else if (candidate.searchRank <= 5) { score += 6; reasons.push('good_rank'); }

  // v8: Academic TLD as decision-level signal
  if (isAcademic) { score += 12; reasons.push('academic_tld'); }

  if (domCoh >= 0.65) { score += 8; reasons.push('strong_dom_coh'); }
  else if (domCoh >= 0.4) { score += 4; reasons.push('mod_dom_coh'); }

  if (stMatch.score >= 0.7) { score += 10; reasons.push(`strong_st(${stMatch.method})`); }
  else if (stMatch.score >= 0.5) { score += 5; reasons.push(`partial_st(${stMatch.method})`); }

  score = Math.max(0, Math.min(100, score));

  let status: 'matched' | 'review' | 'failed' = 'failed';
  if (rejection_reason.length === 0) {
    if (score >= MATCH_THRESHOLD) status = 'matched';
    else if (score >= REVIEW_THRESHOLD) status = 'review';
    else if (identity.valid && identity.confidence >= 35) {
      status = 'review';
      reasons.push('identity_rescue');
    }
  } else if (!signals.fetchSuccess && identity.confidence > 0) {
    // Fetch failed but has signals → rescue to review, never let aggregator win
    if (score >= REVIEW_THRESHOLD || (isAcademic && domCoh >= 0.5)) {
      status = 'review';
      rejection_reason.length = 0;
      reasons.push('fetch_fail_rescue');
    }
  }

  return {
    url: candidate.url, domain: candidate.domain,
    searchTitle: candidate.title, searchSnippet: candidate.snippet,
    searchRank: candidate.searchRank,
    homepageSignals: signals,
    identityValidation: identity,
    nameSimilarityTitle: Number(stMatch.score.toFixed(4)),
    domainCoherence: Number(domCoh.toFixed(4)),
    score, status, rejection_reason, reasons,
  };
}

// ========================
// OpenAlex cross-check
// ========================

async function crossCheckOpenAlex(name: string, countryCode?: string | null): Promise<{ city?: string; country_code?: string; display_name?: string } | null> {
  try {
    const params = new URLSearchParams({ search: name, per_page: '3', select: 'id,display_name,country_code,geo' });
    if (countryCode) params.set('filter', `country_code:${countryCode.toUpperCase()}`);
    const resp = await fetch(`${OPENALEX_BASE}/institutions?${params}`, {
      headers: { 'User-Agent': 'mailto:admin@lavista.app' },
      signal: AbortSignal.timeout(4_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    let best: any = null, bestSim = 0;
    for (const r of (data.results || [])) {
      const sim = nameSimilarity(name, r.display_name || '');
      if (sim > bestSim) { bestSim = sim; best = r; }
    }
    if (!best || bestSim < 0.5) return null;
    return { city: best.geo?.city, country_code: best.country_code, display_name: best.display_name };
  } catch { return null; }
}

// ========================
// Main Handler
// ========================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = getSupabaseAdmin();

  try {
    const body = await req.json().catch(() => ({}));
    const jobId = body.job_id;

    if (!jobId) return respond({ ok: false, error: 'job_id required' }, 400);

    const { data: job } = await supabase
      .from('website_enrichment_jobs').select('*').eq('id', jobId).single();
    if (!job || job.status !== 'running')
      return respond({ ok: false, error: 'Job not in running state', status: job?.status });

    // Reclaim stale locks
    const staleThreshold = new Date(Date.now() - STALE_LOCK_TIMEOUT_MS).toISOString();
    await supabase.from('website_enrichment_rows')
      .update({ enrichment_status: 'pending', updated_at: new Date().toISOString(), last_stage: 'stale_reclaimed' })
      .eq('job_id', jobId).eq('enrichment_status', 'processing')
      .lt('locked_at', staleThreshold);

    // Lock exactly 1 row
    const { data: rows, error: lockErr } = await supabase.rpc('rpc_we_lock_batch', { p_job_id: jobId, p_limit: 1 });

    if (lockErr) {
      console.error('[WE-v8] Lock error:', lockErr);
      return respond({ ok: false, error: 'Lock failed: ' + lockErr.message }, 500);
    }

    if (!rows || rows.length === 0) {
      const { count: pendingCount } = await supabase.from('website_enrichment_rows')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId).eq('enrichment_status', 'pending');
      const { count: processingCount } = await supabase.from('website_enrichment_rows')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId).eq('enrichment_status', 'processing');

      const done = (pendingCount || 0) === 0 && (processingCount || 0) === 0;
      if (done) {
        await supabase.from('website_enrichment_jobs')
          .update({ status: 'completed', completed_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
          .eq('id', jobId).eq('status', 'running');
        return respond({ ok: true, done: true, message: 'Job completed' });
      }
      return respond({ ok: true, done: false, message: 'No pending rows', pending: pendingCount, processing: processingCount });
    }

    const row = rows[0];
    const rowId = row.id;
    const uniName = row.university_name || '';

    if (!uniName) {
      await updateRow(supabase, rowId, {
        enrichment_status: 'skipped',
        match_reason: 'no_university_name',
        last_stage: 'skipped',
        processed_at: new Date().toISOString(),
      });
      await updateJobCounters(supabase, jobId);
      return respond({ ok: true, processed: 1, skipped: 1, row_id: rowId });
    }

    console.log(`[WE-v9] Processing: ${uniName} (${row.country_code || '?'}) — row ${rowId}`);
    const deadline = Date.now() + HARD_DEADLINE_MS;
    const timeLeft = () => deadline - Date.now();

    try {
      // ─── Lane A: Registry fast-pass (parallel OpenAlex+ROR) ───
      await updateRow(supabase, rowId, { last_stage: 'lane_a_start' });
      const laneA = await laneARegistryFastPass(uniName, row.country_code, deadline);

      if (laneA.hit && laneA.website && laneA.domain && timeLeft() > STAGE_BUDGET.MIN_REMAINING) {
        await updateRow(supabase, rowId, { last_stage: 'lane_a_homepage_validate' });
        const { canonical } = canonicalizeUrl(laneA.website);
        const signals = await fetchHomepageSignals(canonical || laneA.website, row.country_code, deadline, true);
        const identity = validateInstitutionalIdentity(signals, uniName, laneA.domain);

        if (signals.fetchSuccess && identity.confidence >= 30) {
          const finalScore = Math.min(100, 50 + Math.round(identity.confidence * 0.3) + (laneA.similarity >= 0.95 ? 15 : 5));
          let status: 'matched' | 'review' = finalScore >= MATCH_THRESHOLD ? 'matched' : 'review';
          
          // v10: Country mismatch hard gate — demote matched → review if TLD country ≠ uni country
          const countryCheck = hasCountryMismatch(laneA.domain, row.country_code);
          if (countryCheck.mismatch && status === 'matched') {
            console.log(`[WE-v10] COUNTRY MISMATCH Lane A: ${uniName} (${row.country_code}) → domain ${laneA.domain} (${countryCheck.domainCountry}). Demoting to review.`);
            status = 'review';
            identity.reasons.push(`country_mismatch:${countryCheck.reason}`);
          }
          
          // v11: Canonical-homepage gate — demote non-root microsites/sections
          if (status === 'matched') {
            const canonCheck = isNonCanonicalHomepage(canonical || laneA.website);
            if (canonCheck.nonCanonical) {
              console.log(`[WE-v11] NON-CANONICAL Lane A: ${uniName} → ${canonical || laneA.website} (${canonCheck.reason}). Demoting to review.`);
              status = 'review';
              identity.reasons.push(`noncanonical:${canonCheck.reason}`);
            }
          }
          
          // v9: Geo extraction only for matched status
          let finalCity = laneA.city || null;
          let finalCountry = laneA.country_code || row.country_code;
          if (status === 'matched' && timeLeft() > STAGE_BUDGET.MIN_REMAINING) {
            await updateRow(supabase, rowId, { last_stage: 'lane_a_geo_extract' });
            const geoSubpages = await extractGeoFromSubpages(canonical || laneA.website, deadline);
            const geoHomepage = extractGeoFromHtml(signals.bodyTextSample || '', canonical || laneA.website);
            finalCity = geoSubpages.city || geoHomepage.city || finalCity;
            finalCountry = geoSubpages.country_code || geoHomepage.country_code || finalCountry;
          }
          
          await updateRow(supabase, rowId, {
            official_website_url: status === 'matched' ? canonical : null,
            provider_homepage_url_raw: laneA.website,
            official_website_domain: status === 'matched' ? laneA.domain : null,
            match_source: `lane_a_${laneA.source}`,
            confidence_score: finalScore,
            match_reason: `lane_a: ${laneA.reasons.join(',')}; identity: ${identity.reasons.join(',')}`,
            matched_entity_name: laneA.display_name || signals.ogSiteName || signals.title,
            matched_country: finalCountry,
            matched_city: finalCity,
            needs_manual_review: status === 'review',
            enrichment_status: status,
            enriched_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            last_stage: 'lane_a_done',
            provider_candidates: [{ lane: 'A', source: laneA.source, similarity: laneA.similarity, domain: laneA.domain, reasons: laneA.reasons, identity_confidence: identity.confidence, country_check: countryCheck }],
            raw_provider_response: { lane: 'A', source: laneA.source, elapsed_ms: HARD_DEADLINE_MS - timeLeft() },
          });
          await updateJobCounters(supabase, jobId);
          return respond({ ok: true, processed: 1, lane: 'A', status, score: finalScore, row_id: rowId, university: uniName, country_check: countryCheck, elapsed_ms: HARD_DEADLINE_MS - timeLeft() });
        }
        console.log(`[WE-v9] Lane A validation failed for ${uniName}, falling to Lane B`);
      }

      // ─── Lane B: DuckDuckGo web discovery ───
      if (timeLeft() < STAGE_BUDGET.MIN_REMAINING) {
        await updateRow(supabase, rowId, { enrichment_status: 'failed', match_reason: 'deadline_before_lane_b', processed_at: new Date().toISOString(), last_stage: 'deadline_exit' });
        await updateJobCounters(supabase, jobId);
        return respond({ ok: true, processed: 1, lane: 'timeout', row_id: rowId });
      }

      await updateRow(supabase, rowId, { last_stage: 'lane_b_ddg_search' });
      const candidates = await discoverCandidates(uniName, row.country_code, row.city, deadline);

      if (candidates.length === 0) {
        // v9: Skip crosscheck if no time
        let crossCheck = null;
        if (timeLeft() > 3000) {
          await updateRow(supabase, rowId, { last_stage: 'lane_b_crosscheck_only' });
          crossCheck = await crossCheckOpenAlex(uniName, row.country_code);
        }
        if (crossCheck?.city) {
          await updateRow(supabase, rowId, {
            enrichment_status: 'review', match_reason: 'no_web_results_crosscheck_only',
            matched_entity_name: crossCheck.display_name, matched_city: crossCheck.city,
            matched_country: crossCheck.country_code, match_source: 'openalex_crosscheck_only',
            needs_manual_review: true, processed_at: new Date().toISOString(),
            last_stage: 'lane_b_crosscheck_done',
            raw_provider_response: { lane: 'B', candidates: 0, crosscheck: crossCheck },
          });
        } else {
          await updateRow(supabase, rowId, {
            enrichment_status: 'failed', match_reason: 'no_web_results',
            last_error: 'DDG returned no valid candidates', processed_at: new Date().toISOString(),
            last_stage: 'lane_b_no_candidates',
          });
        }
        await updateJobCounters(supabase, jobId);
        return respond({ ok: true, processed: 1, lane: 'B', status: 'no_candidates', row_id: rowId, university: uniName, elapsed_ms: HARD_DEADLINE_MS - timeLeft() });
      }

      // v9: Validate top 2 candidates IN PARALLEL, then conditionally 3rd
      await updateRow(supabase, rowId, { last_stage: 'lane_b_validate' });
      const scoredCandidates: ScoredWebCandidate[] = [];

      // Filter valid candidates first (cheap checks)
      const validCandidates = candidates.filter(c => {
        if (isBlacklisted(c.domain)) return false;
        if (isSubpageOnForeignDomain(c.url, c.domain, uniName)) return false;
        return true;
      });

      // v9: Determine retry eligibility per candidate (before fetching)
      const isRetryEligible = (c: SearchCandidate) => {
        const academic = isAcademicDomain(c.domain);
        const domCoh = domainNameCoherence(c.domain, uniName);
        const stMatch = enhancedNameMatch(uniName, c.title);
        return academic || domCoh >= 0.5 || stMatch.score >= 0.6;
      };

      // Validate top 2 in parallel
      const batch1 = validCandidates.slice(0, 2);
      if (batch1.length > 0 && timeLeft() > STAGE_BUDGET.MIN_REMAINING) {
        const results = await Promise.allSettled(batch1.map(async (candidate) => {
          const { canonical } = canonicalizeUrl(candidate.url);
          const retryOk = isRetryEligible(candidate);
          const signals = await fetchHomepageSignals(canonical || candidate.url, row.country_code, deadline, retryOk);
          const identity = validateInstitutionalIdentity(signals, uniName, candidate.domain, candidate.title);
          return scoreCandidate(candidate, signals, identity, uniName, row.country_code);
        }));
        for (const r of results) {
          if (r.status === 'fulfilled') scoredCandidates.push(r.value);
        }
      }

      // v9: Early exit if we have a strong match
      const earlyBest = scoredCandidates.find(c => c.status === 'matched' && c.score >= 85);
      
      // Only try 3rd candidate if no safe decision AND time remains
      if (!earlyBest && validCandidates.length > 2 && timeLeft() > STAGE_BUDGET.MIN_REMAINING) {
        const third = validCandidates[2];
        const { canonical } = canonicalizeUrl(third.url);
        const retryOk = isRetryEligible(third);
        const signals = await fetchHomepageSignals(canonical || third.url, row.country_code, deadline, retryOk);
        const identity = validateInstitutionalIdentity(signals, uniName, third.domain, third.title);
        scoredCandidates.push(scoreCandidate(third, signals, identity, uniName, row.country_code));
      }

      scoredCandidates.sort((a, b) => b.score - a.score);

      // v9: Skip crosscheck if deadline is tight
      let crossCheck = null;
      if (timeLeft() > 3000) {
        crossCheck = await crossCheckOpenAlex(uniName, row.country_code);
      }

      const best = scoredCandidates[0];
      const diagnostics = scoredCandidates.map(c => ({
        domain: c.domain, url: c.url, score: c.score, status: c.status,
        searchRank: c.searchRank, searchTitle: c.searchTitle,
        titleSimilarity: c.nameSimilarityTitle, domainCoherence: c.domainCoherence,
        identityConfidence: c.identityValidation.confidence,
        identityReasons: c.identityValidation.reasons,
        rejected: c.rejection_reason, reasons: c.reasons,
        fetchSuccess: c.homepageSignals.fetchSuccess,
        retryUsed: c.homepageSignals.retryUsed,
        pageTitle: c.homepageSignals.title, ogSiteName: c.homepageSignals.ogSiteName,
        hasSchema: c.homepageSignals.hasSchemaOrg, eduDomain: c.homepageSignals.hasEduDomain,
      }));

      if (!best || best.status === 'failed') {
        if (crossCheck?.city) {
          await updateRow(supabase, rowId, {
            enrichment_status: 'review', match_reason: 'all_candidates_low_crosscheck_only',
            matched_entity_name: crossCheck.display_name, matched_city: crossCheck.city,
            matched_country: crossCheck.country_code, match_source: 'openalex_crosscheck',
            needs_manual_review: true, processed_at: new Date().toISOString(),
            last_stage: 'lane_b_low_score_crosscheck', provider_candidates: diagnostics,
            raw_provider_response: { lane: 'B', crosscheck: crossCheck, total: candidates.length },
          });
        } else {
          await updateRow(supabase, rowId, {
            enrichment_status: 'failed', match_reason: best ? 'all_candidates_low_score' : 'no_valid_candidates',
            processed_at: new Date().toISOString(), last_stage: 'lane_b_all_failed',
            provider_candidates: diagnostics,
            raw_provider_response: { lane: 'B', crosscheck: crossCheck, total: candidates.length },
          });
        }
        await updateJobCounters(supabase, jobId);
        return respond({ ok: true, processed: 1, lane: 'B', status: best?.status || 'no_valid', row_id: rowId, elapsed_ms: HARD_DEADLINE_MS - timeLeft() });
      }

      // ── ABSOLUTE PUBLISH GATE v10: Country mismatch + original safety ──
      const { canonical } = canonicalizeUrl(best.url);
      
      // v10: Country mismatch hard gate — demote matched → review if TLD country ≠ uni country
      const countryCheck = hasCountryMismatch(best.domain, row.country_code);
      if (countryCheck.mismatch && best.status === 'matched') {
        console.log(`[WE-v10] COUNTRY MISMATCH Lane B: ${uniName} (${row.country_code}) → domain ${best.domain} (${countryCheck.domainCountry}). Demoting to review.`);
        best.status = 'review';
        best.reasons.push(`country_mismatch:${countryCheck.reason}`);
      }
      
      // v11: Canonical-homepage gate — demote non-root microsites/sections
      if (best.status === 'matched') {
        const canonCheck = isNonCanonicalHomepage(canonical || best.url);
        if (canonCheck.nonCanonical) {
          console.log(`[WE-v11] NON-CANONICAL Lane B: ${uniName} → ${canonical || best.url} (${canonCheck.reason}). Demoting to review.`);
          best.status = 'review';
          best.reasons.push(`noncanonical:${canonCheck.reason}`);
        }
      }
      
      // v9: Geo extraction ONLY for matched status
      let city = crossCheck?.city || null;
      let country = crossCheck?.country_code || row.country_code;
      if (best.status === 'matched' && timeLeft() > STAGE_BUDGET.MIN_REMAINING) {
        await updateRow(supabase, rowId, { last_stage: 'lane_b_geo_extract' });
        const geoSub = await extractGeoFromSubpages(canonical || best.url, deadline);
        const geoHome = extractGeoFromHtml(best.homepageSignals.bodyTextSample || '', canonical || best.url);
        city = geoSub.city || geoHome.city || city;
        country = geoSub.country_code || geoHome.country_code || country;
      }

      if (best.status === 'matched') {
        await updateRow(supabase, rowId, {
          official_website_url: canonical, provider_homepage_url_raw: best.url,
          official_website_domain: best.domain, match_source: 'lane_b_ddg',
          confidence_score: best.score, match_reason: best.reasons.join(','),
          matched_entity_name: best.homepageSignals.ogSiteName || best.homepageSignals.title || best.searchTitle,
          matched_country: country, matched_city: city,
          needs_manual_review: false, enrichment_status: 'matched',
          enriched_at: new Date().toISOString(), processed_at: new Date().toISOString(),
          last_stage: 'lane_b_done', provider_candidates: diagnostics,
          raw_provider_response: { lane: 'B', crosscheck: crossCheck, total: candidates.length, elapsed_ms: HARD_DEADLINE_MS - timeLeft(), country_check: countryCheck },
        });
      } else {
        await updateRow(supabase, rowId, {
          provider_homepage_url_raw: best.url, match_source: 'lane_b_ddg',
          confidence_score: best.score, match_reason: best.reasons.join(','),
          matched_entity_name: best.homepageSignals.ogSiteName || best.homepageSignals.title || best.searchTitle,
          matched_country: country, matched_city: city,
          needs_manual_review: true, enrichment_status: 'review',
          enriched_at: new Date().toISOString(), processed_at: new Date().toISOString(),
          last_stage: 'lane_b_done', provider_candidates: diagnostics,
          raw_provider_response: { lane: 'B', crosscheck: crossCheck, total: candidates.length, elapsed_ms: HARD_DEADLINE_MS - timeLeft() },
        });
      }
      await updateJobCounters(supabase, jobId);
      return respond({ ok: true, processed: 1, lane: 'B', status: best.status, score: best.score, row_id: rowId, university: uniName, elapsed_ms: HARD_DEADLINE_MS - timeLeft() });

    } catch (err) {
      console.error(`[WE-v8] Error processing row ${rowId}:`, err);
      await updateRow(supabase, rowId, {
        enrichment_status: 'failed',
        last_error: String(err).slice(0, 500),
        processed_at: new Date().toISOString(),
        last_stage: 'error',
      });
      await updateJobCounters(supabase, jobId);
      return respond({ ok: true, processed: 1, status: 'error', error: String(err).slice(0, 200), row_id: rowId });
    }

  } catch (err) {
    console.error('[WE-v8] Fatal:', err);
    return respond({ ok: false, error: String(err) }, 500);
  }
});

// ========================
// Helpers
// ========================

async function updateJobCounters(supabase: any, jobId: string) {
  const countByStatus = async (status: string) => {
    const { count } = await supabase.from('website_enrichment_rows')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId).eq('enrichment_status', status);
    return count || 0;
  };
  const [pendingCount, processingCount, matchedCount, reviewCount, failedCount, skippedCount] =
    await Promise.all([
      countByStatus('pending'), countByStatus('processing'), countByStatus('matched'),
      countByStatus('review'), countByStatus('failed'), countByStatus('skipped'),
    ]);
  const processed = matchedCount + reviewCount + failedCount + skippedCount;
  const total = processed + pendingCount + processingCount;
  const stats: Record<string, any> = {
    processed_rows: processed,
    matched_rows: matchedCount,
    review_rows: reviewCount,
    failed_rows: failedCount,
    skipped_rows: skippedCount,
    total_rows: total,
    last_activity_at: new Date().toISOString(),
  };
  if (pendingCount === 0 && processingCount === 0) {
    stats.status = 'completed';
    stats.completed_at = new Date().toISOString();
  }
  await supabase.from('website_enrichment_jobs').update(stats).eq('id', jobId);
}

function respond(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function updateRow(supabase: any, rowId: string, data: Record<string, any>) {
  await supabase.from('website_enrichment_rows').update({ ...data, updated_at: new Date().toISOString() }).eq('id', rowId);
}
