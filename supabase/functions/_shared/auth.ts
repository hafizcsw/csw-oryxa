// Shared JWT verification utility for admin SSO
export async function verifyAdminJWT(authHeader: string | null): Promise<any> {
  if (!authHeader) return null;
  
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const secret = Deno.env.get('CRM_JWT_SECRET');
  
  if (!secret) {
    console.error('[SSO] CRM_JWT_SECRET not configured');
    return null;
  }

  try {
    // Split JWT parts
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    // Verify signature using HMAC-SHA256
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode signature
    const signatureBytes = base64UrlDecode(signatureB64);
    const valid = await crypto.subtle.verify('HMAC', secretKey, signatureBytes, data);
    
    if (!valid) {
      console.warn('[SSO] Invalid signature');
      return null;
    }

    // Decode and verify payload
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      console.warn('[SSO] Token expired');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[SSO] Verification error:', error);
    return null;
  }
}

function base64UrlDecode(str: string): ArrayBuffer {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-student-portal-token, x-client-trace-id, x-orxya-ingress',
};

// Admin guard for unis assistant functions (with pilot user support)
export async function requireAdminOrPilot(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new Error("NO_AUTH");

  // Verify user via ANON key + passed token
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data: { user }, error } = await anon.auth.getUser();
  if (error || !user) throw new Error("INVALID_USER");

  // Check pilot users list
  const pilotIds = JSON.parse(
    (Deno.env.get("UNIS_ASSISTANT_PILOT_USER_IDS") ?? "[]")
  ) as string[];

  // Check admin claim or pilot list
  const isAdminClaim = (user.app_metadata as any)?.is_admin === true;
  const isPilot = pilotIds.includes(user.id);

  if (!(isAdminClaim || isPilot)) throw new Error("FORBIDDEN");
  return user;
}

// Alias for requireAdmin - used by older edge functions
export const requireAdmin = requireAdminOrPilot;
