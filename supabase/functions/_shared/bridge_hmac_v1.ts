// Shared HMAC v1 library for Portal Bridge communication
// ✅ Canonical v1 = 7 lines, newline separated, NO prefixes

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * ✅ Canonical v1 = exactly 7 lines, newline separated, NO prefixes, NO empty lines
 *
 * v1
 * 1737654321
 * abc123nonce
 * POST
 * /functions/v1/bridge-emit
 * ?foo=bar (or empty string if no query)
 * {"event_name":"...","payload":{...}}
 *
 * IMPORTANT: Even if search is empty, line 6 must exist (just empty).
 */
export function canonicalV1(args: {
  ts: string;
  nonce: string;
  method: string;
  pathname: string;
  search: string;
  bodyRaw: string;
}): string {
  return [
    "v1",
    args.ts,
    args.nonce,
    args.method.toUpperCase(),
    args.pathname,
    args.search ?? "",
    args.bodyRaw ?? ""
  ].join("\n");
}
