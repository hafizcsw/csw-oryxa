// LAV #15: List student shortlist
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
    const { student_id, country_id } = await req.json();

    if (!student_id || !country_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'student_id and country_id required' }),
        { status: 400, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    slog({ tid, evt: 'shortlist_list_start', student_id, country_id });

    const { data, error, count } = await supabase
      .from('student_shortlists')
      .select('university_id', { count: 'exact' })
      .eq('student_id', student_id)
      .eq('country_id', country_id);

    if (error) {
      slog({ tid, level: 'error', error: error.message, dur_ms: Math.round(performance.now() - t0) });
      throw error;
    }

    const items = (data || []).map(d => d.university_id);

    slog({ tid, evt: 'shortlist_list_ok', count, dur_ms: Math.round(performance.now() - t0) });

    return new Response(
      JSON.stringify({ ok: true, count: count || 0, items }),
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
      message: e.message,
      stack: e.stack,
      dur_ms: Math.round(performance.now() - t0)
    });

    return new Response(
      JSON.stringify({ ok: false, error: String(e), message: e.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    );
  }
});
