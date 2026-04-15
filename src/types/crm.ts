import { StageInfo, GuestState } from './chat';

/**
 * بيانات ملف الطالب للمزامنة مع CRM
 * يتطابق مع جدول 'customers' في CRM مع حقل web_user_id
 */
export interface StudentProfileForCRM {
  web_user_id: string;              // user_id من جدول profiles
  full_name: string;
  email?: string;
  phone?: string;
  country_of_residence?: string;    // من profile.country
  preferred_destination?: string;   // دولة الدراسة المفضلة
  preferred_program_type?: string;  // Medicine, Engineering, Business, etc.
  budget_per_year?: number;         // الميزانية السنوية بالدولار
  language_preference?: string;     // EN, RU, AR, etc.
  education_level?: string;         // high_school, bachelor, master, etc.
}

/**
 * بيانات الطلب للمزامنة مع CRM
 * يتطابق مع جدول 'student_applications' في CRM
 */
export interface ApplicationForCRM {
  web_user_id: string;              // user_id من profiles
  web_application_id: string;       // application.id من قاعدة البيانات هنا
  university_id: string;            // UUID الجامعة
  program_id: string;               // UUID البرنامج
  university_name: string;          // اسم الجامعة
  program_name: string;             // اسم البرنامج
  country: string;                  // slug الدولة
  tuition_usd?: number;             // الرسوم الدراسية
  duration_months?: number;         // مدة البرنامج بالأشهر
  language?: string;                // لغة التدريس
  status: 'draft' | 'submitted';    // حالة الطلب
}

/**
 * Webhook payload الذي يصل من CRM
 */
export interface CRMWebhookPayload {
  web_user_id: string;              // ربط بالطالب
  event: 'status_changed' | 'stage_updated' | 'document_requested' | 'message_sent';
  application_id?: string;          // web_application_id (اختياري)
  new_status?: string;              // الحالة الجديدة (للطلبات)
  new_stage?: string;               // المرحلة الجديدة (من 10 مراحل CRM)
  new_progress?: number;            // نسبة التقدم (0-100)
  message?: string;                 // رسالة للطالب
  data?: Record<string, any>;       // بيانات إضافية
}

/**
 * أنواع الأحداث المدعومة في Webhook:
 * 
 * - status_changed: تغيير حالة الطلب (accepted, rejected, pending, etc.)
 * - stage_updated: تغيير مرحلة الطالب في CRM (من 10 مراحل)
 * - document_requested: طلب مستند جديد من الطالب
 * - message_sent: رسالة جديدة من المستشار
 */

/**
 * أنواع الأحداث في الشات الإلكتروني
 */
export type WebChatEventType =
  | 'like_university'
  | 'apply_university'
  | 'request_alternatives'
  | 'submit_phone'
  | 'verify_otp'
  | 'submit_name'
  | 'create_account_confirmed'
  | 'action_confirmed';

/**
 * حدث في الشات الإلكتروني
 */
export interface WebChatEvent {
  type: WebChatEventType;
  metadata?: Record<string, any>;
}

/**
 * رسالة واحدة من الشات (الشكل الجديد القادم من CRM)
 */
export interface WebChatMessage {
  from: 'user' | 'bot';
  type: 'text' | 'action' | 'universities';
  content: string;
  action?: string;
  timestamp?: Date | string;
}

/**
 * الاستجابة الكاملة من web-chat-malak في CRM
 */
