import { createClient, SupabaseClient } from "@supabase/supabase-js";

type AdminCheckSuccess = {
  ok: true;
  user: { id: string; email?: string };
  srv: SupabaseClient;
};

type AdminCheckFailure = {
  ok: false;
  status: 401 | 403;
  error: "unauthorized" | "forbidden";
  srv?: never;
};

type AdminCheck = AdminCheckSuccess | AdminCheckFailure;

export async function requireAdmin(req: Request): Promise<AdminCheck> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Extract JWT from header
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401 as const, error: "unauthorized" };
  }

  // 2) Auth client to read user
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
  
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) {
    return { ok: false, status: 401 as const, error: "unauthorized" };
  }

  // 3) Check is_admin via DB using existing function signature
  const srv = createClient(SUPABASE_URL, SRV_KEY);
  const { data } = await srv.rpc("is_admin", { _user_id: user.id as any });
  
  if (!data) {
    return { ok: false, status: 403 as const, error: "forbidden" };
  }

  return { ok: true, user, srv };
}


export async function requireAdminOrServiceRole(req: Request): Promise<AdminCheck> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401 as const, error: "unauthorized" };
  }

  const token = authHeader.slice(7).trim();
  try {
    const [, payloadB64] = token.split('.');
    if (payloadB64) {
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      if (payload?.role === 'service_role') {
        const srv = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        return { ok: true, user: { id: 'service_role' }, srv };
      }
    }
  } catch (_) {
    // JWT verification already happened at the edge runtime when verify_jwt=true.
  }

  return requireAdmin(req);
}
