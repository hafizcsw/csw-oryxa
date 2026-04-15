export type MessageRole = 'user' | 'bot';
export type MessageType = 'text' | 'action' | 'universities';
export type ChatStatus = 'idle' | 'thinking' | 'searching';

// ✅ Input mode types for Chat-First UX
export type InputMode = 'free' | 'phone' | 'otp' | 'name';

// 🆕 P0: Results source tracking - Single Source of Truth
export type ResultsSource = 'chat_cards' | 'manual_search' | 'none';

// 🆕 P0: Debug info for traceability
export interface DebugInfo {
  last_trace_id: string | null;
  last_request_id: string | null;
  last_cards_query: {
    query_id: string;
    params: Record<string, unknown>;
  } | null;
  last_api_payload: Record<string, unknown> | null;
  last_api_total: number | null;
  last_rendered_count: number;
  results_source: ResultsSource;
  timestamp: number;
}

// 🆕 Session & Account types for Auth Modal
export type SessionType = 'guest' | 'authenticated';
export type AccountRole = 'student' | 'parent' | 'agent';

// 🆕 Guest state from CRM for memory limit tracking
export interface GuestState {
  message_count?: number | null;
  memory_full?: boolean | null;
  intro_sent?: boolean | null;
}

// 🆕 Auth Start Modal state for pre-chat authentication
export type AuthModalStep = 'choice' | 'login-phone' | 'login-otp' | 'signup-phone' | 'signup-otp';

// ✅ Chat stage types matching CRM
export type ChatStage =
  | 'initial'
  | 'intake'
  | 'offer_shown'
  | 'awaiting_phone'
  | 'awaiting_otp'
  | 'authenticated'
  | 'searching'
  | 'collecting_info'
  | 'verified'
  | 'idle';

// 🆕 Stage info from CRM for student status display
export interface StageInfo {
  student_substage: string | null;
  student_substage_label: string | null;
  deal_stage_v2: string | null;
  docs_status: string | null;
  payment_status: string | null;
  progress_percent: number | null;
  // 🆕 New fields from CRM
  days_to_next_deadline?: number | null;
  status_notes?: string[] | null;
  qualification_status?: string | null;
  seriousness_score?: number | null;
}

export interface ChatMessage {
  id: string;
  from: MessageRole;
  type: MessageType;
  content: string;
  action?: string;
  timestamp: Date;
}

export interface University {
  id: string;
  // ✅ P0 Fix V2: Primary program identifier (use instead of id for shortlist)
  program_id?: string;
  program_ref_id?: string;
  // ✅ P0 Fix V2: University ID (separate from program ID)
  university_id?: string;
  
  // الحقول الجديدة من CRM
  program_name_ar?: string;
  program_name_en?: string;
  university_name_ar?: string;
  university_name_en?: string;
  country_code?: string;
  country_name_ar?: string;
  country_name_en?: string;
  city?: string;
  tuition_min?: number;
  tuition_max?: number;
  degree_level?: string;
  website?: string;
  ranking_global?: number;
  
  // ✅ P0 Fix: حقول إضافية للـ Snapshot
  program_slug?: string;
  slug?: string;
  logo_url?: string;
  university_logo?: string;
  degree_name?: string;
  degree?: string;
  
  // الحقول القديمة (للتوافق مع الكود القديم)
  university_name?: string;
  program_name?: string;
  country?: string;
  tuition_usd?: number;
  duration_months?: number;
  language?: string;
}
