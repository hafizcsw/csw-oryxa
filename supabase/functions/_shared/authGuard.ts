import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function requireAuth(req: Request) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false as const, status: 401 as const, error: "unauthorized" };
  }

  const auth = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) {
    return { ok: false as const, status: 401 as const, error: "unauthorized" };
  }

  const srv = createClient(SUPABASE_URL, SRV_KEY);
  const { data: isAdmin } = await srv.rpc("is_admin", { _user_id: user.id as any });

  return { ok: true as const, user, isAdmin: !!isAdmin, srv };
}
