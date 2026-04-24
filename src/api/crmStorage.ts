/**
 * ✅ CRM Storage API - All storage operations go through Portal proxy
 * 
 * Protocol:
 * 1. prepare_upload → Get signed URL
 * 2. PUT → Direct upload to signed URL
 * 3. confirm_upload → Register in CRM DB
 * 
 * For avatars:
 * 1. prepare_upload(file_kind='avatar') → Get signed URL
 * 2. PUT → Direct upload
 * 3. set_avatar → Update customer avatar
 */
import { portalInvoke } from "./portalInvoke";
import {
  evaluateUploadGuard,
  guardErrorEnvelope,
  type UploadGuardContext,
  type UploadContext,
  type ConfirmationState,
} from "@/lib/draftFirstGuard";

/**
 * Server firewall envelope. Forwarded as `ctx` on every crm_storage request
 * so the server-side draft-first guard can classify and block sensitive
 * mutations (Phase 1.2). Frontend cannot bypass — the server fails closed.
 */
export interface CrmStorageServerCtx {
  upload_context: UploadContext | 'operational';
  confirmation_state: ConfirmationState;
  confirmation_trace_id?: string;
}

function ctxToServerEnvelope(ctx?: UploadGuardContext): CrmStorageServerCtx | undefined {
  if (!ctx) return undefined;
  return {
    upload_context: ctx.context,
    confirmation_state: ctx.confirmationState,
    ...(ctx.confirmationTraceId ? { confirmation_trace_id: ctx.confirmationTraceId } : {}),
  };
}

// ✅ CRM Storage sub-actions
export type CrmStorageAction =
  | 'prepare_upload'
  | 'confirm_upload'
  | 'list_files'
  | 'sign_file'
  | 'set_avatar'
  | 'delete_file'
  | 'clear_all_files'
  | 'clear_pending_files'
  | 'mark_files_saved'
  | 'purge_all_files'         // ✅ Added for clean cutover
  | 'paddle_structure_proxy'; // ✅ CRM-aware Paddle OCR/Structure proxy

export interface PrepareUploadResult {
  bucket: string;
  path: string;
  signed_url: string;
  token?: string;
  expires_in?: number;
}

export interface ConfirmUploadResult {
  file_id: string;
  file_url?: string;
}

export interface FileRecord {
  id: string;
  file_kind: string;
  file_name: string;
  file_url: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  admin_notes?: string | null;
  created_at: string;
}

/**
 * Call CRM storage action through Portal proxy.
 * Optional `serverCtx` is forwarded as the `ctx` envelope so the server-side
 * draft-first firewall can authorize the call independently of the frontend.
 */
export async function callCrmStorage<T = unknown>(
  crm_action: CrmStorageAction,
  payload: Record<string, unknown> = {},
  serverCtx?: CrmStorageServerCtx,
): Promise<{ ok: boolean; data?: T; error?: string; details?: string; http_status?: number }> {
  const body: Record<string, unknown> = { crm_action, payload };
  if (serverCtx) body.ctx = serverCtx;
  const result = await portalInvoke<T>('crm_storage', body);
  
  // ✅ Extract http_status from response body (Edge always returns 200 now)
  const httpStatus = (result.data as any)?.http_status || (result as any)?.http_status;
  
  // Normalize response - extract data if nested
  if (result.ok && result.data) {
    return { ...result, http_status: httpStatus };
  }
  
  return { ...result, http_status: httpStatus };
}

/**
 * Prepare upload - get signed URL from CRM
 */
export async function prepareUpload(params: {
  bucket?: string;
  file_kind: string;
  file_name: string;
  /** Draft-first guard context. Required for sensitive student document contexts. */
  ctx?: UploadGuardContext;
}): Promise<{ ok: boolean; data?: PrepareUploadResult; error?: string; details?: string; trace_id?: string }> {
  const decision = evaluateUploadGuard('prepare_upload', params.ctx);
  if (!decision.allowed) {
    return guardErrorEnvelope(decision);
  }
  return callCrmStorage<PrepareUploadResult>(
    'prepare_upload',
    {
      bucket: params.bucket || 'student-docs',
      file_kind: params.file_kind,
      file_name: params.file_name,
    },
    ctxToServerEnvelope(params.ctx),
  );
}

/**
 * Confirm upload - register file in CRM after PUT
 */
export async function confirmUpload(params: {
  bucket: string;
  path: string;
  file_kind: string;
  file_name: string;
  mime_type?: string;
  size_bytes?: number;
  description?: string | null;
  /** Draft-first guard context. Required for sensitive student document contexts. */
  ctx?: UploadGuardContext;
}): Promise<{ ok: boolean; data?: ConfirmUploadResult; error?: string; details?: string; trace_id?: string }> {
  const decision = evaluateUploadGuard('confirm_upload', params.ctx);
  if (!decision.allowed) {
    return guardErrorEnvelope(decision);
  }
  const { ctx: _ctx, ...rest } = params;
  return callCrmStorage<ConfirmUploadResult>('confirm_upload', rest);
}

/**
 * List files from CRM
 */
export async function listFiles(): Promise<{ ok: boolean; files?: FileRecord[]; error?: string }> {
  const result = await callCrmStorage<{ files: FileRecord[] }>('list_files');
  if (result.ok && result.data) {
    return { ok: true, files: (result.data as any)?.files || result.data || [] };
  }
  return { ok: false, error: result.error };
}