export interface WebChatResponse {
  ok: boolean;
  messages: WebChatMessage[];
  universities: any[];
  state: 'idle' | 'thinking' | 'awaiting_phone' | 'awaiting_otp' | 'awaiting_name' | 'searching' | 'awaiting_consent';
  actions: { type: string; [key: string]: any }[];
  customer_id?: string;
  normalized_phone?: string;
  stage?: string;
  is_new_customer?: boolean;
  student_portal_token?: string;
  session_state?: Record<string, any>;
  need_phone?: boolean;
  need_name?: boolean;
  need_otp?: boolean;
  show_programs?: boolean; // ✅ تحكم في عرض البرامج بناءً على عمق الحوار
  stage_info?: StageInfo | null;
  guest_state?: GuestState | null; // 🆕 Guest memory tracking
  ui?: {  // 🆕 UI configuration from CRM
    cards_plan?: CardsPlanConfig;
    cards_plan_v1?: CardsPlanConfig;
  };
  events?: CRMEvent[];  // 🆕 Events from CRM response
  cards_query?: CardsQuery;  // 🆕 Cards query from CRM - Portal fetches from Catalog
  // ✅ P0-ENFORCEMENT: Critical fields from assistant-process
  ui_directives?: {
    search_mode?: 'start' | 'hold';
    crm_build?: string;
    phase?: 'clarify' | 'awaiting_consent' | 'ready' | 'searching';
    consent_status?: 'pending' | 'granted' | 'declined';
    filters_hash?: string;
    missing_fields?: string[];
    hold_reason?: string;
    [key: string]: unknown;
  };
  ap_version?: string;  // Portal assistant-process version stamp
  // ✅ Consent workflow fields (root level)
  phase?: 'clarify' | 'awaiting_consent' | 'ready' | 'searching';
  consent_status?: 'pending' | 'granted' | 'declined';
  filters_hash?: string;
  missing_fields?: string[];
  reply_key?: string;
}

/**
 * Cards display plan configuration
 */
export interface CardsPlanConfig {
  mode: 'sequential' | 'instant';
  show_loader_first_ms?: number;
  pace_ms?: number;
  max_cards?: number;
  typing_lines?: string[];
  allow_show_all?: boolean;
}

/**
 * Event from CRM response
 */
export interface CRMEvent {
  type: string;
  payload?: Record<string, any>;
}

/**
 * CardsQuery interface - for Pilot mode
 * CRM sends this, Portal fetches from Catalog
 * 
 * Fix #3: Extended to support all CRM param variants
 * ✅ FIX: Added country_code, degree_slug, tuition_usd_* (CRM sends these)
 */
export interface CardsQuery {
  query_id: string;
  sequence: number;
  params: {
    // Country variants (CRM sends both)
    country?: string;         // Single country code
    country_code?: string;    // ✅ CRM also sends this
    country_codes?: string[]; // Multiple country codes
    // Degree variants (CRM sends both)
    degree_level?: string;
    degree_slug?: string;     // ✅ CRM also sends this
    degree_levels?: string[];
    // Language
    language?: string;
    instruction_languages?: string[]; // ✅ CRM array variant
    // Budget (CRM sends different names)
    budget_max?: number;
    max_tuition?: number;     
    tuition_usd_max?: number; // ✅ CRM sends this
    tuition_usd_min?: number; // ✅ CRM sends this
    // Keywords/major
    keyword?: string;
    keywords?: string[];
    major?: string;           // Single major
    majors?: string[];        // Multiple majors
    // Allow any additional CRM params
    [key: string]: unknown;
  };
  limit?: number;
}

/**
 * Normalized response structure for UI consumption
 */
export interface NormalizedCRMResponse {
  ok: boolean;
  messages: WebChatMessage[];
  universities: any[];
  state: WebChatResponse['state'];
  cardsPlan: CardsPlanConfig | null;
  events: CRMEvent[];
  cardsQuery: CardsQuery | null;  // 🆕 Cards query for Portal Catalog fetch
  // Auth & customer data
  customerId?: string;
  normalizedPhone?: string;
  stage?: string;
  isNewCustomer?: boolean;
  studentPortalToken?: string;
  needPhone?: boolean;
  needName?: boolean;
  needOtp?: boolean;
  showPrograms?: boolean;
  stageInfo?: WebChatResponse['stage_info'];
  guestState?: WebChatResponse['guest_state'];
  phase?: WebChatResponse['phase'];
  missingFields?: string[];
  replyKey?: string;
  uiDirectives?: WebChatResponse['ui_directives'];
}

const CLARIFY_FIELD_KEY_MAP: Record<string, string> = {
  country: 'search.clarify.country',
  country_code: 'search.clarify.country',
  target_country: 'search.clarify.country',
  target_countries: 'search.clarify.country',
  discipline: 'search.clarify.discipline',
  discipline_slug: 'search.clarify.discipline',
  major: 'search.clarify.discipline',
  degree: 'search.clarify.degree',
  degree_level: 'search.clarify.degree',
  degree_slug: 'search.clarify.degree',
  instruction_languages: 'search.clarify.instruction_languages',
  language: 'search.clarify.instruction_languages',
};

