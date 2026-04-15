// LAV #15: Standardized CORS utility for all Edge Functions
// Provides consistent CORS handling with whitelisted origins

export const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://cswworld.com",
  "https://www.cswworld.com",
  "https://csw-portal.lovable.app",
  "https://lavista-launchpad.lovable.app",
  "https://bmditidkhlbszhvkrnau.supabase.co",
]);

// Check if origin is allowed (includes lovableproject.com domains)
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow all lovableproject.com subdomains for development
  if (origin.includes('.lovableproject.com')) return true;
  // Allow Lovable preview domains
  if (origin.includes('.lovable.app')) return true;
  return false;
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  // If origin is in whitelist, use it; otherwise use production default
  const allowedOrigin = origin && isOriginAllowed(origin)
    ? origin 
    : "https://cswworld.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-request-id, x-client-trace-id, x-orxya-ingress, x-student-portal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  return null;
}

export function generateTraceId(): string {
  return crypto.randomUUID();
}

export interface StructuredLog {
  tid?: string;
  ts?: string;
  level?: "info" | "warn" | "error";
  [key: string]: unknown;
}

export function slog(data: StructuredLog): void {
  const log = {
    ts: new Date().toISOString(),
    ...data,
  };
  console.log(JSON.stringify(log));
}

// Helper for error responses with CORS
export function handleError(error: unknown, tid: string, origin: string | null): Response {
  const errorMsg = error instanceof Error ? error.message : String(error);
  
  slog({
    tid,
    level: 'error',
    error: errorMsg,
    stack: error instanceof Error ? error.stack : undefined
  });
  
  return new Response(
    JSON.stringify({
      ok: false,
      tid,
      error: errorMsg
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin)
      }
    }
  );
}