/**
 * Sign file - get signed URL for download
 */
export async function signFile(file_id: string): Promise<{ ok: boolean; signed_url?: string; error?: string }> {
  const result = await callCrmStorage<{ signed_url: string }>('sign_file', { file_id });
  if (result.ok && result.data) {
    return { ok: true, signed_url: (result.data as any)?.signed_url };
  }
  return { ok: false, error: result.error };
}

/**
 * Set avatar - update customer avatar after upload
 * Note: CRM Edge Function computes the public URL - no need to pass it
 */
export async function setAvatar(params: {
  path: string;
}): Promise<{ ok: boolean; file_url?: string; error?: string }> {
  const result = await callCrmStorage<{ file_url: string }>('set_avatar', { path: params.path });
  if (result.ok && result.data) {
    return { ok: true, file_url: (result.data as any)?.file_url };
  }
  return { ok: false, error: result.error };
}

/**
 * Delete file from CRM storage and database
 */
export async function deleteFile(file_id: string, document_id?: string | null): Promise<{ ok: boolean; error?: string }> {
  const result = await callCrmStorage<{ deleted: string }>('delete_file', {
    file_id,
    ...(document_id ? { document_id } : {}),
  });
  return { ok: result.ok, error: result.error };
}

/**
 * Open file in new window using signed URL
 */
export async function openFile(file_id: string): Promise<boolean> {
  const result = await signFile(file_id);
  if (result.ok && result.signed_url) {
    window.open(result.signed_url, '_blank', 'noopener,noreferrer');
    return true;
  }
  console.error('[openFile] Failed:', result.error);
  return false;
}

/**
 * Clear all files for the current student (CRM)
 */
export async function clearAllFiles(): Promise<{ ok: boolean; deleted_count?: number; error?: string }> {
  const result = await callCrmStorage<{ deleted_count: number; deleted: string[]; errors?: string[] }>('clear_all_files');
  if (result.ok && result.data) {
    return { ok: true, deleted_count: (result.data as any)?.deleted_count || 0 };
  }
  return { ok: false, error: result.error };
}

export async function clearPendingFiles(): Promise<{ ok: boolean; deleted_count?: number; deleted?: string[]; error?: string }> {
  const result = await callCrmStorage<{ deleted_count: number; deleted: string[]; errors?: string[] }>('clear_pending_files');
  if (result.ok && result.data) {
    const data = result.data as any;
    return { ok: true, deleted_count: data?.deleted_count || 0, deleted: data?.deleted || [] };
  }
  return { ok: false, error: result.error };
}

export async function markFilesSaved(
  file_ids: string[],
  ctx?: UploadGuardContext,
): Promise<{ ok: boolean; updated_count?: number; updated?: string[]; error?: string; trace_id?: string }> {
  const decision = evaluateUploadGuard('mark_files_saved', ctx);
  if (!decision.allowed) {
    return guardErrorEnvelope(decision);
  }
  const result = await callCrmStorage<{ updated_count: number; updated: string[] }>('mark_files_saved', { file_ids });
  if (result.ok && result.data) {
    const data = result.data as any;
    return { ok: true, updated_count: data?.updated_count || 0, updated: data?.updated || [] };
  }
  return { ok: false, error: result.error };
}

/**
 * ✅ Purge ALL student documents (Soft delete) - for clean cutover
 * Sets deleted_at = now() and status = 'deleted' for ALL customer_files
 */
export async function purgeAllFiles(): Promise<{ ok: boolean; purged_count?: number; error?: string; details?: string }> {
  const result = await callCrmStorage<{ purged_count: number; purged: string[]; errors?: string[] }>('purge_all_files');
  if (result.ok && result.data) {
    const data = result.data as any;
    return { 
      ok: true, 
      purged_count: data?.purged_count || 0,
      details: data?.errors?.length ? `Errors: ${data.errors.join(', ')}` : undefined
    };
  }
  return { ok: false, error: result.error };
}

/**
 * ✅ CRM-aware Paddle Structure proxy.
 * Resolves the file from CRM truth (customer_id ownership), signs a
 * short-lived URL on CRM storage, then forwards to the Paddle endpoint.
 * The client never has to know whether the file lives in app or CRM.
 *
 * Pass either `file_id` (preferred — DB ownership check) or
 * `storage_path` (fallback — `<customerId>/...` prefix check).
 */
export interface PaddleStructureProxyResult {
  ok: boolean;
  result?: unknown;
  /** Stage at which a failure occurred. */
  stage?: 'request' | 'config' | 'ownership' | 'sign' | 'provider' | 'network';
  reason?: string;
  error_message?: string | null;
  latency_ms?: number;
}

export async function callPaddleStructureProxy(params: {
  document_id: string;
  storage_path?: string;
  storage_bucket?: string;
  file_id?: string;
  mime_type: string;
  file_name: string;
}): Promise<PaddleStructureProxyResult> {
  const result = await callCrmStorage<PaddleStructureProxyResult>('paddle_structure_proxy', params);
  // Edge wraps the body inside `data`; unwrap and surface as a flat envelope.
  if (result.ok && result.data) {
    return result.data as PaddleStructureProxyResult;
  }
  // Outer transport failure — surface as a network-stage error.
  return {
    ok: false,
    stage: 'network',
    reason: result.error || 'transport_failed',
    error_message: result.details ?? null,
  };
}
