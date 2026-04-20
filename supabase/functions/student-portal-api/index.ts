import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log('[student-portal-api] VERSION=2026-03-15_contract_v9_p_customer_id');

// ============= CORS Configuration (Allowlist-based) =============
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://cswworld.com",
  "https://www.cswworld.com",
  "https://csw-portal.lovable.app",
  "https://lavista-launchpad.lovable.app",
  "https://bmditidkhlbszhvkrnau.supabase.co",
]);

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (origin.includes('.lovableproject.com')) return true;
  if (origin.includes('.lovable.app')) return true;
  return false;
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && isOriginAllowed(origin) ? origin : "https://cswworld.com";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    // This function is invoked from the browser via POST only.
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-request-id, x-client-trace-id",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// ============= Logging Utilities (P0 Evidence) =============
const safeId = (id?: string | null) => (id ? `${id.slice(0, 6)}…${id.slice(-6)}` : 'null');
const genRequestId = () => `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

interface RpcLogContext {
  requestId: string;
  action: string;
  authUserId?: string | null;
}

function logRpcStart(ctx: RpcLogContext, rpcName: string, paramKeys: string[]) {
  console.log(`[student-portal-api] ${ctx.requestId} rpc_start name=${rpcName} keys=[${paramKeys.join(',')}]`);
}

function logRpcEnd(ctx: RpcLogContext, rpcName: string, ok: boolean, durationMs: number, errorMsg?: string) {
  console.log(`[student-portal-api] ${ctx.requestId} rpc_done name=${rpcName} ok=${ok} ms=${durationMs}${errorMsg ? ` err=${errorMsg}` : ''}`);
}

function buildCrmProxyHeaders(params: { apiKey?: string; jwt?: string; traceId: string; proxySecret?: string | null }): Record<string,string> {
  const headers: Record<string,string> = {
    'Content-Type': 'application/json',
    'x-orxya-ingress': 'portal',
    'x-client-trace-id': params.traceId,
  };
  if (params.apiKey) headers['x-api-key'] = params.apiKey;
  if (params.proxySecret) headers['x-portal-proxy-secret'] = params.proxySecret;
  if (params.jwt) headers['Authorization'] = `Bearer ${params.jwt}`;
  return headers;
}

// CRM Project - Source of Truth
const CRM_SUPABASE_URL = Deno.env.get("CRM_URL") || "https://hlrkyoxwbjsgqbncgzpi.supabase.co";
const CRM_SERVICE_ROLE_KEY = Deno.env.get("CRM_SERVICE_ROLE_KEY") || "";

// Portal's own Supabase for JWT verification
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Action =
  | 'delete_my_file'
  | 'get_profile' 
  | 'update_profile' 
  | 'sync_shortlist' 
  | 'clear_shortlist'  // ✅ NEW: Clear all shortlist from CRM + Portal
  // ✅ #7.2: Shortlist API (Portal DB via RPC - limit=10)
  | 'shortlist_list'   // List user's shortlist via rpc_shortlist_list
  | 'shortlist_add'    // Add single program via rpc_shortlist_add (limit enforced)
  | 'shortlist_remove' // Remove single program via rpc_shortlist_remove
  | 'shortlist_compare' // Get program data for compare UI
  | 'add_file'
  | 'get_shortlist'
  | 'get_documents'
  | 'get_documents_signed'
  | 'list_files'
  | 'sign_file'
  | 'get_payments'
  | 'get_applications'
  | 'get_events'
  | 'mark_event_read'
  | 'add_note'
  | 'check_link_status'
  | 'list_wallet_ledger'
  | 'search_programs'
  // ❌ DEPRECATED: Legacy actions - return 410 Gone
  // | 'sync_storage_to_crm'
  // | 'reconcile_my_storage_files'
  | 'clear_my_files'
  // ✅ CRM Storage Proxy (الرسمي - prepare/confirm protocol)
  | 'crm_storage'
  // ✅ Service Selections
  | 'get_service_selections'
  | 'save_service_selection'
  | 'clear_service_selection'  // ✅ FIX-3: Clear selection for country
  | 'submit_service_selection'
  // ✅ ORDER #2: Set services selection (CRM proxy with state_rev management)
  | 'set_services_selection'
  // ✅ Application Submission (CRM Proxy)
  | 'submit_application'
  // ✅ Payment System (CRM Proxy)
  | 'list_payment_channels'
  | 'submit_payment_proof'
  | 'get_payment_receipt'
  | 'create_card_checkout_session'  // ✅ NEW: Stripe Checkout via CRM
  // ✅ PORTAL DB V1 (Fallback Outbox)
  | 'submit_application_portal_v1'
  | 'get_portal_applications_v1'
  | 'get_portal_payments_v1'
  | 'submit_portal_payment_proof_v1'
  // ✅ Portal Files V1 (Ready Downloads + Uploads)
  | 'list_portal_files_v1'
  | 'add_portal_file_v1'
  | 'sign_portal_file_v1'
  // ✅ Case Dashboard V1 (CRM Proxy)
  | 'get_case_dashboard_v1'
  | 'accept_contract_v1'
  | 'set_delivery_v1'
  // ✅ Ready Files (Staff-uploaded for student)
  | 'get_ready_files'
  | 'sign_ready_file'
  // ✅ Student Card Snapshot (Aggregated View)
  | 'get_student_card_snapshot'
  // ✅ NEW: CRM Sync for Choices (Program + Services)
  | 'sync_program_choice'
  | 'sync_service_choices'
  // ✅ DEBUG: Staff-only RPC probe (no side effects)
  | 'debug_probe_crm_rpcs'
  // ✅ Compare V1: Facts API for program comparison (PUBLIC - works for guests)
  | 'compare_programs_v1'
  // ✅ University Shortlist
  | 'uni_shortlist_list'
  | 'uni_shortlist_add'
  | 'uni_shortlist_remove'
  // ✅ Staff Authority Resolution (CRM source of truth)
  | 'resolve_staff_authority'
  | 'resolve_teacher_approval'
  // ✅ Course Access Resolution (CRM source of truth)
  | 'resolve_course_access'
  // ✅ Teacher Dashboard (Portal DB queries, staff-gated)
  | 'teacher_get_students'
  | 'teacher_get_student_detail'
  | 'teacher_add_note'
  | 'teacher_get_notes'
  // ✅ Teacher Session Workflow
  | 'teacher_list_sessions'
  | 'teacher_get_session'
  | 'teacher_create_session'
  | 'teacher_update_session'
  | 'teacher_update_attendance'
  | 'teacher_save_session_outcome'
  | 'teacher_save_evaluation'
  | 'teacher_get_evaluations'
  | 'teacher_set_exam_decision'
  | 'teacher_list_plans'
  | 'teacher_create_plan'
  | 'teacher_list_review_items'
  | 'teacher_upsert_review_item'
  | 'teacher_update_review_item_status'
  | 'teacher_ai_copilot'
  // ✅ Shared lifecycle: session action items
  | 'teacher_create_action_items'
  | 'teacher_list_action_items'
  | 'teacher_review_action_item'
  | 'student_list_sessions'
  | 'student_list_action_items'
  | 'student_complete_action_item'
  | 'student_delete_action_item'
  | 'student_dismiss_session'
  | 'teacher_get_ai_followups'
  | 'teacher_get_exam_mode'
  | 'teacher_upsert_exam_mode'
  | 'teacher_list_documents'
  | 'get_teacher_profile'
  | 'teacher_upload_document'
  | 'sync_teacher_state'
  | 'teacher_mark_lesson_complete'
  | 'get_teacher_state'
  // ✅ Account Identity Changes (CRM-unified)
  | 'change_email'
  | 'change_phone';

// ============= CRM-only staff authority helper =============
// FINAL CUTOVER: No Portal is_admin fallback. CRM is the ONLY authority source.
// ENFORCES: role + is_active + access_scope (portal_only | crm_and_portal)
const PORTAL_CAPABLE_SCOPES = ['portal_only', 'crm_and_portal'];

async function verifyCrmStaffRole(
  crmCl: ReturnType<typeof createClient>,
  portalAdm: ReturnType<typeof createClient>,
  userId: string,
  allowedRoles: string[] = ['teacher', 'super_admin']
): Promise<{ authorized: boolean; role: string | null; access_scope: string | null; denial_reason?: string }> {
  const { data: userData } = await portalAdm.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (!email) {
    console.log(`[verifyCrmStaffRole] ❌ no email for userId=${userId}`);
    return { authorized: false, role: null, access_scope: null, denial_reason: 'no_email' };
  }

  const { data: staffData, error } = await crmCl
    .from('staff' as any)
    .select('role, access_scope')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle() as { data: { role: string; access_scope: string | null } | null; error: any };

  if (error) {
    console.log(`[verifyCrmStaffRole] ❌ CRM query error for ${email}: ${error.message}`);
    return { authorized: false, role: null, access_scope: null, denial_reason: 'crm_query_error' };
  }
  if (!staffData) {
    console.log(`[verifyCrmStaffRole] ❌ no active staff record for ${email}`);
    return { authorized: false, role: null, access_scope: null, denial_reason: 'not_active_staff' };
  }

  // Check role
  if (!allowedRoles.includes(staffData.role)) {
    console.log(`[verifyCrmStaffRole] ❌ wrong role for ${email}: got=${staffData.role} allowed=${allowedRoles.join(',')}`);
    return { authorized: false, role: staffData.role, access_scope: staffData.access_scope, denial_reason: 'wrong_role' };
  }

  // Check access_scope — crm_only staff MUST NOT access Portal APIs
  const scope = staffData.access_scope || 'crm_only';
  if (!PORTAL_CAPABLE_SCOPES.includes(scope)) {
    console.log(`[verifyCrmStaffRole] ❌ crm_only scope for ${email}: scope=${scope}`);
    return { authorized: false, role: staffData.role, access_scope: scope, denial_reason: 'crm_only_scope' };
  }

  console.log(`[verifyCrmStaffRole] ✅ authorized ${email} role=${staffData.role} scope=${scope}`);
  return { authorized: true, role: staffData.role, access_scope: scope };
}

type CrmStorageAction = 
  | 'prepare_upload'         // Get signed URL for upload
  | 'confirm_upload'         // Register file in CRM after PUT
  | 'list_files'             // List student files from CRM
  | 'sign_file'              // Get signed URL for download
  | 'set_avatar'             // Update avatar
  | 'delete_file'            // Delete file from CRM
  | 'clear_all_files'        // Delete ALL files for student
  | 'purge_all_files'        // ✅ Soft delete ALL for clean cutover
  | 'paddle_structure_proxy';// ✅ CRM-aware Paddle OCR/Structure proxy

// ============= Pricing Constants (Server-Side - Source of Truth) =============
const COUNTRY_BASE_PRICES: Record<string, number> = {
  RU: 800,
  CN: 1200,
  GB: 1500,
  EU: 1500,
};

const SERVICE_WEIGHTS: Record<string, number> = {
  'translate-basic': 0.1875,
  'translate-residency': 0.05,
  'attestation': 0.075,
  'apply-uni': 0.15,
  'followup': 0.10,
  'confirm-seat': 0.0625,
  'airport': 0.075,
  'sim': 0.025,
  'address-reg': 0.0375,
  'housing': 0.1125,
  'bank': 0.0625,
  'credential': 0.0625,
};

const SERVICE_NAMES: Record<string, string> = {
  'translate-basic': 'ترجمة ملف القبول الأساسي',
  'translate-residency': 'ترجمة إقامة/هوية مقيم',
  'attestation': 'توثيق/تصديق الوثائق',
  'apply-uni': 'تقديم جامعة واحدة',
  'followup': 'متابعة القبول والنواقص',
  'confirm-seat': 'تأكيد المقعد / التسجيل النهائي',
  'airport': 'استقبال مطار + نقل للسكن',
  'sim': 'شريحة اتصال عند الوصول',
  'address-reg': 'تسجيل سكن/عنوان',
  'housing': 'حجز سكن',
  'bank': 'فتح حساب بنكي (مساعدة)',
  'credential': 'معادلة الشهادة',
};

const RUSSIA_ADDONS: Record<string, { name: string; price: number }> = {
  'russian-course': { name: 'كورس لغة روسي', price: 250 },
  'scholarship-pack': { name: 'ملف منحة احترافي', price: 500 },
};

type AvailabilityRuleRow = { day_of_week: number; start_time: string; end_time: string; is_active: boolean };
type AvailabilityExceptionRow = { exception_date: string; start_time: string | null; end_time: string | null; exception_type: string };
type AvailabilityPrefsRow = {
  timezone: string | null;
  default_session_duration: number | null;
  buffer_before_minutes: number | null;
  buffer_after_minutes: number | null;
  public_booking_enabled: boolean | null;
};
type SessionSlotRow = { id: string; scheduled_at: string | null; status: string };

function hmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return ((h || 0) * 60) + (m || 0);
}

function dateKeyInTz(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function weekdayInTz(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? date.getUTCDay();
}

function timeKeyInTz(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

async function validateTeacherScheduleSlot(params: {
  portalAdmin: ReturnType<typeof createClient>;
  teacherUserId: string;
  scheduledAt: string;
  currentSessionId?: string;
  requirePublicBooking?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const requestedStart = new Date(params.scheduledAt);
  if (Number.isNaN(requestedStart.getTime())) return { ok: false, error: 'INVALID_SCHEDULED_AT' };

  const [rulesRes, exceptionsRes, prefsRes, sessionsRes] = await Promise.all([
    params.portalAdmin.from('teacher_availability_rules').select('day_of_week, start_time, end_time, is_active').eq('user_id', params.teacherUserId).eq('is_active', true),
    params.portalAdmin.from('teacher_availability_exceptions').select('exception_date, start_time, end_time, exception_type').eq('user_id', params.teacherUserId),
    params.portalAdmin.from('teacher_availability_preferences').select('timezone, default_session_duration, buffer_before_minutes, buffer_after_minutes, public_booking_enabled').eq('user_id', params.teacherUserId).maybeSingle(),
    params.portalAdmin.from('teacher_sessions').select('id, scheduled_at, status').eq('teacher_user_id', params.teacherUserId).not('scheduled_at', 'is', null).in('status', ['draft', 'scheduled', 'live']),
  ]);
  if (rulesRes.error) return { ok: false, error: rulesRes.error.message };
  if (exceptionsRes.error) return { ok: false, error: exceptionsRes.error.message };
  if (prefsRes.error) return { ok: false, error: prefsRes.error.message };
  if (sessionsRes.error) return { ok: false, error: sessionsRes.error.message };

  const prefs = (prefsRes.data || {}) as AvailabilityPrefsRow;
  const timezone = prefs.timezone || 'UTC';
  const duration = Number(prefs.default_session_duration || 50);
  const bufferBefore = Number(prefs.buffer_before_minutes || 0);
  const bufferAfter = Number(prefs.buffer_after_minutes || 0);
  const publicBookingEnabled = prefs.public_booking_enabled !== false;

  if (params.requirePublicBooking && !publicBookingEnabled) return { ok: false, error: 'PUBLIC_BOOKING_DISABLED' };

  const dayOfWeek = weekdayInTz(requestedStart, timezone);
  const dateKey = dateKeyInTz(requestedStart, timezone);
  const startTime = timeKeyInTz(requestedStart, timezone);
  const startMinutes = hmToMinutes(startTime);
  const endMinutes = startMinutes + duration;

  const rules = (rulesRes.data || []) as AvailabilityRuleRow[];
  // Only enforce availability rules for public bookings — teachers can schedule freely
  if (params.requirePublicBooking) {
    const matchesRule = rules.some((rule) => rule.day_of_week === dayOfWeek && hmToMinutes(rule.start_time) <= startMinutes && hmToMinutes(rule.end_time) >= endMinutes);
    if (!matchesRule) return { ok: false, error: 'OUTSIDE_AVAILABILITY_RULES' };
  }

  const exceptions = (exceptionsRes.data || []) as AvailabilityExceptionRow[];
  const dayExceptions = exceptions.filter((e) => e.exception_date === dateKey);
  if (dayExceptions.some((e) => e.exception_type === 'blackout' && !e.start_time)) return { ok: false, error: 'BLACKOUT_DATE' };

  const blockedByRange = dayExceptions.some((e) => {
    if (!e.start_time || !e.end_time) return false;
    const exStart = hmToMinutes(e.start_time);
    const exEnd = hmToMinutes(e.end_time);
    if (e.exception_type === 'blackout' || e.exception_type === 'override_unavailable') {
      return exStart < endMinutes && exEnd > startMinutes;
    }
    return false;
  });
  if (blockedByRange) return { ok: false, error: 'BLACKOUT_RANGE' };

  const hasOverrideAvailable = dayExceptions.some((e) => e.exception_type === 'override_available');
  if (hasOverrideAvailable) {
    const insideOverride = dayExceptions.some((e) => {
      if (e.exception_type !== 'override_available' || !e.start_time || !e.end_time) return false;
      const exStart = hmToMinutes(e.start_time);
      const exEnd = hmToMinutes(e.end_time);
      return exStart <= startMinutes && exEnd >= endMinutes;
    });
    if (!insideOverride) return { ok: false, error: 'OUTSIDE_OVERRIDE_WINDOW' };
  }

  const sessions = (sessionsRes.data || []) as SessionSlotRow[];
  const requestedBufferedStart = startMinutes - bufferBefore;
  const requestedBufferedEnd = endMinutes + bufferAfter;
  const hasConflict = sessions.some((s) => {
    if (!s.scheduled_at || s.id === params.currentSessionId) return false;
    const slotDate = new Date(s.scheduled_at);
    if (dateKeyInTz(slotDate, timezone) !== dateKey) return false;
    const slotStart = hmToMinutes(timeKeyInTz(slotDate, timezone));
    const slotEnd = slotStart + duration;
    const existingBufferedStart = slotStart - bufferBefore;
    const existingBufferedEnd = slotEnd + bufferAfter;
    return existingBufferedStart < requestedBufferedEnd && existingBufferedEnd > requestedBufferedStart;
  });
  if (hasConflict) return { ok: false, error: 'SLOT_CONFLICT' };

  return { ok: true };
}

function roundTo10(n: number): number {
  return Math.round(n / 10) * 10;
}

function calculateServicePrice(serviceCode: string, countryCode: string): number {
  const basePrice = COUNTRY_BASE_PRICES[countryCode] || COUNTRY_BASE_PRICES['EU'];
  const weight = SERVICE_WEIGHTS[serviceCode] || 0;
  return roundTo10(basePrice * weight);
}

interface RequestBody {
  action: Action;
  payload?: Record<string, unknown>;
  file_kind?: string;
  file_url?: string;
  file_name?: string;
  description?: string;
  mime_type?: string;
  size_bytes?: number;
  storage_bucket?: string;
  storage_path?: string;
  file_id?: string;  // ✅ For sign_file with CRM file lookup
  program_ids?: string[];
  since?: string;
  event_id?: string;
  note?: string;
  // ✅ Wallet ledger params (flat body - not nested)
  currency?: string;
  limit?: number;
  offset?: number;
  // ✅ Search programs params
  keyword?: string;
  country_code?: string;
  degree_level?: string;
  language?: string;
  max_tuition?: number;
  source?: string;  // For sync_shortlist source tracking
  // ✅ Service selection params
  selected_services?: string[];
  selected_addons?: string[];
  selected_package_id?: string | null;
  pricing_snapshot?: {
    currency: string;
    base_price: number;
    items: Array<{ code: string; kind: 'service' | 'addon'; price: number }>;
    services_total: number;
    addons_total: number;
    total: number;
    pay_plan: 'full' | 'split';
    deposit_amount: number;
    remainder_amount: number;
    note?: string | null;
  };
  idempotency_key?: string;
  request_id?: string;  // ✅ P0 Fix: For tracking clear_shortlist and sync
  // ✅ FIX-3: Additional service selection params
  pay_plan?: 'full' | 'split';
  pricing_version?: string;
  origin?: string;  // ✅ A) Single write path origin identifier
  // ✅ sync_shortlist V3 params
  items?: Array<{
    program_ref_id: string;
    program_slug?: string | null;
    snapshot: Record<string, unknown>;
  }>;
  allow_clear?: boolean;  // ✅ Explicit flag to allow clearing all items
  // ✅ Payment System params (Manual Proof Flow)
  payment_id?: string;
  evidence_file_id?: string;
  evidence_storage_bucket?: string;
  evidence_storage_path?: string;
  payment_method?: string;
  payment_reference?: string;
  // ✅ Case Dashboard V1 params
  application_id?: string;
  contract_id?: string;
  consent_version?: string;
  delivery_type?: string;
  address?: Record<string, unknown>;
  // ✅ NEW: Sync Choices params (Program + Services)
  program_id?: string;
  university_id?: string;  // ✅ University shortlist
  program_source?: string;
  program_snapshot?: Record<string, unknown>;
  services_selection?: {
    service_ids?: string[];
    addon_ids?: string[];
    package_id?: string;
  };
  // ✅ Compare V1 params
  locale?: string;
  audience?: 'customer' | 'staff';
  // ✅ Teacher/Lesson params
  language_key?: string;
  student_user_id?: string;
  student_user_ids?: string[];
  lesson_slug?: string;
  module_slug?: string;
  session_type?: string;
  teacher_type?: string;
  curriculum_course_id?: string;
  curriculum_module_id?: string;
  curriculum_lesson_id?: string;
  scheduled_at?: string;
  session_id?: string;
  eval_type?: string;
  score?: number;
  max_score?: number;
  feedback?: string;
  homework_id?: string;
  title?: string;
  due_date?: string;
  status?: string;
  exam_mode?: string;
}

// ✅ v8.2: Shared CRM customer ID resolver — used by ALL shortlist operations (read + write)
// Resolution order: 1) portal_customer_map 2) auth.users metadata 3) null
async function resolveCrmCustomerId(portalAdminClient: any, authUserId: string): Promise<{ crmCustomerId: string | null; source: string }> {
  // 1) Canonical mapping table
  const { data: mapping } = await portalAdminClient
    .from('portal_customer_map')
    .select('crm_customer_id')
    .eq('portal_auth_user_id', authUserId)
    .maybeSingle();

  if (mapping?.crm_customer_id) {
    console.log(`[resolveCrmCustomerId] ✅ source=portal_customer_map crm=${mapping.crm_customer_id.slice(0,12)}...`);
    return { crmCustomerId: mapping.crm_customer_id, source: 'portal_customer_map' };
  }

  // 2) Fallback: auth.users metadata
  const { data: userData } = await portalAdminClient.auth.admin.getUserById(authUserId);
  const meta = (userData?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const metaId = (meta.crm_customer_id as string) || (meta.customer_id as string) || null;
  if (metaId) {
    console.log(`[resolveCrmCustomerId] ✅ source=user_metadata crm=${metaId.slice(0,12)}...`);
    return { crmCustomerId: metaId, source: 'user_metadata' };
  }

  console.log(`[resolveCrmCustomerId] ⚠️ No CRM mapping for portal user ${authUserId.slice(0,12)}...`);
  return { crmCustomerId: null, source: 'none' };
}

// ✅ Resolve the CRM-side auth_user_id for use with CRM RPCs that accept p_auth_user_id.
// When a Portal user's auth ID differs from the CRM's auth_user_id (e.g. after account re-link),
// we must look up the CRM profile's auth_user_id to pass to RPCs.
async function resolveCrmAuthUserId(
  crmClient: any,
  portalAdminClient: any,
  portalAuthUserId: string
): Promise<string> {
  const { crmCustomerId } = await resolveCrmCustomerId(portalAdminClient, portalAuthUserId);
  if (!crmCustomerId) return portalAuthUserId; // fallback to portal auth id

  // Look up CRM profile(s) by canonical customer identity, then pick the freshest auth_user_id
  const { data: crmProfiles, error: crmProfilesError } = await crmClient
    .from('vw_student_portal_profile')
    .select('auth_user_id, updated_at, created_at')
    .or(`customer_id.eq.${crmCustomerId},id.eq.${crmCustomerId}`)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (crmProfilesError) {
    console.warn(`[resolveCrmAuthUserId] ⚠️ profile lookup error for crm_customer_id=${safeId(crmCustomerId)}: ${crmProfilesError.message}`);
  }

  if (Array.isArray(crmProfiles) && crmProfiles.length > 0) {
    const candidate = crmProfiles.find((row: any) => Boolean(row?.auth_user_id)) || crmProfiles[0];
    if (candidate?.auth_user_id) {
      console.log(`[resolveCrmAuthUserId] ✅ CRM auth_user_id=${safeId(candidate.auth_user_id)} (portal=${safeId(portalAuthUserId)})`);
      return candidate.auth_user_id;
    }
  }

  // Final fallback: reuse unified profile resolver (already customer-id aware)
  const resolvedProfile = await fetchCrmProfileByAuthUserId(crmClient, portalAuthUserId);
  if (resolvedProfile.ok && resolvedProfile.linked && resolvedProfile.profile?.auth_user_id) {
    const fallbackAuth = String(resolvedProfile.profile.auth_user_id);
    console.log(`[resolveCrmAuthUserId] ✅ fallback auth_user_id=${safeId(fallbackAuth)} (portal=${safeId(portalAuthUserId)})`);
    return fallbackAuth;
  }

  console.log(`[resolveCrmAuthUserId] ⚠️ Falling back to portal auth_user_id=${safeId(portalAuthUserId)}`);
  return portalAuthUserId; // fallback
}

// Resolve all portal/auth IDs linked to the same CRM customer identity.
// This protects student runtime reads after account re-linking/migration.
async function resolveLinkedPortalStudentUserIds(
  crmClient: any,
  portalAdminClient: any,
  portalAuthUserId: string
): Promise<string[]> {
  const linked = new Set<string>([portalAuthUserId]);

  const { crmCustomerId } = await resolveCrmCustomerId(portalAdminClient, portalAuthUserId);
  if (!crmCustomerId) {
    return Array.from(linked);
  }

  const canonicalAuthUserId = await resolveCrmAuthUserId(crmClient, portalAdminClient, portalAuthUserId);
  if (canonicalAuthUserId) {
    linked.add(canonicalAuthUserId);
  }

  const { data: mappedPortalUsers, error: mapErr } = await portalAdminClient
    .from('portal_customer_map')
    .select('portal_auth_user_id')
    .eq('crm_customer_id', crmCustomerId);

  if (mapErr) {
    console.warn(`[resolveLinkedPortalStudentUserIds] ⚠️ portal map lookup failed for crm=${safeId(crmCustomerId)}: ${mapErr.message}`);
  } else {
    for (const row of (mappedPortalUsers || [])) {
      if (row?.portal_auth_user_id) linked.add(String(row.portal_auth_user_id));
    }
  }

  const { data: crmProfiles, error: crmErr } = await crmClient
    .from('vw_student_portal_profile')
    .select('auth_user_id')
    .or(`customer_id.eq.${crmCustomerId},id.eq.${crmCustomerId}`)
    .limit(10);

  if (crmErr) {
    console.warn(`[resolveLinkedPortalStudentUserIds] ⚠️ CRM profile lookup failed for crm=${safeId(crmCustomerId)}: ${crmErr.message}`);
  } else {
    for (const row of (crmProfiles || [])) {
      if (row?.auth_user_id) linked.add(String(row.auth_user_id));
    }
  }

  return Array.from(linked);
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  return cleaned.length ? cleaned : null;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.replace(/[\s\-()]/g, '').trim();
  return cleaned.length ? cleaned : null;
}

// Bridge runtime identity using stable profile/auth contacts (email/phone).
// This fixes session visibility when teacher linked a legacy portal user id.
async function expandLinkedPortalStudentUserIdsByContacts(
  portalAdminClient: any,
  seedUserIds: string[],
): Promise<string[]> {
  const linked = new Set<string>((seedUserIds || []).filter(Boolean));
  if (!linked.size) return [];

  const seedIds = Array.from(linked);
  const contactsEmails = new Set<string>();
  const contactsPhones = new Set<string>();

  const { data: profileRows, error: profileErr } = await portalAdminClient
    .from('profiles')
    .select('user_id, email, phone')
    .in('user_id', seedIds);

  if (profileErr) {
    console.warn(`[expandLinkedPortalStudentUserIdsByContacts] ⚠️ profiles seed lookup failed: ${profileErr.message}`);
  } else {
    for (const row of (profileRows || [])) {
      const email = normalizeEmail(row?.email);
      const phone = normalizePhone(row?.phone);
      if (email) contactsEmails.add(email);
      if (phone) contactsPhones.add(phone);
    }
  }

  const authRows = await Promise.all(seedIds.map(async (uid) => {
    const { data, error } = await portalAdminClient.auth.admin.getUserById(uid);
    if (error) return null;
    return {
      email: normalizeEmail(data?.user?.email ?? null),
      phone: normalizePhone(data?.user?.phone ?? null),
    };
  }));

  for (const row of authRows) {
    if (!row) continue;
    if (row.email) contactsEmails.add(row.email);
    if (row.phone) contactsPhones.add(row.phone);
  }

  if (!contactsEmails.size && !contactsPhones.size) {
    return Array.from(linked);
  }

  const emailCandidates = Array.from(contactsEmails);
  const phoneCandidates = Array.from(contactsPhones);

  const [emailMatchRes, phoneMatchRes] = await Promise.all([
    emailCandidates.length
      ? portalAdminClient
          .from('profiles')
          .select('user_id')
          .in('email', emailCandidates)
      : Promise.resolve({ data: [], error: null }),
    phoneCandidates.length
      ? portalAdminClient
          .from('profiles')
          .select('user_id')
          .in('phone', phoneCandidates)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (emailMatchRes.error) {
    console.warn(`[expandLinkedPortalStudentUserIdsByContacts] ⚠️ email lookup failed: ${emailMatchRes.error.message}`);
  }
  if (phoneMatchRes.error) {
    console.warn(`[expandLinkedPortalStudentUserIdsByContacts] ⚠️ phone lookup failed: ${phoneMatchRes.error.message}`);
  }

  for (const row of (emailMatchRes.data || [])) {
    if (row?.user_id) linked.add(String(row.user_id));
  }
  for (const row of (phoneMatchRes.data || [])) {
    if (row?.user_id) linked.add(String(row.user_id));
  }

  return Array.from(linked);
}

// ✅ Helper موحد - مصدر واحد للحقيقة: vw_student_portal_profile
// Resolution order for CRM linkage:
// 1) portal_customer_map (canonical)
// 2) auth.users metadata crm_customer_id/customer_id
// 3) legacy fallback: vw_student_portal_profile.auth_user_id = portal auth user id
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCrmProfileByAuthUserId(crmClient: any, authUserId: string): Promise<{
  ok: boolean;
  linked: boolean;
  profile: Record<string, unknown> | null;
  error_code: string | null;
  error?: unknown;
}> {
  console.log('[student-portal-api] 🔍 Resolving CRM profile for portal auth user:', authUserId);

  const portalAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let resolvedCustomerId: string | null = null;
  let resolvedSource: 'portal_customer_map' | 'user_metadata' | 'legacy_auth_user_id' | 'none' = 'none';

  // 1) Canonical mapping table
  const { data: mapping, error: mappingError } = await portalAdmin
    .from('portal_customer_map')
    .select('crm_customer_id')
    .eq('portal_auth_user_id', authUserId)
    .maybeSingle();

  if (mappingError) {
    console.warn('[student-portal-api] ⚠️ portal_customer_map lookup failed:', mappingError);
  }

  if (mapping?.crm_customer_id) {
    resolvedCustomerId = mapping.crm_customer_id;
    resolvedSource = 'portal_customer_map';
  }

  // 2) Fallback to auth metadata
  if (!resolvedCustomerId) {
    const { data: userData, error: userError } = await portalAdmin.auth.admin.getUserById(authUserId);
    if (userError) {
      console.warn('[student-portal-api] ⚠️ auth.users metadata lookup failed:', userError);
    } else {
      const meta = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
      const metaCustomerId = typeof meta.crm_customer_id === 'string'
        ? meta.crm_customer_id
        : typeof meta.customer_id === 'string'
          ? meta.customer_id
          : null;

      if (metaCustomerId) {
        resolvedCustomerId = metaCustomerId;
        resolvedSource = 'user_metadata';
      }
    }
  }

  // 1/2 resolved → query CRM by customer_id (NOT auth_user_id)
  if (resolvedCustomerId) {
    console.log(`[student-portal-api] 🔗 CRM linkage source=${resolvedSource} customer_id=${resolvedCustomerId}`);

    const { data: byCustomer, error: byCustomerError } = await crmClient
      .from('vw_student_portal_profile')
      .select('*')
      .or(`customer_id.eq.${resolvedCustomerId},id.eq.${resolvedCustomerId}`)
      .limit(1)
      .maybeSingle();

    if (byCustomerError) {
      console.error('[student-portal-api] ❌ CRM query by customer_id failed:', byCustomerError);
      return { ok: false, error: byCustomerError, linked: false, profile: null, error_code: 'query_error' };
    }

    if (byCustomer) {
      const profile = byCustomer as Record<string, unknown>;
      console.log('[student-portal-api] ✅ Profile found by customer_id:', profile.customer_id || profile.id);
      return { ok: true, linked: true, profile, error_code: null };
    }

    console.warn('[student-portal-api] ⚠️ No CRM profile found by resolved customer_id, trying legacy auth_user_id path');
  }

  // 3) Legacy fallback
  const { data: legacyData, error: legacyError } = await crmClient
    .from('vw_student_portal_profile')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (legacyError) {
    console.error('[student-portal-api] ❌ Legacy auth_user_id query error:', legacyError);
    return { ok: false, error: legacyError, linked: false, profile: null, error_code: 'query_error' };
  }

  if (!legacyData) {
    console.log('[student-portal-api] ⚠️ No profile found in view');
    return { ok: true, linked: false, error_code: 'no_linked_customer', profile: null };
  }

  resolvedSource = 'legacy_auth_user_id';
  const profile = legacyData as Record<string, unknown>;
  console.log(`[student-portal-api] ✅ Profile found via ${resolvedSource}:`, profile.customer_id || profile.id);
  return { ok: true, linked: true, profile, error_code: null };
}

Deno.serve(async (req) => {
  // ✅ CORS: Compute headers from request origin for ALL responses
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // ✅ IMPORTANT: enforce CORS headers on *every* response (success + error)
  const applyCors = (res: Response): Response => {
    const headers = new Headers(res.headers);

    // Merge/overwrite with computed CORS headers
    for (const [k, v] of Object.entries(corsHeaders)) {
      headers.set(k, v);
    }

    // Ensure Vary contains Origin even if another code path set it differently
    const vary = headers.get('Vary');
    if (vary) {
      const parts = vary.split(',').map((s) => s.trim().toLowerCase());
      if (!parts.includes('origin')) headers.set('Vary', `${vary}, Origin`);
    } else {
      headers.set('Vary', 'Origin');
    }

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };

  // Wrap the entire handler so even early-returns get CORS applied.
  return applyCors(await (async () => {
    // Handle preflight immediately
    if (req.method === 'OPTIONS') {
      return new Response('ok', { status: 200 });
    }

    try {
    // 1. Parse request body FIRST to check action
    const body: RequestBody = await req.json();
    const { action } = body;

    if (!action) {
      return Response.json({ ok: false, error: 'Missing action' }, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // ✅ PUBLIC_ACTIONS - لا تحتاج auth (مثل البحث عن البرامج والمقارنات)
    const PUBLIC_ACTIONS = new Set(['search_programs', 'compare_programs_v1']);
    
    let authUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    const portalAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Handle auth based on action type — use getClaims() instead of getUser() to avoid hitting auth service under DB pressure
    if (!PUBLIC_ACTIONS.has(action)) {
      // Protected actions require JWT
      if (!authHeader) {
        return Response.json({ ok: false, error: 'Missing authorization', error_code: 'auth_required' }, { 
          status: 401, 
          headers: corsHeaders 
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      
      if (claimsError || !claimsData?.claims?.sub) {
        console.error('[student-portal-api] Auth error:', claimsError);
        return Response.json({ ok: false, error: 'Invalid token', error_code: 'invalid_token' }, { 
          status: 401, 
          headers: corsHeaders 
        });
      }

      authUserId = claimsData.claims.sub as string;
      console.log('[student-portal-api] Authenticated user:', authUserId);
    } else {
      // Public actions: auth is optional
      console.log('[student-portal-api] Public action:', action);
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: claimsData } = await userClient.auth.getClaims(token);
        if (claimsData?.claims?.sub) authUserId = claimsData.claims.sub as string;
      }
    }

    // 3. Create CRM client
    const crmClient = createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY);

    // 4. Route to appropriate CRM RPC
    let result: { data: unknown; error: unknown };

    switch (action) {
      case 'get_profile': {
        const profileRes = await fetchCrmProfileByAuthUserId(crmClient, authUserId!);
        
        if (profileRes.ok && profileRes.linked && profileRes.profile) {
          // ✅ نجاح: نرجع البروفايل مغلف
          return Response.json({ ok: true, data: profileRes.profile, error: null }, { headers: corsHeaders });
        }

        if (profileRes.ok && !profileRes.linked) {
          // ⚠️ غير مربوط: نرجع success=false
          return Response.json(
            { ok: true, data: { success: false, error: 'no_linked_customer' }, error: null },
            { headers: corsHeaders }
          );
        }

        // ❌ خطأ في CRM
        const errorMessage = profileRes.error && typeof profileRes.error === 'object' && 'message' in profileRes.error 
          ? (profileRes.error as { message: string }).message 
          : 'crm_error';
        console.error('[student-portal-api] get_profile CRM error:', profileRes.error);
        return Response.json(
          { ok: false, data: { success: false, error: 'crm_error' }, error: errorMessage },
          { headers: corsHeaders }
        );
      }

      case 'update_profile': {
        console.log('[student-portal-api] 🔄 update_profile called');
        console.log('[student-portal-api] 📤 auth_user_id:', authUserId);
        console.log('[student-portal-api] 📤 payload:', JSON.stringify(body.payload || {}, null, 2));
        
        // 🆕 P0: Check profile_locked BEFORE update
        const profileCheckRes = await fetchCrmProfileByAuthUserId(crmClient, authUserId!);
        
        if (profileCheckRes.ok && profileCheckRes.profile?.profile_locked === true) {
          console.log('[update_profile] ⛔ PROFILE_LOCKED - blocking update');
          return Response.json({
            ok: false,
            error: 'PROFILE_LOCKED',
            message: (profileCheckRes.profile.profile_lock_reason as string) || 'الملف الشخصي مقفول',
            http_status: 403
          }, { status: 200, headers: corsHeaders });
        }
        
        const updateStartTime = Date.now();
        result = await crmClient.rpc('rpc_update_student_portal_profile', {
          p_auth_user_id: authUserId,
          p_payload: body.payload || {},
        });
        
        const updateDuration = Date.now() - updateStartTime;
        console.log(`[student-portal-api] ⏱️ CRM RPC took ${updateDuration}ms`);
        console.log('[student-portal-api] 📥 CRM response data:', JSON.stringify(result.data, null, 2));
        
        if (result.error) {
          console.error('[student-portal-api] ❌ update_profile RPC error:', JSON.stringify(result.error, null, 2));
          // Return detailed error for debugging
          return Response.json({ 
            ok: false, 
            error: 'UPDATE_FAILED',
            message: typeof result.error === 'object' ? JSON.stringify(result.error) : String(result.error),
            details: {
              auth_user_id: authUserId,
              crm_error: result.error,
            }
          }, { status: 200, headers: corsHeaders });
        }
        
        console.log('[student-portal-api] ✅ update_profile success');
        break;
      }

      case 'delete_my_file': {
        // ✅ Delete file from Portal Storage
        const storagePath = body.storage_path;
        
        if (!storagePath) {
          return Response.json({ ok: false, error: 'storage_path required' }, { headers: corsHeaders });
        }
        
        // Verify the path belongs to this user
        const expectedPrefix = `users/${authUserId}/`;
        if (!storagePath.startsWith(expectedPrefix)) {
          console.error('[delete_my_file] ❌ Unauthorized path:', storagePath, 'expected prefix:', expectedPrefix);
          return Response.json({ ok: false, error: 'unauthorized_path' }, { headers: corsHeaders });
        }
        
        // User-auth client for storage delete
        const userStorageClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
        });
        
        const { error: rmError } = await userStorageClient.storage
          .from('student-docs')
          .remove([storagePath]);
        
        if (rmError) {
          console.error('[delete_my_file] ❌ Storage delete error:', rmError);
          return Response.json({ ok: false, error: rmError.message }, { headers: corsHeaders });
        }
        
        console.log('[delete_my_file] ✅ Deleted:', storagePath);
        return Response.json({ ok: true, deleted: storagePath }, { headers: corsHeaders });
      }

      case 'clear_my_files': {
        // ⚠️ TEMPORARY: Delete ALL files for this user from Storage
        console.log('[clear_my_files] 🗑️ Clearing all files for user:', authUserId);
        
        const userPrefix = `users/${authUserId}/`;
        
        // Use service role to list all files
        const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        // List all folders for this user
        const folders = ['passport', 'certificate', 'photo', 'additional'];
        const allDeleted: string[] = [];
        const errors: string[] = [];
        
        for (const folder of folders) {
          const folderPath = `${userPrefix}${folder}`;
          const { data: files, error: listErr } = await serviceClient.storage
            .from('student-docs')
            .list(folderPath);
          
          if (listErr) {
            console.error(`[clear_my_files] ❌ List error for ${folder}:`, listErr);
            errors.push(`${folder}: ${listErr.message}`);
            continue;
          }
          
          if (files && files.length > 0) {
            const filePaths = files.map(f => `${folderPath}/${f.name}`);
            console.log(`[clear_my_files] 📁 Found ${files.length} files in ${folder}:`, filePaths);
            
            const { error: rmErr } = await serviceClient.storage
              .from('student-docs')
              .remove(filePaths);
            
            if (rmErr) {
              console.error(`[clear_my_files] ❌ Delete error for ${folder}:`, rmErr);
              errors.push(`${folder}: ${rmErr.message}`);
            } else {
              allDeleted.push(...filePaths);
            }
          }
        }
        
        console.log('[clear_my_files] ✅ Deleted total:', allDeleted.length, 'files');
        return Response.json({ 
          ok: true, 
          deleted_count: allDeleted.length,
          deleted: allDeleted,
          errors: errors.length > 0 ? errors : undefined
        }, { headers: corsHeaders });
      }

      case 'sync_shortlist': {
        // ==========================================
        // V3 Protocol: Accepts snapshots directly from UI
        // V1/V2 Fallback: Accepts program_ids[] and enriches from KB
        // ==========================================
        const { 
          items: clientItems,  // V3: ProgramSnapshot[]
          program_ids,         // V1/V2: string[]
          source,
          request_id,
          allow_clear,         // ✅ P0.1: Explicit flag to allow clearing all items
        } = body as { 
          items?: any[];
          program_ids?: string[]; 
          source?: string;
          request_id?: string;
          allow_clear?: boolean;
        };
        
        const reqId = request_id || `srv_${Date.now()}`;
        const isV3 = Array.isArray(clientItems) && clientItems.length > 0;
        const hasNoItems = (!clientItems || clientItems.length === 0) && (!program_ids || program_ids.length === 0);
        
        console.log('[sync_shortlist] 🟢 ACTION RECEIVED', {
          request_id: reqId,
          auth_user_id: authUserId,
          version: isV3 ? 'V3 (client snapshots)' : 'V1/V2 (legacy)',
          count: isV3 ? clientItems.length : (program_ids?.length ?? 0),
          source,
          allow_clear,
          has_no_items: hasNoItems,
        });
        
        // ✅ P0.1 Fix: Guard against accidental empty sync UNLESS allow_clear is explicitly true
        if (hasNoItems && !allow_clear) {
          console.log('[sync_shortlist] ⏭️ Empty items without allow_clear flag - ignoring to prevent accidental clear');
          return Response.json({
            ok: true,
            request_id: reqId,
            synced_to_crm: false,
            stored_count: 0,
            skipped_reason: 'empty_without_allow_clear',
          }, { headers: corsHeaders });
        }
        
        // ==========================================
        // 1) Build items[] - V3 uses client snapshots, V1/V2 enriches from KB
        // ==========================================
        let items: any[] = [];
        const rejectedItems: { program_ref_id: string; reason: string }[] = [];
        
        // Helper: Build portal_url from slug/id
        const buildPortalUrl = (slug: string | null, id: string) => {
          const portalDomain = Deno.env.get('PORTAL_DOMAIN') || 'https://portal.example.com';
          return `${portalDomain}/program/${slug || id}`;
        };
        
        if (isV3) {
          // ==========================================
          // ✅ V3: Validate client-provided snapshots (CRM-compatible fields)
          // ==========================================
          
          for (const item of clientItems) {
            const snapshot = item.snapshot || {};
            const programId = item.program_ref_id;
            
            // Check for missing_in_catalog flag
            if (snapshot.missing_in_catalog === true) {
              console.warn('[sync_shortlist] ⛔ Rejecting missing_in_catalog:', programId);
              rejectedItems.push({ 
                program_ref_id: programId, 
                reason: 'missing_in_catalog' 
              });
              continue;
            }
            
            // ✅ Flexible validation: Accept EN OR AR for names
            const hasProgramName = !!(
              (snapshot.program_name_en?.trim() && snapshot.program_name_en !== 'Unknown Program') ||
              (snapshot.program_name_ar?.trim())
            );
            const hasUniName = !!(
              (snapshot.university_name_en?.trim() && snapshot.university_name_en !== 'Unknown University') ||
              (snapshot.university_name_ar?.trim())
            );
            const hasCountry = !!(
              snapshot.country_code?.trim() ||
              snapshot.country_name_en?.trim() ||
              snapshot.country_name_ar?.trim()
            );
            const hasPortalUrl = !!snapshot.portal_url?.trim();
            
            const missing: string[] = [];
            if (!hasProgramName) missing.push('program_name (en/ar)');
            if (!hasUniName) missing.push('university_name (en/ar)');
            if (!hasCountry) missing.push('country (code/name)');
            if (!hasPortalUrl) missing.push('portal_url');
            
            if (missing.length > 0) {
              console.warn('[sync_shortlist] ⛔ Rejecting incomplete snapshot:', programId, missing);
              rejectedItems.push({ 
                program_ref_id: programId, 
                reason: `missing_fields: ${missing.join(', ')}` 
              });
              continue;
            }
            
            // ✅ Valid snapshot - map to CRM-expected fields
            items.push({
              program_ref_id: programId,
              program_slug: item.program_slug ?? null,
              snapshot: {
                // Program names
                program_name_en: snapshot.program_name_en ?? null,
                program_name_ar: snapshot.program_name_ar ?? snapshot.program_name_en ?? null,
                
                // University
                university_name_en: snapshot.university_name_en ?? null,
                university_name_ar: snapshot.university_name_ar ?? snapshot.university_name_en ?? null,
                university_logo: snapshot.university_logo ?? null,
                
                // Country - CRM expects all three
                country_name_en: snapshot.country_name_en ?? null,
                country_name_ar: snapshot.country_name_ar ?? snapshot.country_name_en ?? null,
                country_code: snapshot.country_code ?? null,
                
                // Degree & Language
                degree_level: snapshot.degree_level ?? null,
                language: snapshot.language ?? null,
                duration_months: snapshot.duration_months ?? null,
                
                // Tuition - CRM expects min/max in USD
                tuition_usd_min: snapshot.tuition_usd_min ?? null,
                tuition_usd_max: snapshot.tuition_usd_max ?? null,
                
                // Portal URL - for CRM staff
                portal_url: snapshot.portal_url,
                
                // City
                city: snapshot.city ?? null,
              }
            });
          }
          
          console.log('[sync_shortlist] ✅ V3 Validated:', items.length, 'accepted,', rejectedItems.length, 'rejected');
          
        } else {
          // ==========================================
          // V1/V2 Fallback: Enrich from Portal KB (legacy support)
          // ==========================================
          const ids = program_ids || [];
          console.log('[sync_shortlist] 🔄 V1/V2 Enriching from KB:', ids.length, 'IDs');
          
          if (ids.length > 0) {
            // ✅ Query only existing columns (program_slug does NOT exist in vw_program_search)
            const { data: kbPrograms, error: kbErr } = await portalAdmin
              .from('vw_program_search')
              .select(`
                program_id, program_name,
                university_id, university_name, logo_url,
                country_id, country_name, country_slug,
                degree_id, degree_name, degree_slug,
                fees_yearly, city, language, duration_months
              `)
              .in('program_id', ids);
  
            if (kbErr) {
              console.error('[sync_shortlist] KB query error:', kbErr);
            }
            
            console.log('[sync_shortlist] ✅ KB returned', kbPrograms?.length ?? 0, 'programs for', ids.length, 'IDs');

            const programMap = new Map((kbPrograms ?? []).map((p: any) => [p.program_id, p]));

            for (const id of ids) {
              const p = programMap.get(id);
              
              if (!p) {
                console.warn('[sync_shortlist] ⛔ Program not in KB:', id);
                rejectedItems.push({ 
                  program_ref_id: id, 
                  reason: 'not_found_in_catalog' 
                });
                continue;
              }
              
              items.push({
                program_ref_id: id,
                program_slug: null, // ✅ Not available in KB, use program_id for URLs
                snapshot: {
                  // Program names
                  program_name_en: p.program_name ?? null,
                  program_name_ar: p.program_name ?? null,
                  
                  // University
                  university_name_en: p.university_name ?? null,
                  university_name_ar: p.university_name ?? null,
                  university_logo: p.logo_url ?? null, // ✅ Correct column name
                  
                  // Country - CRM expects all three
                  country_name_en: p.country_name ?? null,
                  country_name_ar: p.country_name ?? null,
                  country_code: p.country_slug?.toUpperCase() ?? null,
                  
                  // Degree & Language
                  degree_level: p.degree_name ?? null,
                  language: p.language ?? null,
                  duration_months: p.duration_months ?? null,
                  
                  // Tuition - CRM expects min/max
                  tuition_usd_min: p.fees_yearly ?? null,
                  tuition_usd_max: p.fees_yearly ?? null,
                  
                  // Portal URL - use program_id since slug not available
                  portal_url: buildPortalUrl(null, id),
                  
                  // City
                  city: p.city ?? null,
                }
              });
            }
            
            console.log('[sync_shortlist] ✅ V1/V2 Enriched:', items.length, 'found,', rejectedItems.length, 'not found');
          }
        }
        
        // ==========================================
        // 2) Save to Portal user_shortlists (local cache - accepted items only)
        // ==========================================
        if (authUserId) {
          await portalAdmin
            .from('user_shortlists')
            .delete()
            .eq('user_id', authUserId);

          if (items.length > 0) {
            const localItems = items.map((item: any) => ({
              user_id: authUserId,
              program_id: item.program_ref_id,
            }));
            
            const { error: localErr } = await portalAdmin
              .from('user_shortlists')
              .insert(localItems);
            
            if (localErr) {
              console.warn('[sync_shortlist] Local save failed:', localErr.message);
            } else {
              console.log('[sync_shortlist] ✅ Local saved', items.length, 'programs');
            }
          } else {
            console.log('[sync_shortlist] ✅ Local cleared (0 valid programs)');
          }
        }
        
        // ==========================================
        // 3) Sync to CRM (only valid items) — v8.3: resolve CRM customer ID
        // ==========================================
        let syncedToCrm = false;
        let crmError: string | null = null;
        
        // ✅ v8.3: Resolve CRM customer ID (parity with shortlist_add/remove/get)
        const { crmCustomerId: syncCrmId, source: syncIdSource } = await resolveCrmCustomerId(portalAdmin, authUserId!);
        const syncIdForCrm = syncCrmId || authUserId;
        console.log(`[sync_shortlist] Identity resolved: crm=${syncCrmId?.slice(0,12) ?? 'null'} source=${syncIdSource} portal_auth=${authUserId?.slice(0,12)}`);
        
        if (items.length > 0) {
          // Try V2 RPC first (with snapshots) — v9: p_customer_id for identity
          console.log(`[sync_shortlist] 🔑 Contract v9 V2: p_auth_user_id=${safeId(authUserId)} p_customer_id=${safeId(syncIdForCrm)}`);
          const { data: v2Data, error: v2Err } = await crmClient.rpc('rpc_sync_student_shortlist_from_portal_v2', {
            p_auth_user_id: authUserId,
            p_customer_id: syncIdForCrm,
            p_items: items,
            p_source: source || 'portal_web_shortlist',
          });

          if (!v2Err && v2Data) {
            console.log('[sync_shortlist] ✅ CRM V2 success:', v2Data);
            syncedToCrm = true;
          } else {
            console.warn('[sync_shortlist] ⚠️ CRM V2 failed:', v2Err?.message);
            
            // Fallback to V1 (IDs only)
            const programIds = items.map((i: any) => i.program_ref_id);
            const { data: v1Data, error: v1Err } = await crmClient.rpc('rpc_sync_student_shortlist_from_portal', {
              p_auth_user_id: authUserId,
              p_customer_id: syncIdForCrm,
              p_program_ids: programIds,
              p_source: source || 'portal_web_shortlist',
            });

            if (!v1Err && v1Data) {
              console.log('[sync_shortlist] ✅ CRM V1 success:', v1Data);
              syncedToCrm = true;
            } else {
              console.error('[sync_shortlist] ❌ CRM V1 failed:', v1Err);
              crmError = v1Err?.message || 'CRM sync failed';
            }
          }
        } else {
          // Clear shortlist in CRM
          const { error: clearErr } = await crmClient.rpc('rpc_sync_student_shortlist_from_portal', {
            p_auth_user_id: authUserId,
            p_customer_id: syncIdForCrm,
            p_program_ids: [],
            p_source: source || 'portal_web_shortlist',
          });
          
          if (!clearErr) {
            console.log('[sync_shortlist] ✅ CRM cleared');
            syncedToCrm = true;
          } else {
            crmError = clearErr.message;
          }
        }
        
        // ==========================================
        // 4) Build response (transparent - no hidden failures)
        // ==========================================
        const response = {
          ok: true,
          request_id: reqId,
          synced_to_crm: syncedToCrm,
          stored_count: items.length,
          rejected_items: rejectedItems.length > 0 ? rejectedItems : undefined,
          crm_error: crmError,
        };
        
        console.log('[sync_shortlist] 📤 Response:', response);
        return Response.json(response, { headers: corsHeaders });
      }

      // ============= CLEAR SHORTLIST (P0 Fix) =============
      case 'clear_shortlist': {
        const reqId = body.request_id || `clear_${Date.now()}`;
        const source = body.source || 'portal_web';
        console.log('[clear_shortlist] 🗑️ request_id:', reqId, 'auth_user_id:', authUserId, 'source:', source);

        // Note: auth is enforced before switch, but keep a hard guard.
        if (!authUserId) {
          return Response.json({
            ok: false,
            request_id: reqId,
            error: 'auth_required',
            error_code: 'auth_required',
          }, { status: 200, headers: corsHeaders });
        }

        // ✅ v8.3: Resolve CRM customer ID (parity with all shortlist paths)
        const { crmCustomerId: clearCrmId, source: clearIdSource } = await resolveCrmCustomerId(portalAdmin, authUserId!);
        const clearIdForCrm = clearCrmId || authUserId;
        console.log(`[clear_shortlist] Identity resolved: crm=${clearCrmId?.slice(0,12) ?? 'null'} source=${clearIdSource}`);

        // 1) Determine which program IDs to remove (TEXT - no UUID validation)
        let idsToRemove: string[] = [];

        if (Array.isArray(body.program_ids) && body.program_ids.length > 0) {
          // Accept any non-empty string (CRM uses TEXT, not UUID)
          idsToRemove = body.program_ids.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
        } else {
          const rpcName = 'rpc_get_student_shortlist';
          const t0 = Date.now();
          console.log(`[clear_shortlist] 🔑 Contract v9 list: p_auth_user_id=${safeId(authUserId)} p_customer_id=${safeId(clearIdForCrm)}`);
          const { data: listData, error: listErr } = await crmClient.rpc(rpcName, {
            p_auth_user_id: authUserId,
            p_customer_id: clearIdForCrm,
          });
          const ms = Date.now() - t0;

          if (listErr) {
            console.error('[clear_shortlist] ❌ Failed to fetch shortlist from CRM:', listErr.message);
            return Response.json({
              ok: false,
              request_id: reqId,
              rpc_ok: false,
              rpc_error: listErr.message,
              ms,
              stage: 'list',
            }, { status: 200, headers: corsHeaders });
          }

          const rows = Array.isArray(listData) ? (listData as any[]) : [];
          // ✅ Accept any non-empty string (TEXT-based program_ref_id)
          idsToRemove = rows
            .map((r) => (r?.program_ref_id || r?.program_id || null))
            .filter((x): x is string => typeof x === 'string' && x.trim() !== '');

          // Deduplicate while preserving order
          idsToRemove = [...new Set(idsToRemove)];
        }

        if (idsToRemove.length === 0) {
          // Nothing to clear
          return Response.json({
            ok: true,
            request_id: reqId,
            removed_count: 0,
            attempted_count: 0,
            crm_cleared: true,
            portal_cleared: false,
          }, { status: 200, headers: corsHeaders });
        }

        // 2) Remove one-by-one from CRM (safe clear; no empty-array sync)
        const removeRpc = 'rpc_shortlist_remove_v1';
        let removed = 0;
        const errors: Array<{ program_id: string; error: string }> = [];

        for (const pid of idsToRemove) {
          const t0 = Date.now();
          const { error: rmErr } = await crmClient.rpc(removeRpc, {
            p_auth_user_id: authUserId,
            p_customer_id: clearIdForCrm,
            p_program_id: pid,
            p_source: `${source}_bulk`,
          });
          const ms = Date.now() - t0;

          if (rmErr) {
            console.error('[clear_shortlist] ❌ remove failed:', { program_id: pid, error: rmErr.message, ms });
            errors.push({ program_id: pid, error: rmErr.message });
          } else {
            removed += 1;
          }
        }

        const crmCleared = errors.length === 0;

        // 3) Clear Portal cache ONLY if CRM clear succeeded (avoid hiding data when CRM fails)
        let portalCleared = false;
        if (crmCleared) {
          const { error: localErr } = await portalAdmin
            .from('user_shortlists')
            .delete()
            .eq('user_id', authUserId);

          if (localErr) {
            console.warn('[clear_shortlist] ⚠️ Portal cache clear failed:', localErr.message);
          } else {
            portalCleared = true;
          }
        }

        return Response.json({
          ok: crmCleared,
          request_id: reqId,
          crm_cleared: crmCleared,
          portal_cleared: portalCleared,
          removed_count: removed,
          attempted_count: idsToRemove.length,
          errors: errors.length ? errors : undefined,
        }, { status: 200, headers: corsHeaders });
      }

      // ============= P0 FIX: Delta-based Shortlist Operations =============
      // These use individual add/remove RPCs instead of full-sync to prevent flicker
      // ✅ v8.1: Resolves CRM customer ID from portal_customer_map before calling CRM RPC
      
      case 'shortlist_add': {
        const reqId = genRequestId();
        const logCtx: RpcLogContext = { requestId: reqId, action: 'shortlist_add', authUserId };
        
        const programId = body.program_id;
        const snapshot = body.program_snapshot || null;
        const source = body.source || 'portal';
        
        if (!programId) {
          console.log(`[student-portal-api] ${reqId} ❌ Missing program_id`);
          return Response.json({ ok: false, error: 'program_id required', request_id: reqId }, { headers: corsHeaders });
        }
        
        console.log(`[student-portal-api] ${reqId} action=shortlist_add program=${safeId(programId)} auth=${safeId(authUserId)}`);
        
        // 1) Save to Portal DB (portal_shortlist = local cache/SoT)
        const { error: localErr } = await portalAdmin
          .from('portal_shortlist')
          .upsert({ 
            auth_user_id: authUserId, 
            program_id: programId 
          }, { 
            onConflict: 'auth_user_id,program_id' 
          });
        
        if (localErr) {
          console.warn(`[student-portal-api] ${reqId} Portal upsert warning:`, localErr.message);
        } else {
          console.log(`[student-portal-api] ${reqId} ✅ Portal shortlist upsert success`);
        }
        
        // 2) Resolve CRM customer ID from portal_customer_map
        let crmCustomerId: string | null = null;
        const { data: mapping } = await portalAdmin
          .from('portal_customer_map')
          .select('crm_customer_id')
          .eq('portal_auth_user_id', authUserId)
          .maybeSingle();
        
        if (mapping?.crm_customer_id) {
          crmCustomerId = mapping.crm_customer_id;
          console.log(`[student-portal-api] ${reqId} ✅ CRM customer resolved: ${safeId(crmCustomerId)}`);
        } else {
          // Fallback: check user metadata
          const { data: userData } = await portalAdmin.auth.admin.getUserById(authUserId!);
          const meta = (userData?.user?.user_metadata ?? {}) as Record<string, unknown>;
          crmCustomerId = (meta.crm_customer_id as string) || (meta.customer_id as string) || null;
          if (crmCustomerId) {
            console.log(`[student-portal-api] ${reqId} ✅ CRM customer from metadata: ${safeId(crmCustomerId)}`);
          }
        }
        
        if (!crmCustomerId) {
          console.warn(`[student-portal-api] ${reqId} ⚠️ No CRM customer mapped for portal user ${safeId(authUserId)}, skip CRM sync`);
          // Still return success for Portal-only save
          return Response.json({
            ok: true,
            added: true,
            count: 0,
            limit: 10,
            limit_reached: false,
            request_id: reqId,
            portal_saved: !localErr,
            crm_synced: false,
            crm_skip_reason: 'no_customer_mapping',
          }, { headers: corsHeaders });
        }
        
        // 3) Call CRM RPC with resolved customer ID
        const rpcName = 'rpc_shortlist_add_v1';
        logRpcStart(logCtx, rpcName, ['p_auth_user_id', 'p_customer_id', 'p_program_id', 'p_snapshot', 'p_source']);
        const t0 = Date.now();
        
        console.log(`[shortlist_add] 🔑 Contract v9: p_auth_user_id=${safeId(authUserId)} p_customer_id=${safeId(crmCustomerId)} program=${safeId(programId)}`);
        const { data: rpcData, error: rpcErr } = await crmClient.rpc(rpcName, {
          p_auth_user_id: authUserId,
          p_customer_id: crmCustomerId,
          p_program_id: programId,
          p_snapshot: snapshot,
          p_source: source,
        });
        
        const duration = Date.now() - t0;
        logRpcEnd(logCtx, rpcName, !rpcErr, duration, rpcErr?.message);
        
        if (rpcErr) {
          console.error(`[student-portal-api] ${reqId} ❌ CRM RPC failed:`, rpcErr.message);
        } else {
          console.log(`[student-portal-api] ${reqId} ✅ CRM shortlist_add synced`);
        }
        
        // 4) Return flat response matching frontend expectations
        const rpcResult = (rpcData || {}) as Record<string, unknown>;
        return Response.json({
          ok: true,
          added: rpcResult.added ?? true,
          already_exists: rpcResult.already_exists ?? false,
          count: rpcResult.count ?? 0,
          limit: rpcResult.limit ?? 10,
          limit_reached: rpcResult.limit_reached ?? false,
          items: rpcResult.items,
          request_id: reqId,
          portal_saved: !localErr,
          crm_synced: !rpcErr,
          ms: duration,
        }, { headers: corsHeaders });
      }
      
      case 'shortlist_remove': {
        const reqId = genRequestId();
        const logCtx: RpcLogContext = { requestId: reqId, action: 'shortlist_remove', authUserId };
        
        const programId = body.program_id;
        const source = body.source || 'portal';
        
        if (!programId || typeof programId !== 'string' || programId.trim() === '') {
          console.log(`[student-portal-api] ${reqId} ❌ Missing program_id`);
          return Response.json({ 
            ok: false, error: 'program_id required', error_code: 'MISSING_ID',
            request_id: reqId 
          }, { headers: corsHeaders });
        }
        
        console.log(`[student-portal-api] ${reqId} action=shortlist_remove program=${safeId(programId)} auth=${safeId(authUserId)}`);
        
        // 1) Resolve CRM customer ID
        let crmCustomerId: string | null = null;
        const { data: mapping } = await portalAdmin
          .from('portal_customer_map')
          .select('crm_customer_id')
          .eq('portal_auth_user_id', authUserId)
          .maybeSingle();
        
        if (mapping?.crm_customer_id) {
          crmCustomerId = mapping.crm_customer_id;
        } else {
          const { data: userData } = await portalAdmin.auth.admin.getUserById(authUserId!);
          const meta = (userData?.user?.user_metadata ?? {}) as Record<string, unknown>;
          crmCustomerId = (meta.crm_customer_id as string) || (meta.customer_id as string) || null;
        }
        
        // 2) Call CRM RPC if customer is mapped
        let crmSynced = false;
        let duration = 0;
        
        if (crmCustomerId) {
          const rpcName = 'rpc_shortlist_remove_v1';
          logRpcStart(logCtx, rpcName, ['p_auth_user_id', 'p_customer_id', 'p_program_id', 'p_source']);
          const t0 = Date.now();
          
          console.log(`[shortlist_remove] 🔑 Contract v9: p_auth_user_id=${safeId(authUserId)} p_customer_id=${safeId(crmCustomerId)} program=${safeId(programId)}`);
          const { data: rpcData, error: rpcErr } = await crmClient.rpc(rpcName, {
            p_auth_user_id: authUserId,
            p_customer_id: crmCustomerId,
            p_program_id: programId,
            p_source: source,
          });
          
          duration = Date.now() - t0;
          logRpcEnd(logCtx, rpcName, !rpcErr, duration, rpcErr?.message);
          
          const rpcResult = rpcData as { ok?: boolean; error_code?: string; message?: string } | null;
          const isLocked = rpcResult?.error_code === 'LOCKED' || 
                           rpcErr?.message?.includes('LOCKED') ||
                           rpcErr?.message?.includes('cannot remove');
          
          if (isLocked) {
            console.log(`[student-portal-api] ${reqId} 🔒 Program is LOCKED`);
            return Response.json({
              ok: false, request_id: reqId, error_code: 'LOCKED',
              message: 'لا يمكن حذف هذا البرنامج بعد التقديم أو الدفع',
              ms: duration,
            }, { headers: corsHeaders });
          }
          
          if (rpcErr) {
            console.error(`[student-portal-api] ${reqId} ❌ CRM remove failed:`, rpcErr.message);
          } else {
            crmSynced = true;
            console.log(`[student-portal-api] ${reqId} ✅ CRM shortlist_remove synced`);
          }
        } else {
          console.warn(`[student-portal-api] ${reqId} ⚠️ No CRM customer mapped, removing from Portal only`);
        }
        
        // 3) Delete from Portal cache
        const { error: localErr } = await portalAdmin
          .from('portal_shortlist')
          .delete()
          .eq('auth_user_id', authUserId)
          .eq('program_id', programId);
        
        if (localErr) {
          console.warn(`[student-portal-api] ${reqId} Portal delete warning:`, localErr.message);
        } else {
          console.log(`[student-portal-api] ${reqId} ✅ Portal cache cleared`);
        }
        
        return Response.json({
          ok: true,
          removed: true,
          request_id: reqId,
          crm_synced: crmSynced,
          portal_deleted: !localErr,
          ms: duration,
        }, { headers: corsHeaders });
      }

      case 'add_file':
        console.log('[student-portal-api] Calling rpc_add_customer_file_from_portal with full metadata');
        result = await crmClient.rpc('rpc_add_customer_file_from_portal', {
          p_auth_user_id: authUserId,
          p_file_kind: body.file_kind,
          p_file_url: body.file_url,
          p_file_name: body.file_name,
          p_description: body.description || null,
          // ✅ NEW: Full storage metadata
          p_mime_type: body.mime_type || null,
          p_size_bytes: body.size_bytes || null,
          p_storage_bucket: body.storage_bucket || null,
          p_storage_path: body.storage_path || null,
        });
        break;

      case 'get_shortlist': {
        console.log('[student-portal-api] Getting shortlist - CRM first, Portal fallback');
        
        // ✅ v8.2: Resolve CRM customer ID using shared resolver (same as write path)
        const { crmCustomerId: gsCustomerId, source: gsSource } = await resolveCrmCustomerId(portalAdmin, authUserId!);
        console.log(`[get_shortlist] Identity resolved: crm=${gsCustomerId?.slice(0,12) ?? 'null'} source=${gsSource} portal_auth=${authUserId?.slice(0,12)}`);
        
        let rows: any[] = [];
        let source = 'crm';
        
        // ==========================================
        // 1) PRIMARY: Try CRM RPC first (State) — v9: p_customer_id for identity
        // ==========================================
        const crmIdForQuery = gsCustomerId || authUserId;
        console.log(`[get_shortlist] 🔑 Contract v9: p_auth_user_id=${safeId(authUserId)} p_customer_id=${safeId(crmIdForQuery)}`);
        const { data: crmRows, error: crmErr } = await crmClient.rpc('rpc_get_student_shortlist', {
          p_auth_user_id: authUserId,
          p_customer_id: crmIdForQuery,
        });

        // ✅ تحسين 1: التحقق من Array.isArray
        const isCrmArray = Array.isArray(crmRows);
        
        // ✅ P0 Evidence: Log CRM raw data BEFORE filtering
        if (isCrmArray) {
          const statusHistogram = (crmRows as any[]).reduce((acc, r) => {
            const key = String(r.status ?? 'NULL');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const sample10 = (crmRows as any[]).slice(0, 10).map(r => ({
            pid: (r.program_ref_id || r.program_id || '').slice(0, 12),
            status: r.status ?? 'NULL',
            created: r.created_at ? r.created_at.slice(0, 10) : null,
          }));
          
          console.log('[get_shortlist] CRM_SHORTLIST_EVIDENCE:', JSON.stringify({
            crmRows_len: crmRows.length,
            status_histogram: statusHistogram,
            sample_first10: sample10,
          }));
        } else {
          console.log('[get_shortlist] CRM_SHORTLIST_EVIDENCE:', JSON.stringify({
            crmRows_len: 0,
            crmRows_type: typeof crmRows,
            crmRows_null: crmRows === null,
            crmErr_code: crmErr?.code,
            crmErr_msg: crmErr?.message,
          }));
        }
        
        // ✅ تحسين 5: فلترة بـ status === 'shortlisted' فقط
        const crmFiltered = isCrmArray 
          ? (crmRows as any[]).filter((r: any) => r.status === 'shortlisted')
          : [];
        
        // ✅ P0 Evidence: Log filtered count
        console.log('[get_shortlist] CRM_FILTERED_COUNT:', crmFiltered.length);

        if (!crmErr && crmFiltered.length > 0) {
          // CRM نجح - نستخدم بياناته المفلترة
          rows = crmFiltered;
          console.log('[student-portal-api] CRM returned', rows.length, 'shortlisted rows');
        } else {
          // ==========================================
          // 2) FALLBACK: Read from Portal user_shortlists
          // ==========================================
          if (crmErr) {
            console.warn('[student-portal-api] CRM RPC failed, falling back to Portal:', crmErr.code, crmErr.message);
          } else {
            console.log('[student-portal-api] CRM returned empty/no-shortlisted, checking Portal fallback');
          }
          
          source = 'portal_fallback';
          
          const { data: portalRows, error: portalErr } = await portalAdmin
            .from('portal_shortlist')
            .select('program_id, created_at')
            .eq('auth_user_id', authUserId);
          
          if (portalErr) {
            console.error('[student-portal-api] Portal fallback also failed:', portalErr);
            return Response.json({ 
              ok: true, 
              data: { shortlisted_programs: [] }
            }, { headers: corsHeaders });
          }
          
          rows = (portalRows ?? []).map(r => ({
            program_id: r.program_id,
            created_at: r.created_at,
            status: 'shortlisted',
          }));
          
          console.log('[student-portal-api] Portal fallback returned', rows.length, 'rows');
          
          // ==========================================
          // 3) BACKFILL: Sync Portal data to CRM (with timeout)
          // ==========================================
          // ✅ تحسين 3: Backfill فقط عند أخطاء محددة
          const shouldBackfill = crmErr?.code === 'PGRST202' || crmErr?.code === 'PGRST116' || !crmErr;
          
          if (rows.length > 0 && shouldBackfill) {
            const backfillIds = rows.map(r => r.program_id);
            console.log('[student-portal-api] Backfilling CRM with', backfillIds.length, 'programs');
            
            // ✅ تحسين 2: Timeout بدل fire-and-forget
            try {
              const backfillPromise = crmClient.rpc('rpc_sync_student_shortlist_from_portal', {
                p_auth_user_id: authUserId,
                p_customer_id: gsCustomerId || authUserId,
                p_program_ids: backfillIds,
                p_source: 'portal_backfill_auto',
              });
              await Promise.race([
                backfillPromise,
                new Promise((_, rej) => setTimeout(() => rej(new Error('backfill_timeout')), 800)),
              ]);
              console.log('[student-portal-api] Backfill to CRM succeeded');
            } catch (e: any) {
              console.warn('[student-portal-api] Backfill skipped/timeout:', e.message);
            }
          }
        }
        
        // ==========================================
        // 4) Return empty if no data from any source
        // ==========================================
        const programIds = rows.map((r: any) => r.program_id).filter(Boolean);
        
        if (programIds.length === 0) {
          return Response.json({ 
            ok: true, 
            data: { shortlisted_programs: [] }
          }, { headers: corsHeaders });
        }

        // ==========================================
        // 5) Enrich from Portal KB (catalog)
        // ✅ Only query existing columns in vw_program_search
        // ==========================================
        // ✅ P0-A FIX: Use 'languages' column (not 'language') + graceful fallback on error
        let kbPrograms: any[] = [];
        try {
          const { data: kbData, error: kbErr } = await portalAdmin
            .from('vw_program_search')
            .select(`
              program_id, program_name,
              duration_months, languages,
              university_id, university_name, city, logo_url,
              fees_yearly,
              country_id, country_slug, country_name,
              degree_id, degree_name, degree_slug
            `)
            .in('program_id', programIds);

          if (kbErr) {
            // ✅ P0-A: Log error but DON'T fail - return rows as-is with minimal enrichment
            console.error('[student-portal-api] KB enrich failed (continuing with fallback):', kbErr);
          } else {
            kbPrograms = kbData ?? [];
          }
        } catch (e) {
          console.error('[student-portal-api] KB enrich exception (continuing with fallback):', e);
        }
        
        console.log('[get_shortlist] ✅ KB enriched', kbPrograms.length, 'of', programIds.length, 'programs');
        
        console.log('[get_shortlist] ✅ KB enriched', kbPrograms?.length ?? 0, 'of', programIds.length, 'programs');

        // ==========================================
        // 6) Merge: State + KB details + ensure program_name exists
        // ==========================================
        const kbMap = new Map((kbPrograms ?? []).map((p: any) => [p.program_id, p]));
        const enrichedPrograms = rows.map((r: any) => {
          const kb = kbMap.get(r.program_id) ?? {};
          
          // ✅ P0 FIX: Ensure program_name is ALWAYS present
          const programName = kb.program_name || r.program_name || r.snapshot?.program_name || null;
          const universityName = kb.university_name || r.university_name || r.snapshot?.university_name || null;
          
          // ✅ Log missing KB entries for debugging
          if (!kb.program_id) {
            console.warn('[get_shortlist] ⚠️ Program not in KB:', r.program_id);
          }
          
          return {
            ...r,
            ...kb,
            // ✅ Guarantee these fields are present for UI
            program_name: programName,
            university_name: universityName,
            // ✅ Add country_code for services filtering
            country_code: kb.country_slug?.toUpperCase() ?? r.country_code ?? null,
          };
        });
        
        console.log('[student-portal-api] Returning', enrichedPrograms.length, 'enriched programs from:', source);
        console.log('[get_shortlist] Sample enriched:', enrichedPrograms[0] ? {
          program_id: enrichedPrograms[0].program_id,
          program_name: enrichedPrograms[0].program_name,
          university_name: enrichedPrograms[0].university_name,
        } : 'empty');

        return Response.json({ 
          ok: true, 
          data: { shortlisted_programs: enrichedPrograms },
          source
        }, { headers: corsHeaders });
      }

      case 'get_documents':
        console.log('[student-portal-api] Calling rpc_get_student_documents_list');
        result = await crmClient.rpc('rpc_get_student_documents_list', {
          p_auth_user_id: authUserId,
        });
        // Handle missing RPC gracefully
        if (result.error) {
          console.error('[student-portal-api] get_documents RPC not available:', result.error);
          return Response.json({ 
            ok: false, 
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'هذه الميزة غير مفعلة حالياً'
          }, { status: 200, headers: corsHeaders });
        }
        break;

      case 'list_files': {
        // ✅ NEW: CRM is source of truth for files list
        console.log('[student-portal-api] Calling rpc_portal_list_files');
        result = await crmClient.rpc('rpc_portal_list_files', {
          p_auth_user_id: authUserId,
        });
        // Handle missing RPC gracefully
        if (result.error) {
          console.error('[student-portal-api] list_files RPC not available:', result.error);
          return Response.json({ 
            ok: false, 
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'هذه الميزة غير مفعلة حالياً'
          }, { status: 200, headers: corsHeaders });
        }
        // Return files array directly
        return Response.json({ 
          ok: true, 
          files: result.data ?? [] 
        }, { headers: corsHeaders });
      }

      case 'sign_file': {
        // ✅ On-demand signed URL generation with OWNERSHIP VERIFICATION
        // Supports both: (storage_bucket + storage_path) OR (file_id → query CRM for storage info)
        console.log('[student-portal-api] Generating signed URL for file');
        let { storage_bucket, storage_path } = body;
        const fileId = body.file_id as string | undefined;
        const paymentId = body.payment_id as string | undefined;
        
        // ✅ If file_id provided but no storage info, query CRM
        if (fileId && (!storage_bucket || !storage_path)) {
          console.log('[student-portal-api] file_id provided, querying CRM for storage info:', fileId);
          
          const { data: fileInfo, error: fileErr } = await crmClient.rpc('rpc_get_file_storage_info', {
            p_file_id: fileId,
            p_auth_user_id: authUserId,
          });
          
          if (fileErr || !fileInfo) {
            console.error('[student-portal-api] rpc_get_file_storage_info error:', fileErr);
            return Response.json({ 
              ok: false, 
              error: 'file_not_found',
              message: 'الملف غير موجود'
            }, { status: 200, headers: corsHeaders });
          }
          
          storage_bucket = fileInfo.storage_bucket;
          storage_path = fileInfo.storage_path;
          console.log('[student-portal-api] Got storage info from CRM:', { storage_bucket, storage_path });
        }
        
        // ✅ OWNERSHIP VERIFICATION: If storage_bucket + storage_path provided directly (Portal-only V1)
        // Verify this user owns a payment with this evidence file
        if (storage_bucket && storage_path && !fileId) {
          console.log('[student-portal-api] 🔒 Verifying file ownership for Portal payment evidence');
          
          const { data: ownershipCheck, error: ownershipErr } = await portalAdmin
            .from('portal_payments_v1')
            .select('id')
            .eq('auth_user_id', authUserId)
            .eq('evidence_storage_bucket', storage_bucket)
            .eq('evidence_storage_path', storage_path)
            .maybeSingle();
          
          if (ownershipErr || !ownershipCheck) {
            console.error('[student-portal-api] ⛔ Ownership verification failed:', ownershipErr);
            return Response.json({ 
              ok: false, 
              error: 'access_denied',
              message: 'ليس لديك صلاحية لهذا الملف'
            }, { status: 403, headers: corsHeaders });
          }
          
          console.log('[student-portal-api] ✅ Ownership verified for payment:', ownershipCheck.id);
        }
        
        if (!storage_bucket || !storage_path) {
          return Response.json({ 
            ok: false, 
            error: 'missing_storage',
            message: 'معلومات التخزين مفقودة'
          }, { status: 400, headers: corsHeaders });
        }

        // Use Portal's storage client (not CRM) - files are stored in Portal
        // Hard 8s timeout prevents IDLE_TIMEOUT (150s) when storage stalls / object missing
        const signPromise = portalAdmin.storage
          .from(storage_bucket)
          .createSignedUrl(storage_path, 60 * 10); // 10 minutes

        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: { message: 'SIGN_TIMEOUT_8S' } }), 8000)
        );

        const { data: signedData, error: signError } = await Promise.race([signPromise, timeoutPromise]) as any;

        if (signError || !signedData?.signedUrl) {
          console.error('[student-portal-api] Sign URL error:', signError);
          return Response.json({ 
            ok: false, 
            error: 'sign_failed',
            message: 'فشل إنشاء رابط التحميل',
            detail: signError?.message
          }, { status: 200, headers: corsHeaders });
        }

        return Response.json({ 
          ok: true, 
          signed_url: signedData.signedUrl 
        }, { headers: corsHeaders });
      }

      case 'get_documents_signed': {
        console.log('[student-portal-api] Listing user files with signed URLs (using user token)');
        
        // Use user token with anon key (not SERVICE_ROLE) to respect RLS
        const authHeader = req.headers.get("Authorization") ?? "";
        const userStorageClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        
        // Path matches RLS: users/${authUserId}/...
        const userFolder = `users/${authUserId}`;
        
        // First: list category folders
        const { data: folders, error: listError } = await userStorageClient.storage
          .from('student-docs')
          .list(userFolder, { limit: 50 });
        
        if (listError) {
          console.error('[student-portal-api] Storage list error:', listError);
          return Response.json({ 
            ok: false, 
            error: 'STORAGE_ERROR',
            message: 'فشل قراءة الملفات'
          }, { status: 200, headers: corsHeaders });
        }
        
        // Second: list files inside each category folder
        interface DocWithSignedUrl {
          id: string;
          file_name: string;
          file_type: string | null;
          file_size: number | null;
          file_path: string;
          storage_path: string;
          document_category: string;
          status: string;
          admin_notes: string | null;
          uploaded_at: string;
          signed_url: string | null;
        }
        
        const allDocs: DocWithSignedUrl[] = [];
        
        for (const folder of (folders || [])) {
          // Skip files at root level (we want folders only - folders don't have 'id')
          if (folder.id) continue;
          
          const categoryPath = `${userFolder}/${folder.name}`;
          const { data: categoryFiles } = await userStorageClient.storage
            .from('student-docs')
            .list(categoryPath, { limit: 100 });
          
          for (const file of (categoryFiles || [])) {
            const filePath = `${categoryPath}/${file.name}`;
            const { data: signedData } = await userStorageClient.storage
              .from('student-docs')
              .createSignedUrl(filePath, 1800); // 30 minutes
            
            allDocs.push({
              id: file.id || file.name,
              file_name: file.name,
              file_type: file.metadata?.mimetype || null,
              file_size: file.metadata?.size || null,
              file_path: filePath,
              storage_path: filePath,
              document_category: folder.name,
              status: 'uploaded',
              admin_notes: null,
              uploaded_at: file.created_at || new Date().toISOString(),
              signed_url: signedData?.signedUrl || null,
            });
          }
        }
        
        console.log(`[student-portal-api] Found ${allDocs.length} files for user`);
        result = { data: allDocs, error: null };
        break;
      }

      // ✅ CRM PROXY: get_payments → CRM RPC with Portal V1 fallback
      case 'get_payments': {
        console.log('[student-portal-api] 💳 get_payments → calling CRM rpc_get_student_payments_list');
        
        // Resolve CRM auth_user_id (may differ from Portal auth user ID)
        const crmAuthForPayments = await resolveCrmAuthUserId(crmClient, portalAdmin, authUserId!);
        
        // Try CRM first
        const { data: crmPayments, error: crmErr } = await crmClient.rpc('rpc_get_student_payments_list', {
          p_auth_user_id: crmAuthForPayments,
        });
        
        if (!crmErr && Array.isArray(crmPayments) && crmPayments.length > 0) {
          console.log('[student-portal-api] ✅ CRM payments:', crmPayments.length);
          return Response.json({ ok: true, data: crmPayments }, { headers: corsHeaders });
        }
        
        // Fallback to Portal DB V1
        console.log('[student-portal-api] ⚠️ CRM unavailable, falling back to Portal DB V1');
        const { data: pays, error: paysErr } = await portalAdmin
          .from('portal_payments_v1')
          .select('*')
          .eq('auth_user_id', authUserId)
          .order('created_at', { ascending: false });
        
        if (paysErr) {
          console.error('[student-portal-api] ❌ Portal payments query error:', paysErr);
          return Response.json({ 
            ok: false, 
            error: 'QUERY_FAILED',
            message: paysErr.message
          }, { headers: corsHeaders });
        }
        
        // Transform to match StudentPayment interface
        const transformedPayments = (pays || []).map(p => ({
          id: p.id,
          amount: p.amount_required,
          amount_required: p.amount_required,
          currency: p.currency,
          status: p.status,
          payment_date: p.created_at,
          reference: null,
          description: 'رسوم الخدمات',
          payment_method: null,
          due_date: null,
          service_type: 'application_services',
          receipt_no: p.receipt_no,
          storage_bucket: p.evidence_storage_bucket,
          storage_path: p.evidence_storage_path,
          evidence_file_id: p.evidence_file_id,
          rejection_reason: p.rejection_reason,
          rejected_at: p.rejected_at,
          application_id: p.application_id,
        }));
        
        console.log('[student-portal-api] ✅ Portal payments (fallback):', transformedPayments.length);
        return Response.json({ ok: true, data: transformedPayments }, { headers: corsHeaders });
      }

      // ===== Payment System: List Payment Channels =====
      case 'list_payment_channels': {
        console.log('[student-portal-api] 📋 Fetching payment channels');
        result = await crmClient.rpc('rpc_list_active_payment_channels', {
          p_country_scope: body.country_code || null,
        });
        
        if (result.error) {
          console.error('[student-portal-api] list_payment_channels error:', result.error);
          return Response.json({ 
            ok: false, 
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'قنوات الدفع غير متاحة حالياً'
          }, { status: 200, headers: corsHeaders });
        }
        
        return Response.json({ 
          ok: true, 
          data: result.data || []
        }, { headers: corsHeaders });
      }

      // ✅ CRM PROXY: submit_payment_proof → CRM RPC with Portal V1 fallback
      case 'submit_payment_proof': {
        const { payment_id, evidence_file_id, evidence_storage_bucket, evidence_storage_path, payment_method, payment_reference } = body;
        
        if (!payment_id) {
          return Response.json({ 
            ok: false, 
            error: 'MISSING_PARAMS',
            message: 'payment_id مطلوب'
          }, { status: 400, headers: corsHeaders });
        }
        
        console.log('[student-portal-api] 📤 submit_payment_proof → calling CRM rpc_submit_payment_proof_from_portal');
        
        // Try CRM first
        const { data: crmResult, error: crmErr } = await crmClient.rpc('rpc_submit_payment_proof_from_portal', {
          p_auth_user_id: authUserId,
          p_payment_id: payment_id,
          p_evidence_file_id: evidence_file_id || null,
          p_evidence_storage_bucket: evidence_storage_bucket || null,
          p_evidence_storage_path: evidence_storage_path || null,
          p_payment_method: payment_method || null,
          p_payment_reference: payment_reference || null,
        });
        
        if (!crmErr && crmResult) {
          console.log('[student-portal-api] ✅ CRM proof submitted:', crmResult);
          return Response.json({ ok: true, ...crmResult }, { headers: corsHeaders });
        }
        
        // Fallback to Portal DB V1
        console.log('[student-portal-api] ⚠️ CRM unavailable, falling back to Portal DB V1');
        const updateData: Record<string, unknown> = {
          status: 'proof_received',
          rejection_reason: null,
          rejected_at: null,
        };
        
        if (evidence_file_id) updateData.evidence_file_id = evidence_file_id;
        if (evidence_storage_bucket) updateData.evidence_storage_bucket = evidence_storage_bucket;
        if (evidence_storage_path) updateData.evidence_storage_path = evidence_storage_path;
        if (payment_method) updateData.payment_method = payment_method;
        if (payment_reference) updateData.reference = payment_reference;
        
        const { error: updateError } = await portalAdmin
          .from('portal_payments_v1')
          .update(updateData)
          .eq('id', payment_id)
          .eq('auth_user_id', authUserId);
        
        if (updateError) {
          console.error('[student-portal-api] submit_payment_proof error:', updateError);
          return Response.json({ 
            ok: false, 
            error: 'SUBMIT_FAILED',
            message: 'فشل إرسال الإثبات'
          }, { status: 200, headers: corsHeaders });
        }
        
        console.log('[student-portal-api] ✅ Portal proof submitted (fallback)');
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ===== Payment System: Get Payment Receipt =====
      // ✅ تستدعي CRM Edge Function `generate-payment-receipt` بدلاً من RPC
      case 'get_payment_receipt': {
        const { payment_id } = body;
        
        if (!payment_id) {
          return Response.json({ 
            ok: false, 
            error: 'MISSING_PARAMS',
            message: 'payment_id مطلوب'
          }, { status: 400, headers: corsHeaders });
        }
        
        console.log('[student-portal-api] 🧾 Fetching receipt via CRM Edge Function for:', payment_id);
        
        // ✅ استدعاء CRM Edge Function مباشرة مع JWT
        const CRM_FUNCTIONS_URL = Deno.env.get("CRM_FUNCTIONS_URL") || `${CRM_SUPABASE_URL}/functions/v1`;
        const CRM_API_KEY = Deno.env.get("CRM_API_KEY") || CRM_SERVICE_ROLE_KEY;
        
        try {
          const receiptResponse = await fetch(`${CRM_FUNCTIONS_URL}/generate-payment-receipt`, {
            method: 'POST',
            headers: buildCrmProxyHeaders({
              apiKey: CRM_API_KEY,
              jwt: CRM_API_KEY,
              traceId: req.headers.get('x-client-trace-id') || genRequestId(),
              proxySecret: Deno.env.get('PORTAL_PROXY_SECRET'),
            }),
            body: JSON.stringify({
              payment_id,
              auth_user_id: authUserId,
            }),
          });
          
          if (!receiptResponse.ok) {
            const errorText = await receiptResponse.text();
            console.error('[student-portal-api] CRM receipt error:', errorText);
            return Response.json({ 
              ok: false, 
              error: 'RECEIPT_NOT_FOUND',
              message: 'الإيصال غير متاح'
            }, { status: 200, headers: corsHeaders });
          }
          
          // CRM returns HTML directly
          const contentType = receiptResponse.headers.get('content-type') || '';
          
          if (contentType.includes('text/html')) {
            const html = await receiptResponse.text();
            return Response.json({ 
              ok: true, 
              data: { html }
            }, { headers: corsHeaders });
          } else {
            // JSON response
            const jsonData = await receiptResponse.json();
            return Response.json({ 
              ok: true, 
              data: jsonData
            }, { headers: corsHeaders });
          }
        } catch (fetchError) {
          console.error('[student-portal-api] CRM fetch error:', fetchError);
          return Response.json({ 
            ok: false, 
            error: 'RECEIPT_FETCH_FAILED',
            message: 'فشل الاتصال بخادم الإيصالات'
          }, { status: 200, headers: corsHeaders });
        }
      }

      // ✅ CRM PROXY: get_applications → CRM RPC with Portal V1 fallback
      case 'get_applications': {
        console.log('[student-portal-api] 📋 get_applications → calling CRM rpc_get_student_applications_v1');
        
        // Try CRM first
        const { data: crmApps, error: crmErr } = await crmClient.rpc('rpc_get_student_applications_v1', {
          p_auth_user_id: authUserId,
        });
        
        if (!crmErr && Array.isArray(crmApps) && crmApps.length > 0) {
          console.log('[student-portal-api] ✅ CRM applications:', crmApps.length);
          return Response.json({ ok: true, data: crmApps }, { headers: corsHeaders });
        }
        
        // Fallback to Portal DB V1 VIEW
        console.log('[student-portal-api] ⚠️ CRM unavailable, falling back to Portal DB V1');
        const { data: apps, error: appsErr } = await portalAdmin
          .from('vw_portal_applications_v1')
          .select('*')
          .eq('auth_user_id', authUserId)
          .order('created_at', { ascending: false });
        
        if (appsErr) {
          console.error('[student-portal-api] ❌ Portal apps query error:', appsErr);
          return Response.json({ 
            ok: false, 
            error: 'QUERY_FAILED',
            message: appsErr.message
          }, { headers: corsHeaders });
        }
        
        console.log('[student-portal-api] ✅ Portal apps (fallback):', apps?.length || 0);
        return Response.json({ ok: true, data: apps || [] }, { headers: corsHeaders });
      }

      // ✅ NEW: Card Checkout Session via CRM
      case 'create_card_checkout_session': {
        const { payment_id, success_url, cancel_url } = body as {
          payment_id?: string;
          success_url?: string;
          cancel_url?: string;
        };
        
        if (!payment_id) {
          return Response.json({ 
            ok: false, 
            error: 'MISSING_PARAMS',
            message: 'payment_id مطلوب'
          }, { status: 400, headers: corsHeaders });
        }
        
        console.log('[student-portal-api] 💳 create_card_checkout_session → calling CRM crm-pay-create-checkout');
        
        const CRM_FUNCTIONS_URL = Deno.env.get("CRM_FUNCTIONS_URL") || `${CRM_SUPABASE_URL}/functions/v1`;
        
        // ✅ SECURITY: Pass JWT to CRM, CRM validates ownership
        const userJwt = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
        
        try {
          const checkoutResponse = await fetch(`${CRM_FUNCTIONS_URL}/crm-pay-create-checkout`, {
            method: 'POST',
            headers: buildCrmProxyHeaders({
              jwt: userJwt,
              apiKey: Deno.env.get('CRM_API_KEY') || undefined,
              traceId: req.headers.get('x-client-trace-id') || genRequestId(),
              proxySecret: Deno.env.get('PORTAL_PROXY_SECRET'),
            }),
            body: JSON.stringify({
              payment_id,
              success_url: success_url || `${req.headers.get('origin') || ''}/account?tab=payments&paid=1`,
              cancel_url: cancel_url || `${req.headers.get('origin') || ''}/account?tab=payments&canceled=1`,
            }),
          });
          
          if (!checkoutResponse.ok) {
            const errorText = await checkoutResponse.text();
            console.error('[student-portal-api] CRM checkout error:', errorText);
            return Response.json({ 
              ok: false, 
              error: 'CHECKOUT_UNAVAILABLE',
              message: 'الدفع بالبطاقة غير متاح حالياً'
            }, { headers: corsHeaders });
          }
          
          const checkoutData = await checkoutResponse.json();
          console.log('[student-portal-api] ✅ Checkout URL received');
          
          return Response.json({ 
            ok: true, 
            checkout_url: checkoutData.checkout_url || checkoutData.url,
            session_id: checkoutData.session_id
          }, { headers: corsHeaders });
          
        } catch (fetchError) {
          console.error('[student-portal-api] CRM checkout fetch error:', fetchError);
          return Response.json({ 
            ok: false, 
            error: 'CHECKOUT_FETCH_FAILED',
            message: 'فشل الاتصال بخادم الدفع'
          }, { headers: corsHeaders });
        }
      }

      case 'get_events':
        console.log('[student-portal-api] Calling rpc_get_student_portal_events');
        result = await crmClient.rpc('rpc_get_student_portal_events', {
          p_auth_user_id: authUserId,
          p_since: body.since || null,
        });
        // Handle missing RPC gracefully
        if (result.error) {
          console.error('[student-portal-api] get_events RPC not available:', result.error);
          return Response.json({ 
            ok: false, 
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'الإشعارات غير مفعلة حالياً'
          }, { status: 200, headers: corsHeaders });
        }
        break;

      case 'mark_event_read':
        console.log('[student-portal-api] Calling rpc_mark_student_event_read');
        result = await crmClient.rpc('rpc_mark_student_event_read', {
          p_auth_user_id: authUserId,
          p_event_id: body.event_id,
        });
        // Handle missing RPC gracefully
        if (result.error) {
          console.error('[student-portal-api] mark_event_read RPC not available:', result.error);
          return Response.json({ 
            ok: false, 
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'هذه الميزة غير مفعلة حالياً'
          }, { status: 200, headers: corsHeaders });
        }
        break;

      case 'add_note':
        console.log('[student-portal-api] Calling rpc_add_student_note_from_portal');
        result = await crmClient.rpc('rpc_add_student_note_from_portal', {
          p_auth_user_id: authUserId,
          p_note: body.note || '',
        });
        // Handle missing RPC gracefully
        if (result.error) {
          console.error('[student-portal-api] mark_event_read RPC not available:', result.error);
          return Response.json({ 
            ok: false, 
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'هذه الميزة غير مفعلة حالياً'
          }, { status: 200, headers: corsHeaders });
        }
        break;

      case 'list_wallet_ledger': {
        // ✅ Wallet ledger from CRM - uses flat body params
        console.log('[student-portal-api] Calling rpc_wallet_list_ledger');
        const currency = body.currency || 'USD';
        const limit = body.limit || 20;
        const offset = body.offset || 0;
        
        result = await crmClient.rpc('rpc_wallet_list_ledger', {
          p_auth_user_id: authUserId,
          p_currency: currency,
          p_limit: limit,
          p_offset: offset,
        });
        
        if (result.error) {
          console.error('[student-portal-api] list_wallet_ledger RPC error:', result.error);
          return Response.json({ 
            ok: false, 
            error: 'FEATURE_NOT_AVAILABLE',
            message: 'المحفظة غير مفعلة حالياً'
          }, { status: 200, headers: corsHeaders });
        }
        
        // Return CRM shape directly
        const walletData = result.data as { available?: number; pending?: number; entries?: unknown[] };
        return Response.json({ 
          ok: true, 
          available: walletData.available ?? 0,
          pending: walletData.pending ?? 0,
          entries: walletData.entries ?? []
        }, { headers: corsHeaders });
      }

      case 'check_link_status': {
        console.log('[student-portal-api] 🔎 check_link_status using unified helper');
        const linkRes = await fetchCrmProfileByAuthUserId(crmClient, authUserId!);
        
        if (linkRes.ok && linkRes.linked && linkRes.profile) {
          const profile = linkRes.profile as Record<string, unknown>;
          const customerId = (profile.customer_id ?? profile.id) as string | null;

          if (!customerId) {
            console.error('[student-portal-api] ⚠️ Profile found but no customer_id:', profile);
            return Response.json(
              { ok: true, linked: false, error_code: 'missing_customer_id', error: 'missing_customer_id' },
              { headers: corsHeaders }
            );
          }

          // 📋 تشخيص: تحذير إذا كان customer_id مختلف عن id
          if (profile.customer_id && profile.id && profile.customer_id !== profile.id) {
            console.warn('[student-portal-api] ⚠️ customer_id mismatch detected:', { 
              customer_id: profile.customer_id, 
              id: profile.id 
            });
          }

          return Response.json({ 
            ok: true, 
            linked: true, 
            customer_id: customerId,
            customer_name: (profile.full_name as string) ?? null
          }, { headers: corsHeaders });
          
        } else {
          const code = linkRes.error_code ?? 'no_linked_customer';
          return Response.json({ 
            ok: true, 
            linked: false, 
            error_code: code, 
            error: code
          }, { headers: corsHeaders });
        }
      }

      case 'search_programs': {
        // ============= KILL-SWITCH: Emergency Disable =============
        const PORTAL_SEARCH_DISABLED = Deno.env.get('PORTAL_SEARCH_DISABLED') === 'true';
        if (PORTAL_SEARCH_DISABLED) {
          console.warn('[student-portal-api] ⚠️ KILL-SWITCH ACTIVE: search_programs disabled');
          return new Response(
            JSON.stringify({
              ok: false,
              error_code: 'service_unavailable',
              message: 'البحث متوقف مؤقتًا للصيانة',
              items: [],
              count: 0,
            }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // ✅ UNIFIED SOT: Using vw_program_search_api_v3_final (Phase 1 Unification)
        // ============= EVIDENCE PACK: 4 Truth Logs with same request_id =============
        const searchRequestId = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        
        console.log('[student-portal-api] 🔍 Searching Portal KB vw_program_search_api_v3_final (UNIFIED SOT)');
        
        // ============= CONTRACT V2 GUARDRAIL (#8.1 - 16+4 Alignment with Oreska) =============
        // SECURITY: Accept only the 16 canonical filter keys + pagination
        // Reject any locked/internal keys to prevent client-side injection
        
        // ✅ 16 CANONICAL FILTER KEYS (User/CRM-controlled)
        // These are the ONLY filter keys that Oreska/CRM can send
        const CANONICAL_FILTER_KEYS_16 = new Set([
          'country_code',              // 1. Country code (e.g., 'RU', 'CN')
          'city',                      // 2. City name
          'degree_slug',               // 3. Degree level slug (e.g., 'bachelor', 'master')
          'discipline_slug',           // 4. Field of study
          'study_mode',                // 5. Enum: on_campus, online, hybrid
          'instruction_languages',     // 6. Array of language codes
          'tuition_usd_min',           // 7. Minimum tuition (USD/year)
          'tuition_usd_max',           // 8. Maximum tuition (USD/year)
          'duration_months_max',       // 9. Maximum program duration
          'has_dorm',                  // 10. Boolean: dormitory available
          'dorm_price_monthly_usd_max', // 11. Max dorm price
          'monthly_living_usd_max',    // 12. Max living cost
          'scholarship_available',     // 13. Boolean: scholarship offered
          'scholarship_type',          // 14. Scholarship type
          'intake_months',             // 15. Array of intake months (1-12)
          'deadline_before',           // 16. Deadline date filter
        ]);
        
        // ✅ ALLOWED ALIASES (Legacy compatibility - normalized to canonical keys)
        const ALLOWED_ALIASES = new Set([
          'action',                    // Required action parameter
          'keyword', 'q', 'query', 'subject',  // → keyword (text search)
          'country_slug', 'country',   // → country_code aliases
          'degree_level', 'degree_id', 'degree',  // → degree_slug aliases
          'discipline_id', 'discipline', // → discipline_slug aliases
          'language',                  // → instruction_languages[0]
          'max_tuition', 'fees_max', 'tuition_max_year_usd',  // → tuition_usd_max aliases
          'min_tuition',               // → tuition_usd_min alias
          'limit', 'offset', 'page', 'page_size',  // paging
          // ✅ RANK10: ONLY rank_filters object allowed (keys inside are checked separately)
          'rank_filters',              // Object containing rank filters (ONLY valid location)
        ]);
        
        // ✅ 4 LOCKED KEYS (System-only - NEVER from user/CRM)
        // Sending these triggers 422 + P0 CRITICAL_GUARD_VIOLATION
        const LOCKED_KEYS_4 = new Set([
          'is_active',                 // System constant: always true
          'partner_priority',          // Internal ranking - never from user
          'do_not_offer',              // System constant: always false
          'tuition_basis',             // System constant: always 'year'
        ]);
        
        // ✅ BLOCKED KEYS (Features not yet wired - reject with 422)
        const CONTRACT_V2_BLOCKED_KEYS = new Set([
          'sort', 'sort_by',           // Sorting not exposed yet
          'enforce_eligibility', 'admission_policy', 'applicant_profile',  // Admission engine
          'partner_tier', 'partner_preferred', 'partner_star',  // Internal ranking
          'publish_status',            // System-controlled
          'instruction_language',      // Must use instruction_languages[]
        ]);
        
        // Build combined allowed set
        const ALL_ALLOWED_KEYS = new Set([
          ...CANONICAL_FILTER_KEYS_16,
          ...ALLOWED_ALIASES,
        ]);
        
        // Check for locked/blocked keys and reject with 422
        const bodyAny = body as unknown as Record<string, unknown>;
        const receivedKeys = Object.keys(bodyAny).filter(k => bodyAny[k] !== undefined && bodyAny[k] !== null && bodyAny[k] !== '');
        
        // ✅ CONTRACT V2: Check locked keys (CRITICAL_GUARD_VIOLATION → 422)
        const lockedKeysFound = receivedKeys.filter(k => LOCKED_KEYS_4.has(k));
        // ✅ CONTRACT V2: Check blocked keys (features not wired → 422)
        const blockedKeysFound = receivedKeys.filter(k => CONTRACT_V2_BLOCKED_KEYS.has(k));
        // ✅ CONTRACT V2: Unknown keys are logged but allowed (lenient for future expansion)
        const unknownKeys = receivedKeys.filter(k => !ALL_ALLOWED_KEYS.has(k) && !LOCKED_KEYS_4.has(k) && !CONTRACT_V2_BLOCKED_KEYS.has(k));
        
        // ✅ TRUTH LOG #1: FINAL_GUARD_CHECK_USER (before system augment)
        // Extract user-controlled keys only (exclude 'action')
        const userKeys = receivedKeys.filter(k => k !== 'action');
        const userFiltersJson: Record<string, unknown> = {};
        for (const k of userKeys) {
          // ✅ Preserve 0 and false values
          userFiltersJson[k] = bodyAny[k];
        }
        const hasForbidden = lockedKeysFound.length > 0;
        
        console.log(`FINAL_GUARD_CHECK_USER request_id=${searchRequestId} has_forbidden=${hasForbidden} user_keys=[${userKeys.join(',')}] user_filters_json=${JSON.stringify(userFiltersJson)}`);
        
        // ============= P0 ALERT EMIT: LOCKED Keys Attempted → 422 =============
        if (hasForbidden) {
          console.error(`CRITICAL_GUARD_VIOLATION request_id=${searchRequestId} locked_keys=[${lockedKeysFound.join(',')}]`);
          // Emit P0 Alert to system_alerts
          try {
            await portalAdmin.from('system_alerts').insert({
              level: 'critical',
              source: 'portal_guard',
              message: `LOCKED_KEYS_VIOLATION: User attempted locked keys [${lockedKeysFound.join(',')}]`,
              meta: { request_id: searchRequestId, locked_keys: lockedKeysFound, user_keys: userKeys },
              acknowledged: false,
            });
            console.log(`[student-portal-api] ✅ P0 Alert emitted for locked_keys rid=${searchRequestId}`);
          } catch (alertErr) {
            console.error('[student-portal-api] ⚠️ Failed to emit P0 alert (non-blocking):', alertErr);
          }
          // ✅ STRICT: Return 422 for locked keys
          return Response.json({
            ok: false,
            error_code: 'locked_keys_violation',
            error: 'locked_keys_violation',
            message: `المفاتيح التالية محظورة (نظام فقط): ${lockedKeysFound.join(', ')}`,
            locked_keys: lockedKeysFound,
            request_id: searchRequestId,
          }, { status: 422, headers: corsHeaders });
        }
        
        if (blockedKeysFound.length > 0) {
          console.warn('[student-portal-api] ⚠️ 422: Blocked filters rejected:', blockedKeysFound);
          // ============= P0 ALERT EMIT: Blocked Keys Rejected =============
          // Schema: level, source, message, meta, acknowledged
          try {
            await portalAdmin.from('system_alerts').insert({
              level: 'critical',
              source: 'portal_guard',
              message: `BLOCKED_KEYS_REJECTED: Request rejected with blocked keys [${blockedKeysFound.join(',')}]`,
              meta: { request_id: searchRequestId, blocked_keys: blockedKeysFound, user_keys: userKeys },
              acknowledged: false,
            });
            console.log(`[student-portal-api] ✅ P0 Alert emitted for blocked_keys rid=${searchRequestId}`);
          } catch (alertErr) {
            console.error('[student-portal-api] ⚠️ Failed to emit P0 alert (non-blocking):', alertErr);
          }
          return Response.json({
            ok: false,
            error_code: 'unsupported_filters',
            error: 'unsupported_filters',
            message: `الفلاتر التالية غير مدعومة في الموقع: ${blockedKeysFound.join(', ')}`,
            blocked_filters: blockedKeysFound,
            request_id: searchRequestId,
          }, { status: 422, headers: corsHeaders });
        }
        
        // ✅ UNKNOWN KEYS GUARD (CRITICAL FAIL-CLOSED) — Reject any unexpected root keys
        if (unknownKeys.length > 0) {
          console.error(`CRITICAL_GUARD_VIOLATION request_id=${searchRequestId} unknown_root_keys=[${unknownKeys.join(',')}]`);
          // Emit P0 Alert
          try {
            await portalAdmin.from('system_alerts').insert({
              level: 'critical',
              source: 'portal_guard',
              message: `UNKNOWN_KEYS_VIOLATION: Request contained unexpected root keys [${unknownKeys.join(',')}]`,
              meta: { request_id: searchRequestId, unknown_root_keys: unknownKeys, user_keys: userKeys },
              acknowledged: false,
            });
            console.log(`[student-portal-api] ✅ P0 Alert emitted for unknown_root_keys rid=${searchRequestId}`);
          } catch (alertErr) {
            console.error('[student-portal-api] ⚠️ Failed to emit P0 alert (non-blocking):', alertErr);
          }
          return Response.json({
            ok: false,
            error_code: 'unknown_keys_violation',
            error: 'unknown_keys_violation',
            message: 'Request contains unexpected root keys',
            details: { unknown_root_keys: unknownKeys },
            request_id: searchRequestId,
          }, { status: 422, headers: corsHeaders });
        }
        
        // ============= END CONTRACT V2 GUARDRAIL =============
        
        const limit = Math.min(Number(body.limit ?? 24), 50);
        const offset = Math.max(Number(body.offset ?? 0), 0);
        
        // ============= NORMALIZE ALL 16 CANONICAL FILTERS =============
        // Step 1: Extract and normalize all 16 keys with their aliases
        
        // 1. country_code (aliases: country_slug, country)
        const normalizedCountry = bodyAny.country_code ?? bodyAny.country_slug ?? bodyAny.country;
        
        // 2. city (direct)
        const normalizedCity = bodyAny.city;
        
        // 3. degree_slug (aliases: degree_level, degree_id, degree)
        const normalizedDegree = bodyAny.degree_slug ?? bodyAny.degree_level ?? bodyAny.degree_id ?? bodyAny.degree;
        
        // 4. discipline_slug (aliases: discipline_id, discipline)
        const normalizedDiscipline = bodyAny.discipline_slug ?? bodyAny.discipline_id ?? bodyAny.discipline;
        
        // 5. study_mode (direct: on_campus, online, hybrid)
        const normalizedStudyMode = bodyAny.study_mode;
        
        // 6. instruction_languages (alias: language → array[0])
        const normalizedLangs = Array.isArray(bodyAny.instruction_languages)
          ? bodyAny.instruction_languages
          : bodyAny.language ? [bodyAny.language] : undefined;
        
        // 7. tuition_usd_min (alias: min_tuition)
        const normalizedTuitionMin = bodyAny.tuition_usd_min ?? bodyAny.min_tuition;
        
        // 8. tuition_usd_max (aliases: max_tuition, fees_max, tuition_max_year_usd)
        const normalizedTuitionMax = bodyAny.tuition_usd_max ?? bodyAny.max_tuition ?? bodyAny.fees_max ?? bodyAny.tuition_max_year_usd;
        
        // 9. duration_months_max (direct)
        const normalizedDurationMax = bodyAny.duration_months_max;
        
        // 10. has_dorm (direct boolean)
        const normalizedHasDorm = bodyAny.has_dorm;
        
        // 11. dorm_price_monthly_usd_max (direct)
        const normalizedDormPriceMax = bodyAny.dorm_price_monthly_usd_max;
        
        // 12. monthly_living_usd_max (aliases: living_max, monthly_living_max)
        const normalizedLivingMax = bodyAny.monthly_living_usd_max ?? bodyAny.living_max ?? bodyAny.monthly_living_max;
        
        // 13. scholarship_available (direct boolean)
        const normalizedScholarshipAvailable = bodyAny.scholarship_available;
        
        // 14. scholarship_type (direct)
        const normalizedScholarshipType = bodyAny.scholarship_type;
        
        // 15. intake_months (direct array of ints 1-12)
        const normalizedIntakeMonths = Array.isArray(bodyAny.intake_months) ? bodyAny.intake_months : undefined;
        
        // 16. deadline_before (direct date string)
        const normalizedDeadlineBefore = bodyAny.deadline_before;
        
        // Keyword (text search - not a canonical filter but used for search)
        const normalizedKeyword = body.keyword ?? bodyAny.q ?? bodyAny.query ?? bodyAny.subject;
        
        // ============= RANK10 KEYS (2026-02-05) =============
        // ✅ CONTRACT FIX: ONLY extract from rank_filters object (NEVER from root body)
        // Rank10 keys at root level = CONTRACT VIOLATION (should be rejected earlier)
        const rankFiltersObj = (bodyAny.rank_filters && typeof bodyAny.rank_filters === 'object') 
          ? bodyAny.rank_filters as Record<string, unknown>
          : {};
        
        // ✅ CONTRACT: Rank10 keys ONLY from rank_filters object
        const normalizedInstitutionId = rankFiltersObj.institution_id;
        const normalizedRankingSystem = rankFiltersObj.ranking_system;
        const normalizedRankingYear = rankFiltersObj.ranking_year;
        const normalizedWorldRankMax = rankFiltersObj.world_rank_max;
        const normalizedNationalRankMax = rankFiltersObj.national_rank_max;
        const normalizedOverallScoreMin = rankFiltersObj.overall_score_min;
        const normalizedTeachingScoreMin = rankFiltersObj.teaching_score_min;
        const normalizedEmployabilityScoreMin = rankFiltersObj.employability_score_min;
        const normalizedAcademicReputationScoreMin = rankFiltersObj.academic_reputation_score_min;
        const normalizedResearchScoreMin = rankFiltersObj.research_score_min;
        
        
        // ✅ UNKNOWN KEYS GUARD (CRITICAL FAIL-CLOSED) — Reject unknown keys in rank_filters
        const RANK10_ALLOWED_KEYS = new Set([
          'institution_id', 'ranking_system', 'ranking_year',
          'world_rank_max', 'national_rank_max',
          'overall_score_min', 'teaching_score_min', 'employability_score_min',
          'academic_reputation_score_min', 'research_score_min'
        ]);
        if (rankFiltersObj && Object.keys(rankFiltersObj).length > 0) {
          const unknownRankKeys = Object.keys(rankFiltersObj).filter(k => !RANK10_ALLOWED_KEYS.has(k));
          if (unknownRankKeys.length > 0) {
            console.error(`CRITICAL_GUARD_VIOLATION request_id=${searchRequestId} unknown_rank_keys=[${unknownRankKeys.join(',')}]`);
            // Emit P0 Alert
            try {
              await portalAdmin.from('system_alerts').insert({
                level: 'critical',
                source: 'portal_guard',
                message: `UNKNOWN_KEYS_VIOLATION: Request contained unexpected rank_filters keys [${unknownRankKeys.join(',')}]`,
                meta: { request_id: searchRequestId, unknown_rank_filter_keys: unknownRankKeys },
                acknowledged: false,
              });
              console.log(`[student-portal-api] ✅ P0 Alert emitted for unknown_rank_keys rid=${searchRequestId}`);
            } catch (alertErr) {
              console.error('[student-portal-api] ⚠️ Failed to emit P0 alert (non-blocking):', alertErr);
            }
            return Response.json({
              ok: false,
              error_code: 'unknown_keys_violation',
              error: 'unknown_keys_violation',
              message: 'Request contains unexpected rank_filters keys',
              details: { unknown_rank_filter_keys: unknownRankKeys },
              request_id: searchRequestId,
            }, { status: 422, headers: corsHeaders });
          }
        }
        
        // ✅ CONTRACT GUARD: Reject Rank10 keys at root level (MUST be inside rank_filters)
        const RANK10_KEYS_SET = new Set([
          'institution_id', 'ranking_system', 'ranking_year', 'world_rank_max', 'national_rank_max',
          'overall_score_min', 'teaching_score_min', 'employability_score_min', 
          'academic_reputation_score_min', 'research_score_min'
        ]);
        const rank10AtRootLevel = receivedKeys.filter(k => RANK10_KEYS_SET.has(k));
        if (rank10AtRootLevel.length > 0) {
          console.error(`[student-portal-api] ❌ CONTRACT VIOLATION: Rank10 keys at root level: [${rank10AtRootLevel.join(',')}]`);
          return Response.json({
            ok: false,
            error_code: 'rank10_wrong_location',
            error: 'rank10_wrong_location',
            details: { keys: rank10AtRootLevel, correct_location: 'rank_filters' },
            request_id: searchRequestId,
          }, { status: 422, headers: corsHeaders });
        }
        
        // ============= RANKING CONSISTENCY RULE =============
        // If any threshold key is present, ranking_system + ranking_year must also be present
        const RANK_THRESHOLD_KEYS = ['world_rank_max', 'national_rank_max', 'overall_score_min', 
          'teaching_score_min', 'employability_score_min', 'academic_reputation_score_min', 'research_score_min'];
        
        // ✅ CONTRACT FIX: Only check inside rank_filters (root is rejected above)
        const hasThresholdKey = RANK_THRESHOLD_KEYS.some(k => 
          rankFiltersObj[k] !== undefined && rankFiltersObj[k] !== null
        );
        const hasRankingContext = normalizedRankingSystem && normalizedRankingYear;
        const isOnlyInstitutionId = normalizedInstitutionId && !hasThresholdKey && !normalizedRankingSystem && !normalizedRankingYear;
        
        if (hasThresholdKey && !hasRankingContext) {
          console.warn('[student-portal-api] ⚠️ 422: Ranking threshold without context (ranking_system + ranking_year)');
          return Response.json({
            ok: false,
            error_code: 'missing_ranking_context',
            error: 'missing_ranking_context',
            details: { missing: ['ranking_system', 'ranking_year'], threshold_keys_found: RANK_THRESHOLD_KEYS.filter(k => rankFiltersObj[k] !== undefined) },
            request_id: searchRequestId,
          }, { status: 422, headers: corsHeaders });
        }
        
        // ============= SYSTEM AUGMENTATION (CONTRACT V2 - 16+4) =============
        // Build ONE unified payload object used for both logging and query
        
        // Step 1: Build user filters (normalized from all 16 canonical keys)
        const userFilters: Record<string, unknown> = {};
        
        // 1. country_code
        if (normalizedCountry !== undefined && normalizedCountry !== null && normalizedCountry !== '') {
          userFilters.country_code = String(normalizedCountry).toUpperCase();
        }
        
        // 2. city
        if (normalizedCity !== undefined && normalizedCity !== null && normalizedCity !== '') {
          userFilters.city = normalizedCity;
        }
        
        // 3. degree_slug (stored as degree_level for legacy compatibility)
        if (normalizedDegree !== undefined && normalizedDegree !== null && normalizedDegree !== '') {
          userFilters.degree_slug = normalizedDegree;
        }
        
        // 4. discipline_slug
        if (normalizedDiscipline !== undefined && normalizedDiscipline !== null && normalizedDiscipline !== '') {
          userFilters.discipline_slug = normalizedDiscipline;
        }
        
        // 5. study_mode
        if (normalizedStudyMode !== undefined && normalizedStudyMode !== null && normalizedStudyMode !== '') {
          userFilters.study_mode = normalizedStudyMode;
        }
        
        // 6. instruction_languages (array)
        if (normalizedLangs && normalizedLangs.length > 0) {
          userFilters.instruction_languages = normalizedLangs.map((l: unknown) => String(l).toLowerCase());
        }
        
        // 7. tuition_usd_min - Accept 0, reject NaN
        if (normalizedTuitionMin !== undefined && normalizedTuitionMin !== null) {
          const numVal = Number(normalizedTuitionMin);
          if (Number.isFinite(numVal)) {
            userFilters.tuition_usd_min = numVal;
          }
        }
        
        // 8. tuition_usd_max - Accept 0, reject NaN
        if (normalizedTuitionMax !== undefined && normalizedTuitionMax !== null) {
          const numVal = Number(normalizedTuitionMax);
          if (Number.isFinite(numVal)) {
            userFilters.tuition_usd_max = numVal;
          }
        }
        
        // 9. duration_months_max
        if (normalizedDurationMax !== undefined && normalizedDurationMax !== null) {
          const numVal = Number(normalizedDurationMax);
          if (Number.isFinite(numVal)) {
            userFilters.duration_months_max = numVal;
          }
        }
        
        // 10. has_dorm (boolean - preserve false)
        if (normalizedHasDorm !== undefined && normalizedHasDorm !== null) {
          userFilters.has_dorm = Boolean(normalizedHasDorm);
        }
        
        // 11. dorm_price_monthly_usd_max
        if (normalizedDormPriceMax !== undefined && normalizedDormPriceMax !== null) {
          const numVal = Number(normalizedDormPriceMax);
          if (Number.isFinite(numVal)) {
            userFilters.dorm_price_monthly_usd_max = numVal;
          }
        }
        
        // 12. monthly_living_usd_max
        if (normalizedLivingMax !== undefined && normalizedLivingMax !== null) {
          const numVal = Number(normalizedLivingMax);
          if (Number.isFinite(numVal)) {
            userFilters.monthly_living_usd_max = numVal;
          }
        }
        
        // 13. scholarship_available (boolean - preserve false)
        if (normalizedScholarshipAvailable !== undefined && normalizedScholarshipAvailable !== null) {
          userFilters.scholarship_available = Boolean(normalizedScholarshipAvailable);
        }
        
        // 14. scholarship_type
        if (normalizedScholarshipType !== undefined && normalizedScholarshipType !== null && normalizedScholarshipType !== '') {
          userFilters.scholarship_type = normalizedScholarshipType;
        }
        
        // 15. intake_months (array of 1-12)
        if (normalizedIntakeMonths && normalizedIntakeMonths.length > 0) {
          userFilters.intake_months = normalizedIntakeMonths.map((m: unknown) => Number(m));
        }
        
        // 16. deadline_before (date string)
        if (normalizedDeadlineBefore !== undefined && normalizedDeadlineBefore !== null && normalizedDeadlineBefore !== '') {
          userFilters.deadline_before = normalizedDeadlineBefore;
        }
        
        // keyword (text search - not one of the 16 but used for full-text)
        if (normalizedKeyword !== undefined && normalizedKeyword !== null && normalizedKeyword !== '') {
          userFilters.keyword = normalizedKeyword;
        }
        
        // Pagination
        userFilters.limit = limit;
        userFilters.offset = offset;
        
        // Step 2: Define system-controlled constants (NEVER from user - 4 LOCKED KEYS)
        const systemFilters: Record<string, unknown> = {
          tuition_basis: 'year',       // System constant
          is_active: true,             // System constant
          publish_status: 'published', // System constant
          do_not_offer: false,         // System constant
        };
        const systemAddedKeys = Object.keys(systemFilters);
        
        // Step 3: Build FINAL PAYLOAD (single source of truth for logging + query)
        const finalPayload: Record<string, unknown> = {
          ...userFilters,
          ...systemFilters,
        };
        const finalKeys = Object.keys(finalPayload).sort();
        
        // ✅ TRUTH LOG #2: SYSTEM_AUGMENTED (uses finalPayload keys)
        console.log(`SYSTEM_AUGMENTED request_id=${searchRequestId} added_system_keys=[${systemAddedKeys.join(',')}] final_keys=[${finalKeys.join(',')}]`);
        
        // ✅ TRUTH LOG #3: PORTAL_REQ_FINAL (same finalPayload object)
        console.log(`PORTAL_REQ_FINAL request_id=${searchRequestId} final_keys=[${finalKeys.join(',')}] program_filters_json=${JSON.stringify(finalPayload)}`);
        
        console.log('[student-portal-api] Filters (Contract V2 - 16+4):', finalPayload);

        // ✅ UNIFIED: Same view as portal-programs-search → vw_program_search_api_v3_final
        let query = portalAdmin
          .from('vw_program_search_api_v3_final')
          .select(`
            program_id, program_name_ar, program_name_en,
            duration_months, instruction_languages, study_mode,
            university_id, university_name_ar, university_name_en, university_logo, city,
            tuition_usd_year_min, tuition_usd_year_max, tuition_is_free,
            monthly_living_usd, ranking, currency_code,
            country_code, country_name_ar, country_name_en,
            degree_slug, degree_name, discipline_slug, discipline_name_ar, discipline_name_en,
            is_active, publish_status, portal_url,
            has_dorm, dorm_price_monthly_usd,
            scholarship_available, scholarship_type,
            partner_tier, partner_preferred, partner_star,
            intake_months, deadline_date, do_not_offer
          `, { count: 'exact' })
          .eq('is_active', true)
          .eq('publish_status', 'published')
          .eq('do_not_offer', false)
          .range(offset, offset + limit - 1);

        // ============= APPLY ALL 16 CANONICAL FILTERS =============
        
        // 1. country_code
        if (userFilters.country_code) {
          query = query.eq('country_code', String(userFilters.country_code));
        }
        
        // 2. city (EXACT MATCH per contract - NOT ilike)
        if (userFilters.city) {
          query = query.eq('city', String(userFilters.city));
        }
        
        // 3. degree_slug
        if (userFilters.degree_slug) {
          let degreeSlug = String(userFilters.degree_slug);
          // If UUID, resolve to slug
          if (degreeSlug.includes('-')) {
            const { data: degreeData } = await portalAdmin
              .from('degrees')
              .select('slug')
              .eq('id', degreeSlug)
              .single();
            if (degreeData?.slug) {
              degreeSlug = degreeData.slug;
            }
          }
          query = query.eq('degree_slug', degreeSlug);
        }
        
        // 4. discipline_slug
        if (userFilters.discipline_slug) {
          query = query.eq('discipline_slug', String(userFilters.discipline_slug));
        }
        
        // 5. study_mode
        if (userFilters.study_mode) {
          query = query.eq('study_mode', String(userFilters.study_mode));
        }
        
        // 6. instruction_languages (overlap)
        if (userFilters.instruction_languages && Array.isArray(userFilters.instruction_languages)) {
          query = query.overlaps('instruction_languages', userFilters.instruction_languages as string[]);
        }
        
        // 7. tuition_usd_min (Budget OVERLAP: user_min <= program_max)
        // User's minimum budget must be <= program's maximum tuition
        // This ensures programs within budget range are included
        if (userFilters.tuition_usd_min !== undefined) {
          query = query.gte('tuition_usd_year_max', Number(userFilters.tuition_usd_min));
        }
        
        // 8. tuition_usd_max (Budget OVERLAP: user_max >= program_min)
        // User's maximum budget must be >= program's minimum tuition
        // This ensures affordable programs are included
        if (userFilters.tuition_usd_max !== undefined) {
          query = query.lte('tuition_usd_year_min', Number(userFilters.tuition_usd_max));
        }
        
        // 9. duration_months_max (lte)
        if (userFilters.duration_months_max !== undefined) {
          query = query.lte('duration_months', Number(userFilters.duration_months_max));
        }
        
        // 10. has_dorm
        if (userFilters.has_dorm !== undefined) {
          query = query.eq('has_dorm', Boolean(userFilters.has_dorm));
        }
        
        // 11. dorm_price_monthly_usd_max (lte)
        if (userFilters.dorm_price_monthly_usd_max !== undefined) {
          query = query.lte('dorm_price_monthly_usd', Number(userFilters.dorm_price_monthly_usd_max));
        }
        
        // 12. monthly_living_usd_max (lte)
        if (userFilters.monthly_living_usd_max !== undefined) {
          query = query.lte('monthly_living_usd', Number(userFilters.monthly_living_usd_max));
        }
        
        // 13. scholarship_available
        if (userFilters.scholarship_available !== undefined) {
          query = query.eq('scholarship_available', Boolean(userFilters.scholarship_available));
        }
        
        // 14. scholarship_type
        if (userFilters.scholarship_type) {
          query = query.eq('scholarship_type', String(userFilters.scholarship_type));
        }
        
        // 15. intake_months (overlap)
        if (userFilters.intake_months && Array.isArray(userFilters.intake_months)) {
          query = query.overlaps('intake_months', userFilters.intake_months as number[]);
        }
        
        // 16. deadline_before (lte on deadline_date)
        if (userFilters.deadline_before) {
          query = query.lte('deadline_date', String(userFilters.deadline_before));
        }
        
        // Keyword (text search)
        if (userFilters.keyword && String(userFilters.keyword).trim() !== '') {
          const kw = `%${String(userFilters.keyword).trim()}%`;
          query = query.or(`program_name_ar.ilike.${kw},university_name_ar.ilike.${kw},program_name_en.ilike.${kw}`);
        }
        
        // ============= RANK10 FILTERS (2026-02-05) =============
        // Apply ranking filters to query
        // Note: These filter against the view's ranking columns (from institution_rankings JOIN)
        
        // institution_id → university_id (direct filter)
        if (normalizedInstitutionId) {
          query = query.eq('university_id', String(normalizedInstitutionId));
        }
        
        // ranking_system and ranking_year (context for threshold filters)
        if (normalizedRankingSystem) {
          query = query.eq('ranking_system', String(normalizedRankingSystem));
        }
        if (normalizedRankingYear) {
          query = query.eq('ranking_year', Number(normalizedRankingYear));
        }
        
        // world_rank_max (lte)
        if (normalizedWorldRankMax !== undefined && normalizedWorldRankMax !== null) {
          query = query.lte('world_rank', Number(normalizedWorldRankMax));
        }
        
        // national_rank_max (lte)
        if (normalizedNationalRankMax !== undefined && normalizedNationalRankMax !== null) {
          query = query.lte('national_rank', Number(normalizedNationalRankMax));
        }
        
        // overall_score_min (gte)
        if (normalizedOverallScoreMin !== undefined && normalizedOverallScoreMin !== null) {
          query = query.gte('overall_score', Number(normalizedOverallScoreMin));
        }
        
        // teaching_score_min (gte)
        if (normalizedTeachingScoreMin !== undefined && normalizedTeachingScoreMin !== null) {
          query = query.gte('teaching_score', Number(normalizedTeachingScoreMin));
        }
        
        // employability_score_min (gte)
        if (normalizedEmployabilityScoreMin !== undefined && normalizedEmployabilityScoreMin !== null) {
          query = query.gte('employability_score', Number(normalizedEmployabilityScoreMin));
        }
        
        // academic_reputation_score_min (gte)
        if (normalizedAcademicReputationScoreMin !== undefined && normalizedAcademicReputationScoreMin !== null) {
          query = query.gte('academic_reputation_score', Number(normalizedAcademicReputationScoreMin));
        }
        
        // research_score_min (gte)
        if (normalizedResearchScoreMin !== undefined && normalizedResearchScoreMin !== null) {
          query = query.gte('research_score', Number(normalizedResearchScoreMin));
        }

        // Order by partner preference then ranking
        query = query.order('partner_preferred', { ascending: false, nullsFirst: false })
                     .order('ranking', { ascending: true, nullsFirst: true });

        const { data, error, count } = await query;

        if (error) {
          console.error('[student-portal-api] ❌ Portal KB search error:', error);
          // ✅ TRUTH LOG #4: PORTAL_RES (error case)
          console.log(`PORTAL_RES request_id=${searchRequestId} status=500 ok=false ignored_filters=[] count=0`);
          
          // ============= P0 ALERT EMIT: Search Failed =============
          // Schema: level, source, message, meta, acknowledged
          try {
            await portalAdmin.from('system_alerts').insert({
              level: 'critical',
              source: 'portal_search',
              message: `PORTAL_RES_FAILED: Search returned ok=false`,
              meta: { request_id: searchRequestId, error: error.message || String(error) },
              acknowledged: false,
            });
            console.log(`[student-portal-api] ✅ P0 Alert emitted for ok=false rid=${searchRequestId}`);
          } catch (alertErr) {
            console.error('[student-portal-api] ⚠️ Failed to emit P0 alert (non-blocking):', alertErr);
          }
          
          return Response.json({ 
            ok: false, 
            error_code: 'kb_search_failed',
            error: 'kb_search_failed',
            message: 'البحث غير متاح حالياً',
            request_id: searchRequestId,
          }, { status: 200, headers: corsHeaders });
        }

        // Map to backwards-compatible format + v3_final API format
        const items = (data ?? []).map((p: any) => ({
          // ===== Legacy field names (backwards compatibility) =====
          program_id: p.program_id,
          program_name: p.program_name_ar,
          description: null, // v3_final doesn't have description in list view
          duration_months: p.duration_months,
          languages: p.instruction_languages,
          next_intake: p.intake_months?.[0] ?? null,
          university_id: p.university_id,
          university_name: p.university_name_ar,
          city: p.city,
          logo_url: p.university_logo,
          fees_yearly: p.tuition_usd_year_max,
          monthly_living: p.monthly_living_usd,
          ranking: p.ranking,
          country_id: null, // Legacy - use country_code instead
          country_slug: p.country_code?.toLowerCase(),
          country_name: p.country_name_ar,
          degree_id: null, // Legacy - use degree_slug instead
          degree_name: p.degree_name,
          degree_slug: p.degree_slug,
          // ===== NEW: v3_final API contract fields =====
          program_name_ar: p.program_name_ar,
          program_name_en: p.program_name_en,
          university_name_ar: p.university_name_ar,
          university_name_en: p.university_name_en,
          university_logo: p.university_logo,
          country_code: p.country_code,
          country_name_ar: p.country_name_ar,
          country_name_en: p.country_name_en,
          tuition_usd_min: p.tuition_usd_year_min,
          tuition_usd_max: p.tuition_usd_year_max,
          tuition_is_free: p.tuition_is_free,
          currency_code: p.currency_code,
          portal_url: p.portal_url,
          language: p.instruction_languages?.[0] ?? null,
          // ===== V3 NEW FIELDS =====
          study_mode: p.study_mode,
          discipline_slug: p.discipline_slug,
          discipline_name_ar: p.discipline_name_ar,
          discipline_name_en: p.discipline_name_en,
          has_dorm: p.has_dorm,
          dorm_price_monthly_usd: p.dorm_price_monthly_usd,
          monthly_living_usd: p.monthly_living_usd,
          scholarship_available: p.scholarship_available,
          scholarship_type: p.scholarship_type,
          partner_tier: p.partner_tier,
          partner_preferred: p.partner_preferred,
          partner_star: p.partner_star,
          intake_months: p.intake_months,
          deadline_date: p.deadline_date,
          instruction_languages: p.instruction_languages,
        }));

        const resultCount = items.length;
        const totalCount = count ?? 0;
        
        // ✅ TRUTH LOG #4: PORTAL_RES (success case)
        console.log(`PORTAL_RES request_id=${searchRequestId} status=200 ok=true ignored_filters=[] count=${resultCount}`);
        
        console.log('[student-portal-api] ✅ search_programs (v3_final) returned', items.length, 'items, total:', count);
        
        return Response.json({ 
          ok: true, 
          items,
          total: count,
          has_next: offset + limit < (count || 0),
          next_offset: offset + items.length,
          sot_view: 'vw_program_search_api_v3_final', // ✅ Evidence marker
          request_id: searchRequestId, // ✅ Evidence: Same request_id for all 4 logs
        }, { headers: corsHeaders });
      }

      // ❌ LEGACY ACTIONS REMOVED: sync_storage_to_crm, reconcile_my_storage_files
      // These were cut over to crm_storage actions. No case handlers needed.

      // ✅ Service Selections Actions
      case 'get_service_selections': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} action=get_service_selections auth=${safeId(authUserId)}`);
        
        const rpcName = 'rpc_get_student_service_selections';
        logRpcStart({ requestId: reqId, action: 'get_service_selections', authUserId }, rpcName, ['p_auth_user_id']);
        
        const t0 = Date.now();
        result = await crmClient.rpc(rpcName, {
          p_auth_user_id: authUserId,
        });
        const durationMs = Date.now() - t0;
        
        const errMsg = result.error && typeof result.error === 'object' && 'message' in result.error ? (result.error as { message: string }).message : undefined;
        logRpcEnd({ requestId: reqId, action: 'get_service_selections', authUserId }, rpcName, !result.error, durationMs, errMsg);
        
        if (result.error) {
          console.error(`[student-portal-api] ${reqId} ❌ ${rpcName} not available:`, result.error);
          // ✅ FIX: Return rpc_ok=false + rpc_error for Evidence (Gatekeeper requirement)
          return Response.json({ 
            ok: true, 
            selections: [],
            rpc_ok: false,
            rpc_error: errMsg || 'RPC not available',
            message: 'No saved selections found',
            request_id: reqId
          }, { headers: corsHeaders });
        }
        
        const selections = (result.data as unknown[] | null) ?? [];
        console.log(`[student-portal-api] ${reqId} ✅ ${rpcName} returned ${selections.length} selections`);
        
        return Response.json({ 
          ok: true, 
          selections,
          rpc_ok: true,
          request_id: reqId
        }, { headers: corsHeaders });
      }

      case 'save_service_selection': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} 💾 save_service_selection for:`, safeId(authUserId));
        console.log(`[student-portal-api] ${reqId} 📤 payload:`, JSON.stringify({
          country_code: body.country_code,
          selected_services: body.selected_services,
          selected_addons: body.selected_addons,
          selected_package_id: body.selected_package_id,
          pay_plan: body.pay_plan,
          pricing_version: body.pricing_version,
          source: body.source,
        }, null, 2));
        
        if (!body.country_code) {
          return Response.json({ 
            ok: false, 
            error: 'country_code required'
          }, { status: 400, headers: corsHeaders });
        }
        
        // ✅ FIX-3: Pass pay_plan, pricing_version, source to CRM RPC
        // CRM RPC should manage state_rev atomically (server-managed)
        result = await crmClient.rpc('rpc_save_student_service_selection', {
          p_auth_user_id: authUserId,
          p_country_code: body.country_code,
          p_program_ids: body.program_ids || [],
          p_selected_services: body.selected_services || [],
          p_selected_addons: body.selected_addons || [],
          p_selected_package_id: body.selected_package_id || null,
          p_pay_plan: body.pay_plan || 'full',
          p_pricing_snapshot: body.pricing_snapshot || null,
          p_pricing_version: body.pricing_version || 'v1',
          p_source: body.source || 'portal',
          p_idempotency_key: body.idempotency_key || null,
        });
        
        if (result.error) {
          console.error(`[student-portal-api] ${reqId} ❌ save_service_selection RPC error:`, result.error);
          return Response.json({ 
            ok: false, 
            error: 'SAVE_UNAVAILABLE',
            message: 'حفظ الاختيارات غير متاح حالياً',
            details: result.error,
            request_id: reqId
          }, { headers: corsHeaders });
        }
        
        // ✅ FIX-3: Return state_rev from server for client to track
        const rpcData = result.data as { state_rev?: number; selection?: Record<string, unknown> } | null;
        console.log(`[student-portal-api] ${reqId} ✅ save_service_selection success, state_rev:`, rpcData?.state_rev);
        
        return Response.json({ 
          ok: true, 
          state_rev: rpcData?.state_rev || 1,
          selection: rpcData?.selection || null,
          request_id: reqId
        }, { headers: corsHeaders });
      }
      
      // ✅ FIX-3: Clear service selection for a country
      case 'clear_service_selection': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} 🗑️ clear_service_selection for:`, safeId(authUserId), 'country:', body.country_code);
        
        if (!body.country_code) {
          return Response.json({ 
            ok: false, 
            error: 'country_code required'
          }, { status: 400, headers: corsHeaders });
        }
        
        result = await crmClient.rpc('rpc_clear_student_service_selection', {
          p_auth_user_id: authUserId,
          p_country_code: body.country_code,
        });
        
        if (result.error) {
          console.error(`[student-portal-api] ${reqId} ❌ clear_service_selection RPC error:`, result.error);
          return Response.json({ 
            ok: false, 
            error: 'CLEAR_FAILED',
            message: 'فشل مسح الاختيارات',
            details: result.error,
            request_id: reqId
          }, { headers: corsHeaders });
        }
        
        console.log(`[student-portal-api] ${reqId} ✅ clear_service_selection success`);
        return Response.json({ 
          ok: true, 
          request_id: reqId
        }, { headers: corsHeaders });
      }

      case 'submit_service_selection': {
        console.log('[student-portal-api] 🚀 submit_service_selection for:', authUserId);
        console.log('[student-portal-api] 📤 country_code:', body.country_code);
        console.log('[student-portal-api] 📤 idempotency_key:', body.idempotency_key);
        
        if (!body.country_code) {
          return Response.json({ 
            ok: false, 
            error: 'country_code required'
          }, { status: 400, headers: corsHeaders });
        }
        
        result = await crmClient.rpc('rpc_submit_student_service_selection', {
          p_auth_user_id: authUserId,
          p_country_code: body.country_code,
          p_idempotency_key: body.idempotency_key || null,
        });
        
        if (result.error) {
          console.error('[student-portal-api] ❌ submit_service_selection RPC error:', result.error);
          return Response.json({ 
            ok: false, 
            error: 'SUBMIT_FAILED',
            message: 'فشل إرسال طلب الخدمات',
            details: result.error
          }, { headers: corsHeaders });
        }
        
        console.log('[student-portal-api] ✅ submit_service_selection success:', result.data);
        return Response.json({ 
          ok: true, 
          data: result.data
        }, { headers: corsHeaders });
      }

      // ============= ORDER #2: set_services_selection (CRM Proxy with state_rev) =============
      // This action:
      // 1. Gets auth_user_id from JWT (NOT from client)
      // 2. Gets customer_id from CRM via profile check
      // 3. Calculates next_state_rev from Portal mirror table
      // 4. Builds pricing_snapshot server-side
      // 5. Calls CRM RPC rpc_set_customer_service_selection
      case 'set_services_selection': {
        const reqId = genRequestId();
        const logCtx: RpcLogContext = { requestId: reqId, action: 'set_services_selection', authUserId };
        
        // ✅ ORDER #2: Mandatory HIT log with origin
        const { country_code, selected_services, selected_addons, selected_package_id, pay_plan, origin } = body;
        console.log(`[student-portal-api] ${reqId} ✅ set_services_selection HIT`, {
          country_code,
          has_services: Array.isArray(selected_services),
          services_count: Array.isArray(selected_services) ? selected_services.length : 0,
          auth: safeId(authUserId),
          origin: origin || 'unknown', // ✅ A) Track write path origin
        });
        
        // 1) Validate required params
        
        if (!country_code) {
          return Response.json({ 
            ok: false, 
            error: 'country_code required',
            request_id: reqId
          }, { status: 400, headers: corsHeaders });
        }
        
        if (!Array.isArray(selected_services) || selected_services.length === 0) {
          return Response.json({ 
            ok: false, 
            error: 'selected_services required (non-empty array)',
            request_id: reqId
          }, { status: 400, headers: corsHeaders });
        }
        
        // 2) Check link status - get customer_id from CRM
        console.log(`[student-portal-api] ${reqId} 🔍 Checking link status...`);
        const profileRes = await fetchCrmProfileByAuthUserId(crmClient, authUserId!);
        
        if (!profileRes.ok || !profileRes.linked) {
          console.log(`[student-portal-api] ${reqId} ⚠️ User not linked to customer`);
          return Response.json({
            ok: false,
            error: 'not_linked',
            error_code: 'no_linked_customer',
            message: 'يجب ربط حسابك أولاً',
            cta: 'link_account',
            request_id: reqId
          }, { headers: corsHeaders });
        }
        
        const customerId = profileRes.profile?.customer_id || profileRes.profile?.id;
        console.log(`[student-portal-api] ${reqId} ✅ customer_id=${safeId(customerId as string)}`);
        
        // 3) Get current state_rev from Portal mirror table
        const { data: currentSelection, error: selectErr } = await portalAdmin
          .from('customer_service_selections')
          .select('state_rev')
          .eq('auth_user_id', authUserId)
          .eq('country_code', country_code)
          .maybeSingle();
        
        const currentStateRev = (currentSelection?.state_rev as number) || 0;
        const nextStateRev = BigInt(currentStateRev) + 1n;
        
        console.log(`[student-portal-api] ${reqId} 📊 state_rev: current=${currentStateRev}, next=${nextStateRev}`);
        
        // 4) Build pricing_snapshot SERVER-SIDE (not from client)
        const basePrice = COUNTRY_BASE_PRICES[country_code as keyof typeof COUNTRY_BASE_PRICES] || COUNTRY_BASE_PRICES['EU'];
        
        const lineItems: Array<{ code: string; kind: 'service' | 'addon'; name: string; price: number }> = [];
        let servicesTotal = 0;
        let addonsTotal = 0;
        
        // Add services
        for (const svcId of (selected_services as string[])) {
          const price = calculateServicePrice(svcId, country_code);
          const name = SERVICE_NAMES[svcId] || svcId;
          lineItems.push({ code: svcId, kind: 'service', name, price });
          servicesTotal += price;
        }
        
        // Add addons (Russia only)
        const addons = (selected_addons as string[]) || [];
        for (const addonId of addons) {
          const addonDef = RUSSIA_ADDONS[addonId];
          if (addonDef) {
            lineItems.push({ code: addonId, kind: 'addon', name: addonDef.name, price: addonDef.price });
            addonsTotal += addonDef.price;
          }
        }
        
        const total = servicesTotal + addonsTotal;
        const effectivePayPlan = (pay_plan as string) || 'full';
        const depositAmount = effectivePayPlan === 'split' ? roundTo10(total * 0.4) : total;
        const remainderAmount = effectivePayPlan === 'split' ? total - depositAmount : 0;
        
        const pricingSnapshot = {
          currency: 'USD',
          base_price: basePrice,
          items: lineItems,
          services_total: servicesTotal,
          addons_total: addonsTotal,
          total,
          pay_plan: effectivePayPlan,
          deposit_amount: depositAmount,
          remainder_amount: remainderAmount,
          note: effectivePayPlan === 'split' ? 'القسط الثاني قبل السفر' : null,
        };
        
        console.log(`[student-portal-api] ${reqId} 💰 Pricing: total=${total}, deposit=${depositAmount}`);
        
        // 5) Call CRM RPC: rpc_set_customer_service_selection
        const rpcName = 'rpc_set_customer_service_selection';
        logRpcStart(logCtx, rpcName, ['p_customer_id', 'p_country_code', 'p_state_rev']);
        
        const t0 = Date.now();
        const { data: rpcData, error: rpcErr } = await crmClient.rpc(rpcName, {
          p_customer_id: customerId,
          p_country_code: country_code,
          p_selected_services: selected_services,
          p_selected_addons: addons,
          p_selected_package_id: selected_package_id || null,
          p_pay_plan: effectivePayPlan,
          p_pricing_snapshot: pricingSnapshot,
          p_pricing_version: 'v1',
          p_state_rev: Number(nextStateRev), // CRM expects number
          p_source: 'portal',
        });
        
        const duration = Date.now() - t0;
        logRpcEnd(logCtx, rpcName, !rpcErr, duration, rpcErr?.message);
        
        if (rpcErr) {
          console.error(`[student-portal-api] ${reqId} ❌ CRM RPC error:`, rpcErr);
          
          // Check for specific error codes
          const errMsg = rpcErr.message || '';
          if (errMsg.includes('customer_not_linked') || errMsg.includes('no_linked_customer')) {
            return Response.json({
              ok: false,
              error: 'not_linked',
              error_code: 'no_linked_customer',
              message: 'الحساب غير مربوط بعميل',
              cta: 'link_account',
              request_id: reqId
            }, { headers: corsHeaders });
          }
          
          return Response.json({
            ok: false,
            error: 'CRM_ERROR',
            message: 'فشل حفظ الاختيارات في النظام',
            details: errMsg,
            request_id: reqId
          }, { headers: corsHeaders });
        }
        
        // 6) Parse CRM response
        const crmResponse = rpcData as { 
          applied?: boolean; 
          synced?: boolean; 
          state_rev?: number;
          selection_id?: string;
        } | null;
        
        // ✅ ORDER #2: Mandatory DONE log
        console.log(`[student-portal-api] ${reqId} ✅ set_services_selection DONE`, {
          applied: crmResponse?.applied,
          synced: crmResponse?.synced,
          state_rev: crmResponse?.state_rev || Number(nextStateRev),
        });
        
        return Response.json({
          ok: true,
          applied: crmResponse?.applied ?? true,
          synced: crmResponse?.synced ?? true,
          state_rev: crmResponse?.state_rev || Number(nextStateRev),
          selection_id: crmResponse?.selection_id,
          pricing: {
            total,
            deposit: depositAmount,
            remainder: remainderAmount,
            currency: 'USD',
          },
          request_id: reqId
        }, { headers: corsHeaders });
      }

      // ✅ CRM PROXY: submit_application → CRM RPC with Portal V1 fallback
      case 'submit_application': {
        console.log('[student-portal-api] 🚀 submit_application → calling CRM rpc_portal_submit_application_v2');
        
        const { program_id, program_name, university_name, country_code, services } = body as { 
          program_id?: string; 
          program_name?: string;
          university_name?: string;
          country_code?: string; 
          services?: Array<{ code: string; qty?: number }>;
        };
        
        if (!program_id || !country_code) {
          return Response.json({ 
            ok: false, 
            error: 'program_id and country_code required'
          }, { status: 400, headers: corsHeaders });
        }
        
        if (!services || services.length === 0) {
          return Response.json({ 
            ok: false, 
            error: 'At least one service required'
          }, { status: 400, headers: corsHeaders });
        }
        
        // ==========================================
        // NEW: Fetch program details from Portal KB
        // ==========================================
        const { data: kbProgram, error: kbErr } = await portalAdmin
          .from('vw_program_search')
          .select(`
            program_id, program_name,
            university_id, university_name, university_logo,
            country_id, country_name, country_slug,
            degree_id, degree_name, degree_slug,
            fees_yearly, city
          `)
          .eq('program_id', program_id)
          .maybeSingle();

        // Build snapshot from KB (even if not found - use client values as fallback)
        const snapshot = kbProgram ? {
          program_name_en: kbProgram.program_name,
          university_name_en: kbProgram.university_name,
          university_logo: kbProgram.university_logo,
          country: kbProgram.country_name,
          country_slug: kbProgram.country_slug,
          degree_level: kbProgram.degree_name,
          tuition_year: kbProgram.fees_yearly,
          city: kbProgram.city,
        } : {
          program_name_en: program_name || "(Unknown)",
          university_name_en: university_name || "(Unknown)",
          from_client: true,  // Mark that this came from client, not KB
        };

        // Use KB values for program_name/university_name if available
        const finalProgramName = kbProgram?.program_name || program_name || null;
        const finalUniversityName = kbProgram?.university_name || university_name || null;

        console.log('[student-portal-api] 📦 Built snapshot from KB:', { 
          found_in_kb: !!kbProgram, 
          program: finalProgramName 
        });

        // Try CRM first (server-side pricing in CRM)
        const { data: crmResult, error: crmErr } = await crmClient.rpc('rpc_portal_submit_application_v2', {
          p_auth_user_id: authUserId,
          p_program_id: program_id,
          p_program_name: finalProgramName,
          p_university_name: finalUniversityName,
          p_country_code: country_code,
          p_services: services,
        });
        
        if (!crmErr && crmResult && (crmResult as Record<string, unknown>).application_id) {
          console.log('[student-portal-api] ✅ CRM submit success:', crmResult);
          return Response.json({ 
            ok: true, 
            ...(crmResult as Record<string, unknown>)
          }, { headers: corsHeaders });
        }
        
        // Fallback: Calculate prices SERVER-SIDE and write to Portal DB
        console.log('[student-portal-api] ⚠️ CRM unavailable, falling back to Portal DB V1');
        
        const calculatedServicesSubmit: Array<{
          code: string;
          name: string;
          qty: number;
          unit_price: number;
          line_total: number;
        }> = [];
        
        let servicesTotalSubmit = 0;
        let addonsTotalSubmit = 0;
        
        for (const svc of services) {
          const code = svc.code;
          const qty = svc.qty || 1;
          
          if (RUSSIA_ADDONS[code]) {
            const addon = RUSSIA_ADDONS[code];
            const lineTotal = addon.price * qty;
            calculatedServicesSubmit.push({
              code,
              name: addon.name,
              qty,
              unit_price: addon.price,
              line_total: lineTotal,
            });
            addonsTotalSubmit += lineTotal;
          } else {
            const unitPrice = calculateServicePrice(code, country_code);
            const lineTotal = unitPrice * qty;
            calculatedServicesSubmit.push({
              code,
              name: SERVICE_NAMES[code] || code,
              qty,
              unit_price: unitPrice,
              line_total: lineTotal,
            });
            servicesTotalSubmit += lineTotal;
          }
        }
        
        const totalAmountSubmit = servicesTotalSubmit + addonsTotalSubmit;
        
        console.log('[student-portal-api] 📊 Portal pricing (fallback):', { total: totalAmountSubmit });
        
        // Write to Portal DB - now with KB-resolved names
        const { data: appDataSubmit, error: appErrorSubmit } = await portalAdmin
          .from('portal_applications_v1')
          .insert({
            auth_user_id: authUserId,
            program_id,
            program_name: finalProgramName,
            university_name: finalUniversityName,
            country_code,
            status: 'pending_payment',
            services_json: calculatedServicesSubmit,
            total_amount: totalAmountSubmit,
            currency: 'USD',
          })
          .select('id')
          .single();
        
        if (appErrorSubmit) {
          console.error('[student-portal-api] ❌ Portal insert error:', appErrorSubmit);
          return Response.json({ 
            ok: false, 
            error: 'PORTAL_INSERT_FAILED',
            message: appErrorSubmit.message
          }, { headers: corsHeaders });
        }
        
        const applicationIdSubmit = appDataSubmit.id;
        
        // Create payment record
        const { data: payDataSubmit, error: payErrorSubmit } = await portalAdmin
          .from('portal_payments_v1')
          .insert({
            auth_user_id: authUserId,
            application_id: applicationIdSubmit,
            amount_required: totalAmountSubmit,
            currency: 'USD',
            status: 'requested',
          })
          .select('id')
          .single();
        
        const paymentIdSubmit = payDataSubmit?.id || null;
        
        // Update application with payment_id
        if (paymentIdSubmit) {
          await portalAdmin
            .from('portal_applications_v1')
            .update({ payment_id: paymentIdSubmit })
            .eq('id', applicationIdSubmit);
        }
        
        console.log('[student-portal-api] ✅ Portal submit success (fallback):', { applicationIdSubmit, paymentIdSubmit });
        
        return Response.json({ 
          ok: true, 
          application_id: applicationIdSubmit,
          payment_id: paymentIdSubmit,
          status: 'pending_payment',
          services: calculatedServicesSubmit,
          total_amount: totalAmountSubmit,
        }, { headers: corsHeaders });
      }

      // ============= PORTAL DB V1 ACTIONS (Temporary Outbox) =============
      // These write to Portal's own tables, NOT CRM
      
      case 'submit_application_portal_v1': {
        console.log('[student-portal-api] 🚀 submit_application_portal_v1 for:', authUserId);
        
        const { program_id, program_name, university_name, country_code, services } = body as { 
          program_id?: string; 
          program_name?: string;
          university_name?: string;
          country_code?: string; 
          services?: Array<{ code: string; qty?: number }>;
        };
        
        if (!program_id || !country_code) {
          return Response.json({ 
            ok: false, 
            error: 'program_id and country_code required'
          }, { status: 400, headers: corsHeaders });
        }
        
        if (!services || services.length === 0) {
          return Response.json({ 
            ok: false, 
            error: 'At least one service required'
          }, { status: 400, headers: corsHeaders });
        }
        
        // ✅ Calculate prices SERVER-SIDE
        const calculatedServices: Array<{
          code: string;
          name: string;
          qty: number;
          unit_price: number;
          line_total: number;
        }> = [];
        
        let servicesTotal = 0;
        let addonsTotal = 0;
        
        for (const svc of services) {
          const code = svc.code;
          const qty = svc.qty || 1;
          
          if (RUSSIA_ADDONS[code]) {
            const addon = RUSSIA_ADDONS[code];
            const lineTotal = addon.price * qty;
            calculatedServices.push({
              code,
              name: addon.name,
              qty,
              unit_price: addon.price,
              line_total: lineTotal,
            });
            addonsTotal += lineTotal;
          } else {
            const unitPrice = calculateServicePrice(code, country_code);
            const lineTotal = unitPrice * qty;
            calculatedServices.push({
              code,
              name: SERVICE_NAMES[code] || code,
              qty,
              unit_price: unitPrice,
              line_total: lineTotal,
            });
            servicesTotal += lineTotal;
          }
        }
        
        const totalAmount = servicesTotal + addonsTotal;
        
        console.log('[student-portal-api] 📊 Portal V1 pricing:', { total: totalAmount });
        
        // ✅ Insert into Portal's portal_applications_v1 table
        const { data: appData, error: appError } = await portalAdmin
          .from('portal_applications_v1')
          .insert({
            auth_user_id: authUserId,
            program_id,
            program_name: program_name || null,
            university_name: university_name || null,
            country_code,
            status: 'pending_payment',
            services_json: calculatedServices,
            total_amount: totalAmount,
            currency: 'USD',
          })
          .select('id')
          .single();
        
        if (appError) {
          console.error('[student-portal-api] ❌ Portal app insert error:', appError);
          return Response.json({ 
            ok: false, 
            error: 'PORTAL_INSERT_FAILED',
            message: 'فشل حفظ الطلب',
            details: appError.message
          }, { headers: corsHeaders });
        }
        
        const applicationId = appData.id;
        
        // ✅ Insert payment record into Portal's portal_payments_v1 table
        const { data: payData, error: payError } = await portalAdmin
          .from('portal_payments_v1')
          .insert({
            auth_user_id: authUserId,
            application_id: applicationId,
            amount_required: totalAmount,
            currency: 'USD',
            status: 'requested',
          })
          .select('id')
          .single();
        
        if (payError) {
          console.error('[student-portal-api] ❌ Portal payment insert error:', payError);
          // Still return success for application, just no payment_id
        }
        
        const paymentId = payData?.id || null;
        
        // ✅ Update application with payment_id
        if (paymentId) {
          await portalAdmin
            .from('portal_applications_v1')
            .update({ payment_id: paymentId })
            .eq('id', applicationId);
        }
        
        // ✅ EXEC ORDER: Sync to CRM (non-blocking - Portal is primary, CRM is secondary)
        // This ensures CRM has the application data even if CRM RPC was unavailable initially
        const clientTraceId = (body as any).client_trace_id;
        const programRef = (body as any).program_ref;
        const crmSyncReqId = genRequestId();
        
        try {
          console.log(`[student-portal-api] ${crmSyncReqId} 🔄 Syncing application to CRM...`, { 
            applicationId, 
            client_trace_id: clientTraceId 
          });
          
          const rpcName = 'rpc_portal_application_created_v1';
          const rpcParams = ['p_auth_user_id', 'p_portal_application_id', 'p_program_id', 'p_program_name', 'p_university_name', 'p_country_code', 'p_services', 'p_total_amount', 'p_payment_id', 'p_program_ref', 'p_client_trace_id'];
          logRpcStart({ requestId: crmSyncReqId, action: 'submit_application_portal_v1', authUserId }, rpcName, rpcParams);
          
          const t0 = Date.now();
          const { data: crmSyncResult, error: crmSyncErr } = await crmClient.rpc(rpcName, {
            p_auth_user_id: authUserId,
            p_portal_application_id: applicationId,
            p_program_id: program_id,
            p_program_name: program_name || programRef?.snapshot?.program_name || null,
            p_university_name: university_name || programRef?.snapshot?.university_name || null,
            p_country_code: country_code,
            p_services: calculatedServices,
            p_total_amount: totalAmount,
            p_payment_id: paymentId,
            p_program_ref: programRef || null,
            p_client_trace_id: clientTraceId || null,
          });
          const durationMs = Date.now() - t0;
          
          logRpcEnd({ requestId: crmSyncReqId, action: 'submit_application_portal_v1', authUserId }, rpcName, !crmSyncErr, durationMs, crmSyncErr?.message);
          
          if (crmSyncErr) {
            // Non-fatal: log but don't fail the request
            console.warn(`[student-portal-api] ${crmSyncReqId} ⚠️ CRM sync failed (non-fatal):`, crmSyncErr.message);
          } else {
            console.log(`[student-portal-api] ${crmSyncReqId} ✅ CRM sync success:`, crmSyncResult);
          }
        } catch (crmSyncException) {
          // Non-fatal: log but don't fail the request
          console.warn(`[student-portal-api] ${crmSyncReqId} ⚠️ CRM sync exception (non-fatal):`, crmSyncException);
        }
        
        console.log('[student-portal-api] ✅ Portal V1 submit success:', { applicationId, paymentId });
        
        return Response.json({ 
          ok: true, 
          application_id: applicationId,
          payment_id: paymentId,
          status: 'pending_payment',
          services: calculatedServices,
          total_amount: totalAmount,
          client_trace_id: clientTraceId,
        }, { headers: corsHeaders });
      }

      case 'get_portal_applications_v1': {
        console.log('[student-portal-api] 📋 get_portal_applications_v1 for:', authUserId);
        
        // ✅ Use VIEW to get apps with payment_status joined
        const { data: apps, error: appsErr } = await portalAdmin
          .from('vw_portal_applications_v1')
          .select('*')
          .eq('auth_user_id', authUserId)
          .order('created_at', { ascending: false });
        
        if (appsErr) {
          console.error('[student-portal-api] ❌ Portal apps query error:', appsErr);
          return Response.json({ 
            ok: false, 
            error: 'QUERY_FAILED',
            message: appsErr.message
          }, { headers: corsHeaders });
        }
        
        console.log('[student-portal-api] ✅ Portal apps:', apps?.length || 0);
        return Response.json({ ok: true, data: apps || [] }, { headers: corsHeaders });
      }

      case 'get_portal_payments_v1': {
        console.log('[student-portal-api] 💳 get_portal_payments_v1 for:', authUserId);
        
        const { data: pays, error: paysErr } = await portalAdmin
          .from('portal_payments_v1')
          .select('*')
          .eq('auth_user_id', authUserId)
          .order('created_at', { ascending: false });
        
        if (paysErr) {
          console.error('[student-portal-api] ❌ Portal payments query error:', paysErr);
          return Response.json({ 
            ok: false, 
            error: 'QUERY_FAILED',
            message: paysErr.message
          }, { headers: corsHeaders });
        }
        
        // Transform to match StudentPayment interface
        const transformedPayments = (pays || []).map(p => ({
          id: p.id,
          amount: p.amount_required,
          amount_required: p.amount_required,
          currency: p.currency,
          status: p.status,
          payment_date: p.created_at,
          reference: null,
          description: 'رسوم الخدمات',
          payment_method: null,
          due_date: null,
          service_type: 'application_services',
          receipt_no: p.receipt_no,
          storage_bucket: p.evidence_storage_bucket,
          storage_path: p.evidence_storage_path,
          rejection_reason: p.rejection_reason,
          application_id: p.application_id,
        }));
        
        console.log('[student-portal-api] ✅ Portal payments:', transformedPayments.length);
        return Response.json({ ok: true, data: transformedPayments }, { headers: corsHeaders });
      }

      case 'submit_portal_payment_proof_v1': {
        console.log('[student-portal-api] 📤 submit_portal_payment_proof_v1 for:', authUserId);
        
        const { payment_id, evidence_storage_bucket, evidence_storage_path } = body as {
          payment_id?: string;
          evidence_storage_bucket?: string;
          evidence_storage_path?: string;
        };
        
        if (!payment_id) {
          return Response.json({ 
            ok: false, 
            error: 'payment_id required'
          }, { status: 400, headers: corsHeaders });
        }
        
        if (!evidence_storage_bucket || !evidence_storage_path) {
          return Response.json({ 
            ok: false, 
            error: 'evidence_storage_bucket and evidence_storage_path required'
          }, { status: 400, headers: corsHeaders });
        }
        
        // ✅ Update Portal payment with proof (trigger handles updated_at)
        const { error: updateErr } = await portalAdmin
          .from('portal_payments_v1')
          .update({
            status: 'proof_received',
            evidence_storage_bucket,
            evidence_storage_path,
            rejection_reason: null,
            rejected_at: null,
          })
          .eq('id', payment_id)
          .eq('auth_user_id', authUserId);
        
        if (updateErr) {
          console.error('[student-portal-api] ❌ Portal proof update error:', updateErr);
          return Response.json({ 
            ok: false, 
            error: 'UPDATE_FAILED',
            message: updateErr.message
          }, { headers: corsHeaders });
        }
        
        console.log('[student-portal-api] ✅ Portal proof submitted:', payment_id);
        return Response.json({ 
          ok: true, 
          payment_id,
          status: 'proof_received'
        }, { headers: corsHeaders });
      }

      // ============= PORTAL FILES V1 (Ready Downloads + Uploads) =============
      
      case 'list_portal_files_v1': {
        console.log('[student-portal-api] 📂 list_portal_files_v1 for:', authUserId);
        
        const { application_id: filterAppId, file_kind: filterKind } = body as {
          application_id?: string;
          file_kind?: string;
        };
        
        let query = portalAdmin
          .from('portal_files_v1')
          .select('*')
          .eq('auth_user_id', authUserId)
          .order('created_at', { ascending: false });
        
        // Optional filters
        if (filterAppId) {
          query = query.eq('application_id', filterAppId);
        }
        if (filterKind) {
          query = query.eq('file_kind', filterKind);
        }
        
        const { data: files, error: filesErr } = await query;
        
        if (filesErr) {
          console.error('[student-portal-api] ❌ Portal files query error:', filesErr);
          return Response.json({ 
            ok: false, 
            error: 'QUERY_FAILED',
            message: filesErr.message
          }, { headers: corsHeaders });
        }
        
        // Group files by category
        const readyDownloads = (files || []).filter(f => 
          ['admission_letter', 'contract', 'invoice', 'receipt', 'visa_invitation', 'visa', 'insurance', 'accommodation_letter', 'arrival_instructions'].includes(f.file_kind)
        );
        const requiredUploads = (files || []).filter(f => 
          ['passport', 'photo', 'certificate', 'transcript', 'medical_report', 'bank_statement'].includes(f.file_kind)
        );
        const additionalFiles = (files || []).filter(f => 
          f.file_kind === 'additional' || !readyDownloads.includes(f) && !requiredUploads.includes(f)
        );
        
        console.log('[student-portal-api] ✅ Portal files:', {
          total: files?.length || 0,
          readyDownloads: readyDownloads.length,
          requiredUploads: requiredUploads.length
        });
        
        return Response.json({ 
          ok: true, 
          files: files || [],
          grouped: {
            ready_downloads: readyDownloads,
            required_uploads: requiredUploads,
            additional: additionalFiles
          }
        }, { headers: corsHeaders });
      }

      case 'add_portal_file_v1': {
        console.log('[student-portal-api] 📤 add_portal_file_v1 for:', authUserId);
        
        const { 
          file_kind: newFileKind, 
          file_name: newFileName, 
          title: newTitle,
          storage_bucket: newBucket,
          storage_path: newPath,
          mime_type: newMime,
          size_bytes: newSize,
          application_id: newAppId
        } = body as {
          file_kind?: string;
          file_name?: string;
          title?: string;
          storage_bucket?: string;
          storage_path?: string;
          mime_type?: string;
          size_bytes?: number;
          application_id?: string;
        };
        
        if (!newFileKind || !newFileName || !newPath) {
          return Response.json({ 
            ok: false, 
            error: 'file_kind, file_name, and storage_path required'
          }, { status: 400, headers: corsHeaders });
        }
        
        const { data: newFile, error: insertErr } = await portalAdmin
          .from('portal_files_v1')
          .insert({
            auth_user_id: authUserId,
            application_id: newAppId || null,
            file_kind: newFileKind,
            file_name: newFileName,
            title: newTitle || null,
            storage_bucket: newBucket || 'student-docs',
            storage_path: newPath,
            mime_type: newMime || null,
            size_bytes: newSize || null,
            status: 'pending_review'
          })
          .select('id')
          .single();
        
        if (insertErr) {
          console.error('[student-portal-api] ❌ Portal file insert error:', insertErr);
          return Response.json({ 
            ok: false, 
            error: 'INSERT_FAILED',
            message: insertErr.message
          }, { headers: corsHeaders });
        }
        
        console.log('[student-portal-api] ✅ Portal file added:', newFile?.id);
        return Response.json({ 
          ok: true, 
          file_id: newFile?.id
        }, { headers: corsHeaders });
      }

      case 'sign_portal_file_v1': {
        console.log('[student-portal-api] 🔐 sign_portal_file_v1 for:', authUserId);
        
        const { file_id: signFileId, storage_bucket: directBucket, storage_path: directPath } = body as {
          file_id?: string;
          storage_bucket?: string;
          storage_path?: string;
        };
        
        let bucket = directBucket;
        let path = directPath;
        let mimeType: string | null = null;
        
        // ✅ SECURITY: If file_id provided, verify ownership via portal_files_v1
        if (signFileId) {
          const { data: fileRecord, error: lookupErr } = await portalAdmin
            .from('portal_files_v1')
            .select('storage_bucket, storage_path, mime_type')
            .eq('id', signFileId)
            .eq('auth_user_id', authUserId)
            .single();
          
          if (lookupErr || !fileRecord) {
            console.error('[student-portal-api] ❌ File not found or not owned:', signFileId);
            return Response.json({ 
              ok: false, 
              error: 'FILE_NOT_FOUND',
              message: 'الملف غير موجود أو ليس لديك صلاحية الوصول'
            }, { status: 403, headers: corsHeaders });
          }
          
          bucket = fileRecord.storage_bucket;
          path = fileRecord.storage_path;
          mimeType = fileRecord.mime_type;
        } else if (directPath) {
          // ✅ SECURITY: Verify path starts with user's prefix
          const expectedPrefix = `users/${authUserId}/`;
          if (!directPath.startsWith(expectedPrefix)) {
            console.error('[student-portal-api] ❌ Unauthorized path:', directPath);
            return Response.json({ 
              ok: false, 
              error: 'UNAUTHORIZED_PATH',
              message: 'لا يمكنك الوصول لهذا الملف'
            }, { status: 403, headers: corsHeaders });
          }
        } else {
          return Response.json({ 
            ok: false, 
            error: 'file_id or storage_path required'
          }, { status: 400, headers: corsHeaders });
        }
        
        if (!bucket || !path) {
          return Response.json({ 
            ok: false, 
            error: 'storage_bucket and storage_path required'
          }, { status: 400, headers: corsHeaders });
        }
        
        // Generate signed URL (60 minutes)
        const { data: signedData, error: signErr } = await portalAdmin.storage
          .from(bucket)
          .createSignedUrl(path, 3600);
        
        if (signErr || !signedData?.signedUrl) {
          console.error('[student-portal-api] ❌ Sign URL error:', signErr);
          return Response.json({ 
            ok: false, 
            error: 'SIGN_FAILED',
            message: signErr?.message || 'فشل إنشاء رابط التحميل'
          }, { headers: corsHeaders });
        }
        
        console.log('[student-portal-api] ✅ Signed URL generated for:', path);
        return Response.json({ 
          ok: true, 
          signed_url: signedData.signedUrl,
          mime_type: mimeType
        }, { headers: corsHeaders });
      }

      // ============= Case Dashboard V1 (CRM Proxy ONLY) =============
      case 'get_case_dashboard_v1': {
        console.log('[student-portal-api] 📊 get_case_dashboard_v1 for:', authUserId);
        
        if (!CRM_SERVICE_ROLE_KEY || !CRM_SUPABASE_URL) {
          return Response.json({ ok: false, error: 'FEATURE_NOT_AVAILABLE' }, { headers: corsHeaders });
        }

        const { application_id: appId } = body as { application_id?: string | null };

        const crmDashClient = createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY);

        const { data: crmData, error: crmErr } = await crmDashClient.rpc('rpc_get_student_case_dashboard_v1', {
          p_auth_user_id: authUserId,
          p_application_id: appId ?? null,
        });

        if (crmErr) {
          console.error('[student-portal-api] ❌ CRM dashboard error:', crmErr);
          return Response.json({ ok: false, error: 'CRM_DASHBOARD_FAILED', details: crmErr.message }, { status: 400, headers: corsHeaders });
        }

        return Response.json(crmData, { headers: corsHeaders });
      }

      // ============= Accept Contract V1 (CRM Proxy ONLY) =============
      case 'accept_contract_v1': {
        console.log('[student-portal-api] ✍️ accept_contract_v1 for:', authUserId);
        
        if (!CRM_SERVICE_ROLE_KEY || !CRM_SUPABASE_URL) {
          return Response.json({ ok: false, error: 'FEATURE_NOT_AVAILABLE' }, { headers: corsHeaders });
        }

        const { contract_id, consent_version } = body as { contract_id: string; consent_version?: string };
        if (!contract_id) {
          return Response.json({ ok: false, error: 'MISSING_CONTRACT_ID' }, { status: 400, headers: corsHeaders });
        }

        // Get IP and User-Agent from request headers
        const signedIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;
        const signedUserAgent = req.headers.get('user-agent') || null;

        const crmContractClient = createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY);

        const { data: crmData, error: crmErr } = await crmContractClient.rpc('rpc_student_accept_contract_v1', {
          p_auth_user_id: authUserId,
          p_contract_id: contract_id,
          p_consent_version: consent_version ?? 'v1',
          p_signed_ip: signedIp,
          p_signed_user_agent: signedUserAgent,
        });

        if (crmErr) {
          console.error('[student-portal-api] ❌ CRM accept contract error:', crmErr);
          return Response.json({ ok: false, error: 'CRM_ACCEPT_CONTRACT_FAILED', details: crmErr.message }, { status: 400, headers: corsHeaders });
        }

        return Response.json(crmData, { headers: corsHeaders });
      }

      // ============= Set Delivery V1 (CRM Proxy ONLY) =============
      case 'set_delivery_v1': {
        console.log('[student-portal-api] 🚚 set_delivery_v1 for:', authUserId);
        
        if (!CRM_SERVICE_ROLE_KEY || !CRM_SUPABASE_URL) {
          return Response.json({ ok: false, error: 'FEATURE_NOT_AVAILABLE' }, { headers: corsHeaders });
        }

        const { application_id: deliveryAppId, delivery_type, address } = body as {
          application_id: string;
          delivery_type: string;
          address: Record<string, unknown>;
        };

        if (!deliveryAppId) {
          return Response.json({ ok: false, error: 'MISSING_APPLICATION_ID' }, { status: 400, headers: corsHeaders });
        }
        if (!delivery_type) {
          return Response.json({ ok: false, error: 'MISSING_DELIVERY_TYPE' }, { status: 400, headers: corsHeaders });
        }
        if (!address) {
          return Response.json({ ok: false, error: 'MISSING_ADDRESS' }, { status: 400, headers: corsHeaders });
        }

        const crmDeliveryClient = createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY);

        const { data: crmData, error: crmErr } = await crmDeliveryClient.rpc('rpc_student_set_delivery_v1', {
          p_auth_user_id: authUserId,
          p_application_id: deliveryAppId,
          p_delivery_type: delivery_type,
          p_address: address,
        });

        if (crmErr) {
          console.error('[student-portal-api] ❌ CRM set delivery error:', crmErr);
          return Response.json({ ok: false, error: 'CRM_SET_DELIVERY_FAILED', details: crmErr.message }, { status: 400, headers: corsHeaders });
        }

        return Response.json(crmData, { headers: corsHeaders });
      }

      // ============= Get Ready Files (Staff-uploaded for student) =============
      case 'get_ready_files': {
        console.log('[student-portal-api] 📁 get_ready_files for:', authUserId);
        
        // Try CRM first
        if (CRM_SERVICE_ROLE_KEY && CRM_SUPABASE_URL) {
          try {
            const crmFilesClient = createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY);
            const { data: crmFiles, error: crmErr } = await crmFilesClient.rpc('rpc_get_student_ready_files', {
              p_auth_user_id: authUserId
            });
            
            if (!crmErr && crmFiles) {
              console.log('[student-portal-api] ✅ Got ready files from CRM:', crmFiles?.length || 0);
              return Response.json({ ok: true, files: crmFiles || [] }, { headers: corsHeaders });
            }
            console.log('[student-portal-api] ℹ️ CRM RPC not available, trying Portal fallback');
          } catch (e) {
            console.log('[student-portal-api] ℹ️ CRM call failed, trying Portal fallback');
          }
        }
        
        // Fallback: Query portal_files_v1 for files uploaded by staff (file_origin = 'staff')
        const { data: portalFiles, error: portalErr } = await portalAdmin
          .from('portal_files_v1')
          .select('*')
          .eq('user_id', authUserId)
          .eq('file_origin', 'staff')
          .order('created_at', { ascending: false });
        
        if (portalErr) {
          console.error('[student-portal-api] ❌ Portal files query error:', portalErr);
          // Return empty if feature not available
          return Response.json({ ok: true, files: [] }, { headers: corsHeaders });
        }
        
        // Map to expected format
        const files = (portalFiles || []).map((f: any) => ({
          id: f.id,
          file_kind: f.file_kind,
          file_name: f.file_name,
          status: f.status || 'ready',
          uploaded_at: f.created_at,
          issued_at: f.issued_at,
          description: f.description,
          storage_bucket: f.storage_bucket,
          storage_path: f.storage_path
        }));
        
        console.log('[student-portal-api] ✅ Got ready files from Portal:', files.length);
        return Response.json({ ok: true, files }, { headers: corsHeaders });
      }

      // ============= Sign Ready File (for download) =============
      case 'sign_ready_file': {
        const { file_id } = body as { file_id: string };
        console.log('[student-portal-api] 🔏 sign_ready_file:', file_id);
        
        if (!file_id) {
          return Response.json({ ok: false, error: 'MISSING_FILE_ID' }, { status: 400, headers: corsHeaders });
        }
        
        // Get file record and verify ownership
        const { data: fileRecord, error: fileErr } = await portalAdmin
          .from('portal_files_v1')
          .select('storage_bucket, storage_path, user_id')
          .eq('id', file_id)
          .single();
        
        if (fileErr || !fileRecord) {
          console.error('[student-portal-api] ❌ File not found:', file_id);
          return Response.json({ ok: false, error: 'FILE_NOT_FOUND' }, { status: 404, headers: corsHeaders });
        }
        
        // Verify ownership
        if (fileRecord.user_id !== authUserId) {
          console.error('[student-portal-api] ❌ Unauthorized file access:', file_id);
          return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 403, headers: corsHeaders });
        }
        
        // Generate signed URL
        const { data: signedData, error: signErr } = await portalAdmin.storage
          .from(fileRecord.storage_bucket)
          .createSignedUrl(fileRecord.storage_path, 3600);
        
        if (signErr || !signedData?.signedUrl) {
          console.error('[student-portal-api] ❌ Sign URL error:', signErr);
          return Response.json({ ok: false, error: 'SIGN_FAILED' }, { headers: corsHeaders });
        }
        
        return Response.json({ ok: true, signed_url: signedData.signedUrl }, { headers: corsHeaders });
      }

      // ============= Student Card Snapshot (Aggregated View for Portal UI) =============
      case 'get_student_card_snapshot': {
        console.log('[student-portal-api] 📊 get_student_card_snapshot → aggregating profile + docs + payments');
        
        // 1. Get Profile (includes stage info)
        const profileRes = await fetchCrmProfileByAuthUserId(crmClient, authUserId!);
        
        if (!profileRes.ok || !profileRes.linked || !profileRes.profile) {
          console.log('[student-portal-api] ⚠️ No linked profile for snapshot');
          return Response.json({ 
            ok: true, 
            snapshot: null, 
            linked: false 
          }, { headers: corsHeaders });
        }
        
        const profile = profileRes.profile;
        
        // 2. Get Documents
        let documents: Array<{
          id: string;
          file_kind: string;
          file_name: string;
          review_status: 'pending' | 'approved' | 'rejected' | 'needs_fix';
          rejection_reason?: string | null;
          admin_notes?: string | null;
          uploaded_at?: string;
        }> = [];
        
        const { data: docsData } = await crmClient.rpc('rpc_get_student_documents_list', {
          p_auth_user_id: authUserId,
        });
        
        if (Array.isArray(docsData)) {
          documents = docsData.map((d: Record<string, unknown>) => ({
            id: String(d.id || ''),
            file_kind: String(d.file_kind || d.document_type || 'unknown'),
            file_name: String(d.file_name || d.original_name || ''),
            review_status: (d.review_status || d.status || 'pending') as 'pending' | 'approved' | 'rejected' | 'needs_fix',
            rejection_reason: d.rejection_reason as string | null,
            admin_notes: d.admin_notes as string | null,
            uploaded_at: d.uploaded_at as string | undefined || d.created_at as string | undefined,
          }));
        }
        
        // 3. Get Payments
        let payments: {
          total_due: number;
          total_paid: number;
          currency: string;
          recent_payments: Array<{
            id: string;
            amount: number;
            status: string;
            due_date?: string;
            description?: string;
          }>;
        } = {
          total_due: 0,
          total_paid: 0,
          currency: 'USD',
          recent_payments: [],
        };
        
        const crmAuthForDashPay = await resolveCrmAuthUserId(crmClient, portalAdmin, authUserId!);
        const { data: paysData } = await crmClient.rpc('rpc_get_student_payments_list', {
          p_auth_user_id: crmAuthForDashPay,
        });
        
        if (Array.isArray(paysData)) {
          payments.recent_payments = paysData.slice(0, 10).map((p: Record<string, unknown>) => ({
            id: String(p.id || ''),
            amount: Number(p.amount || p.amount_required || 0),
            status: String(p.status || 'pending'),
            due_date: p.due_date as string | undefined,
            description: p.description as string | undefined,
          }));
          
          // Calculate totals
          payments.total_paid = paysData
            .filter((p: Record<string, unknown>) => p.status === 'paid')
            .reduce((sum: number, p: Record<string, unknown>) => sum + Number(p.amount || p.amount_required || 0), 0);
          
          payments.total_due = paysData
            .filter((p: Record<string, unknown>) => p.status === 'pending')
            .reduce((sum: number, p: Record<string, unknown>) => sum + Number(p.amount || p.amount_required || 0), 0);
          
          if (paysData[0]?.currency) {
            payments.currency = String(paysData[0].currency);
          }
        }
        
        // 4. Get Shortlist count — v8.3: resolve CRM customer ID
        let shortlistCount = 0;
        const { crmCustomerId: acctCrmId } = await resolveCrmCustomerId(portalAdmin, authUserId!);
        const acctIdForCrm = acctCrmId || authUserId;
        console.log(`[account_summary] 🔑 Contract v9: p_auth_user_id=${safeId(authUserId)} p_customer_id=${safeId(acctIdForCrm)}`);
        const { data: shortlistData } = await crmClient.rpc('rpc_get_student_shortlist', {
          p_auth_user_id: authUserId,
          p_customer_id: acctIdForCrm,
        });
        if (Array.isArray(shortlistData)) {
          shortlistCount = shortlistData.filter((s: Record<string, unknown>) => s.status === 'shortlisted').length;
        }
        
        // 5. Build snapshot
        const snapshot = {
          customer_id: String(profile.customer_id || profile.id || ''),
          stage: String(profile.stage || 'new'),
          stage_label: profile.stage_label as string | undefined,
          profile_confirmed: Boolean(profile.profile_confirmed ?? profile.is_profile_complete ?? false),
          documents,
          payments,
          shortlist_count: shortlistCount,
          applications_count: Number(profile.applications_count ?? 0),
          rejected_docs_count: documents.filter(d => d.review_status === 'rejected' || d.review_status === 'needs_fix').length,
          pending_payments_count: payments.recent_payments.filter(p => p.status === 'pending').length,
          next_actions: [] as Array<{ type: string; priority: 'high' | 'medium' | 'low'; label: string; target_tab?: string }>,
          last_updated_at: new Date().toISOString(),
        };
        
        // 6. Generate next_actions based on state
        if (snapshot.rejected_docs_count > 0) {
          snapshot.next_actions.push({
            type: 'fix_documents',
            priority: 'high',
            label: `${snapshot.rejected_docs_count} مستند يحتاج إصلاح`,
            target_tab: 'documents',
          });
        }
        
        if (payments.total_due > 0) {
          snapshot.next_actions.push({
            type: 'pending_payment',
            priority: 'high',
            label: `دفعة مستحقة: ${payments.total_due} ${payments.currency}`,
            target_tab: 'payments',
          });
        }
        
        if (!snapshot.profile_confirmed) {
          snapshot.next_actions.push({
            type: 'complete_profile',
            priority: 'medium',
            label: 'أكمل ملفك الشخصي',
            target_tab: 'profile',
          });
        }
        
        console.log('[student-portal-api] ✅ Snapshot built:', {
          stage: snapshot.stage,
          docs: snapshot.documents.length,
          rejected: snapshot.rejected_docs_count,
          payments_due: payments.total_due,
          profile_confirmed: snapshot.profile_confirmed,
        });
        
        return Response.json({ ok: true, snapshot }, { headers: corsHeaders });
      }

      // ============= CRM Storage Proxy (Official Protocol) =============
      case 'crm_storage': {
        console.log('[student-portal-api] 📦 crm_storage action');
        
        const crm_action = (body as any).crm_action as CrmStorageAction;
        const payload = (body as any).payload || {};
        
        if (!crm_action) {
          return Response.json({ ok: false, error: 'MISSING_CRM_ACTION', http_status: 400 }, { status: 200, headers: corsHeaders });
        }
        
        if (!CRM_SERVICE_ROLE_KEY || !CRM_SUPABASE_URL) {
          console.error('[crm_storage] ❌ CRM credentials not configured');
          return Response.json({ ok: false, error: 'CRM_NOT_CONFIGURED', http_status: 500 }, { status: 200, headers: corsHeaders });
        }
        
        // Resolve identity for storage actions
        const profileRes = await fetchCrmProfileByAuthUserId(crmClient, authUserId!);
        const isAvatarAction =
          crm_action === 'set_avatar' ||
          (crm_action === 'prepare_upload' && (payload as any)?.file_kind === 'avatar');

        let customerId = '';
        let isStaffAvatarFlow = false;

        if (profileRes.ok && profileRes.linked && profileRes.profile) {
          customerId = String(profileRes.profile.customer_id || profileRes.profile.id);
          console.log('[crm_storage] ✅ Customer ID:', customerId, '| Action:', crm_action);
        } else {
          // Teacher/staff accounts may not have linked customer_id; allow avatar-only fallback
          const { authorized: isStaffAvatarAuthorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
          if (isAvatarAction && isStaffAvatarAuthorized) {
            isStaffAvatarFlow = true;
            customerId = String(authUserId);
            console.log('[crm_storage] ✅ Staff avatar fallback enabled:', { action: crm_action, user: safeId(authUserId) });
          } else {
            console.error('[crm_storage] ❌ Customer not linked:', profileRes.error_code);
            return Response.json({ 
              ok: false, 
              error: 'NOT_LINKED',
              error_code: 'customer_not_linked',
              message: 'حسابك غير مربوط بـ CRM. تواصل مع الدعم.',
              http_status: 400
            }, { status: 200, headers: corsHeaders });
          }
        }
        
        // Create CRM client with service role
        const crmStorageClient = createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY);
        
        switch (crm_action) {
          // ============= PREPARE UPLOAD =============
          case 'prepare_upload': {
            // ✅ P0: Server-side docs_locked check (skip for staff avatar fallback)
            const isDocsLocked = !isStaffAvatarFlow && profileRes.profile?.docs_locked === true;
            if (isDocsLocked) {
              const lockReason = String(profileRes.profile?.docs_lock_reason || 'المستندات مقفولة بواسطة الإدارة');
              console.log('[crm_storage] ⛔ DOCS_LOCKED - blocking upload');
              return Response.json({ 
                ok: false, 
                error: 'DOCS_LOCKED',
                message: lockReason,
                http_status: 403
              }, { status: 200, headers: corsHeaders });
            }

            const { bucket, file_kind, file_name } = payload as {
              bucket: string;
              file_kind: string;
              file_name: string;
            };
            
            if (!bucket || !file_kind || !file_name) {
              return Response.json({ ok: false, error: 'MISSING_PREPARE_PARAMS', details: 'bucket, file_kind, file_name required', http_status: 400 }, { status: 200, headers: corsHeaders });
            }
            
            // Sanitize filename
            const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
            const ts = Date.now();
            const storagePath = `${customerId}/${file_kind}/${ts}_${safeName}`;
            
            console.log('[crm_storage] prepare_upload →', { bucket, storagePath });
            
            // Create signed upload URL in CRM storage
            const { data: signedData, error: signErr } = await crmStorageClient.storage
              .from(bucket)
              .createSignedUploadUrl(storagePath);
            
            if (signErr || !signedData?.signedUrl) {
              console.error('[crm_storage] ❌ createSignedUploadUrl failed:', signErr);
              return Response.json({ 
                ok: false, 
                error: 'PREPARE_FAILED',
                details: signErr?.message || 'Could not create signed URL',
                http_status: 500
              }, { status: 200, headers: corsHeaders });
            }
            
            console.log('[crm_storage] ✅ prepare_upload success:', storagePath);
            return Response.json({
              ok: true,
              bucket,
              path: storagePath,
              signed_url: signedData.signedUrl,
              token: signedData.token,
              expires_in: 600, // 10 minutes
            }, { headers: corsHeaders });
          }
          
          // ============= CONFIRM UPLOAD =============
          case 'confirm_upload': {
            // ✅ P0: Server-side docs_locked check
            const isDocsLockedConfirm = profileRes.profile?.docs_locked === true;
            if (isDocsLockedConfirm) {
              const lockReasonConfirm = String(profileRes.profile?.docs_lock_reason || 'المستندات مقفولة بواسطة الإدارة');
              console.log('[crm_storage] ⛔ DOCS_LOCKED - blocking confirm');
              return Response.json({ 
                ok: false, 
                error: 'DOCS_LOCKED',
                message: lockReasonConfirm,
                http_status: 403
              }, { status: 200, headers: corsHeaders });
            }

            const { bucket, path, file_kind, file_name, mime_type, size_bytes, description } = payload as {
              bucket: string;
              path: string;
              file_kind: string;
              file_name: string;
              mime_type?: string;
              size_bytes?: number;
              description?: string;
            };
            
            if (!bucket || !path || !file_kind || !file_name) {
              return Response.json({ ok: false, error: 'MISSING_CONFIRM_PARAMS', http_status: 400 }, { status: 200, headers: corsHeaders });
            }
            
            console.log('[crm_storage] confirm_upload →', { bucket, path });
            
            // ── Verify the file exists in CRM storage ─────────────
            // Real cause of the OBJECT_NOT_FOUND we saw on slow networks:
            //   1. PUT to signed URL succeeded
            //   2. Storage list() result was cached/eventually-consistent
            //      and didn't yet expose the new object name.
            // Fix: probe with `createSignedUrl` (which calls the auth
            // service directly and returns 404 if the object truly does
            // not exist) and only fall back to `list()` once. Total budget
            // ~9.5s with 6 retries (was ~3.5s with 3 retries).
            let objectExists = false;
            const probeRetryDelays = [200, 400, 800, 1500, 2500, 4000];
            const dirPath = path.substring(0, path.lastIndexOf('/'));
            const fileName = path.substring(path.lastIndexOf('/') + 1);

            for (let attempt = 0; attempt < probeRetryDelays.length; attempt++) {
              if (attempt > 0) {
                await new Promise(r => setTimeout(r, probeRetryDelays[attempt - 1]));
              }

              // Primary probe: try to sign a short-lived URL. Storage
              // returns an error iff the object does not exist.
              const { data: probeSigned, error: probeErr } = await crmStorageClient.storage
                .from(bucket)
                .createSignedUrl(path, 30);

              if (probeSigned?.signedUrl && !probeErr) {
                objectExists = true;
                console.log(`[crm_storage] ✅ Object verified via signed-url probe on attempt ${attempt + 1}`);
                break;
              }

              // Secondary probe: list the directory (cheap, occasionally
              // succeeds when the storage cache hasn't refreshed yet).
              const { data: files } = await crmStorageClient.storage
                .from(bucket)
                .list(dirPath, { limit: 100 });

              if (files?.some(f => f.name === fileName)) {
                objectExists = true;
                console.log(`[crm_storage] ✅ Object verified via list on attempt ${attempt + 1}`);
                break;
              }

              console.log(`[crm_storage] ⏳ Object not visible yet, attempt ${attempt + 1}/${probeRetryDelays.length} (sign_err=${probeErr?.message ?? 'none'})`);
            }

            if (!objectExists) {
              console.error('[crm_storage] ❌ Object not found after retries:', path);
              return Response.json({
                ok: false,
                error: 'OBJECT_NOT_FOUND',
                details: 'File not found in storage after upload (after ~9.5s probe budget). PUT may have silently failed.',
                http_status: 400
              }, { status: 200, headers: corsHeaders });
            }
            
            // Register in CRM database
            const fileUrl = `storage://${bucket}/${path}`;
            
            // ✅ VERSION LOG: Payload keys for debugging
            console.log('[confirm_upload] insert keys: customer_id, file_kind, file_name, storage_bucket, storage_path, mime_type, size_bytes, visibility, uploaded_by_role, status, review_status');
            console.log('[confirm_upload] customer_id:', customerId, 'kind:', file_kind, 'bucket:', bucket, 'path:', path);
            
            // ✅ FIXED: Direct insert only - skip RPC to avoid auth_user_id issues
            // The CRM RPC may expect auth_user_id which doesn't exist in customer_files table
            const insertPayload = {
              customer_id: customerId,
              file_kind,
              file_name,
              file_url: fileUrl,
              storage_bucket: bucket,
              storage_path: path,
              mime_type: mime_type || 'application/octet-stream',
              size_bytes: size_bytes || 0,
              description: description || null,
              status: 'pending',
              uploaded_by_role: 'student',
              visibility: 'student_visible',
              review_status: 'pending',
            };
            
            console.log('[confirm_upload] insertPayload keys:', Object.keys(insertPayload));
            
            const { data: insertData, error: insertErr } = await crmStorageClient
              .from('customer_files')
              .insert(insertPayload)
              .select('id')
              .single();
            
            if (insertErr) {
              console.error('[crm_storage] ❌ Direct insert failed:', insertErr);
              return Response.json({ 
                ok: false, 
                error: 'CONFIRM_FAILED',
                details: insertErr.message,
                http_status: 500
              }, { status: 200, headers: corsHeaders });
            }
            
            console.log('[crm_storage] ✅ confirm_upload via direct insert:', insertData?.id);
            return Response.json({ ok: true, file_id: insertData?.id }, { headers: corsHeaders });
          }
          
          // ============= LIST FILES =============
          case 'list_files': {
            console.log('[crm_storage] list_files for customer:', customerId);
            
            // ✅ CUTOVER STRICT: Only student_visible files (NO null), active status only
            const { data: files, error: listErr } = await crmStorageClient
              .from('customer_files')
              .select('id, file_kind, file_name, file_url, storage_bucket, storage_path, mime_type, size_bytes, status, admin_notes, created_at, visibility, review_status, student_visible_note, rejection_reason')
              .eq('customer_id', customerId)
              .is('deleted_at', null)
              .eq('visibility', 'student_visible')  // ✅ STRICT: Only student_visible (NO null/legacy)
              .not('status', 'in', '(deleted,superseded)')  // ✅ Exclude deleted & superseded
              .order('created_at', { ascending: false });
            
            if (listErr) {
              console.error('[crm_storage] ❌ list_files error:', listErr);
              return Response.json({ ok: false, error: listErr.message, http_status: 500 }, { status: 200, headers: corsHeaders });
            }
            
            // ✅ Debug: Log first 5 IDs for cutover verification
            const first5 = (files || []).slice(0, 5).map((f: any) => ({ id: f.id, kind: f.file_kind, bucket: f.storage_bucket }));
            console.log('[crm_storage] ✅ list_files:', { count: files?.length || 0, first_5: first5 });
            
            return Response.json({ ok: true, files: files || [] }, { headers: corsHeaders });
          }
          
          // ============= SIGN FILE =============
          case 'sign_file': {
            const { file_id } = payload as { file_id: string };
            
            if (!file_id) {
              return Response.json({ ok: false, error: 'MISSING_FILE_ID', http_status: 400 }, { status: 200, headers: corsHeaders });
            }
            
            console.log('[crm_storage] sign_file:', file_id);
            
            // Get file record and verify ownership
            const { data: fileRec, error: fileErr } = await crmStorageClient
              .from('customer_files')
              .select('storage_bucket, storage_path, customer_id')
              .eq('id', file_id)
              .single();
            
            if (fileErr || !fileRec) {
              console.error('[crm_storage] ❌ File not found:', file_id);
              return Response.json({ ok: false, error: 'FILE_NOT_FOUND', http_status: 404 }, { status: 200, headers: corsHeaders });
            }
            
            // Verify ownership
            if (fileRec.customer_id !== customerId) {
              console.error('[crm_storage] ❌ Unauthorized:', fileRec.customer_id, '≠', customerId);
              return Response.json({ ok: false, error: 'UNAUTHORIZED', http_status: 403 }, { status: 200, headers: corsHeaders });
            }
            
            // Generate signed URL with hard 8s timeout to prevent IDLE_TIMEOUT (150s) hangs
            // when storage object is missing or storage API stalls
            const signPromise = crmStorageClient.storage
              .from(fileRec.storage_bucket)
              .createSignedUrl(fileRec.storage_path, 3600);

            const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
              setTimeout(() => resolve({ data: null, error: { message: 'SIGN_TIMEOUT_8S' } }), 8000)
            );

            const { data: signedData, error: signErr } = await Promise.race([signPromise, timeoutPromise]) as any;

            if (signErr || !signedData?.signedUrl) {
              console.error('[crm_storage] ❌ Sign error:', signErr);
              return Response.json(
                { ok: false, error: 'SIGN_FAILED', detail: signErr?.message || 'unknown', http_status: 500 },
                { status: 200, headers: corsHeaders }
              );
            }

            console.log('[crm_storage] ✅ sign_file success');
            return Response.json({ ok: true, signed_url: signedData.signedUrl }, { headers: corsHeaders });
          }

          // ============= PADDLE STRUCTURE PROXY (CRM-aware) =============
          // Resolves the file from CRM truth (customer_id ownership), signs a
          // short-lived URL on CRM storage, and forwards to the Paddle endpoint.
          // This is the single entry point used by PaddleReader so the client
          // never has to know whether storage lives in app or CRM.
          case 'paddle_structure_proxy': {
            const PADDLE_ENDPOINT = Deno.env.get('PADDLE_STRUCTURE_ENDPOINT');
            const PADDLE_API_KEY = Deno.env.get('PADDLE_API_KEY');
            // Timeout chosen for student documents:
            //   - typical passport/ID image ≈ 2–6s
            //   - multi-page born-digital PDF ≈ 8–25s
            //   - scanned multi-page transcript PDF can hit 40–60s
            // After the hard cutover there is no browser fallback to catch
            // long PDFs, so 25s was killing real student transcripts.
            // 75s gives heavy PDFs room without parking the request forever.
            const PADDLE_TIMEOUT_MS = 75_000;
            const PADDLE_TTL = 120;

            const { document_id, storage_path, storage_bucket, file_id, mime_type, file_name } = payload as {
              document_id?: string;
              storage_path?: string;
              storage_bucket?: string;
              file_id?: string;
              mime_type?: string;
              file_name?: string;
            };

            // Helper: wrap the Paddle envelope inside `data` so the portal
            // wrapper (`portalInvoke`) does NOT collapse `ok:false` envelopes
            // into a generic transport error and so the success envelope's
            // `result` field survives the unwrap step on the client.
            const paddleEnvelope = (env: Record<string, unknown>) =>
              Response.json({ ok: true, data: env }, { headers: corsHeaders });

            console.log('[paddle_proxy] ▶ entered case', {
              has_doc_id: !!document_id,
              has_storage_path: !!storage_path,
              has_file_id: !!file_id,
              mime_type,
              customer: customerId,
            });

            if (!document_id || !mime_type || !file_name) {
              return paddleEnvelope({ ok: false, stage: 'request', reason: 'missing_fields', error_message: 'document_id, mime_type, file_name required' });
            }
            if (!file_id && !storage_path) {
              return paddleEnvelope({ ok: false, stage: 'request', reason: 'missing_fields', error_message: 'file_id or storage_path required' });
            }
            if (!PADDLE_ENDPOINT) {
              return paddleEnvelope({ ok: false, stage: 'config', reason: 'no_endpoint_configured', error_message: 'PADDLE_STRUCTURE_ENDPOINT not set' });
            }
            // ── Ownership resolution ──────────────────────────────
            let resolvedBucket = storage_bucket || 'student-docs';
            let resolvedPath = storage_path || '';

            if (file_id) {
              const { data: fileRec, error: fileErr } = await crmStorageClient
                .from('customer_files')
                .select('storage_bucket, storage_path, customer_id')
                .eq('id', file_id)
                .maybeSingle();

              if (fileErr || !fileRec) {
                return paddleEnvelope({ ok: false, stage: 'ownership', reason: 'file_not_found', error_message: fileErr?.message ?? null });
              }
              if (fileRec.customer_id !== customerId) {
                console.log('[paddle_proxy] ✗ ownership mismatch', { fileCustomer: fileRec.customer_id, caller: customerId });
                return paddleEnvelope({ ok: false, stage: 'ownership', reason: 'storage_path_forbidden', error_message: 'customer_id mismatch' });
              }
              resolvedBucket = fileRec.storage_bucket || resolvedBucket;
              resolvedPath = fileRec.storage_path || resolvedPath;
            } else {
              // storage_path-only path: enforce <customerId>/ prefix
              const normalized = resolvedPath.startsWith(`${resolvedBucket}/`)
                ? resolvedPath.slice(resolvedBucket.length + 1)
                : resolvedPath;
              const ownedPrefixes = [`${customerId}/`, `user/${customerId}/`];
              const owned = ownedPrefixes.some((p) => normalized.startsWith(p));
              if (!owned) {
                console.log('[paddle_proxy] ✗ path not owned', { normalized, customerId });
                return paddleEnvelope({ ok: false, stage: 'ownership', reason: 'storage_path_forbidden', error_message: 'path prefix mismatch' });
              }
              resolvedPath = normalized;
            }

            // ── Sign short-lived URL on CRM storage ──────────────
            const { data: signed, error: signErr } = await crmStorageClient.storage
              .from(resolvedBucket)
              .createSignedUrl(resolvedPath, PADDLE_TTL);

            if (signErr || !signed?.signedUrl) {
              console.log('[paddle_proxy] ✗ sign failed', { resolvedBucket, resolvedPath, err: signErr?.message });
              return paddleEnvelope({ ok: false, stage: 'sign', reason: 'signed_url_failed', error_message: signErr?.message ?? null });
            }
            // ── Call Paddle service ──────────────────────────────
            console.log('[paddle_proxy] ▶ calling Paddle', {
              endpoint: PADDLE_ENDPOINT,
              bucket: resolvedBucket,
              path_prefix: resolvedPath.split('/').slice(0, 2).join('/'),
              file_name,
              mime_type,
            });
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), PADDLE_TIMEOUT_MS);
            const startedAt = Date.now();
            try {
              const paddleResp = await fetch(PADDLE_ENDPOINT, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(PADDLE_API_KEY ? { Authorization: `Bearer ${PADDLE_API_KEY}` } : {}),
                },
                body: JSON.stringify({
                  signed_url: signed.signedUrl,
                  mime_type,
                  file_name,
                  url_ttl_seconds: PADDLE_TTL,
                }),
                signal: controller.signal,
              });
              clearTimeout(timer);

              const rawText = await paddleResp.text().catch(() => '');
              const latency_ms = Date.now() - startedAt;
              console.log('[paddle_proxy] upstream', {
                status: paddleResp.status,
                latency_ms,
                preview: rawText.slice(0, 200),
              });

              if (!paddleResp.ok) {
                return paddleEnvelope({
                  ok: false,
                  stage: 'provider',
                  reason: paddleResp.status >= 500 ? 'service_5xx' : 'service_error',
                  error_message: `status=${paddleResp.status} ${rawText.slice(0, 200)}`,
                  latency_ms,
                });
              }

              let result: unknown = null;
              try { result = JSON.parse(rawText); } catch { /* noop */ }
              if (!result || typeof result !== 'object' || !Array.isArray((result as { pages?: unknown }).pages)) {
                return paddleEnvelope({
                  ok: false,
                  stage: 'provider',
                  reason: 'invalid_paddle_response',
                  error_message: `body=${rawText.slice(0, 200)}`,
                  latency_ms,
                });
              }

              return paddleEnvelope({ ok: true, result, latency_ms });
            } catch (err) {
              clearTimeout(timer);
              const msg = err instanceof Error ? err.message : 'unknown_error';
              const isAbort = msg.toLowerCase().includes('abort');
              return paddleEnvelope({
                ok: false,
                stage: 'network',
                reason: isAbort ? 'timeout' : 'network_error',
                error_message: msg,
                latency_ms: Date.now() - startedAt,
              });
            }
          }

          // ============= SET AVATAR =============
          case 'set_avatar': {
            const { path } = payload as { path: string };
            
            if (!path) {
              return Response.json({ ok: false, error: 'MISSING_AVATAR_PATH' }, { headers: corsHeaders });
            }

            const { data: avatarUserData } = await portalAdmin.auth.admin.getUserById(authUserId!);
            const gtpEmail = avatarUserData?.user?.email;
            
            console.log('[crm_storage] set_avatar:', path);
            
            // ✅ Build public URL from CRM storage (avatars bucket is public)
            const publicUrl = `${CRM_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
            
            // Staff teacher flow: persist on staff table directly
            if (isStaffAvatarFlow) {
              const { error: staffUpdateErr } = await crmStorageClient
                .from('staff')
                .update({ avatar_url: publicUrl })
                .eq('email', gtpEmail || '');

              if (staffUpdateErr) {
                console.warn('[crm_storage] ⚠️ Staff avatar update skipped:', staffUpdateErr.message);
              } else {
                console.log('[crm_storage] ✅ set_avatar via staff update');
              }
              return Response.json({ ok: true, file_url: publicUrl }, { headers: corsHeaders });
            }

            // Customer flow: update by customer_id DIRECTLY.
            // The RPC `rpc_portal_set_customer_avatar_v1` matches by p_auth_user_id, which can
            // silently no-op when the customer's stored auth_user_id does not match the current
            // session's auth user (multi-link / re-auth scenarios). Updating by `customers.id`
            // (resolved via fetchCrmProfileByAuthUserId) is authoritative.
            if (!customerId) {
              return Response.json({ ok: false, error: 'NO_CUSTOMER_ID', http_status: 400 }, { status: 200, headers: corsHeaders });
            }

            const { data: updatedRow, error: updateErr } = await crmStorageClient
              .from('customers')
              .update({ avatar_url: publicUrl })
              .eq('id', customerId)
              .select('id, avatar_url')
              .maybeSingle();

            if (updateErr) {
              console.error('[crm_storage] ❌ Avatar update failed:', updateErr);
              return Response.json({ ok: false, error: `set_avatar: ${updateErr.message}`, http_status: 400 }, { status: 200, headers: corsHeaders });
            }

            console.log('[crm_storage] ✅ set_avatar via direct customer update:', updatedRow);

            // Best-effort: also notify the legacy RPC (for any downstream listeners), but ignore errors.
            try {
              await crmStorageClient.rpc('rpc_portal_set_customer_avatar_v1', {
                p_auth_user_id: authUserId,
                p_storage_path: path,
                p_public_url: publicUrl,
              });
            } catch (rpcErr) {
              console.warn('[crm_storage] RPC notify (non-fatal):', rpcErr);
            }

            return Response.json({ ok: true, file_url: publicUrl }, { headers: corsHeaders });
          }
          
          // ============= DELETE FILE =============
          case 'delete_file': {
            // ✅ P0: Server-side docs_locked check
            const isDocsLockedDelete = profileRes.profile?.docs_locked === true;
            if (isDocsLockedDelete) {
              const lockReasonDelete = String(profileRes.profile?.docs_lock_reason || 'المستندات مقفولة');
              console.log('[crm_storage] ⛔ DOCS_LOCKED - blocking delete');
              return Response.json({ 
                ok: false, 
                error: 'DOCS_LOCKED',
                message: lockReasonDelete,
                http_status: 403
              }, { status: 200, headers: corsHeaders });
            }
            
            const { file_id } = payload as { file_id: string };
            
            if (!file_id) {
              return Response.json({ ok: false, error: 'MISSING_FILE_ID' }, { headers: corsHeaders });
            }
            
            console.log('[crm_storage] delete_file:', file_id);
            
            // Get file record and verify ownership
            const { data: fileRec, error: fileErr } = await crmStorageClient
              .from('customer_files')
              .select('id, storage_bucket, storage_path, customer_id')
              .eq('id', file_id)
              .single();
            
            if (fileErr || !fileRec) {
              console.error('[crm_storage] ❌ File not found:', file_id);
              return Response.json({ ok: false, error: 'FILE_NOT_FOUND' }, { headers: corsHeaders });
            }
            
            // Verify ownership
            if (fileRec.customer_id !== customerId) {
              console.error('[crm_storage] ❌ Unauthorized delete:', fileRec.customer_id, '≠', customerId);
              return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { headers: corsHeaders });
            }
            
            // Delete from storage
            const { error: rmErr } = await crmStorageClient.storage
              .from(fileRec.storage_bucket)
              .remove([fileRec.storage_path]);
            
            if (rmErr) {
              console.error('[crm_storage] ⚠️ Storage delete warning:', rmErr);
              // Continue - we still want to delete the DB record
            }
            
            // ✅ FIX: Soft delete using only deleted_at (no status='deleted' - check constraint)
            const { error: dbErr } = await crmStorageClient
              .from('customer_files')
              .update({ 
                deleted_at: new Date().toISOString() 
              })
              .eq('id', file_id);
            
            if (dbErr) {
              console.error('[crm_storage] ❌ DB soft delete failed:', dbErr);
              return Response.json({ ok: false, error: dbErr.message, http_status: 500 }, { status: 200, headers: corsHeaders });
            }
            
            console.log('[crm_storage] ✅ delete_file success:', file_id);
            return Response.json({ ok: true, deleted: file_id }, { headers: corsHeaders });
          }
          
          // ============= CLEAR ALL FILES =============
          case 'clear_all_files': {
            // ✅ P0: Server-side docs_locked check
            const isDocsLockedClear = profileRes.profile?.docs_locked === true;
            if (isDocsLockedClear) {
              const lockReasonClear = String(profileRes.profile?.docs_lock_reason || 'المستندات مقفولة');
              console.log('[crm_storage] ⛔ DOCS_LOCKED - blocking clear_all');
              return Response.json({ 
                ok: false, 
                error: 'DOCS_LOCKED',
                message: lockReasonClear,
                http_status: 403
              }, { status: 200, headers: corsHeaders });
            }
            
            console.log('[crm_storage] 🗑️ clear_all_files for customer:', customerId);
            
            // ✅ FIX: Get all non-deleted files using deleted_at IS NULL
            const { data: allFiles, error: listErr } = await crmStorageClient
              .from('customer_files')
              .select('id, storage_bucket, storage_path')
              .eq('customer_id', customerId)
              .is('deleted_at', null);
            
            if (listErr) {
              console.error('[crm_storage] ❌ List files error:', listErr);
              return Response.json({ ok: false, error: listErr.message, http_status: 500 }, { status: 200, headers: corsHeaders });
            }
            
            if (!allFiles || allFiles.length === 0) {
              console.log('[crm_storage] ℹ️ No files to delete');
              return Response.json({ ok: true, deleted_count: 0, deleted: [] }, { headers: corsHeaders });
            }
            
            console.log('[crm_storage] 📁 Found', allFiles.length, 'files to delete');
            
            const deleted: string[] = [];
            const errors: string[] = [];
            
            for (const file of allFiles) {
              // Delete from storage
              const { error: rmErr } = await crmStorageClient.storage
                .from(file.storage_bucket)
                .remove([file.storage_path]);
              
              if (rmErr) {
                console.error('[crm_storage] ⚠️ Storage delete warning for', file.id, ':', rmErr);
                errors.push(`${file.id}: ${rmErr.message}`);
                // Continue - we still want to soft delete
              }
              
              // ✅ FIX: Soft delete using only deleted_at (no status='deleted')
              const { error: dbErr } = await crmStorageClient
                .from('customer_files')
                .update({ 
                  deleted_at: new Date().toISOString() 
                })
                .eq('id', file.id);
              
              if (dbErr) {
                console.error('[crm_storage] ❌ DB soft delete failed for', file.id, ':', dbErr);
                errors.push(`${file.id}: ${dbErr.message}`);
              } else {
                deleted.push(file.id);
              }
            }
            
            console.log('[crm_storage] ✅ clear_all_files done:', deleted.length, 'deleted,', errors.length, 'errors');
            return Response.json({ 
              ok: true, 
              deleted_count: deleted.length, 
              deleted,
              errors: errors.length > 0 ? errors : undefined
            }, { headers: corsHeaders });
          }
          
          // ============= PURGE ALL FILES (Admin/Staff ONLY - clean cutover) =============
          case 'purge_all_files': {
            // ❌ SECURITY: This action is Admin/Staff only - students cannot purge their files
            console.error('[crm_storage] ❌ purge_all_files blocked - Admin/Staff only action');
            return Response.json({ 
              ok: false, 
              error: 'FORBIDDEN_ADMIN_ONLY',
              message: 'هذه العملية متاحة للإدارة فقط',
              http_status: 403 
            }, { status: 200, headers: corsHeaders });
          }
          
          default:
            return Response.json({ ok: false, error: `Unknown crm_action: ${crm_action}`, http_status: 400 }, { status: 200, headers: corsHeaders });
        }
      }

      // ============= SYNC PROGRAM CHOICE TO CRM =============
      case 'sync_program_choice': {
        console.log('[student-portal-api] 🎯 sync_program_choice for:', authUserId);
        
        const program_id = body.program_id;
        const program_source = body.program_source;
        const program_snapshot = body.program_snapshot;
        
        if (!program_id) {
          return Response.json({ 
            ok: false, 
            error: 'program_id required'
          }, { status: 400, headers: corsHeaders });
        }
        
        try {
          const { data: crmResult, error: crmErr } = await crmClient.rpc('rpc_portal_set_student_program_choice_v1', {
            p_auth_user_id: authUserId,
            p_program_source: program_source || 'portal',
            p_program_external_id: program_id,
            p_program_snapshot: program_snapshot || null,
          });
          
          if (crmErr) {
            console.error('[student-portal-api] ❌ sync_program_choice CRM error:', crmErr);
            return Response.json({ 
              ok: false, 
              error: 'CRM_RPC_FAILED',
              message: crmErr.message
            }, { headers: corsHeaders });
          }
          
          console.log('[student-portal-api] ✅ sync_program_choice success:', crmResult);
          return Response.json({ 
            ok: true, 
            synced: true,
            data: crmResult
          }, { headers: corsHeaders });
          
        } catch (e) {
          console.error('[student-portal-api] ❌ sync_program_choice exception:', e);
          return Response.json({ 
            ok: false, 
            error: 'SYNC_EXCEPTION',
            message: String(e)
          }, { headers: corsHeaders });
        }
      }
      
      // ============= SYNC SERVICE CHOICES TO CRM =============
      case 'sync_service_choices': {
        console.log('[student-portal-api] 🛠️ sync_service_choices for:', authUserId);
        
        const services_selection = body.services_selection;
        const country_code = body.country_code;
        const program_id = body.program_id;
        
        if (!services_selection) {
          return Response.json({ 
            ok: false, 
            error: 'services_selection required'
          }, { status: 400, headers: corsHeaders });
        }
        
        try {
          const { data: crmResult, error: crmErr } = await crmClient.rpc('rpc_portal_set_student_service_choices_v1', {
            p_auth_user_id: authUserId,
            p_services_selection: services_selection,
            p_country_code: country_code || null,
            p_program_id: program_id || null,
          });
          
          if (crmErr) {
            console.error('[student-portal-api] ❌ sync_service_choices CRM error:', crmErr);
            return Response.json({ 
              ok: false, 
              error: 'CRM_RPC_FAILED',
              message: crmErr.message
            }, { headers: corsHeaders });
          }
          
          console.log('[student-portal-api] ✅ sync_service_choices success:', crmResult);
          return Response.json({ 
            ok: true, 
            synced: true,
            data: crmResult
          }, { headers: corsHeaders });
          
        } catch (e) {
          console.error('[student-portal-api] ❌ sync_service_choices exception:', e);
          return Response.json({ 
            ok: false, 
            error: 'SYNC_EXCEPTION',
            message: String(e)
          }, { headers: corsHeaders });
        }
      }

      // ============= #7.2 SHORTLIST API (Portal DB - limit=10) =============
      
      // ✅ shortlist_list - List user's shortlist (v8.2: resolves CRM customer ID)
      case 'shortlist_list': {
        console.log('[SHORTLIST_API] shortlist_list for portal_auth:', authUserId);
        
        // ✅ v8.2: Resolve CRM customer ID using shared resolver (parity with write path)
        const { crmCustomerId: slCustomerId, source: slSource } = await resolveCrmCustomerId(portalAdmin, authUserId!);
        console.log(`[SHORTLIST_API] shortlist_list identity: crm=${slCustomerId?.slice(0,12) ?? 'null'} source=${slSource}`);
        
        if (slCustomerId) {
          // ✅ v9: Query CRM using p_customer_id (identity) + p_auth_user_id (audit)
          console.log(`[shortlist_list] 🔑 Contract v9: p_auth_user_id=${safeId(authUserId)} p_customer_id=${safeId(slCustomerId)}`);
          const { data: crmData, error: crmErr } = await crmClient.rpc('rpc_get_student_shortlist', {
            p_auth_user_id: authUserId,
            p_customer_id: slCustomerId,
          });
          
          if (!crmErr && Array.isArray(crmData)) {
            const shortlisted = crmData.filter((r: any) => r.status === 'shortlisted');
            const items = shortlisted.map((r: any) => ({
              program_id: r.program_ref_id || r.program_id,
              created_at: r.created_at,
            }));
            console.log(`[SHORTLIST_API] shortlist_list CRM ok count=${items.length}`);
            return Response.json({ ok: true, count: items.length, limit: 10, items }, { headers: corsHeaders });
          }
          
          if (crmErr) {
            console.warn('[SHORTLIST_API] CRM RPC failed, falling back to portal_shortlist:', crmErr.message);
          }
        }
        
        // Fallback: portal_shortlist table (for unmapped users)
        const { data: portalData, error: portalErr } = await portalAdmin
          .from('portal_shortlist')
          .select('program_id, created_at')
          .eq('auth_user_id', authUserId);
        
        if (portalErr) {
          console.error('[SHORTLIST_API] portal_shortlist fallback error:', portalErr);
          return Response.json({ ok: true, count: 0, limit: 10, items: [] }, { headers: corsHeaders });
        }
        
        const fallbackItems = (portalData ?? []).map((r: any) => ({
          program_id: r.program_id,
          created_at: r.created_at,
        }));
        
        console.log(`[SHORTLIST_API] shortlist_list portal_fallback count=${fallbackItems.length}`);
        return Response.json({ ok: true, count: fallbackItems.length, limit: 10, items: fallbackItems }, { headers: corsHeaders });
      }
      
      // ❌ REMOVED: Duplicate shortlist_add/shortlist_remove handlers (dead code)
      // CRM sync handled by primary handlers above with portal_customer_map resolution
      
      // ✅ shortlist_compare - Get program data for compare UI
      case 'shortlist_compare': {
        console.log('[SHORTLIST_API] shortlist_compare for:', authUserId);
        
        // Use ANON key + user JWT so auth.uid() works inside RPC
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader! } }
        });
        
        // 1) Get shortlist items (max 10)
        const { data: listData, error: listErr } = await userClient.rpc('rpc_shortlist_list');
        
        if (listErr) {
          console.error('[SHORTLIST_API] compare list error:', listErr);
          return Response.json({ ok: false, error_code: 'rpc_failed', error: listErr.message }, { 
            status: 502, 
            headers: corsHeaders 
          });
        }
        
        const ids: string[] = (listData?.items ?? []).map((x: { program_id: string }) => x.program_id).filter(Boolean);
        
        if (ids.length === 0) {
          return Response.json({ ok: true, items: [], count: 0 }, { headers: corsHeaders });
        }
        
        // 2) Fetch compare fields from view (using service role for read)
        const { data, error } = await portalAdmin
          .from('vw_program_search_api_v3_final')
          .select('program_id, program_name_ar, program_name_en, country_code, university_name_ar, university_name_en, tuition_usd_year_max, duration_months, instruction_languages, has_dorm, scholarship_available, discipline_slug, degree_slug, ranking, monthly_living_usd')
          .in('program_id', ids);
        
        if (error) {
          console.error('[SHORTLIST_API] compare fetch error:', error);
          return Response.json({ ok: false, error_code: 'compare_fetch_failed', error: error.message }, { 
            status: 502, 
            headers: corsHeaders 
          });
        }
        
        console.log(`[SHORTLIST_API] shortlist_compare ok=true count=${data?.length ?? 0}`);
        return Response.json({ ok: true, count: data?.length ?? 0, items: data ?? [] }, { headers: corsHeaders });
      }

      // ✅ University Shortlist - List
      case 'uni_shortlist_list': {
        console.log('[UNI_SHORTLIST_API] uni_shortlist_list for:', authUserId);
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader! } }
        });
        const { data, error } = await userClient.rpc('rpc_uni_shortlist_list');
        if (error) {
          console.error('[UNI_SHORTLIST_API] list error:', error);
          return Response.json({ ok: false, error_code: 'rpc_failed', error: error.message }, { status: 502, headers: corsHeaders });
        }
        return Response.json(data, { headers: corsHeaders });
      }

      // ✅ University Shortlist - Add
      case 'uni_shortlist_add': {
        console.log('[UNI_SHORTLIST_API] uni_shortlist_add for:', authUserId);
        const university_id = body.university_id;
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!university_id || !UUID_RE.test(String(university_id))) {
          return Response.json({ ok: false, error_code: 'invalid_university_id' }, { status: 422, headers: corsHeaders });
        }
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader! } }
        });
        const { data, error } = await userClient.rpc('rpc_uni_shortlist_add', { p_university_id: university_id });
        if (error) {
          console.error('[UNI_SHORTLIST_API] add error:', error);
          return Response.json({ ok: false, error_code: 'rpc_failed', error: error.message }, { status: 502, headers: corsHeaders });
        }
        return Response.json(data, { headers: corsHeaders });
      }

      // ✅ University Shortlist - Remove
      case 'uni_shortlist_remove': {
        console.log('[UNI_SHORTLIST_API] uni_shortlist_remove for:', authUserId);
        const university_id = body.university_id;
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!university_id || !UUID_RE.test(String(university_id))) {
          return Response.json({ ok: false, error_code: 'invalid_university_id' }, { status: 422, headers: corsHeaders });
        }
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader! } }
        });
        const { data, error } = await userClient.rpc('rpc_uni_shortlist_remove', { p_university_id: university_id });
        if (error) {
          console.error('[UNI_SHORTLIST_API] remove error:', error);
          return Response.json({ ok: false, error_code: 'rpc_failed', error: error.message }, { status: 502, headers: corsHeaders });
        }
        return Response.json(data, { headers: corsHeaders });
      }

      // ============= Canonical Teacher Profile (staff + teacher_documents) =============
      case 'get_teacher_profile': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} action=get_teacher_profile auth=${safeId(authUserId)}`);

        const { data: gtpUserData } = await portalAdmin.auth.admin.getUserById(authUserId!);
        const gtpEmail = gtpUserData?.user?.email;
        if (!gtpEmail) {
          return Response.json({ ok: true, data: { found: false, error: 'no_email' } }, { headers: corsHeaders });
        }

        try {
          // 1. Query staff with ALL canonical columns including verification fields
          const { data: staffRow, error: staffErr } = await crmClient
            .from('staff')
            .select('full_name, email, phone, role, is_active, access_scope, identity_verified, education_verified, approval_status, reviewer_notes, rejection_reason, more_info_reason')
            .eq('email', gtpEmail)
            .maybeSingle();

          if (staffErr) {
            console.error(`[student-portal-api] ${reqId} ❌ staff query error:`, staffErr.message);
            // If query fails due to missing columns, retry with base columns only
            const { data: baseRow, error: baseErr } = await crmClient
              .from('staff')
              .select('full_name, email, phone, role, is_active, access_scope')
              .eq('email', gtpEmail)
              .maybeSingle();

            if (baseErr || !baseRow) {
              return Response.json({ ok: true, data: { found: false, error: 'not_staff' } }, { headers: corsHeaders });
            }

            // Base-only path: flag that verification columns are unavailable
            console.warn(`[student-portal-api] ${reqId} ⚠️ Verification columns unavailable, using base staff only`);
            const isActive = baseRow.is_active === true;
            const isTeacherRole = ['teacher', 'super_admin'].includes(baseRow.role);
            const scope = baseRow.access_scope || 'crm_only';
            const hasPortalScope = ['portal_only', 'crm_and_portal'].includes(scope);
            const blockers: string[] = [];
            if (!isActive) blockers.push('account_inactive');
            if (!isTeacherRole) blockers.push('wrong_role');
            if (!hasPortalScope) blockers.push('no_portal_scope');
            blockers.push('verification_columns_unavailable');

            return Response.json({ ok: true, data: {
              found: true,
              full_name: baseRow.full_name,
              email: baseRow.email,
              phone: baseRow.phone,
              role: baseRow.role,
              is_active: isActive,
              access_scope: scope,
              approval_status: 'unknown',
              identity_verified: false,
              education_verified: false,
              can_teach: false,
              blockers,
              reviewer_notes: null,
              rejection_reason: null,
              more_info_reason: null,
              documents: [],
            } }, { headers: corsHeaders });
          }

          if (!staffRow) {
            return Response.json({ ok: true, data: { found: false, error: 'not_staff' } }, { headers: corsHeaders });
          }

          // 2. Read canonical verification truth from real columns
          const isActive = staffRow.is_active === true;
          const isTeacherRole = ['teacher', 'super_admin'].includes(staffRow.role);
          const scope = staffRow.access_scope || 'crm_only';
          const hasPortalScope = ['portal_only', 'crm_and_portal'].includes(scope);
          const identityVerified = staffRow.identity_verified === true;
          const educationVerified = staffRow.education_verified === true;
          const approvalStatus = staffRow.approval_status || (isActive ? 'approved' : 'pending');
          const canTeach = isActive && isTeacherRole && hasPortalScope && identityVerified && educationVerified && approvalStatus === 'approved';

          const blockers: string[] = [];
          if (!isActive) blockers.push('account_inactive');
          if (!isTeacherRole) blockers.push('wrong_role');
          if (!hasPortalScope) blockers.push('no_portal_scope');
          if (!identityVerified) blockers.push('identity_not_verified');
          if (!educationVerified) blockers.push('education_not_verified');
          if (approvalStatus && approvalStatus !== 'approved') blockers.push(`approval_${approvalStatus}`);

          // 3. Fetch canonical teacher_documents
          let documents: any[] = [];
          const { data: docs, error: docsErr } = await crmClient
            .from('teacher_documents')
            .select('id, doc_type, file_name, verification_status, rejection_reason, reviewer_notes, created_at, file_url, storage_path')
            .eq('staff_email', gtpEmail)
            .order('created_at', { ascending: false });

          if (docsErr) {
            console.warn(`[student-portal-api] ${reqId} ⚠️ teacher_documents query: ${docsErr.message}`);
          } else {
            documents = (docs || []).map((d: any) => ({
              file_id: d.id,
              file_kind: d.doc_type || 'other',
              file_name: d.file_name,
              status: d.verification_status || 'pending',
              rejection_reason: d.rejection_reason,
              reviewer_notes: d.reviewer_notes,
              uploaded_at: d.created_at,
              file_url: d.file_url,
            }));
          }

          console.log(`[student-portal-api] ${reqId} ✅ Canonical teacher profile: role=${staffRow.role} approved=${approvalStatus} id_v=${identityVerified} edu_v=${educationVerified} can_teach=${canTeach} docs=${documents.length}`);

          return Response.json({ ok: true, data: {
            found: true,
            full_name: staffRow.full_name,
            email: staffRow.email,
            phone: staffRow.phone,
            role: staffRow.role,
            is_active: isActive,
            access_scope: scope,
            approval_status: approvalStatus,
            identity_verified: identityVerified,
            education_verified: educationVerified,
            can_teach: canTeach,
            blockers,
            reviewer_notes: staffRow.reviewer_notes || null,
            rejection_reason: staffRow.rejection_reason || null,
            more_info_reason: staffRow.more_info_reason || null,
            documents,
          } }, { headers: corsHeaders });
        } catch (e) {
          console.error(`[student-portal-api] ${reqId} ❌ get_teacher_profile error:`, e);
          return Response.json({ ok: true, data: { found: false, error: 'resolution_error' } }, { headers: corsHeaders });
        }
      }

      // ============= Resolve Teacher Approval (CRM source of truth) =============
      case 'resolve_teacher_approval': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} action=resolve_teacher_approval → delegating to get_teacher_profile`);

        // Delegate to canonical get_teacher_profile for consistency
        const { data: rtaUserData } = await portalAdmin.auth.admin.getUserById(authUserId!);
        const rtaEmail = rtaUserData?.user?.email;
        if (!rtaEmail) {
          return Response.json({ ok: true, data: {
            can_teach: false, approval_status: null, identity_verified: false,
            education_verified: false, blockers: ['no_email'],
          }}, { headers: corsHeaders });
        }

        try {
          const { data: staffRow, error: staffErr } = await crmClient
            .from('staff')
            .select('role, is_active, access_scope, identity_verified, education_verified, approval_status')
            .eq('email', rtaEmail)
            .maybeSingle();

          if (staffErr || !staffRow) {
            return Response.json({ ok: true, data: {
              can_teach: false, approval_status: null, identity_verified: false,
              education_verified: false, blockers: ['not_staff'],
            }}, { headers: corsHeaders });
          }

          const isActive = staffRow.is_active === true;
          const isTeacherRole = ['teacher', 'super_admin'].includes(staffRow.role);
          const scope = staffRow.access_scope || 'crm_only';
          const hasPortalScope = ['portal_only', 'crm_and_portal'].includes(scope);
          const identityVerified = staffRow.identity_verified === true;
          const educationVerified = staffRow.education_verified === true;
          const approvalStatus = staffRow.approval_status || (isActive ? 'approved' : 'pending');
          const blockers: string[] = [];
          if (!isActive) blockers.push('account_inactive');
          if (!isTeacherRole) blockers.push('wrong_role');
          if (!hasPortalScope) blockers.push('no_portal_scope');
          if (!identityVerified) blockers.push('identity_not_verified');
          if (!educationVerified) blockers.push('education_not_verified');
          const canTeach = isActive && isTeacherRole && hasPortalScope && identityVerified && educationVerified;

          return Response.json({ ok: true, data: {
            can_teach: canTeach, approval_status: approvalStatus,
            identity_verified: identityVerified, education_verified: educationVerified, blockers,
          }}, { headers: corsHeaders });
        } catch (e) {
          console.error(`[student-portal-api] ${reqId} ❌ resolve_teacher_approval error:`, e);
          return Response.json({ ok: true, data: {
            can_teach: false, approval_status: 'unknown', identity_verified: false,
            education_verified: false, blockers: ['resolution_error'],
          }}, { headers: corsHeaders });
        }
      }


      // Contract: program_ids[] → deterministic facts (no AI, no recommendations)
      // ✅ Gate P5.1: UUID validation + dedupe + 2..10 + published-only + order-preserved
      case 'compare_programs_v1': {
        const reqId = genRequestId();
        const rawProgramIds = body.program_ids || [];
        const locale = body.locale || 'ar';
        const audience = body.audience || 'customer';
        
        console.log(`[COMPARE_V1] ${reqId} START raw_ids=${rawProgramIds.length} locale=${locale} audience=${audience}`);
        
        // ✅ P5.1-A: Validate each ID is a proper UUID (format: 8-4-4-4-12 hex chars)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validatedIds: string[] = [];
        const invalidIds: string[] = [];
        
        for (const id of rawProgramIds) {
          if (typeof id === 'string' && uuidRegex.test(id)) {
            validatedIds.push(id.toLowerCase()); // Normalize to lowercase
          } else {
            invalidIds.push(String(id));
          }
        }
        
        if (invalidIds.length > 0) {
          console.log(`[COMPARE_V1] ${reqId} ❌ INVALID_UUIDS count=${invalidIds.length} samples=${invalidIds.slice(0, 3).join(',')}`);
          return Response.json({ 
            ok: false, 
            error_code: 'invalid_uuid_format',
            error: `${invalidIds.length} invalid UUID(s) provided`,
            invalid_ids: invalidIds.slice(0, 5), // Show up to 5 invalid IDs
            request_id: reqId
          }, { status: 400, headers: corsHeaders });
        }
        
        // ✅ P5.1-B: Deduplicate while preserving order
        const seenIds = new Set<string>();
        const dedupedIds: string[] = [];
        for (const id of validatedIds) {
          if (!seenIds.has(id)) {
            seenIds.add(id);
            dedupedIds.push(id);
          }
        }
        
        const duplicatesRemoved = validatedIds.length - dedupedIds.length;
        if (duplicatesRemoved > 0) {
          console.log(`[COMPARE_V1] ${reqId} DEDUPE removed=${duplicatesRemoved} final=${dedupedIds.length}`);
        }
        
        // ✅ P5.1-C: Enforce min=2, max=10 after deduplication
        if (dedupedIds.length < 2) {
          return Response.json({ 
            ok: false, 
            error_code: 'min_programs_required',
            error: 'At least 2 unique program_ids required for comparison',
            received: dedupedIds.length,
            request_id: reqId
          }, { status: 400, headers: corsHeaders });
        }
        
        if (dedupedIds.length > 10) {
          return Response.json({ 
            ok: false, 
            error_code: 'max_programs_exceeded',
            error: 'Maximum 10 unique programs for comparison',
            limit: 10,
            received: dedupedIds.length,
            request_id: reqId
          }, { status: 400, headers: corsHeaders });
        }
        
        // ✅ P5.1-D: Fetch ONLY published programs from authoritative view
        // Filter: is_active=true, publish_status='published', do_not_offer=false
        const { data, error } = await portalAdmin
          .from('vw_program_search_api_v3_final')
          .select(`
            program_id,
            program_name_ar,
            program_name_en,
            university_id,
            university_name_ar,
            university_name_en,
            university_logo,
            country_code,
            country_name_ar,
            country_name_en,
            city,
            degree_slug,
            degree_name,
            discipline_slug,
            discipline_name_ar,
            discipline_name_en,
            study_mode,
            instruction_languages,
            tuition_usd_year_min,
            tuition_usd_year_max,
            tuition_is_free,
            currency_code,
            duration_months,
            has_dorm,
            dorm_price_monthly_usd,
            monthly_living_usd,
            scholarship_available,
            scholarship_type,
            intake_months,
            deadline_date,
            ranking,
            portal_url
          `)
          .in('program_id', dedupedIds)
          .eq('is_active', true)
          .eq('publish_status', 'published')
          .eq('do_not_offer', false);
        
        if (error) {
          console.error(`[COMPARE_V1] ${reqId} ❌ fetch error:`, error);
          return Response.json({ 
            ok: false, 
            error_code: 'compare_fetch_failed',
            error: error.message,
            request_id: reqId
          }, { status: 502, headers: corsHeaders });
        }
        
        // ✅ P5.1-E: Reorder results to match input order (critical for deterministic comparison)
        const dataMap = new Map<string, Record<string, unknown>>();
        for (const row of (data ?? [])) {
          dataMap.set(row.program_id as string, row);
        }
        
        const orderedData: Record<string, unknown>[] = [];
        for (const id of dedupedIds) {
          const row = dataMap.get(id);
          if (row) {
            orderedData.push(row);
          }
        }
        
        // Build programs array with localized names based on locale
        const programs = orderedData.map((p: Record<string, unknown>) => ({
          program_id: p.program_id,
          program_name: locale === 'en' ? (p.program_name_en || p.program_name_ar) : (p.program_name_ar || p.program_name_en),
          program_name_ar: p.program_name_ar,
          program_name_en: p.program_name_en,
          university_id: p.university_id,
          university_name: locale === 'en' ? (p.university_name_en || p.university_name_ar) : (p.university_name_ar || p.university_name_en),
          university_name_ar: p.university_name_ar,
          university_name_en: p.university_name_en,
          university_logo: p.university_logo,
          country_code: p.country_code,
          country_name: locale === 'en' ? (p.country_name_en || p.country_name_ar) : (p.country_name_ar || p.country_name_en),
          city: p.city,
          degree_slug: p.degree_slug,
          degree_name: p.degree_name,
          discipline_slug: p.discipline_slug,
          discipline_name: locale === 'en' ? (p.discipline_name_en || p.discipline_name_ar) : (p.discipline_name_ar || p.discipline_name_en),
          study_mode: p.study_mode,
          instruction_languages: p.instruction_languages,
          tuition_usd_year_min: p.tuition_usd_year_min,
          tuition_usd_year_max: p.tuition_usd_year_max,
          tuition_is_free: p.tuition_is_free,
          currency_code: p.currency_code,
          duration_months: p.duration_months,
          has_dorm: p.has_dorm,
          dorm_price_monthly_usd: p.dorm_price_monthly_usd,
          monthly_living_usd: p.monthly_living_usd,
          scholarship_available: p.scholarship_available,
          scholarship_type: p.scholarship_type,
          intake_months: p.intake_months,
          deadline_date: p.deadline_date,
          ranking: p.ranking,
          portal_url: p.portal_url,
        }));
        
        // Identify missing fields per program
        const missingFields: Record<string, string[]> = {};
        const criticalFields = ['tuition_usd_year_max', 'duration_months', 'deadline_date', 'dorm_price_monthly_usd', 'monthly_living_usd'];
        
        programs.forEach((p: Record<string, unknown>) => {
          const missing: string[] = [];
          criticalFields.forEach(field => {
            if (p[field] === null || p[field] === undefined) {
              missing.push(field);
            }
          });
          if (missing.length > 0) {
            missingFields[p.program_id as string] = missing;
          }
        });
        
        // ✅ P5.1-F: Identify not_found_ids (either invalid UUID, unpublished, or truly not in DB)
        const foundIds = new Set(programs.map((p: Record<string, unknown>) => p.program_id));
        const notFoundIds = dedupedIds.filter((id: string) => !foundIds.has(id));
        
        console.log(`[COMPARE_V1] ${reqId} ✅ ok=true found=${programs.length}/${dedupedIds.length} not_found=${notFoundIds.length} missing_fields=${Object.keys(missingFields).length} order_preserved=true`);
        
        return Response.json({
          ok: true,
          version: 'compare_v1',
          locale,
          audience,
          programs,
          missing_fields: missingFields,
          not_found_ids: notFoundIds,
          request_id: reqId
        }, { headers: corsHeaders });
      }

      // ✅ DEBUG: Staff-only RPC probe (no side effects) - P0 Evidence Collection
      case 'debug_probe_crm_rpcs': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} action=debug_probe_crm_rpcs auth=${safeId(authUserId)}`);
        
        // ✅ Staff check: verify user is staff in Portal
        const { data: staffCheck } = await portalAdmin
          .from('staff')
          .select('role')
          .eq('user_id', authUserId)
          .single();
        
        if (!staffCheck) {
          console.warn(`[student-portal-api] ${reqId} ❌ Not staff - access denied`);
          return Response.json({ 
            ok: false, 
            error: 'STAFF_ONLY',
            message: 'This action requires staff privileges',
            request_id: reqId
          }, { status: 403, headers: corsHeaders });
        }
        
        console.log(`[student-portal-api] ${reqId} ✅ Staff verified: role=${staffCheck.role}`);
        
        const probeResults: Record<string, { exists: boolean; duration_ms: number; error?: string; note?: string }> = {};
        
        // Probe 1: rpc_get_student_service_selections (read-only, SAFE)
        try {
          const rpc1 = 'rpc_get_student_service_selections';
          logRpcStart({ requestId: reqId, action: 'debug_probe', authUserId }, rpc1, ['p_auth_user_id']);
          const t1 = Date.now();
          const { error: err1 } = await crmClient.rpc(rpc1, { p_auth_user_id: authUserId });
          const d1 = Date.now() - t1;
          logRpcEnd({ requestId: reqId, action: 'debug_probe', authUserId }, rpc1, !err1, d1, err1?.message);
          probeResults[rpc1] = { exists: !err1, duration_ms: d1, error: err1?.message };
        } catch (e) {
          probeResults['rpc_get_student_service_selections'] = { exists: false, duration_ms: 0, error: String(e) };
        }
        
        // ❌ Probe 2 REMOVED: rpc_sync_student_shortlist_from_portal_v2 with empty array is DANGEROUS
        // Empty array could mean "wipe all" in sync RPCs. Removed for safety.
        probeResults['rpc_sync_student_shortlist_from_portal_v2'] = { 
          exists: false, 
          duration_ms: 0, 
          note: 'SKIPPED: Cannot safely probe sync RPCs - CRM team should create rpc_debug_noop_v1()'
        };
        
        // ❌ Probe 3 REMOVED: pg_proc query via .from() won't work in Supabase/PostgREST
        probeResults['rpc_portal_application_created_v1'] = { 
          exists: false, 
          duration_ms: 0, 
          note: 'SKIPPED: Cannot query pg_proc via PostgREST - CRM team should create rpc_debug_function_exists_v1(p_name)'
        };
        
        console.log(`[student-portal-api] ${reqId} probe_results:`, JSON.stringify(probeResults));
        
        return Response.json({
          ok: true,
          request_id: reqId,
          probe_results: probeResults,
          crm_url_suffix: CRM_SUPABASE_URL.slice(-20),
          timestamp: new Date().toISOString(),
          notes: ['Only read-only RPCs are probed for safety', 'CRM team needs: rpc_debug_noop_v1() + rpc_debug_function_exists_v1(p_name)']
        }, { headers: corsHeaders });
      }

      // ============= Resolve Staff Authority (CRM source of truth) =============
      case 'resolve_staff_authority': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} action=resolve_staff_authority auth=${safeId(authUserId)}`);

        // 1. Get user email from Portal auth
        const { data: userData, error: userError } = await portalAdmin.auth.admin.getUserById(authUserId!);
        if (userError || !userData?.user) {
          console.warn(`[student-portal-api] ${reqId} ❌ Cannot resolve auth user`);
          return Response.json({
            ok: true,
            data: { is_staff: false, role: null, email: null },
          }, { headers: corsHeaders });
        }

        const userEmail = userData.user.email;
        console.log(`[student-portal-api] ${reqId} 📧 Checking CRM staff for email=${userEmail?.slice(0,4)}...`);

        // 2. Query CRM staff table by email (CRM is source of truth)
        try {
          const { data: staffData, error: staffError } = await crmClient
            .from('staff')
            .select('role, email, is_active, access_scope')
            .eq('email', userEmail)
            .eq('is_active', true)
            .maybeSingle();

          if (staffError) {
            console.warn(`[student-portal-api] ${reqId} ⚠️ CRM staff query failed:`, staffError.message);
            return Response.json({
              ok: true,
              data: { is_staff: false, role: null, access_scope: null, email: userEmail },
            }, { headers: corsHeaders });
          }

          if (staffData) {
            const scope = staffData.access_scope || 'crm_only';
            const hasPortalScope = ['portal_only', 'crm_and_portal'].includes(scope);
            console.log(`[student-portal-api] ${reqId} ✅ CRM staff found: role=${staffData.role} scope=${scope}`);

            // For portal-capable teachers, merge canonical teacher approval truth
            if (staffData.role === 'teacher' && hasPortalScope) {
              try {
                // Query verification columns — may not exist in all CRM envs
                const { data: tpRow, error: tpErr } = await crmClient
                  .from('staff')
                  .select('full_name, phone, identity_verified, education_verified, approval_status, reviewer_notes, rejection_reason, more_info_reason')
                  .eq('email', userEmail)
                  .maybeSingle();

                console.log(`[student-portal-api] ${reqId} 🔍 Teacher truth query: err=${tpErr?.message || 'none'} found=${!!tpRow}`);

                if (tpErr) {
                  // Columns may not exist — fallback: treat as fully approved if is_active
                  console.warn(`[student-portal-api] ${reqId} ⚠️ Teacher truth query failed (likely missing columns): ${tpErr.message}`);
                  // Return with derived truth from is_active
                  const isActive = staffData.is_active === true;
                  return Response.json({
                    ok: true,
                    data: {
                      is_staff: true,
                      role: staffData.role,
                      access_scope: scope,
                      email: staffData.email || userEmail,
                      approval_status: isActive ? 'approved' : 'pending',
                      identity_verified: isActive,
                      education_verified: isActive,
                      can_teach: isActive,
                      blockers: isActive ? [] : ['account_inactive'],
                      full_name: null,
                      phone: null,
                      reviewer_notes: null,
                      rejection_reason: null,
                      more_info_reason: null,
                    },
                  }, { headers: corsHeaders });
                }

                if (tpRow) {
                  const identityVerified = tpRow.identity_verified === true;
                  const educationVerified = tpRow.education_verified === true;
                  const approvalStatus = tpRow.approval_status || (staffData.is_active ? 'approved' : 'pending');
                  const canTeach = staffData.is_active && identityVerified && educationVerified && approvalStatus === 'approved';

                  const blockers: string[] = [];
                  if (!staffData.is_active) blockers.push('account_inactive');
                  if (!identityVerified) blockers.push('identity_not_verified');
                  if (!educationVerified) blockers.push('education_not_verified');
                  if (approvalStatus && approvalStatus !== 'approved') blockers.push(`approval_${approvalStatus}`);

                  console.log(`[student-portal-api] ${reqId} ✅ Teacher truth merged: can_teach=${canTeach} approval=${approvalStatus} blockers=${blockers.join(',')}`);

                  return Response.json({
                    ok: true,
                    data: {
                      is_staff: true,
                      role: staffData.role,
                      access_scope: scope,
                      email: staffData.email || userEmail,
                      full_name: tpRow.full_name || null,
                      phone: tpRow.phone || null,
                      approval_status: approvalStatus,
                      identity_verified: identityVerified,
                      education_verified: educationVerified,
                      can_teach: canTeach,
                      blockers,
                      reviewer_notes: tpRow.reviewer_notes || null,
                      rejection_reason: tpRow.rejection_reason || null,
                      more_info_reason: tpRow.more_info_reason || null,
                    },
                  }, { headers: corsHeaders });
                }
              } catch (tpError) {
                console.warn(`[student-portal-api] ${reqId} ⚠️ Teacher truth merge exception:`, tpError);
              }
            }

            return Response.json({
              ok: true,
              data: { is_staff: true, role: staffData.role, access_scope: scope, email: staffData.email || userEmail },
            }, { headers: corsHeaders });
          }

          console.log(`[student-portal-api] ${reqId} ℹ️ User is not staff (CRM-only)`);
          return Response.json({
            ok: true,
            data: { is_staff: false, role: null, access_scope: null, email: userEmail },
          }, { headers: corsHeaders });
        } catch (e) {
          console.error(`[student-portal-api] ${reqId} ❌ Staff resolution error:`, e);
          return Response.json({
            ok: true,
            data: { is_staff: false, role: null, access_scope: null, email: userEmail },
          }, { headers: corsHeaders });
        }
      }

      // ============= Resolve Course Access (CRM source of truth) =============
      case 'resolve_course_access': {
        const reqId = genRequestId();
        const langKey = body.language_key || 'russian';
        console.log(`[student-portal-api] ${reqId} action=resolve_course_access auth=${safeId(authUserId)} lang=${langKey}`);

        try {
          // FINAL CUTOVER: CRM payments are the ONLY source of truth for course access.
          // Resolve CRM auth_user_id (may differ from Portal auth user ID after account re-link)
          const crmAuthForAccess = await resolveCrmAuthUserId(crmClient, portalAdmin, authUserId!);
          const { data: crmPayments, error: payErr } = await crmClient.rpc('rpc_get_student_payments_list', {
            p_auth_user_id: crmAuthForAccess,
          });

          let hasActiveAccess = false;
          let paymentStatus: string | null = null;
          const source = 'crm_payments';

          if (!payErr && Array.isArray(crmPayments) && crmPayments.length > 0) {
            const paidStatuses = ['fully_paid', 'paid'];

            const normalizedPayments = [...crmPayments].sort((a: any, b: any) => {
              const aTs = new Date(a?.payment_date || a?.created_at || 0).getTime();
              const bTs = new Date(b?.payment_date || b?.created_at || 0).getTime();
              return bTs - aTs;
            });

            const languagePayments = normalizedPayments.filter((p: any) => {
              const searchable = `${p?.service_type || ''} ${p?.description || ''}`.toLowerCase();
              return ['language', 'course', langKey, 'fees'].some(token => searchable.includes(token));
            });
            
            const relevantPayments = languagePayments.length > 0 ? languagePayments : normalizedPayments;
            
            if (relevantPayments.length > 0) {
              paymentStatus = String(relevantPayments[0]?.status || '').toLowerCase();

              const hasScopedPaid = languagePayments.some((p: any) => paidStatuses.includes(String(p?.status || '').toLowerCase()));
              const hasAnyPaid = normalizedPayments.some((p: any) => paidStatuses.includes(String(p?.status || '').toLowerCase()));

              // Primary: scoped language payments; fallback: if RPC has no service labels, trust any paid row.
              hasActiveAccess = languagePayments.length > 0 ? hasScopedPaid : hasAnyPaid;
            }
          }

          // NO local fallback. CRM is the only authority.
          console.log(`[student-portal-api] ${reqId} ✅ Course access (CRM-only): active=${hasActiveAccess} payment_status=${paymentStatus}`);
          return Response.json({
            ok: true,
            data: {
              has_active_access: hasActiveAccess,
              payment_status: paymentStatus,
              language_key: langKey,
              source,
            },
          }, { headers: corsHeaders });
        } catch (e) {
          console.error(`[student-portal-api] ${reqId} ❌ Course access resolution error:`, e);
          // CRM error = deny access (no local fallback)
          return Response.json({
            ok: true,
            data: {
              has_active_access: false,
              payment_status: null,
              language_key: langKey,
              source: 'crm_error',
            },
          }, { headers: corsHeaders });
        }
      }

      // ============= Teacher Dashboard Actions (Portal DB, staff-gated) =============
      case 'teacher_get_students': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} action=teacher_get_students auth=${safeId(authUserId)}`);

        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isTeacher } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isTeacher) {
          return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        }

        // Get all Russian language enrollments with user profiles and progress
        const { data: enrollments, error: enrError } = await portalAdmin
          .from('language_course_enrollments')
          .select('id, user_id, language_key, course_type, activation_status, request_status, created_at')
          .eq('language_key', 'russian')
          .order('created_at', { ascending: false });

        if (enrError) {
          console.error(`[student-portal-api] ${reqId} ❌ Enrollment query failed:`, enrError.message);
          return Response.json({ ok: false, error: enrError.message }, { headers: corsHeaders });
        }

        if (!enrollments?.length) {
          return Response.json({ ok: true, data: { students: [] } }, { headers: corsHeaders });
        }

        const userIds = [...new Set(enrollments.map((e: any) => e.user_id))];

        // Batch fetch profiles (portal DB)
        const { data: profiles } = await portalAdmin
          .from('profiles')
          .select('user_id, full_name, email, phone, city, country, avatar_storage_path')
          .in('user_id', userIds);

        // Batch fetch customer map to resolve CRM identity drift
        const { data: customerMapRows } = await portalAdmin
          .from('portal_customer_map')
          .select('portal_auth_user_id, crm_customer_id')
          .in('portal_auth_user_id', userIds);

        // Batch fetch CRM profile by auth_user_id
        const { data: crmProfilesByAuth } = await crmClient
          .from('vw_student_portal_profile')
          .select('auth_user_id, customer_id, id, full_name, avatar_url')
          .in('auth_user_id', userIds);

        // Batch fetch CRM profile by customer_id (covers re-linked users)
        const customerIds = [...new Set((customerMapRows || []).map((r: any) => r.crm_customer_id).filter(Boolean))] as string[];
        const { data: crmProfilesByCustomer } = customerIds.length > 0
          ? await crmClient
              .from('vw_student_portal_profile')
              .select('auth_user_id, customer_id, id, full_name, avatar_url')
              .in('customer_id', customerIds)
          : { data: [] as any[] };

        // Batch fetch lesson progress
        const { data: lessonProgress } = await portalAdmin
          .from('learning_lesson_progress')
          .select('user_id, lesson_slug, module_slug, status, completed_at')
          .in('user_id', userIds);

        // Batch fetch vocab progress (count only)
        const { data: vocabProgress } = await portalAdmin
          .from('learning_vocab_progress')
          .select('user_id, mastery')
          .in('user_id', userIds);

        // Batch fetch placement results
        const { data: placements } = await portalAdmin
          .from('learning_placement_results')
          .select('user_id, score, total_questions, result_category, completed_at')
          .in('user_id', userIds)
          .order('completed_at', { ascending: false });

        // Batch fetch student_course_state for current position & activity
        const { data: courseStates } = await portalAdmin
          .from('student_course_state')
          .select('student_user_id, current_lesson_slug, current_module_slug, last_student_activity_at, progression_status')
          .in('student_user_id', userIds)
          .eq('course_key', 'russian');

        // Batch fetch completed sessions for activity tracking
        const { data: sessionStudentRows } = await portalAdmin
          .from('teacher_session_students')
          .select('student_user_id, session_id')
          .in('student_user_id', userIds);

        let completedSessionDates: Map<string, string> = new Map();
        let studentSessionLessons: Map<string, { lesson_slug: string | null; module_slug: string | null }> = new Map();
        const allSessionIds = [...new Set((sessionStudentRows || []).map((r: any) => r.session_id))];
        if (allSessionIds.length > 0) {
          const { data: sessionsData } = await portalAdmin
            .from('teacher_sessions')
            .select('id, scheduled_at, status, lesson_slug, module_slug')
            .in('id', allSessionIds);
          // Map student -> latest session date & lesson
          for (const row of (sessionStudentRows || [])) {
            const session = (sessionsData || []).find((s: any) => s.id === row.session_id);
            if (session?.scheduled_at) {
              const existing = completedSessionDates.get(row.student_user_id);
              if (!existing || session.scheduled_at > existing) {
                completedSessionDates.set(row.student_user_id, session.scheduled_at);
                // Track the lesson from the latest session
                if (session.lesson_slug) {
                  studentSessionLessons.set(row.student_user_id, {
                    lesson_slug: session.lesson_slug,
                    module_slug: session.module_slug,
                  });
                }
              }
            }
          }
        }

        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        const portalToCustomerMap = new Map((customerMapRows || []).map((r: any) => [r.portal_auth_user_id, r.crm_customer_id]));
        const crmByAuthMap = new Map((crmProfilesByAuth || []).map((r: any) => [String(r.auth_user_id), r]));
        const crmByCustomerMap = new Map((crmProfilesByCustomer || []).map((r: any) => [String(r.customer_id || r.id), r]));
        const courseStateMap = new Map((courseStates || []).map((cs: any) => [cs.student_user_id, cs]));

        const lessonMap = new Map<string, any[]>();
        for (const lp of (lessonProgress || [])) {
          const arr = lessonMap.get(lp.user_id) || [];
          arr.push(lp);
          lessonMap.set(lp.user_id, arr);
        }
        const vocabMap = new Map<string, any[]>();
        for (const vp of (vocabProgress || [])) {
          const arr = vocabMap.get(vp.user_id) || [];
          arr.push(vp);
          vocabMap.set(vp.user_id, arr);
        }
        const placementMap = new Map<string, any>();
        for (const pl of (placements || [])) {
          if (!placementMap.has(pl.user_id)) placementMap.set(pl.user_id, pl);
        }

        const students = userIds.map((uid: string) => {
          const profile = profileMap.get(uid) || {};
          const mappedCustomerId = portalToCustomerMap.get(uid);
          const crmProfile = crmByAuthMap.get(uid) || (mappedCustomerId ? crmByCustomerMap.get(mappedCustomerId) : null) || null;
          const lessons = lessonMap.get(uid) || [];
          const vocab = vocabMap.get(uid) || [];
          const placement = placementMap.get(uid) || null;
          const enrollment = enrollments.find((e: any) => e.user_id === uid);
          const courseState = courseStateMap.get(uid);

          const completedLessons = lessons.filter((l: any) => l.status === 'completed');
          const currentLesson = lessons.find((l: any) => l.status === 'in_progress') ||
            lessons.sort((a: any, b: any) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime())[0];

          const masteredWords = vocab.filter((v: any) => v.mastery === 'mastered').length;

          // Resolve latest activity from multiple sources
          let latestActivity: string | null = lessons.reduce((latest: string | null, l: any) => {
            const d = l.completed_at;
            return d && (!latest || d > latest) ? d : latest;
          }, null);
          // Also check student_course_state.last_student_activity_at
          if (courseState?.last_student_activity_at) {
            if (!latestActivity || courseState.last_student_activity_at > latestActivity) {
              latestActivity = courseState.last_student_activity_at;
            }
          }
          // Also check latest session date
          const sessionDate = completedSessionDates.get(uid);
          if (sessionDate && (!latestActivity || sessionDate > latestActivity)) {
            latestActivity = sessionDate;
          }

          // Resolve current module/lesson from multiple sources: lesson progress > course state > sessions
          const sessionLesson = studentSessionLessons.get(uid);
          const resolvedCurrentModule = currentLesson?.module_slug || courseState?.current_module_slug || sessionLesson?.module_slug || null;
          const resolvedCurrentLesson = currentLesson?.lesson_slug || courseState?.current_lesson_slug || sessionLesson?.lesson_slug || null;

          const resolvedFullName = (profile as any).full_name || (crmProfile as any)?.full_name || null;
          const resolvedAvatar = (profile as any).avatar_storage_path || (crmProfile as any)?.avatar_url || null;

          return {
            user_id: uid,
            full_name: resolvedFullName,
            email: (profile as any).email || null,
            phone: (profile as any).phone || null,
            avatar_storage_path: resolvedAvatar,
            enrollment_status: enrollment?.activation_status || 'unknown',
            request_status: enrollment?.request_status || null,
            current_module: resolvedCurrentModule,
            current_lesson: resolvedCurrentLesson,
            lessons_completed: completedLessons.length,
            total_lessons_started: lessons.length,
            words_learned: masteredWords,
            total_vocab: vocab.length,
            placement_score: placement?.score || null,
            placement_category: placement?.result_category || null,
            placement_date: placement?.completed_at || null,
            latest_activity: latestActivity,
            enrolled_at: enrollment?.created_at || null,
          };
        });

        console.log(`[student-portal-api] ${reqId} ✅ Returning ${students.length} students`);
        return Response.json({ ok: true, data: { students } }, { headers: corsHeaders });
      }

      case 'teacher_get_student_detail': {
        const reqId = genRequestId();
        const studentId = body.student_user_id;
        console.log(`[student-portal-api] ${reqId} action=teacher_get_student_detail student=${safeId(studentId)}`);

        if (!studentId) {
          return Response.json({ ok: false, error: 'MISSING_STUDENT_ID' }, { status: 400, headers: corsHeaders });
        }

        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isTeacher2 } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isTeacher2) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const [profileRes, courseStateRes, lessonsRes, vocabRes, placementRes, notesRes, examRes, releasedRes, taughtSessionsRes, actionItemsRes, evaluationsRes, studySessionsRes] = await Promise.all([
          portalAdmin.from('profiles').select('*').eq('user_id', studentId).maybeSingle(),
          portalAdmin.from('student_course_state').select('*').eq('student_user_id', studentId).eq('course_key', 'russian').maybeSingle(),
          portalAdmin.from('learning_lesson_progress').select('*').eq('user_id', studentId).order('completed_at', { ascending: false }),
          portalAdmin.from('learning_vocab_progress').select('*').eq('user_id', studentId),
          portalAdmin.from('learning_placement_results').select('*').eq('user_id', studentId).order('completed_at', { ascending: false }),
          portalAdmin.from('teacher_notes').select('*').eq('student_user_id', studentId).eq('language_key', 'russian').order('created_at', { ascending: false }),
          portalAdmin.from('learning_exam_notices').select('*').eq('user_id', studentId).order('scheduled_at', { ascending: true }),
          portalAdmin.from('student_lesson_progression').select('lesson_slug, module_slug, status, released_at, completed_at, teacher_notes, mastery_score, updated_at').eq('student_user_id', studentId).eq('course_key', 'russian').in('status', ['released', 'in_progress', 'completed', 'review_required']),
          portalAdmin.from('teacher_session_students').select('session_id, attendance_status').eq('student_user_id', studentId),
          portalAdmin.from('session_action_items').select('*').eq('student_user_id', studentId).order('created_at', { ascending: false }).limit(100),
          portalAdmin.from('teacher_student_session_evaluations').select('*').eq('student_user_id', studentId).order('created_at', { ascending: false }).limit(100),
          portalAdmin.from('learning_study_sessions').select('lesson_slug, module_slug, duration_seconds, created_at').eq('user_id', studentId).order('created_at', { ascending: false }),
        ]);

        const actionItems = actionItemsRes.data || [];
        const evaluations = evaluationsRes.data || [];
        const lessonProgressRows = lessonsRes.data || [];
        const releasedLessons = releasedRes.data || [];
        const sessionMembershipRows = taughtSessionsRes.data || [];
        const sessionMembershipMap = new Map((sessionMembershipRows || []).map((row: any) => [row.session_id, row]));

        let taughtLessons: string[] = [];
        let latestSessionLesson: { lesson_slug: string | null; module_slug: string | null } | null = null;
        let latestSessionDate: string | null = null;
        let allStudentSessions: any[] = [];
        const taughtSessionIds = sessionMembershipRows.map((row: any) => row.session_id).filter(Boolean);
        if (taughtSessionIds.length) {
          const { data: sessionRows } = await portalAdmin
            .from('teacher_sessions')
            .select('id, lesson_slug, module_slug, status, scheduled_at, created_at, summary, next_action')
            .in('id', taughtSessionIds);
          allStudentSessions = sessionRows || [];
          taughtLessons = Array.from(new Set(
            allStudentSessions
              .filter((session: any) => session.status === 'completed' && (sessionMembershipMap.get(session.id)?.attendance_status || 'pending') !== 'absent')
              .map((session: any) => session.lesson_slug)
              .filter(Boolean)
          ));

          // Only past/live sessions count as real student activity.
          for (const s of allStudentSessions) {
            const sessionDate = s.scheduled_at || s.created_at || null;
            const attendanceStatus = sessionMembershipMap.get(s.id)?.attendance_status || null;
            const countsAsActivity = sessionDate && (s.status === 'completed' || s.status === 'live' || (attendanceStatus && attendanceStatus !== 'pending'));
            if (countsAsActivity && (!latestSessionDate || sessionDate > latestSessionDate)) {
              latestSessionDate = sessionDate;
              if (s.lesson_slug) {
                latestSessionLesson = { lesson_slug: s.lesson_slug, module_slug: s.module_slug };
              }
            }
          }
        }

        // Enrich profile with CRM data (name, avatar)
        const localProfile = profileRes.data || {};
        let enrichedProfile = { ...localProfile };
        
        // Resolve CRM identity for name/avatar
        const { data: customerMapRow } = await portalAdmin
          .from('portal_customer_map')
          .select('crm_customer_id')
          .eq('portal_auth_user_id', studentId)
          .maybeSingle();

        let crmName: string | null = null;
        let crmAvatar: string | null = null;

        // Try CRM by auth_user_id first
        const { data: crmByAuth } = await crmClient
          .from('vw_student_portal_profile')
          .select('full_name, avatar_url')
          .eq('auth_user_id', studentId)
          .maybeSingle();
        
        if (crmByAuth) {
          crmName = crmByAuth.full_name;
          crmAvatar = crmByAuth.avatar_url;
        } else if (customerMapRow?.crm_customer_id) {
          // Try by customer_id
          const { data: crmByCustomer } = await crmClient
            .from('vw_student_portal_profile')
            .select('full_name, avatar_url')
            .eq('customer_id', customerMapRow.crm_customer_id)
            .maybeSingle();
          if (crmByCustomer) {
            crmName = crmByCustomer.full_name;
            crmAvatar = crmByCustomer.avatar_url;
          }
        }

        // Merge CRM data into profile
        if (!enrichedProfile.full_name && crmName) enrichedProfile.full_name = crmName;
        if (!enrichedProfile.avatar_storage_path && crmAvatar) enrichedProfile.avatar_storage_path = crmAvatar;

        // Enrich courseState with session-derived data
        const courseState = courseStateRes.data || null;
        const latestHomeworkLesson = actionItems.find((item: any) => item.related_lesson_slug && ['pending', 'in_progress'].includes(item.status || 'pending')) || null;
        const latestRelevantSession = [...allStudentSessions]
          .filter((session: any) => session.lesson_slug && session.status !== 'cancelled')
          .sort((a: any, b: any) => {
            const aDate = a.scheduled_at || a.created_at || '';
            const bDate = b.scheduled_at || b.created_at || '';
            return String(bDate).localeCompare(String(aDate));
          })[0] || null;

        let enrichedCourseState = courseState ? { ...courseState } : {
          student_user_id: studentId,
          course_key: 'russian',
          current_lesson_slug: null,
          current_module_slug: null,
          progression_status: null,
          next_teacher_decision: null,
          last_teacher_action_at: null,
          last_student_activity_at: null,
        };

        const derivedCurrentLessonSlug =
          enrichedCourseState.current_lesson_slug ||
          latestHomeworkLesson?.related_lesson_slug ||
          latestSessionLesson?.lesson_slug ||
          latestRelevantSession?.lesson_slug ||
          null;
        const derivedCurrentModuleSlug =
          enrichedCourseState.current_module_slug ||
          latestHomeworkLesson?.related_module_slug ||
          latestSessionLesson?.module_slug ||
          latestRelevantSession?.module_slug ||
          null;

        if (!enrichedCourseState.current_lesson_slug && derivedCurrentLessonSlug) {
          enrichedCourseState.current_lesson_slug = derivedCurrentLessonSlug;
        }
        if (!enrichedCourseState.current_module_slug && derivedCurrentModuleSlug) {
          enrichedCourseState.current_module_slug = derivedCurrentModuleSlug;
        }

        const activityCandidates = [
          enrichedCourseState.last_student_activity_at,
          latestSessionDate,
          ...actionItems.map((item: any) => item.completed_at || null),
          ...evaluations.map((evaluation: any) => evaluation.updated_at || evaluation.created_at || null),
          ...lessonProgressRows.map((lesson: any) => lesson.completed_at || lesson.created_at || null),
        ].filter(Boolean).sort();
        const latestKnownActivity = activityCandidates.length ? activityCandidates[activityCandidates.length - 1] : null;
        if (latestKnownActivity && (!enrichedCourseState.last_student_activity_at || latestKnownActivity > enrichedCourseState.last_student_activity_at)) {
          enrichedCourseState.last_student_activity_at = latestKnownActivity;
        }

        const lessonStatusRank = (status: string | null | undefined) => {
          switch (status) {
            case 'completed': return 5;
            case 'in_progress': return 4;
            case 'review_required': return 3;
            case 'released': return 2;
            case 'scheduled': return 2;
            case 'locked': return 1;
            default: return 0;
          }
        };

        const lessonMap = new Map<string, any>();
        const mergeLessonEntry = (entry: any) => {
          const lessonSlug = entry?.lesson_slug || entry?.related_lesson_slug;
          if (!lessonSlug) return;

          const moduleSlug = entry?.module_slug ?? entry?.related_module_slug ?? null;
          const key = `${moduleSlug || 'root'}::${lessonSlug}`;
          const existing = lessonMap.get(key) || null;
          const normalizedStatus = typeof entry?.status === 'string' && entry.status.length
            ? entry.status
            : entry?.completed_at
              ? 'completed'
              : 'released';

          const next: Record<string, any> = {
            ...(existing || {}),
            lesson_slug: lessonSlug,
            module_slug: moduleSlug,
          };

          for (const [field, value] of Object.entries(entry || {})) {
            if (value !== null && value !== undefined && value !== '') {
              next[field] = value;
            }
          }

          if (!existing || lessonStatusRank(normalizedStatus) >= lessonStatusRank(existing.status)) {
            next.status = normalizedStatus;
          }

          const eventCandidates = [
            existing?.last_event_at,
            entry?.updated_at,
            entry?.completed_at,
            entry?.released_at,
            entry?.scheduled_at,
            entry?.created_at,
          ].filter(Boolean).sort();
          next.last_event_at = eventCandidates.length ? eventCandidates[eventCandidates.length - 1] : null;

          lessonMap.set(key, next);
        };

        lessonProgressRows.forEach((lesson: any) => mergeLessonEntry(lesson));
        releasedLessons.forEach((lesson: any) => mergeLessonEntry(lesson));

        for (const session of allStudentSessions) {
          if (!session.lesson_slug || session.status === 'cancelled') continue;
          const attendanceStatus = sessionMembershipMap.get(session.id)?.attendance_status || null;
          let derivedStatus: string | null = null;

          if (session.status === 'live') {
            derivedStatus = 'in_progress';
          } else if (session.status === 'completed') {
            derivedStatus = attendanceStatus && attendanceStatus !== 'absent' ? 'completed' : 'released';
          } else if (session.status === 'scheduled' || session.status === 'draft') {
            derivedStatus = 'released';
          }

          if (derivedStatus) {
            mergeLessonEntry({
              lesson_slug: session.lesson_slug,
              module_slug: session.module_slug,
              status: derivedStatus,
              scheduled_at: session.scheduled_at,
              created_at: session.created_at,
              session_status: session.status,
              attendance_status: attendanceStatus,
              summary: session.summary,
              next_action: session.next_action,
            });
          }
        }

        const sessionById = new Map(allStudentSessions.map((session: any) => [session.id, session]));

        for (const item of actionItems) {
          if (!item.related_lesson_slug) continue;
          mergeLessonEntry({
            lesson_slug: item.related_lesson_slug,
            module_slug: item.related_module_slug,
            status: item.status === 'completed' || item.status === 'reviewed' ? 'completed' : 'in_progress',
            created_at: item.created_at,
            updated_at: item.updated_at,
            completed_at: item.completed_at,
            homework_status: item.status,
            homework_title: item.title,
          });
        }

        for (const evaluation of evaluations) {
          const relatedSession = sessionById.get(evaluation.session_id);
          if (!relatedSession?.lesson_slug) continue;
          mergeLessonEntry({
            lesson_slug: relatedSession.lesson_slug,
            module_slug: relatedSession.module_slug,
            status: evaluation.needs_review ? 'review_required' : undefined,
            created_at: evaluation.created_at,
            updated_at: evaluation.updated_at,
            evaluation_note: evaluation.note,
            understanding_score: evaluation.understanding_score,
            confidence_score: evaluation.confidence_score,
            participation_score: evaluation.participation_score,
            needs_review: evaluation.needs_review,
            recommended_next_action: evaluation.recommended_next_action,
          });
        }

        if (derivedCurrentLessonSlug) {
          mergeLessonEntry({
            lesson_slug: derivedCurrentLessonSlug,
            module_slug: derivedCurrentModuleSlug,
            status: 'in_progress',
            updated_at: latestKnownActivity || new Date().toISOString(),
          });
        }

        // Aggregate study time per lesson
        const studySessions = studySessionsRes.data || [];
        const studyTimeByLesson = new Map<string, number>();
        let totalStudySeconds = 0;
        for (const ss of studySessions) {
          const dur = ss.duration_seconds || 0;
          totalStudySeconds += dur;
          if (ss.lesson_slug) {
            const key = `${ss.module_slug || 'root'}::${ss.lesson_slug}`;
            studyTimeByLesson.set(key, (studyTimeByLesson.get(key) || 0) + dur);
          }
        }

        // Merge study time into lesson map
        for (const [key, seconds] of studyTimeByLesson) {
          const existing = lessonMap.get(key);
          if (existing) {
            existing.study_time_seconds = seconds;
          } else {
            const [moduleSlug, lessonSlug] = key.split('::');
            lessonMap.set(key, {
              lesson_slug: lessonSlug,
              module_slug: moduleSlug === 'root' ? null : moduleSlug,
              status: 'released',
              study_time_seconds: seconds,
            });
          }
        }

        const derivedLessons = Array.from(lessonMap.values()).sort((a: any, b: any) => {
          const aDate = a.last_event_at || a.updated_at || a.completed_at || a.released_at || a.created_at || '';
          const bDate = b.last_event_at || b.updated_at || b.completed_at || b.released_at || b.created_at || '';
          return String(bDate).localeCompare(String(aDate));
        });

        return Response.json({
          ok: true,
          data: {
            profile: enrichedProfile,
            courseState: enrichedCourseState,
            lessons: derivedLessons,
            vocab: vocabRes.data || [],
            placements: placementRes.data || [],
            notes: notesRes.data || [],
            examNotices: examRes.data || [],
            releasedLessons,
            taughtLessons,
            actionItems,
            evaluations,
            totalStudySeconds,
            studySessions: studySessions.slice(0, 50),
            sessions: allStudentSessions.map((session: any) => ({
              ...session,
              attendance_status: sessionMembershipMap.get(session.id)?.attendance_status || null,
            })),
          },
        }, { headers: corsHeaders });
      }

      case 'teacher_add_note': {
        const reqId = genRequestId();
        const { student_user_id, note, language_key } = body;
        console.log(`[student-portal-api] ${reqId} action=teacher_add_note student=${safeId(student_user_id as string)}`);

        if (!student_user_id || !note) {
          return Response.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400, headers: corsHeaders });
        }

        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isTeacher3 } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isTeacher3) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const { data: noteData, error: noteError } = await portalAdmin
          .from('teacher_notes')
          .insert({
            teacher_user_id: authUserId,
            student_user_id: student_user_id as string,
            language_key: (language_key as string) || 'russian',
            note: note as string,
          })
          .select()
          .single();

        if (noteError) {
          return Response.json({ ok: false, error: noteError.message }, { headers: corsHeaders });
        }

        return Response.json({ ok: true, data: noteData }, { headers: corsHeaders });
      }

      case 'teacher_get_notes': {
        const reqId = genRequestId();
        const sid = body.student_user_id;

        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isTeacher4 } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isTeacher4) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const { data: notes } = await portalAdmin
          .from('teacher_notes')
          .select('*')
          .eq('student_user_id', sid as string)
          .eq('language_key', 'russian')
          .order('created_at', { ascending: false });

        return Response.json({ ok: true, data: { notes: notes || [] } }, { headers: corsHeaders });
      }

      // ============= Teacher Session Workflow =============
      case 'teacher_list_sessions': {
        const reqId = genRequestId();
        // Verify staff
        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isAuthS } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthS) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const { data: sessions } = await portalAdmin.from('teacher_sessions').select('*').eq('teacher_user_id', authUserId).order('created_at', { ascending: false });
        // Enrich with real student membership records
        const sessionIds = (sessions || []).map((s: any) => s.id);
        let sessionStudentsMap: Map<string, any[]> = new Map();
        if (sessionIds.length) {
          const { data: studentRows } = await portalAdmin
            .from('teacher_session_students')
            .select('session_id, student_user_id, attendance_status')
            .in('session_id', sessionIds);

          const studentIds = Array.from(new Set((studentRows || []).map((row: any) => row.student_user_id).filter(Boolean)));
          let profileMap: Map<string, any> = new Map();
          if (studentIds.length) {
            const { data: profiles } = await portalAdmin
              .from('profiles')
              .select('user_id, full_name, email')
              .in('user_id', studentIds);
            profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));
          }

          for (const row of (studentRows || [])) {
            const current = sessionStudentsMap.get(row.session_id) || [];
            const profile = profileMap.get(row.student_user_id) || {};
            current.push({
              ...row,
              full_name: profile.full_name || null,
              email: profile.email || null,
            });
            sessionStudentsMap.set(row.session_id, current);
          }
        }
        const enrichedSessions = (sessions || []).map((s: any) => ({
          ...s,
          students: sessionStudentsMap.get(s.id) || [],
        }));
        return Response.json({ ok: true, data: { sessions: enrichedSessions } }, { headers: corsHeaders });
      }

      case 'teacher_get_session': {
        const reqId = genRequestId();
        const sid = body.session_id as string;
        if (!sid) return Response.json({ ok: false, error: 'MISSING_SESSION_ID' }, { status: 400, headers: corsHeaders });

        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isAuthGS } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthGS) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const [sessionRes, studentsRes] = await Promise.all([
          portalAdmin.from('teacher_sessions').select('*').eq('id', sid).single(),
          portalAdmin.from('teacher_session_students').select('*').eq('session_id', sid),
        ]);

        if (sessionRes.error) return Response.json({ ok: false, error: sessionRes.error.message }, { headers: corsHeaders });

        // Enrich students with profile info
        const studentIds = (studentsRes.data || []).map((s: any) => s.student_user_id);
        let profileMap: Map<string, any> = new Map();
        if (studentIds.length) {
          const { data: profiles } = await portalAdmin.from('profiles').select('user_id, full_name, email').in('user_id', studentIds);
          profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        }
        // Also get current lesson for each student
        let lessonMap: Map<string, any> = new Map();
        if (studentIds.length) {
          const { data: lessons } = await portalAdmin.from('learning_lesson_progress').select('user_id, lesson_slug, module_slug, status').in('user_id', studentIds);
          for (const l of (lessons || [])) {
            if (l.status === 'in_progress' || !lessonMap.has(l.user_id)) lessonMap.set(l.user_id, l);
          }
        }

        const enrichedStudents = (studentsRes.data || []).map((s: any) => {
          const profile = profileMap.get(s.student_user_id) || {};
          const lesson = lessonMap.get(s.student_user_id);
          return {
            ...s,
            full_name: profile.full_name || null,
            email: profile.email || null,
            current_lesson: lesson?.lesson_slug || null,
            current_module: lesson?.module_slug || null,
          };
        });

        return Response.json({ ok: true, data: { ...sessionRes.data, students: enrichedStudents } }, { headers: corsHeaders });
      }

      case 'teacher_create_session': {
        const reqId = genRequestId();
        const { student_user_ids, language_key, lesson_slug, module_slug, session_type, teacher_type, curriculum_course_id, curriculum_module_id, curriculum_lesson_id, scheduled_at } = body;

        // FINAL CUTOVER: CRM-only staff check
        const staffCheckCS = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!staffCheckCS.authorized) {
          console.log(`[teacher_create_session] ❌ staff denied: reason=${staffCheckCS.denial_reason}`);
          return Response.json({ ok: false, error: 'NOT_STAFF', denial_reason: staffCheckCS.denial_reason }, { headers: corsHeaders });
        }

        if (typeof scheduled_at === 'string' && scheduled_at) {
          const slotValidation = await validateTeacherScheduleSlot({
            portalAdmin,
            teacherUserId: authUserId!,
            scheduledAt: scheduled_at,
          });
          if (!slotValidation.ok) {
            return Response.json({ ok: false, error: slotValidation.error }, { headers: corsHeaders });
          }
        }

        const { data: session, error: sessionErr } = await portalAdmin.from('teacher_sessions').insert({
          teacher_user_id: authUserId,
          language_key: (language_key as string) || 'russian',
          lesson_slug: lesson_slug || null,
          module_slug: module_slug || null,
          session_type: (session_type as string) || 'lesson_delivery',
          teacher_type: (teacher_type as string) || 'language_teacher',
          curriculum_course_id: curriculum_course_id || null,
          curriculum_module_id: curriculum_module_id || null,
          curriculum_lesson_id: curriculum_lesson_id || null,
          scheduled_at: (scheduled_at as string) || null,
          status: 'draft',
        }).select().single();

        if (sessionErr) return Response.json({ ok: false, error: sessionErr.message }, { headers: corsHeaders });

        // Add students
        const ids = Array.from(new Set((student_user_ids as string[] || []).filter(Boolean)));
        if (ids.length) {
          const resolvedIds = new Set<string>();
          for (const sid of ids) {
            const bridgedIds = await resolveLinkedPortalStudentUserIds(crmClient, portalAdmin, sid);
            const expandedIds = await expandLinkedPortalStudentUserIdsByContacts(portalAdmin, bridgedIds);
            for (const bridgedId of expandedIds) {
              resolvedIds.add(bridgedId);
            }
          }

          const rows = Array.from(resolvedIds).map((sid: string) => ({
            session_id: session.id,
            student_user_id: sid,
          }));

          if (rows.length) {
            await portalAdmin.from('teacher_session_students').insert(rows);
          }

          console.log(`[teacher_create_session] ${reqId} session=${safeId(session.id)} selected=${ids.length} resolved=${rows.length}`);
        }

        return Response.json({ ok: true, data: session }, { headers: corsHeaders });
      }

      case 'teacher_update_session': {
        const reqId = genRequestId();
        const { session_id, ...updates } = body;
        if (!session_id) return Response.json({ ok: false, error: 'MISSING_SESSION_ID' }, { status: 400, headers: corsHeaders });

        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isAuthUS } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthUS) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const allowedFields = ['status', 'zoom_link', 'lesson_slug', 'module_slug', 'session_type', 'teacher_type', 'curriculum_course_id', 'curriculum_module_id', 'curriculum_lesson_id', 'scheduled_at', 'summary', 'next_action'];
        const updateObj: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const key of allowedFields) {
          if (key in updates) updateObj[key] = updates[key];
        }

        if (typeof updateObj.scheduled_at === 'string' && updateObj.scheduled_at) {
          const slotValidation = await validateTeacherScheduleSlot({
            portalAdmin,
            teacherUserId: authUserId!,
            scheduledAt: updateObj.scheduled_at,
            currentSessionId: session_id as string,
          });
          if (!slotValidation.ok) {
            return Response.json({ ok: false, error: slotValidation.error }, { status: 409, headers: corsHeaders });
          }
        }

        const { data, error: upErr } = await portalAdmin.from('teacher_sessions').update(updateObj).eq('id', session_id).select().single();
        if (upErr) return Response.json({ ok: false, error: upErr.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data }, { headers: corsHeaders });
      }

      case 'teacher_update_attendance': {
        const { session_id, student_user_id, attendance_status } = body;
        if (!session_id || !student_user_id) return Response.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400, headers: corsHeaders });

        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isAuthAT } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthAT) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const { error: attErr } = await portalAdmin.from('teacher_session_students').update({ attendance_status }).eq('session_id', session_id).eq('student_user_id', student_user_id);
        if (attErr) return Response.json({ ok: false, error: attErr.message }, { headers: corsHeaders });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      case 'teacher_save_session_outcome': {
        const { session_id, summary: outSummary, next_action: outNext } = body;
        if (!session_id || !outSummary) return Response.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400, headers: corsHeaders });

        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isAuthOC } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthOC) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        // Upsert into session_notes
        const { data: noteData, error: noteErr } = await portalAdmin.from('teacher_session_notes').insert({
          session_id: session_id as string,
          teacher_user_id: authUserId,
          summary: outSummary as string,
          next_action: (outNext as string) || null,
        }).select().single();

        // Also update the session itself
        await portalAdmin.from('teacher_sessions').update({
          summary: outSummary as string,
          next_action: (outNext as string) || null,
          updated_at: new Date().toISOString(),
        }).eq('id', session_id);

        const { data: linkedStudents } = await portalAdmin.from('teacher_session_students').select('student_user_id').eq('session_id', session_id as string);
        if (outNext && linkedStudents?.length) {
          const reviewRows = linkedStudents.map((row: any) => ({
            teacher_user_id: authUserId,
            student_user_id: row.student_user_id,
            session_id: session_id as string,
            queue_type: 'unresolved_outcomes',
            urgency: 'medium',
            reason: `Outcome action required: ${outNext as string}`,
            recommended_next_action: outNext as string,
            status: 'open',
          }));
          await portalAdmin.from('teacher_review_items').insert(reviewRows);
        }

        const outcomeActionItems = Array.isArray(body.action_items) ? body.action_items as Array<{
          student_user_id: string;
          action_type?: string;
          title: string;
          description?: string;
          priority?: string;
          due_at?: string;
          related_lesson_slug?: string;
          related_module_slug?: string;
          recap_available?: boolean;
        }> : [];
        if (outcomeActionItems.length) {
          const rows = outcomeActionItems
            .filter((item) => item.student_user_id && item.title?.trim())
            .map((item) => ({
              session_id: session_id as string,
              teacher_user_id: authUserId,
              student_user_id: item.student_user_id,
              action_type: item.action_type || 'homework',
              title: item.title.trim(),
              description: item.description?.trim() || null,
              priority: item.priority || 'normal',
              status: 'pending',
              due_at: item.due_at || null,
              related_lesson_slug: item.related_lesson_slug || null,
              related_module_slug: item.related_module_slug || null,
              recap_available: item.recap_available === true,
            }));
          if (rows.length) {
            const { error: actionErr } = await portalAdmin.from('session_action_items').insert(rows);
            if (actionErr) return Response.json({ ok: false, error: actionErr.message }, { headers: corsHeaders });
          }
        }

        if (noteErr) return Response.json({ ok: false, error: noteErr.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data: noteData }, { headers: corsHeaders });
      }

      case 'teacher_save_evaluation': {
        const { session_id, student_user_id, participation_score, understanding_score, confidence_score, needs_review, recommended_next_action, note: evalNote } = body;
        if (!session_id || !student_user_id) return Response.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400, headers: corsHeaders });

        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isAuthEV } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthEV) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const { data: evalSession, error: evalSessionErr } = await portalAdmin
          .from('teacher_sessions')
          .select('language_key')
          .eq('id', session_id as string)
          .eq('teacher_user_id', authUserId)
          .maybeSingle();
        if (evalSessionErr) return Response.json({ ok: false, error: evalSessionErr.message }, { headers: corsHeaders });
        const sessionLanguageKey = evalSession?.language_key;
        if (!sessionLanguageKey) return Response.json({ ok: false, error: 'MISSING_SESSION_LANGUAGE' }, { status: 400, headers: corsHeaders });

        const { data, error: evErr } = await portalAdmin.from('teacher_student_session_evaluations').upsert({
          session_id: session_id as string,
          teacher_user_id: authUserId,
          student_user_id: student_user_id as string,
          language_key: sessionLanguageKey,
          participation_score: participation_score != null ? Number(participation_score) : null,
          understanding_score: understanding_score != null ? Number(understanding_score) : null,
          confidence_score: confidence_score != null ? Number(confidence_score) : null,
          needs_review: needs_review === true,
          recommended_next_action: (recommended_next_action as string) || null,
          note: (evalNote as string) || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id,student_user_id' }).select().single();

        if (evErr) return Response.json({ ok: false, error: evErr.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data }, { headers: corsHeaders });
      }

      case 'teacher_get_evaluations': {
        const sid = body.session_id as string;
        if (!sid) return Response.json({ ok: false, error: 'MISSING_SESSION_ID' }, { status: 400, headers: corsHeaders });

        // FINAL CUTOVER: CRM-only staff check
        const { authorized: isAuthGE } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthGE) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const { data: evals } = await portalAdmin.from('teacher_student_session_evaluations').select('*').eq('session_id', sid);
        return Response.json({ ok: true, data: { evaluations: evals || [] } }, { headers: corsHeaders });
      }

      case 'teacher_set_exam_decision': {
        const studentId = body.student_user_id as string;
        const decision = (body.decision as string) || 'proceed';
        const reason = (body.reason as string) || null;
        if (!studentId) return Response.json({ ok: false, error: 'MISSING_STUDENT_ID' }, { status: 400, headers: corsHeaders });
        if (!['proceed', 'retake', 'recovery'].includes(decision)) {
          return Response.json({ ok: false, error: 'INVALID_DECISION' }, { status: 400, headers: corsHeaders });
        }

        const { authorized: isAuthExam } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthExam) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const progressionStatus = decision === 'proceed' ? 'active' : 'review_hold';
        const nextDecision = decision === 'proceed' ? 'proceed_after_exam' : decision === 'retake' ? 'retake_exam' : 'exam_recovery_required';

        const { error: stateErr } = await portalAdmin.from('student_course_state').upsert({
          student_user_id: studentId,
          course_key: 'russian',
          progression_status: progressionStatus,
          next_teacher_decision: nextDecision,
          last_teacher_action_at: new Date().toISOString(),
        } as any, { onConflict: 'student_user_id,course_key' });
        if (stateErr) return Response.json({ ok: false, error: stateErr.message }, { headers: corsHeaders });

        await portalAdmin.from('teacher_notes').insert({
          teacher_user_id: authUserId,
          student_user_id: studentId,
          language_key: 'russian',
          note: `[exam_${decision}] ${reason || nextDecision}`,
        });

        return Response.json({ ok: true, data: { decision, progression_status: progressionStatus, next_teacher_decision: nextDecision } }, { headers: corsHeaders });
      }


      case 'teacher_list_plans': {
        const { authorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!authorized) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const studentId = (body.student_user_id as string) || null;
        let q = portalAdmin.from('teacher_plans').select('*').eq('teacher_user_id', authUserId).order('created_at', { ascending: false });
        if (studentId) q = q.eq('student_user_id', studentId);
        const { data, error } = await q;
        if (error) return Response.json({ ok: false, error: error.message }, { headers: corsHeaders });
        const plans = (data || []).map((plan: any) => ({
          ...plan,
          target_lessons: Array.isArray(plan.target_lessons) ? plan.target_lessons : [],
          homework_payload: Array.isArray(plan.homework_payload) ? plan.homework_payload : [],
          checkpoint_payload: Array.isArray(plan.checkpoint_payload) ? plan.checkpoint_payload : [],
        }));
        return Response.json({ ok: true, data: { plans } }, { headers: corsHeaders });
      }

      case 'teacher_create_plan': {
        const { authorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!authorized) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const insertRow = {
          teacher_user_id: authUserId,
          student_user_id: body.student_user_id,
          language_key: (body.language_key as string) || 'russian',
          teacher_type: (body.teacher_type as string) || 'language_teacher',
          plan_type: body.plan_type,
          status: 'active',
          title: body.title,
          target_lessons: body.target_lessons || [],
          homework_payload: body.homework_payload || [],
          checkpoint_payload: body.checkpoint_payload || [],
          ai_policy: body.ai_policy || {},
        };
        const { data, error } = await portalAdmin.from('teacher_plans').insert(insertRow).select().single();
        if (error) return Response.json({ ok: false, error: error.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data }, { headers: corsHeaders });
      }

      case 'teacher_list_review_items': {
        const { authorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!authorized) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const studentId = (body.student_user_id as string) || null;
        let q = portalAdmin.from('teacher_review_items').select('*').eq('teacher_user_id', authUserId).order('created_at', { ascending: false });
        if (studentId) q = q.eq('student_user_id', studentId);
        const { data, error } = await q;
        if (error) return Response.json({ ok: false, error: error.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data: { items: data || [] } }, { headers: corsHeaders });
      }

      case 'teacher_upsert_review_item': {
        const { authorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!authorized) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const row = {
          teacher_user_id: authUserId,
          student_user_id: body.student_user_id || null,
          session_id: body.session_id || null,
          lesson_slug: body.lesson_slug || null,
          module_slug: body.module_slug || null,
          queue_type: body.queue_type,
          urgency: body.urgency || 'medium',
          reason: body.reason,
          recommended_next_action: body.recommended_next_action || null,
          status: body.status || 'open',
          outreach_log: body.outreach_log || [],
        };
        const { data, error } = await portalAdmin.from('teacher_review_items').insert(row).select().single();
        if (error) return Response.json({ ok: false, error: error.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data }, { headers: corsHeaders });
      }

      case 'teacher_update_review_item_status': {
        const { authorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!authorized) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const id = body.review_item_id as string;
        const status = body.status as string;
        const { data, error } = await portalAdmin.from('teacher_review_items').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id).eq('teacher_user_id', authUserId).select().single();
        if (error) return Response.json({ ok: false, error: error.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data }, { headers: corsHeaders });
      }

      case 'teacher_ai_copilot': {
        const { authorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!authorized) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const action = (body.action as string) || 'summarize_student_state';
        const studentId = body.student_user_id as string;
        const lessonSlug = (body.lesson_slug as string) || null;
        const [{ data: lessons }, { data: evals }, { data: notes }] = await Promise.all([
          portalAdmin.from('learning_lesson_progress').select('lesson_slug,status,updated_at').eq('user_id', studentId).order('updated_at', { ascending: false }).limit(10),
          portalAdmin.from('teacher_student_session_evaluations').select('recommended_next_action,note,needs_review').eq('student_user_id', studentId).order('created_at', { ascending: false }).limit(8),
          portalAdmin.from('teacher_notes').select('note,created_at').eq('student_user_id', studentId).order('created_at', { ascending: false }).limit(8),
        ]);
        const weak = (evals || []).filter((x: any) => x.needs_review).length;
        const output = `${action}: recent_lessons=${(lessons || []).length}; review_flags=${weak}; lesson=${lessonSlug || 'n/a'}`;
        const tasks = [
          weak > 0 ? 'review_current_lesson' : 'continue_next_lesson',
          'assign_targeted_homework',
          'check_ai_followup',
        ];
        return Response.json({ ok: true, data: { output, tasks } }, { headers: corsHeaders });
      }

      case 'teacher_get_ai_followups': {
        const { authorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!authorized) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const studentId = (body.student_user_id as string) || null;
        let q = portalAdmin.from('teacher_ai_followups').select('*').eq('teacher_user_id', authUserId).order('created_at', { ascending: false });
        if (studentId) q = q.eq('student_user_id', studentId);
        const { data, error } = await q.limit(30);
        if (error) return Response.json({ ok: false, error: error.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data: { rows: data || [] } }, { headers: corsHeaders });
      }

      case 'teacher_get_exam_mode': {
        const { authorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!authorized) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const studentId = body.student_user_id as string;
        const { data, error } = await portalAdmin.from('teacher_exam_modes').select('*').eq('teacher_user_id', authUserId).eq('student_user_id', studentId).maybeSingle();
        if (error) return Response.json({ ok: false, error: error.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data: data || null }, { headers: corsHeaders });
      }

      case 'teacher_upsert_exam_mode': {
        const { authorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!authorized) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const examDate = (body.exam_date as string) || null;
        const countdown = examDate ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000)) : null;
        const row = {
          teacher_user_id: authUserId,
          student_user_id: body.student_user_id,
          language_key: (body.language_key as string) || 'russian',
          exam_target: body.exam_target || null,
          exam_date: examDate,
          countdown_days: countdown,
          required_sessions_per_week: body.required_sessions_per_week || 5,
          daily_target_sessions: body.daily_target_sessions || 1,
          emergency_catchup_enabled: body.emergency_catchup_enabled === true,
          risk_flags: countdown !== null && countdown <= 30 ? ['high_countdown'] : [],
          daily_targets: body.daily_targets || {},
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await portalAdmin.from('teacher_exam_modes').upsert(row, { onConflict: 'teacher_user_id,student_user_id,language_key' }).select().single();
        if (error) return Response.json({ ok: false, error: error.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data }, { headers: corsHeaders });
      }

      case 'teacher_mark_lesson_complete': {
        const { authorized } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!authorized) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const studentUserId = body.student_user_id as string;
        const lessonSlug = body.lesson_slug as string;
        const moduleSlug = (body.module_slug as string) || null;
        const courseKey = (body.course_key as string) || 'russian';
        if (!studentUserId || !lessonSlug) {
          return Response.json({ ok: false, error: 'MISSING_PARAMS' }, { status: 400, headers: corsHeaders });
        }
        // Upsert student_lesson_progression to 'completed'
        const { error: progError } = await portalAdmin.from('student_lesson_progression').upsert({
          student_user_id: studentUserId,
          course_key: courseKey,
          lesson_slug: lessonSlug,
          module_slug: moduleSlug,
          status: 'completed',
          completed_at: new Date().toISOString(),
          released_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'student_user_id,course_key,lesson_slug' });
        if (progError) {
          console.error('[teacher_mark_lesson_complete] progression upsert error', progError);
          return Response.json({ ok: false, error: progError.message }, { headers: corsHeaders });
        }
        // Also sync learning_lesson_progress for the student
        const { error: llpError } = await portalAdmin.from('learning_lesson_progress').upsert({
          user_id: studentUserId,
          lesson_slug: lessonSlug,
          module_slug: moduleSlug,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,lesson_slug' });
        if (llpError) console.warn('[teacher_mark_lesson_complete] learning_lesson_progress upsert warning', llpError);
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      case 'teacher_list_documents': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} action=teacher_list_documents auth=${safeId(authUserId)}`);

        // Staff check
        const { authorized: isAuthTLD } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthTLD) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        // Query CRM for teacher documents via the staff's email
        try {
          const { data: tldUserData } = await portalAdmin.auth.admin.getUserById(authUserId!);
          const tldEmail = tldUserData?.user?.email;

          if (!tldEmail) {
            return Response.json({ ok: true, data: { documents: [] } }, { headers: corsHeaders });
          }

          // ✅ CANONICAL: Query teacher_documents from Portal DB (not CRM)
          const { data: docs, error: docsErr } = await portalAdmin
            .from('teacher_documents')
            .select('id, doc_type, file_name, verification_status, rejection_reason, reviewer_notes, created_at, file_url, storage_path')
            .eq('staff_email', tldEmail)
            .order('created_at', { ascending: false });

          if (docsErr) {
            console.warn(`[student-portal-api] ${reqId} ⚠️ teacher_documents query failed:`, docsErr.message);
            return Response.json({ ok: true, data: { documents: [] } }, { headers: corsHeaders });
          }

          const documents = (docs || []).map((d: any) => ({
            file_id: d.id,
            file_kind: d.doc_type || 'other',
            file_name: d.file_name,
            status: d.verification_status || 'pending',
            rejection_reason: d.rejection_reason,
            reviewer_notes: d.reviewer_notes,
            uploaded_at: d.created_at,
            file_url: d.file_url,
          }));

          console.log(`[student-portal-api] ${reqId} ✅ Teacher documents (canonical): ${documents.length}`);
          return Response.json({ ok: true, data: { documents } }, { headers: corsHeaders });
        } catch (e) {
          console.error(`[student-portal-api] ${reqId} ❌ Teacher documents error:`, e);
          return Response.json({ ok: true, data: { documents: [] } }, { headers: corsHeaders });
        }
      }

      // ============= Sync Teacher State (CRM → Portal local cache) =============
      case 'sync_teacher_state': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} action=sync_teacher_state auth=${safeId(authUserId)}`);

        const { authorized: isSyncStaff } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isSyncStaff) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        try {
          // 1. Get user email
          const { data: syncUserData } = await portalAdmin.auth.admin.getUserById(authUserId!);
          const syncEmail = syncUserData?.user?.email;
          if (!syncEmail) {
            return Response.json({ ok: false, error: 'NO_EMAIL' }, { headers: corsHeaders });
          }

          // 2. Call canonical CRM sync contract (staff-authority-resolve with mode teacher_state_sync)
          const crmServiceKey = Deno.env.get('CRM_SERVICE_ROLE_KEY');
          let crmPayload: any = null;

          if (crmServiceKey) {
            try {
              const crmRes = await fetch('https://hlrkyoxwbjsgqbncgzpi.supabase.co/functions/v1/staff-authority-resolve', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${crmServiceKey}`,
                },
                body: JSON.stringify({ email: syncEmail, mode: 'teacher_state_sync' }),
              });
              if (crmRes.ok) {
                const crmJson = await crmRes.json();
                if (crmJson?.ok && crmJson?.data) {
                  crmPayload = crmJson.data;
                  console.log(`[student-portal-api] ${reqId} ✅ Canonical CRM sync payload received`);
                } else {
                  console.warn(`[student-portal-api] ${reqId} ⚠️ CRM sync returned non-ok:`, crmJson?.error);
                }
              } else {
                console.warn(`[student-portal-api] ${reqId} ⚠️ CRM sync HTTP ${crmRes.status}`);
              }
            } catch (crmErr) {
              console.warn(`[student-portal-api] ${reqId} ⚠️ CRM canonical sync call failed:`, crmErr);
            }
          }

          // 3. Fallback: if canonical sync unavailable, derive from raw CRM staff reads
          if (!crmPayload) {
            console.log(`[student-portal-api] ${reqId} 🔄 Falling back to raw CRM staff query`);
            const { data: staffRow, error: staffErr } = await crmClient
              .from('staff')
              .select('id, role, email, full_name, phone, is_active, access_scope')
              .eq('email', syncEmail)
              .eq('is_active', true)
              .maybeSingle();

            let verificationData: any = null;
            try {
              const { data: vRow } = await crmClient
                .from('staff')
                .select('identity_verified, education_verified, approval_status, reviewer_notes, rejection_reason, more_info_reason')
                .eq('email', syncEmail)
                .maybeSingle();
              verificationData = vRow;
            } catch { /* columns may not exist */ }

            if (staffErr || !staffRow) {
              return Response.json({ ok: false, error: 'NOT_FOUND_IN_CRM' }, { headers: corsHeaders });
            }

            const isActive = staffRow.is_active === true;
            const identityVerified = verificationData?.identity_verified === true || isActive;
            const educationVerified = verificationData?.education_verified === true || isActive;
            const approvalStatus = verificationData?.approval_status || (isActive ? 'approved' : 'pending');
            const canTeach = isActive && identityVerified && educationVerified && approvalStatus === 'approved';
            const blockers: string[] = [];
            if (!isActive) blockers.push('account_inactive');
            if (!identityVerified) blockers.push('identity_not_verified');
            if (!educationVerified) blockers.push('education_not_verified');
            if (approvalStatus && approvalStatus !== 'approved') blockers.push(`approval_${approvalStatus}`);

            crmPayload = {
              crm_staff_id: staffRow.id,
              role: staffRow.role || 'teacher',
              access_scope: staffRow.access_scope,
              is_active: isActive,
              approval_status: approvalStatus,
              identity_verified: identityVerified,
              education_verified: educationVerified,
              can_teach: canTeach,
              blockers,
              full_name: staffRow.full_name,
              email: staffRow.email || syncEmail,
              phone: staffRow.phone,
              reviewer_notes: verificationData?.reviewer_notes || null,
              rejection_reason: verificationData?.rejection_reason || null,
              more_info_reason: verificationData?.more_info_reason || null,
            };
          }

          // 4. Upsert into Portal teacher_state_cache
          const blockers = Array.isArray(crmPayload.blockers) ? crmPayload.blockers : [];
          const cachePayload = {
            portal_auth_user_id: authUserId,
            crm_staff_id: crmPayload.crm_staff_id || null,
            role: crmPayload.role || 'teacher',
            access_scope: crmPayload.access_scope || null,
            is_active: crmPayload.is_active === true,
            approval_status: crmPayload.approval_status || 'pending',
            identity_verified: crmPayload.identity_verified === true,
            education_verified: crmPayload.education_verified === true,
            can_teach: crmPayload.can_teach === true,
            blockers: JSON.stringify(blockers),
            full_name: crmPayload.full_name || null,
            email: crmPayload.email || syncEmail,
            phone: crmPayload.phone || null,
            reviewer_notes: crmPayload.reviewer_notes || null,
            rejection_reason: crmPayload.rejection_reason || null,
            more_info_reason: crmPayload.more_info_reason || null,
            synced_at: new Date().toISOString(),
            source_version: crmPayload.source_version || 'canonical_sync_v1',
          };

          const { error: upsertErr } = await portalAdmin
            .from('teacher_state_cache')
            .upsert(cachePayload, { onConflict: 'portal_auth_user_id' });

          if (upsertErr) {
            console.error(`[student-portal-api] ${reqId} ❌ teacher_state_cache upsert error:`, upsertErr.message);
            return Response.json({ ok: false, error: 'CACHE_UPSERT_FAILED', details: upsertErr.message }, { headers: corsHeaders });
          }

          console.log(`[student-portal-api] ${reqId} ✅ Teacher state synced to local cache`);

          // Also sync document verification_status based on CRM truth
          const cacheSyncEmail = cachePayload.email;
          if (cacheSyncEmail) {
            try {
              // If identity_verified, mark identity docs as verified
              if (cachePayload.identity_verified) {
                await portalAdmin
                  .from('teacher_documents')
                  .update({ verification_status: 'verified' })
                   .eq('staff_email', cacheSyncEmail)
                  .eq('doc_type', 'teacher_identity')
                  .neq('verification_status', 'verified');
              }
              // If education_verified, mark education docs as verified
              if (cachePayload.education_verified) {
                await portalAdmin
                  .from('teacher_documents')
                  .update({ verification_status: 'verified' })
                  .eq('staff_email', cacheSyncEmail)
                  .eq('doc_type', 'teacher_education')
                  .neq('verification_status', 'verified');
              }
              console.log(`[student-portal-api] ${reqId} ✅ Document statuses synced from CRM truth`);
            } catch (docSyncErr) {
              console.warn(`[student-portal-api] ${reqId} ⚠️ Document status sync failed (non-blocking):`, docSyncErr);
            }
          }

          return Response.json({
            ok: true,
            data: {
              synced: true,
              state: { ...cachePayload, blockers },
            },
          }, { headers: corsHeaders });
        } catch (e) {
          console.error(`[student-portal-api] ${reqId} ❌ sync_teacher_state error:`, e);
          return Response.json({ ok: false, error: 'SYNC_ERROR', details: String(e) }, { headers: corsHeaders });
        }
      }

      // ============= Get Teacher State (local cache read) =============
      case 'get_teacher_state': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} action=get_teacher_state auth=${safeId(authUserId)}`);

        try {
          const { data: cached, error: cacheErr } = await portalAdmin
            .from('teacher_state_cache')
            .select('*')
            .eq('portal_auth_user_id', authUserId)
            .maybeSingle();

          if (cacheErr) {
            console.warn(`[student-portal-api] ${reqId} ⚠️ Cache read error:`, cacheErr.message);
            return Response.json({ ok: true, data: { found: false } }, { headers: corsHeaders });
          }

          if (!cached) {
            return Response.json({ ok: true, data: { found: false } }, { headers: corsHeaders });
          }

          return Response.json({ ok: true, data: { found: true, ...cached } }, { headers: corsHeaders });
        } catch (e) {
          console.error(`[student-portal-api] ${reqId} ❌ get_teacher_state error:`, e);
          return Response.json({ ok: true, data: { found: false } }, { headers: corsHeaders });
        }
      }


      case 'teacher_upload_document': {
        const reqId = genRequestId();
        console.log(`[student-portal-api] ${reqId} action=teacher_upload_document auth=${safeId(authUserId)}`);

        const { authorized: isAuthTUD } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthTUD) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const { data: tudUserData } = await portalAdmin.auth.admin.getUserById(authUserId!);
        const tudEmail = tudUserData?.user?.email;
        if (!tudEmail) {
          return Response.json({ ok: false, error: 'NO_EMAIL' }, { headers: corsHeaders });
        }

        const { doc_type, file_name, file_url, storage_bucket, storage_path, mime_type, size_bytes } = body as any;

        if (!doc_type || !file_name) {
          return Response.json({ ok: false, error: 'MISSING_PARAMS', details: 'doc_type and file_name required' }, { headers: corsHeaders });
        }

        try {
          // ✅ Insert into canonical teacher_documents table
          const insertPayload = {
            staff_email: tudEmail,
            doc_type,
            file_name,
            file_url: file_url || null,
            storage_bucket: storage_bucket || 'teacher-docs',
            storage_path: storage_path || null,
            mime_type: mime_type || 'application/octet-stream',
            size_bytes: size_bytes || 0,
            verification_status: 'pending',
          };

          const { data: insertData, error: insertErr } = await portalAdmin
            .from('teacher_documents')
            .insert(insertPayload)
            .select('id')
            .single();

          if (insertErr) {
            console.error(`[student-portal-api] ${reqId} ❌ teacher_documents insert error:`, insertErr.message);
            return Response.json({ ok: false, error: 'INSERT_FAILED', details: insertErr.message }, { headers: corsHeaders });
          }

          console.log(`[student-portal-api] ${reqId} ✅ Teacher document registered: ${insertData?.id}`);

          // Fire-and-forget: sync document metadata to CRM teacher_documents
          const docTypeMap: Record<string, string> = {
            teacher_identity: 'identity',
            teacher_education: 'education',
          };
          const crmDocType = docTypeMap[doc_type] || 'other';
          const crmServiceRoleKey = Deno.env.get('CRM_SERVICE_ROLE_KEY');
          if (crmServiceRoleKey) {
            fetch('https://hlrkyoxwbjsgqbncgzpi.supabase.co/functions/v1/staff-authority-resolve', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${crmServiceRoleKey}`,
              },
              body: JSON.stringify({
                email: tudEmail,
                mode: 'teacher_doc_sync',
                documents: [{
                  doc_type: crmDocType,
                  file_name,
                  file_url: file_url || null,
                }],
              }),
            }).then(r => {
              console.log(`[student-portal-api] ${reqId} CRM doc sync status=${r.status}`);
            }).catch(err => {
              console.warn(`[student-portal-api] ${reqId} CRM doc sync failed (non-blocking):`, err?.message);
            });
          } else {
            console.warn(`[student-portal-api] ${reqId} CRM_SERVICE_ROLE_KEY not set, skipping CRM doc sync`);
          }

          return Response.json({ ok: true, data: { file_id: insertData?.id } }, { headers: corsHeaders });
        } catch (e) {
          console.error(`[student-portal-api] ${reqId} ❌ teacher_upload_document error:`, e);
          return Response.json({ ok: false, error: 'UPLOAD_ERROR', details: String(e) }, { headers: corsHeaders });
        }
      }

      // ============= Account Identity Changes =============
      case 'change_email': {
        const newEmail = (body.new_email as string || '').trim().toLowerCase();
        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
          return Response.json({ ok: false, error: 'invalid_email', message: 'Invalid email address' }, { headers: corsHeaders });
        }

        // 1) Resolve CRM customer_id
        const emailProfileRes = await fetchCrmProfileByAuthUserId(crmClient, authUserId!);
        if (!emailProfileRes.ok || !emailProfileRes.linked || !emailProfileRes.profile) {
          return Response.json({ ok: false, error: 'customer_not_found' }, { headers: corsHeaders });
        }
        if (emailProfileRes.profile.profile_locked === true) {
          return Response.json({ ok: false, error: 'profile_locked', message: 'Profile is locked' }, { headers: corsHeaders });
        }
        const emailCustomerId = (emailProfileRes.profile.customer_id || emailProfileRes.profile.id) as string;

        // 2) Call CRM RPC
        const { data: emailRpcData, error: emailRpcErr } = await crmClient.rpc('rpc_portal_update_email', {
          p_customer_id: emailCustomerId,
          p_new_email: newEmail,
        });

        if (emailRpcErr) {
          const errMsg = typeof emailRpcErr === 'object' && 'message' in emailRpcErr ? (emailRpcErr as any).message : String(emailRpcErr);
          console.error('[change_email] CRM RPC error:', errMsg);
          // Map known CRM errors
          if (errMsg.includes('email_already_in_use')) {
            return Response.json({ ok: false, error: 'email_already_in_use' }, { headers: corsHeaders });
          }
          if (errMsg.includes('profile_locked')) {
            return Response.json({ ok: false, error: 'profile_locked' }, { headers: corsHeaders });
          }
          return Response.json({ ok: false, error: 'crm_error', message: errMsg }, { headers: corsHeaders });
        }

        // 3) Update Portal auth.users email
        const { error: authUpdateErr } = await portalAdmin.auth.admin.updateUserById(authUserId!, { email: newEmail });
        if (authUpdateErr) {
          console.error('[change_email] auth.users update failed:', authUpdateErr);
          // CRM already updated - log but don't fail user
        }

        // 4) Update Portal profiles.email
        await portalAdmin.from('profiles').update({ email: newEmail }).eq('user_id', authUserId);

        console.log('[change_email] ✅ Email changed successfully for user:', authUserId);
        return Response.json({ ok: true, new_email: newEmail }, { headers: corsHeaders });
      }

      case 'change_phone': {
        const newPhone = (body.new_phone_e164 as string || '').trim();
        if (!newPhone || !/^\+[1-9]\d{6,14}$/.test(newPhone)) {
          return Response.json({ ok: false, error: 'invalid_phone', message: 'Invalid E.164 phone number' }, { headers: corsHeaders });
        }

        // 1) Resolve CRM customer_id
        const phoneProfileRes = await fetchCrmProfileByAuthUserId(crmClient, authUserId!);
        if (!phoneProfileRes.ok || !phoneProfileRes.linked || !phoneProfileRes.profile) {
          return Response.json({ ok: false, error: 'customer_not_found' }, { headers: corsHeaders });
        }
        if (phoneProfileRes.profile.profile_locked === true) {
          return Response.json({ ok: false, error: 'profile_locked', message: 'Profile is locked' }, { headers: corsHeaders });
        }
        const phoneCustomerId = (phoneProfileRes.profile.customer_id || phoneProfileRes.profile.id) as string;

        // 2) Call CRM RPC
        const { data: phoneRpcData, error: phoneRpcErr } = await crmClient.rpc('rpc_portal_change_phone_verified', {
          p_customer_id: phoneCustomerId,
          p_new_phone_e164: newPhone,
          p_verification_source: 'portal_otp',
        });

        if (phoneRpcErr) {
          const errMsg = typeof phoneRpcErr === 'object' && 'message' in phoneRpcErr ? (phoneRpcErr as any).message : String(phoneRpcErr);
          console.error('[change_phone] CRM RPC error:', errMsg);
          if (errMsg.includes('phone_already_in_use')) {
            return Response.json({ ok: false, error: 'phone_already_in_use' }, { headers: corsHeaders });
          }
          if (errMsg.includes('profile_locked')) {
            return Response.json({ ok: false, error: 'profile_locked' }, { headers: corsHeaders });
          }
          return Response.json({ ok: false, error: 'crm_error', message: errMsg }, { headers: corsHeaders });
        }

        // 3) Update Portal auth.users phone
        const { error: phoneAuthErr } = await portalAdmin.auth.admin.updateUserById(authUserId!, { phone: newPhone });
        if (phoneAuthErr) {
          console.error('[change_phone] auth.users phone update failed:', phoneAuthErr);
        }

        // 4) Update Portal profiles.phone
        await portalAdmin.from('profiles').update({ phone: newPhone }).eq('user_id', authUserId);

        // 5) Update portal_customer_map.phone_e164
        await portalAdmin.from('portal_customer_map').update({ phone_e164: newPhone }).eq('portal_auth_user_id', authUserId);

        console.log('[change_phone] ✅ Phone changed successfully for user:', authUserId);
        return Response.json({ ok: true, new_phone: newPhone }, { headers: corsHeaders });
      }

      // ========== SHARED LIFECYCLE: SESSION ACTION ITEMS ==========
      case 'teacher_create_action_items': {
        const { authorized: isAuthAI } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthAI) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const items = body.items as Array<{
          session_id: string; student_user_id: string; action_type: string;
          title: string; description?: string; priority?: string;
          due_at?: string; related_lesson_slug?: string; related_module_slug?: string;
          recap_available?: boolean;
        }>;
        if (!items?.length) return Response.json({ ok: false, error: 'MISSING_ITEMS' }, { status: 400, headers: corsHeaders });
        const rows = items.map(item => ({
          session_id: item.session_id,
          teacher_user_id: authUserId,
          student_user_id: item.student_user_id,
          action_type: item.action_type || 'homework',
          title: item.title,
          description: item.description || null,
          priority: item.priority || 'normal',
          status: 'pending',
          due_at: item.due_at || null,
          related_lesson_slug: item.related_lesson_slug || null,
          related_module_slug: item.related_module_slug || null,
          recap_available: item.recap_available || false,
        }));
        const { data: inserted, error: insErr } = await portalAdmin.from('session_action_items').insert(rows).select();
        if (insErr) return Response.json({ ok: false, error: insErr.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data: { items: inserted } }, { headers: corsHeaders });
      }

      case 'teacher_list_action_items': {
        const { authorized: isAuthTLA } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthTLA) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });
        const studentFilter = body.student_user_id as string | null;
        const statusFilter = body.status as string | null;
        const sessionFilter = body.session_id as string | null;
        let q = portalAdmin.from('session_action_items').select('*')
          .eq('teacher_user_id', authUserId)
          .order('created_at', { ascending: false })
          .limit(100);
        if (studentFilter) q = q.eq('student_user_id', studentFilter);
        if (statusFilter) q = q.eq('status', statusFilter);
        if (sessionFilter) q = q.eq('session_id', sessionFilter);
        const { data: actionItems, error: aiErr } = await q;
        if (aiErr) return Response.json({ ok: false, error: aiErr.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data: { items: actionItems || [] } }, { headers: corsHeaders });
      }

      case 'teacher_review_action_item': {
        const { authorized: isAuthReview } = await verifyCrmStaffRole(crmClient, portalAdmin, authUserId!);
        if (!isAuthReview) return Response.json({ ok: false, error: 'NOT_STAFF' }, { status: 403, headers: corsHeaders });

        const itemId = body.item_id as string;
        const feedback = (body.feedback as string) || null;
        const decision = (body.decision as string) || 'pass';
        const score = typeof body.score === 'number' ? body.score : null;
        if (!itemId || !feedback?.trim()) {
          return Response.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400, headers: corsHeaders });
        }
        if (!['pass', 'revise', 'reteach'].includes(decision)) {
          return Response.json({ ok: false, error: 'INVALID_DECISION' }, { status: 400, headers: corsHeaders });
        }

        const { data: targetItem, error: targetErr } = await portalAdmin
          .from('session_action_items')
          .select('id, teacher_user_id, status, student_user_id')
          .eq('id', itemId)
          .maybeSingle();
        if (targetErr) return Response.json({ ok: false, error: targetErr.message }, { headers: corsHeaders });
        if (!targetItem || targetItem.teacher_user_id !== authUserId) {
          return Response.json({ ok: false, error: 'NOT_FOUND' }, { status: 404, headers: corsHeaders });
        }

        const { data: reviewed, error: reviewErr } = await portalAdmin
          .from('session_action_items')
          .update({
            status: 'reviewed',
            teacher_feedback: feedback.trim(),
            review_decision: decision,
            score,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)
          .select()
          .single();
        if (reviewErr) return Response.json({ ok: false, error: reviewErr.message }, { headers: corsHeaders });

        // Homework review can hold or release progression explicitly.
        const nextDecision = decision === 'pass' ? 'homework_passed' : decision === 'revise' ? 'homework_revision_required' : 'homework_reteach_required';
        const progressionStatus = decision === 'pass' ? 'active' : 'review_hold';
        await portalAdmin.from('student_course_state').upsert({
          student_user_id: targetItem.student_user_id,
          course_key: 'russian',
          progression_status: progressionStatus,
          next_teacher_decision: nextDecision,
          last_teacher_action_at: new Date().toISOString(),
        } as any, { onConflict: 'student_user_id,course_key' });

        return Response.json({ ok: true, data: reviewed }, { headers: corsHeaders });
      }

      case 'student_list_sessions': {
        const reqId = genRequestId();
        const baseLinkedUserIds = await resolveLinkedPortalStudentUserIds(crmClient, portalAdmin, authUserId!);
        const linkedUserIds = await expandLinkedPortalStudentUserIdsByContacts(portalAdmin, baseLinkedUserIds);
        console.log(`[student_list_sessions] ${reqId} auth=${safeId(authUserId)} linked_ids=${linkedUserIds.map(safeId).join(',')}`);

        const { data: membershipRows, error: membershipErr } = await portalAdmin
          .from('teacher_session_students')
          .select('session_id, student_user_id, attendance_status')
          .in('student_user_id', linkedUserIds);

        if (membershipErr) {
          return Response.json({ ok: false, error: membershipErr.message }, { headers: corsHeaders });
        }

        const sessionIds = Array.from(new Set((membershipRows || []).map((row: any) => row.session_id).filter(Boolean)));
        if (!sessionIds.length) {
          return Response.json({
            ok: true,
            data: {
              sessions: [],
              notes: [],
              evaluations: [],
              teacherNames: {},
              aiRecapUsage: 0,
            },
          }, { headers: corsHeaders });
        }

        const [sessionsRes, notesRes, evalsRes] = await Promise.all([
          portalAdmin
            .from('teacher_sessions')
            .select('id, status, scheduled_at, session_type, lesson_slug, module_slug, zoom_link, summary, next_action, teacher_user_id')
            .in('id', sessionIds),
          portalAdmin
            .from('teacher_session_notes')
            .select('session_id, summary, next_action')
            .in('session_id', sessionIds),
          portalAdmin
            .from('teacher_student_session_evaluations')
            .select('session_id, understanding_score, confidence_score, participation_score, student_user_id')
            .in('session_id', sessionIds)
            .in('student_user_id', linkedUserIds),
        ]);

        if (sessionsRes.error) return Response.json({ ok: false, error: sessionsRes.error.message }, { headers: corsHeaders });
        if (notesRes.error) return Response.json({ ok: false, error: notesRes.error.message }, { headers: corsHeaders });
        if (evalsRes.error) return Response.json({ ok: false, error: evalsRes.error.message }, { headers: corsHeaders });

        const sessions = sessionsRes.data || [];
        const teacherIds = Array.from(new Set(sessions.map((s: any) => s.teacher_user_id).filter(Boolean)));

        let teacherNames: Record<string, string | null> = {};
        if (teacherIds.length) {
          const [{ data: profileRows }, { data: teacherProfileRows }] = await Promise.all([
            portalAdmin.from('profiles').select('user_id, full_name').in('user_id', teacherIds),
            portalAdmin.from('teacher_public_profiles').select('user_id, display_name').in('user_id', teacherIds),
          ]);

          for (const row of (profileRows || [])) {
            teacherNames[row.user_id] = row.full_name || null;
          }
          for (const row of (teacherProfileRows || [])) {
            if (row.display_name) teacherNames[row.user_id] = row.display_name;
          }
        }

        const evalBySession = new Map<string, { session_id: string; understanding_score: number | null; confidence_score: number | null; participation_score: number | null; student_user_id?: string }>();
        for (const row of (evalsRes.data || [])) {
          const existing = evalBySession.get(row.session_id);
          if (!existing || row.student_user_id === authUserId) {
            evalBySession.set(row.session_id, row);
          }
        }

        const evaluations = Array.from(evalBySession.values()).map(({ session_id, understanding_score, confidence_score, participation_score }) => ({
          session_id,
          understanding_score,
          confidence_score,
          participation_score,
        }));

        return Response.json({
          ok: true,
          data: {
            sessions,
            notes: notesRes.data || [],
            evaluations,
            teacherNames,
            aiRecapUsage: (notesRes.data || []).length,
          },
        }, { headers: corsHeaders });
      }

      case 'student_list_action_items': {
        // Student reads their own action items (no staff check)
        const statusFilter2 = body.status as string | null;
        let q2 = portalAdmin.from('session_action_items').select('*')
          .eq('student_user_id', authUserId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (statusFilter2) q2 = q2.eq('status', statusFilter2);
        const { data: myItems, error: myErr } = await q2;
        if (myErr) return Response.json({ ok: false, error: myErr.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data: { items: myItems || [] } }, { headers: corsHeaders });
      }

      case 'student_complete_action_item': {
        // Student completes/submits their own action item
        const itemId = body.item_id as string;
        const response = (body.response as string) || null;
        if (!itemId) return Response.json({ ok: false, error: 'MISSING_ITEM_ID' }, { status: 400, headers: corsHeaders });
        const { data: updated, error: updErr } = await portalAdmin.from('session_action_items')
          .update({
            status: 'completed',
            student_response: response,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)
          .eq('student_user_id', authUserId)
          .select()
          .single();
        if (updErr) return Response.json({ ok: false, error: updErr.message }, { headers: corsHeaders });
        return Response.json({ ok: true, data: updated }, { headers: corsHeaders });
      }

      case 'student_delete_action_item': {
        const delItemId = body.item_id as string;
        if (!delItemId) return Response.json({ ok: false, error: 'MISSING_ITEM_ID' }, { status: 400, headers: corsHeaders });
        const { error: delErr } = await portalAdmin.from('session_action_items')
          .delete()
          .eq('id', delItemId)
          .eq('student_user_id', authUserId);
        if (delErr) return Response.json({ ok: false, error: delErr.message }, { headers: corsHeaders });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      case 'student_dismiss_session': {
        const sessId = body.session_id as string;
        if (!sessId) return Response.json({ ok: false, error: 'MISSING_SESSION_ID' }, { status: 400, headers: corsHeaders });
        // Mark student's record as dismissed (set attendance to 'dismissed')
        const { error: dismissErr } = await portalAdmin.from('teacher_session_students')
          .update({ attendance_status: 'dismissed', updated_at: new Date().toISOString() })
          .eq('session_id', sessId)
          .eq('student_user_id', authUserId);
        if (dismissErr) return Response.json({ ok: false, error: dismissErr.message }, { headers: corsHeaders });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      default:
        return Response.json({ ok: false, error: `Unknown action: ${action}` }, { 
          status: 400, 
          headers: corsHeaders 
        });
    }

    if (result.error) {
      const errorMsg = typeof result.error === 'object' 
        ? JSON.stringify(result.error) 
        : String(result.error);
      console.error(`[student-portal-api] CRM RPC error for ${action}:`, result.error);
      return Response.json({ ok: false, error: errorMsg }, { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`[student-portal-api] ${action} success`);
    return Response.json({ ok: true, data: result.data }, { headers: corsHeaders });

    } catch (e) {
      console.error('[student-portal-api] Error:', e);
      return Response.json({ ok: false, error: String(e) }, { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  })());
});
