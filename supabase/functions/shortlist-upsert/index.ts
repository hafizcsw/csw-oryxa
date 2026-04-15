// LAV #15.B2: Shortlist Management (Add/Remove with 5-item limit)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight, generateTraceId, slog } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const tid = generateTraceId();
  const t0 = performance.now();

  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) {
    slog({ tid, kind: 'preflight', origin });
    return preflightResponse;
  }

  try {
    const { op, student_id, country_id, university_id } = await req.json();

    if (!op || !student_id || !country_id || !university_id) {
      throw new Error('Missing required fields: op, student_id, country_id, university_id');
    }

    if (op === 'add') {
      const { error } = await supabase
        .from('student_shortlists')
        .insert({ student_id, country_id, university_id });

      if (error) {
        // Check if it's the limit error
        if (error.message.includes('Shortlist limit')) {
          return new Response(
            JSON.stringify({
              ok: false,
              tid,
              error: 'Shortlist limit (5) reached for this country',
              code: 'LIMIT_REACHED'
            }),
            {
              status: 400,
              headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
            }
          );
        }
        throw error;
      }
    } else if (op === 'remove') {
      const { error } = await supabase
        .from('student_shortlists')
        .delete()
        .eq('student_id', student_id)
        .eq('country_id', country_id)
        .eq('university_id', university_id);

      if (error) throw error;
    } else {
      throw new Error('Invalid op, must be "add" or "remove"');
    }

    // Return current count X/5
    const { count } = await supabase
      .from('student_shortlists')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', student_id)
      .eq('country_id', country_id);

    slog({
      tid,
      evt: 'shortlist_ok',
      op,
      student_id,
      country_id,
      university_id,
      count,
      dur_ms: Math.round(performance.now() - t0)
    });

    return new Response(
      JSON.stringify({ ok: true, tid, count: count || 0 }),
      {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    );
  } catch (e: any) {
    slog({
      tid,
      level: 'error',
      error: String(e),
      dur_ms: Math.round(performance.now() - t0)
    });

    return new Response(
      JSON.stringify({ ok: false, tid, error: String(e) }),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    );
  }
});
