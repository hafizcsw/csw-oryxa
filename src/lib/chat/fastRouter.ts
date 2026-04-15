/**
 * ✅ P0: Fast Router - First Reply ≤ 1s
 * Routes messages to appropriate handlers before hitting CRM
 * 
 * Architecture (from EXEC ORDER):
 * A) Greetings/Templates → Client-side instant response
 * B) Catalog Q&A → Portal DB (vw_program_search)
 * C) CRM Status → CRM RPC (read-only)
 * D) Brain → Full CRM processing with streaming
 */

export type RouteType = 'greeting' | 'catalog' | 'status' | 'brain';

export interface RouteResult {
  type: RouteType;
  /** Instant response for greetings (no backend needed) */
  instantResponse?: string;
  /** Keywords extracted for catalog search */
  catalogKeywords?: string[];
  /** Intent for CRM status check */
  statusIntent?: 'my_status' | 'my_files' | 'my_payments' | 'my_documents';
  /** Whether to skip CRM entirely */
  skipCRM: boolean;
  /** ACK message to show while processing */
  ackMessage: string;
}

// =================== Text Normalization (Routing) ===================

/**
 * Normalize user input for routing only.
 * هدفها ضمان أن "مرحبا" لا تفشل بسبب محارف مخفية / RTL marks / ترقيم / مسافات.
 */
function normalizeForRouting(input: string): string {
  if (!input) return '';

  let text = input;

  // Remove zero-width chars + RTL/LTR marks
  text = text.replace(/[\u200B-\u200F\u202A-\u202E]/g, '');

  // Remove Arabic diacritics (tashkeel)
  text = text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Strip trailing punctuation (Arabic + Latin)
  text = text.replace(/[\s\.!?,،؛…؟]+$/g, '').trim();

  return text;
}

// =================== Greeting Detection ===================

// ✅ P0 FIX: More flexible greeting patterns (handles variations)
const GREETING_PATTERNS_AR = [
  /^مرحبا?\.?!?$/i,
  /^مرحباً?\.?!?$/i,
  /^اهلا\.?!?$/i,
  /^أهلاً?\.?!?$/i,
  /^اهلاً?\.?!?$/i,
  /^السلام عليكم\.?!?$/i,
  /^السلام\.?!?$/i,
  /^هاي\.?!?$/i,
  /^هلو\.?!?$/i,
  /^هلا\.?!?$/i,
  /^صباح الخير\.?!?$/i,
  /^مساء الخير\.?!?$/i,
  /^كيف الحال\.?!?\??$/i,
  /^كيفك\.?!?\??$/i,
  /^شلونك\.?!?\??$/i,
  /^هلا والله\.?!?$/i,
  /^يا هلا\.?!?$/i,
];

const GREETING_PATTERNS_EN = [
  /^hi$/i,
  /^hello$/i,
  /^hey$/i,
  /^good morning$/i,
  /^good evening$/i,
  /^how are you$/i,
  /^what's up$/i,
  /^yo$/i,
];

const GREETING_RESPONSES_AR = [
  'أهلاً وسهلاً! 👋 كيف يمكنني مساعدتك اليوم؟',
  'مرحباً! 🎓 أنا ملك، مساعدك للدراسة في الخارج. كيف أساعدك؟',
  'أهلاً! 👋 جاهز لمساعدتك في اختيار الجامعة المناسبة.',
];

const GREETING_RESPONSES_EN = [
  'Hello! 👋 How can I help you today?',
  'Hi there! 🎓 I\'m Malak, your study abroad assistant. How can I help?',
  'Hey! 👋 Ready to help you find the right university.',
];

function isGreeting(text: string): boolean {
  const normalized = normalizeForRouting(text);
  
  // Check Arabic patterns
  for (const pattern of GREETING_PATTERNS_AR) {
    if (pattern.test(normalized)) return true;
  }
  
  // Check English patterns
  for (const pattern of GREETING_PATTERNS_EN) {
    if (pattern.test(normalized)) return true;
  }
  
  return false;
}

function getRandomGreetingResponse(locale: string = 'ar'): string {
  const responses = locale === 'en' ? GREETING_RESPONSES_EN : GREETING_RESPONSES_AR;
  return responses[Math.floor(Math.random() * responses.length)];
}

// =================== Catalog Detection ===================

const CATALOG_KEYWORDS_AR = [
  'برنامج', 'برامج', 'جامعة', 'جامعات', 'تخصص', 'تخصصات',
  'طب', 'هندسة', 'كمبيوتر', 'أعمال', 'إدارة',
  'روسيا', 'تركيا', 'ماليزيا', 'مصر', 'الصين',
  'بكالوريوس', 'ماجستير', 'دكتوراه',
  'رسوم', 'سعر', 'تكلفة', 'منحة', 'منح',
  'أرخص', 'أفضل', 'أسهل',
];

