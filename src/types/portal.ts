// ============= Portal Data Contracts =============
// Single source of truth for Portal <-> CRM data shapes

// ============= Files =============
export interface PortalFile {
  id: string;
  file_kind: string;
  file_name: string;
  status: 'pending' | 'reviewing' | 'approved' | 'accepted' | 'rejected' | 'uploaded' | 'archived';
  mime_type: string | null;
  size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  file_url: string | null;
  signed_url?: string | null;
  created_at: string;
  admin_notes?: string | null;
}

// ============= Payments =============
export interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_paid';
  payment_method?: string;
  reference?: string;
  description?: string;
  service_type?: string;
  payment_date: string;
  due_date?: string | null;
}

// ============= Shortlist =============
export interface ShortlistItem {
  id: string;
  program_id: string;
  program_name: string;
  university_name: string;
  country?: string;
  status: 'shortlisted' | 'applied' | 'accepted' | 'rejected';
  created_at: string;
}

// ============= CRM Profile =============
export interface PortalProfile {
  id: string;
  customer_id?: string;
  auth_user_id: string;
  full_name: string;
  phone?: string;
  phone_e164?: string;
  email?: string;
  gender?: string;
  gpa?: string;
  passport_name?: string;
  passport_number?: string;
  passport_expiry?: string;
  stage?: string;
  progress?: number;
  docs_count?: number;
  docs_verified?: number;
  docs_pending?: number;
  docs_rejected?: number;
  payment_total_paid?: number;
  payment_total_required?: number;
  applications_count?: number;
  stage_info?: {
    student_substage?: string;
    docs_status?: string;
    payment_status?: string;
    progress_percent?: number;
  };
  is_linked?: boolean;
}

// ============= API Response Contracts =============
export type PortalErrorCode = 
  | 'no_linked_customer' 
  | 'invalid_token' 
  | 'feature_not_available' 
  | 'network_error' 
  | 'auth_required'
  | 'unknown';

export interface PortalApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  error_code?: PortalErrorCode;
  message?: string;
}

export interface ListFilesResponse {
  ok: boolean;
  files: PortalFile[];
  error?: string;
  error_code?: PortalErrorCode;
}

export interface SignFileResponse {
  ok: boolean;
  signed_url?: string;
  error?: string;
}

export interface ListPaymentsResponse {
  ok: boolean;
  payments: PaymentRow[];
  error?: string;
  error_code?: PortalErrorCode;
}

export interface ListShortlistResponse {
  ok: boolean;
  items: ShortlistItem[];
  error?: string;
  error_code?: PortalErrorCode;
}

// ============= Wallet Ledger (CRM Contract) =============
export type LedgerEntryType = 
  | 'deposit' 
  | 'withdrawal' 
  | 'transfer' 
  | 'payment' 
  | 'refund' 
  | 'adjustment';

export type LedgerEntryStatus = 
  | 'pending' 
  | 'completed' 
  | 'failed' 
  | 'reversed' 
  | 'canceled';

export interface LedgerEntry {
  id: string;
  entry_type: LedgerEntryType;
  amount: number;
  currency: string;
  status: LedgerEntryStatus;
  reference_type?: string | null;
  reference_id?: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
}

export interface WalletLedgerResponse {
  ok: boolean;
  available: number;
  pending: number;
  entries: LedgerEntry[];
  error?: string;
  error_code?: PortalErrorCode;
}