export function resolveClarifyReplyKey(raw: WebChatResponse): string | undefined {
  const replyKey = (raw as any).reply_key;
  if (typeof replyKey === 'string' && replyKey.trim().length > 0) {
    return replyKey.trim();
  }

  const uiDirectives = (raw as any).ui_directives ?? raw.ui_directives;
  const mergedMissing = extractMissingFields(raw as unknown as Record<string, unknown>, uiDirectives as Record<string, unknown> | undefined)
    .map((field) => field.trim().toLowerCase());

  for (const field of mergedMissing) {
    const key = CLARIFY_FIELD_KEY_MAP[field];
    if (key) return key;
  }

  return undefined;
}

function extractMissingFields(
  raw: Record<string, unknown>,
  uiDirectives?: Record<string, unknown>
): string[] {
  const rawMissing = raw.missing_fields;
  const directivesMissing = uiDirectives?.missing_fields;

  const toFields = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim());
    }

    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>);
    }

    return [];
  };

  return Array.from(new Set([...toFields(directivesMissing), ...toFields(rawMissing)]));
}

/**
 * Normalizes raw CRM response into consistent structure
 * Ensures backward compatibility if fields are missing
 * ✅ Supports both snake_case and camelCase from CRM
 */
export function normalizeCRMResponse(raw: WebChatResponse): NormalizedCRMResponse {
  // ✅ Support both snake_case and camelCase for cards_query
  const cardsQuery = (raw as any).cards_query ?? (raw as any).cardsQuery ?? null;
  
  // ✅ Support both ui.cards_plan and ui.cardsPlan
  const cardsPlan = raw.ui?.cards_plan ?? (raw.ui as any)?.cardsPlan ?? raw.ui?.cards_plan_v1 ?? null;
  
  // ✅ P4 FIX: Convert legacy 'reply' to messages array if messages is empty/undefined
  // CRM returns { reply: "..." } format, but UI expects { messages: [...] }
  let messages: WebChatMessage[] = raw.messages || [];
  const legacyReply = (raw as any).reply;
  const uiDirectives = (raw as any).ui_directives ?? raw.ui_directives;
  const phase = uiDirectives?.phase ?? (raw as any).phase;
  const holdReason = uiDirectives?.hold_reason;
  const missingFields = extractMissingFields(raw as unknown as Record<string, unknown>, uiDirectives as Record<string, unknown> | undefined);
  const replyKey = resolveClarifyReplyKey(raw);
  
  if (messages.length === 0) {
    // Case 1: CRM sent a non-empty reply
    if (legacyReply && typeof legacyReply === 'string' && legacyReply.trim().length > 0) {
      messages = [{
        from: 'bot',
        type: 'text',
        content: legacyReply.trim(),
        timestamp: new Date()
      }];
      
      if (import.meta.env.DEV) {
        console.log('[normalizeCRMResponse] ✅ Converted legacy reply to messages:', legacyReply.slice(0, 50));
      }
    }
    // Case 2: CRM is in intake/hold phase OR search_mode=hold - emit i18n key message
    else if (phase === 'intake' || phase === 'clarify' || holdReason || uiDirectives?.search_mode === 'hold' || Boolean(replyKey)) {
      const intakeMessageKey = replyKey ?? 'portal.chat.errors.needsMoreInfo';

      messages = [{
        from: 'bot',
        type: 'text',
        content: intakeMessageKey,
        timestamp: new Date()
      }];
      
      if (import.meta.env.DEV) {
        console.log('[normalizeCRMResponse] ✅ Generated intake message:', { 
          phase, holdReason, missingFields,
          searchMode: uiDirectives?.search_mode,
          message: intakeMessageKey,
          replyKey,
        });
      }
    }
  }
  
  return {
    ok: raw.ok,
    messages,
    universities: raw.universities || [],
    state: raw.state || 'idle',
    cardsPlan,
    events: raw.events || [],
    cardsQuery,
    customerId: raw.customer_id,
    normalizedPhone: raw.normalized_phone,
    stage: raw.stage,
    isNewCustomer: raw.is_new_customer,
    studentPortalToken: raw.student_portal_token,
    needPhone: raw.need_phone,
    needName: raw.need_name,
    needOtp: raw.need_otp,
    showPrograms: raw.show_programs,
    stageInfo: raw.stage_info,
    guestState: raw.guest_state,
    phase,
    missingFields,
    replyKey,
    uiDirectives,
  };
}
