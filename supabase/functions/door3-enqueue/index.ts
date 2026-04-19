// ═══════════════════════════════════════════════════════════════
// Door 3 — Enqueue (orchestration only, no heavy work)
// ═══════════════════════════════════════════════════════════════
// POST { document_id, job_type, payload? }
// → idempotent insert into document_jobs (uniq active per doc+type)
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_JOB_TYPES = new Set([
  'internal_ocr',
  'transcript_parse',
  'passport_recovery',
  'certificate_recovery',
  'ai_semantic_parse',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) {
      return json({ error: 'unauthorized' }, 401);
    }

    // Verify caller via anon client + JWT
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
    const user_id = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const document_id = String(body.document_id ?? '');
    const job_type = String(body.job_type ?? '');
    const payload = body.payload ?? {};

    if (!document_id || !job_type) return json({ error: 'missing_fields' }, 400);
    if (!ALLOWED_JOB_TYPES.has(job_type)) return json({ error: 'invalid_job_type' }, 400);

    // Use service role to call the SECURITY DEFINER helper (idempotent)
    const admin = createClient(url, service);
    const { data, error } = await admin.rpc('enqueue_door3_followup', {
      _document_id: document_id,
      _user_id: user_id,
      _job_type: job_type,
      _payload: payload,
    });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, job_id: data });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  function json(b: unknown, status = 200) {
    return new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
