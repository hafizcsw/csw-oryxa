import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const g = await requireAdmin(req);
    if (!g.ok) {
      return new Response(JSON.stringify({ ok: false, error: g.error }), {
        status: g.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { kinds = ['meta', 'faq', 'internal_links', 'content_gap'] } = await req.json().catch(() => ({}));
    
    // Fetch programs/universities needing optimization
    const { data: programs } = await g.srv
      .from('programs')
      .select('id, title, university_id')
      .is('seo_title', null)
      .limit(10);

    const { data: universities } = await g.srv
      .from('universities')
      .select('id, name')
      .is('seo_title', null)
      .limit(10);

    const tasks = [];

    // Meta tasks
    if (kinds.includes('meta')) {
      for (const p of (programs || [])) {
        tasks.push({
          kind: 'meta',
          status: 'pending',
          payload: { 
            entity_type: 'program', 
            entity_id: p.id,
            title: p.title 
          }
        });
      }
      
      for (const u of (universities || [])) {
        tasks.push({
          kind: 'meta',
          status: 'pending',
          payload: { 
            entity_type: 'university', 
            entity_id: u.id,
            name: u.name 
          }
        });
      }
    }

    // FAQ tasks
    if (kinds.includes('faq')) {
      for (const u of (universities || []).slice(0, 5)) {
        tasks.push({
          kind: 'faq',
          status: 'pending',
          payload: { 
            entity_type: 'university', 
            entity_id: u.id,
            name: u.name 
          }
        });
      }
    }

    // Internal links suggestions
    if (kinds.includes('internal_links')) {
      tasks.push({
        kind: 'internal_links',
        status: 'pending',
        payload: { 
          scope: 'site_wide',
          limit: 50
        }
      });
    }

    // Content gap analysis
    if (kinds.includes('content_gap')) {
      tasks.push({
        kind: 'content_gap',
        status: 'pending',
        payload: { 
          scope: 'blog',
          target_keywords: []
        }
      });
    }

    // Insert tasks
    const { error, count } = await g.srv
      .from('seo_ai_tasks')
      .insert(tasks, { count: 'exact' });

    if (error) throw error;

    const queued = count || 0;

    // Update cron status
    await g.srv.from('seo_cron_jobs')
      .update({ 
        status: 'ok', 
        last_run_at: new Date().toISOString(),
        last_error: null
      })
      .eq('job_name', 'ai_daily');

    // Log telemetry
    await g.srv.from("events").insert({
      name: "seo_ai_daily_queued",
      properties: {
        queued,
        kinds
      }
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      queued 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("[seo-ai-daily] Exception:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
