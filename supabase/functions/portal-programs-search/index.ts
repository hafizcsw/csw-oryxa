import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============= CONTRACT VERSION =============
const CONTRACT_VERSION = 'kb_search_v1_3_final_hardened';
const SUPPORTED_CONTRACTS = ['kb_search_v1_3_final', 'kb_search_v1_3_final_hardened'];
const VERSION = '2026-01-27_v2_contract_lock';
console.log(`[portal-programs-search] VERSION=${VERSION} CONTRACT=${CONTRACT_VERSION}`);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ============= HMAC Authentication =============
const HMAC_SHARED_SECRET = Deno.env.get("PORTAL_KB_HMAC_SECRET") || Deno.env.get("HMAC_SHARED_SECRET") || "";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hmac-signature, x-hmac-timestamp, x-hmac-nonce, x-ts, x-nonce, x-signature, x-request-id',
};

// ============= Max body size (64KB) =============
const MAX_BODY_SIZE = 64 * 1024;

// ============= Constant-time comparison =============
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============= HMAC Signature Verification =============
async function verifyHmacSignature(
  req: Request,
  body: string
): Promise<{ valid: boolean; error?: string }> {
  const signature = req.headers.get('x-hmac-signature') || req.headers.get('x-signature');
  const timestamp = req.headers.get('x-hmac-timestamp') || req.headers.get('x-ts');
  const nonce = req.headers.get('x-hmac-nonce') || req.headers.get('x-nonce');

  if (!signature || !timestamp || !nonce) {
    console.log('[portal-programs-search] ⚠️ Missing HMAC headers');
    return { valid: false, error: 'Missing HMAC headers (x-ts, x-nonce, x-signature required)' };
  }

  if (!HMAC_SHARED_SECRET) {
    console.error('[portal-programs-search] ⚠️ HMAC_SHARED_SECRET not configured');
    return { valid: false, error: 'HMAC not configured on server' };
  }

  const requestTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - requestTime) > 300) {
    console.log('[portal-programs-search] ⚠️ HMAC timestamp expired, skew:', Math.abs(now - requestTime), 's');
    return { valid: false, error: 'Request expired (timestamp >5min old)' };
  }

  // Canonical: ts.nonce.body
  const canonical = `${timestamp}.${nonce}.${body}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(HMAC_SHARED_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(canonical)
  );
  
  const computedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (!timingSafeEqual(signature, computedSignature)) {
    console.log('[portal-programs-search] ⚠️ HMAC signature mismatch');
    return { valid: false, error: 'Invalid signature' };
  }

  // Nonce replay protection (fail-closed)
  // Table has defaults: used_at=now(), expires_at=now()+10min, ts=now(), request_id=uuid, created_at=now()
  // Only nonce is required (unique constraint for replay detection)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const { error: insertError } = await supabase
    .from('hmac_nonces')
    .insert({ nonce });

  if (insertError) {
    if (insertError.code === '23505') {
      console.warn('[portal-programs-search] ⚠️ Nonce already used (replay attempt):', nonce.substring(0, 8));
      return { valid: false, error: 'Nonce already used (replay detected)' };
    }
    console.error('[portal-programs-search] ⛔ Nonce store failed (fail-closed):', insertError);
    return { valid: false, error: 'Nonce store failed' };
  }

  console.log('[portal-programs-search] ✅ HMAC verified, nonce:', nonce.substring(0, 8) + '...');
  return { valid: true };
}

// ============= MAIN HANDLER =============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestTs = new Date().toISOString();
  let rid = req.headers.get('x-request-id') || `portal-${Date.now()}`;

  try {
    // Body size check
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_BODY_SIZE) {
      return Response.json({
        ok: false,
        request_id: rid,
        error: 'Request body too large',
        code: 'BODY_TOO_LARGE',
        meta: { max_size: MAX_BODY_SIZE, contract: CONTRACT_VERSION }
      }, { status: 413, headers: corsHeaders });
    }

    const bodyText = await req.text();
    
    // HMAC verification
    const hasHmacHeaders = req.headers.get('x-hmac-signature') || req.headers.get('x-signature');
    if (hasHmacHeaders) {
      const hmacResult = await verifyHmacSignature(req, bodyText);
      if (!hmacResult.valid) {
        return Response.json({ 
          ok: false, 
          request_id: rid,
          error: hmacResult.error,
          code: 'HMAC_FAILED',
          meta: { contract: CONTRACT_VERSION, ts: requestTs }
        }, { status: 401, headers: corsHeaders });
      }
    } else {
      return Response.json({ 
        ok: false, 
        request_id: rid,
        error: 'unauthorized: HMAC signature required (service-to-service only)',
        code: 'MISSING_AUTH',
        meta: { contract: CONTRACT_VERSION, ts: requestTs }
      }, { status: 401, headers: corsHeaders });
    }

    // Parse JSON
    let body: any = {};
    if (req.method === 'POST' && bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        return Response.json({
          ok: false,
          request_id: rid,
          error: 'Invalid JSON body',
          code: 'INVALID_JSON',
          meta: { contract: CONTRACT_VERSION, ts: requestTs }
        }, { status: 400, headers: corsHeaders });
      }
    }

    // Update request_id from body
    if (body.request_id) {
      rid = body.request_id;
    }

    // ============= CONTRACT VERSION LOCK =============
    if (body.contract_version && !SUPPORTED_CONTRACTS.includes(body.contract_version)) {
      console.warn(`[portal-programs-search] ⚠️ UNSUPPORTED_CONTRACT rid=${rid} received=${body.contract_version} supported=${SUPPORTED_CONTRACTS.join(',')}`);
      return Response.json({
        ok: false,
        request_id: rid,
        error: 'UNSUPPORTED_CONTRACT_VERSION',
        message: `Contract version '${body.contract_version}' is not supported. Use one of: ${SUPPORTED_CONTRACTS.join(', ')}`,
        supported_contracts: SUPPORTED_CONTRACTS,
        meta: { contract: CONTRACT_VERSION, ts: requestTs }
      }, { status: 422, headers: corsHeaders });
    }

    // ============= PRODUCTION LOGGING (NO BYPASS) =============
    const received_program_filter_keys = body.program_filters ? Object.keys(body.program_filters).sort() : [];

    console.log(`[portal-programs-search] PortalBody rid=${rid} contract=${body.contract_version || 'implicit'} keys=${JSON.stringify(received_program_filter_keys)}`);

    // ============= PortalIn LOG =============
    console.log(`[portal-programs-search] PortalIn rid=${rid} parsed=${JSON.stringify({
      display_lang: body.display_lang,
      display_currency_code: body.display_currency_code,
      program_filters: body.program_filters,
      admission_policy: body.admission_policy,
      applicant_profile: body.applicant_profile ? { curriculum: body.applicant_profile?.curriculum, stream: body.applicant_profile?.stream } : null,
      paging: body.paging,
    })}`);

    // SECURITY: No test_mode, no test_rpc, no bypass. Production only.

    // Call RPC
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('rpc_kb_programs_search_v1_3_final', { payload: body });

    const duration = Date.now() - startTime;

    if (rpcError) {
      console.error(`[portal-programs-search] PortalOut rid=${rid} status=500 error=${rpcError.message} duration_ms=${duration}`);
      return Response.json({
        ok: false,
        request_id: rid,
        error: 'RPC_ERROR',
        message: rpcError.message,
        ignored_filters: [],
        missing_data_fields: [],
        meta: { contract: CONTRACT_VERSION, ts: requestTs, duration_ms: duration }
      }, { status: 500, headers: corsHeaders });
    }

    // Check if RPC returned error (422 for validation errors)
    if (rpcResult?.ok === false) {
      const errorCode = rpcResult.error;
      const is422Error = ['MISSING_DATA_FIELDS', 'UNKNOWN_KEYS', 'CONFLICTS'].includes(errorCode);
      const httpStatus = is422Error ? 422 : 400;
      console.log(`[portal-programs-search] PortalResponse rid=${rid} status=${httpStatus} error=${errorCode} conflicts=${JSON.stringify(rpcResult.conflicts || [])} unknown_keys=${JSON.stringify(rpcResult.unknown_keys || [])} duration_ms=${duration}`);
      return Response.json({
        ...rpcResult,
        meta: { contract: CONTRACT_VERSION, ts: requestTs, duration_ms: duration }
      }, { status: httpStatus, headers: corsHeaders });
    }

    // ============= PortalResponse LOG (Success) =============
    console.log(`[portal-programs-search] PortalResponse rid=${rid} status=200 count=${rpcResult?.meta?.count || 0} defaults_applied=${JSON.stringify(rpcResult?.defaults_applied || [])} duration_ms=${duration}`);

    // Ensure response contract compliance
    const response = {
      ...rpcResult,
      meta: {
        ...rpcResult?.meta,
        contract: CONTRACT_VERSION,
        ts: requestTs,
      },
    };

    return Response.json(response, { headers: corsHeaders });

  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[portal-programs-search] PortalOut rid=${rid} status=500 error=${err instanceof Error ? err.message : String(err)} duration_ms=${duration}`);
    return Response.json({ 
      ok: false, 
      request_id: rid,
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : String(err),
      ignored_filters: [],
      missing_data_fields: [],
      meta: { contract: CONTRACT_VERSION, ts: requestTs, duration_ms: duration }
    }, { status: 500, headers: corsHeaders });
  }
});
