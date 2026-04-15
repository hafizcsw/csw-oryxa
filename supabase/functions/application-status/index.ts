import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight, generateTraceId, slog } from '../_shared/cors.ts';

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { application_id } = await req.json();
    const vid = req.headers.get('x-visitor-id') || '';

    if (!application_id || !vid) {
      slog({ tid, level: 'warn', error: 'Missing required fields', dur_ms: Math.round(performance.now() - t0) });
      return new Response(
        JSON.stringify({ error: 'Missing required fields', tid }),
        { status: 400, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    // Verify this application belongs to this visitor
    const { data: app } = await supabase
      .from('applications')
      .select('id, visitor_id, full_name, email, phone, status, created_at')
      .eq('id', application_id)
      .single();

    if (!app || app.visitor_id !== vid) {
      slog({ tid, level: 'warn', error: 'Forbidden', dur_ms: Math.round(performance.now() - t0) });
      return new Response(
        JSON.stringify({ error: 'Forbidden', tid }),
        { status: 403, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
      );
    }

    // Get timeline events
    const { data: events } = await supabase
      .from('application_status_events')
      .select('*')
      .eq('application_id', application_id)
      .order('created_at', { ascending: true });

    // Get documents
    const { data: docs } = await supabase
      .from('application_documents')
      .select('id, doc_type, file_path, original_name, file_size, status, created_at')
      .eq('application_id', application_id)
      .order('created_at', { ascending: true });

    slog({ tid, path: '/application-status', method: 'POST', status: 200, dur_ms: Math.round(performance.now() - t0) });

    return new Response(
      JSON.stringify({
        ok: true,
        application: app,
        events: events || [],
        documents: docs || [],
        tid
      }),
      { headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    slog({ tid, level: 'error', error: String(error), dur_ms: Math.round(performance.now() - t0) });
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ error: message, tid }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});