const CATALOG_KEYWORDS_EN = [
  'program', 'programs', 'university', 'universities', 'major', 'majors',
  'medicine', 'engineering', 'computer', 'business', 'management',
  'russia', 'turkey', 'malaysia', 'egypt', 'china',
  'bachelor', 'master', 'phd', 'doctorate',
  'fees', 'price', 'cost', 'scholarship', 'scholarships',
  'cheapest', 'best', 'easiest',
];

function extractCatalogKeywords(text: string): string[] {
  const normalized = normalizeForRouting(text).toLowerCase();
  const found: string[] = [];
  
  for (const kw of [...CATALOG_KEYWORDS_AR, ...CATALOG_KEYWORDS_EN]) {
    if (normalized.includes(kw.toLowerCase())) {
      found.push(kw);
    }
  }
  
  return found;
}

// =================== CRM Status Detection ===================

const STATUS_PATTERNS: Array<{ pattern: RegExp; intent: RouteResult['statusIntent'] }> = [
  { pattern: /حالتي|حالة ملفي|وين وصلت|status/i, intent: 'my_status' },
  { pattern: /ملفاتي|مستنداتي|وثائقي|documents|files/i, intent: 'my_files' },
  { pattern: /مدفوعاتي|فواتيري|دفعاتي|payments/i, intent: 'my_payments' },
  { pattern: /مستنداتي|أوراقي|papers/i, intent: 'my_documents' },
];

function detectStatusIntent(text: string): RouteResult['statusIntent'] | null {
  const normalized = normalizeForRouting(text);
  for (const { pattern, intent } of STATUS_PATTERNS) {
    if (pattern.test(normalized)) return intent;
  }
  return null;
}

// =================== Main Router ===================

/**
 * Fast route a message before hitting CRM
 * Returns routing decision with optional instant response
 */
export function fastRoute(text: string, locale: string = 'ar'): RouteResult {
  const trimmed = normalizeForRouting(text);

  // Helpful runtime evidence for hidden-char misses
  if (import.meta.env.DEV) {
    const rawTrimmed = (text ?? '').trim();
    if (rawTrimmed && rawTrimmed !== trimmed) {
      console.log('[FastRouter] ✨ Normalized input', { before: rawTrimmed, after: trimmed });
    }
  }
  
  // A) Greeting → Still goes to CRM (Portal is pure proxy)
  // But we show a fast ACK and CRM should respond quickly for greetings
  if (isGreeting(trimmed)) {
    console.log('[FastRouter] 🎯 Route: GREETING (CRM will respond)');
    return {
      type: 'greeting',
      // ✅ DSTOUR FIX: NO local response - CRM handles ALL replies
      skipCRM: false,  // ALL messages go to CRM
      ackMessage: locale === 'en' 
        ? 'Hi there! 👋' 
        : 'أهلاً وسهلاً! 👋',
    };
  }
  
  // Check for status intent first (higher priority than catalog)
  const statusIntent = detectStatusIntent(trimmed);
  
  // C) CRM Status → Quick RPC call
  if (statusIntent) {
    console.log('[FastRouter] 🎯 Route: STATUS', statusIntent);
    return {
      type: 'status',
      statusIntent,
      skipCRM: false, // Still need CRM but fast path
      ackMessage: locale === 'en' 
        ? 'Checking your status...' 
        : 'جاري التحقق من حالتك...',
    };
  }
  
  // B) Catalog Q&A → Portal DB search
  const catalogKeywords = extractCatalogKeywords(trimmed);
  if (catalogKeywords.length >= 2) {
    console.log('[FastRouter] 🎯 Route: CATALOG', catalogKeywords);
    return {
      type: 'catalog',
      catalogKeywords,
      skipCRM: false, // May still need CRM for context
      ackMessage: locale === 'en'
        ? 'Searching programs...'
        : 'جاري البحث في البرامج...',
    };
  }
  
  // D) Brain → Full CRM processing
  console.log('[FastRouter] 🎯 Route: BRAIN (full CRM)');
  return {
    type: 'brain',
    skipCRM: false,
    ackMessage: locale === 'en'
      ? 'Thinking...'
      : 'تمام — لحظة واحدة...',
  };
}

/**
 * Get ACK message based on route type
 */
export function getAckMessage(routeType: RouteType, locale: string = 'ar'): string {
  const messages: Record<RouteType, { ar: string; en: string }> = {
    greeting: { ar: '', en: '' }, // No ACK for instant
    catalog: { ar: 'جاري البحث في البرامج...', en: 'Searching programs...' },
    status: { ar: 'جاري التحقق من حالتك...', en: 'Checking your status...' },
    brain: { ar: 'تمام — لحظة واحدة...', en: 'Thinking...' },
  };
  
  return messages[routeType][locale === 'en' ? 'en' : 'ar'];
}
