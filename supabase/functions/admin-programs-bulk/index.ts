import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkRequest {
  action: 'publish' | 'unpublish' | 'fill_and_publish';
  program_ids?: string[];
  filters?: {
    publish_status?: string;
    university_id?: string;
    country_code?: string;
  };
  defaults?: {
    intake_months?: number[];
    next_intake_date?: string;
    study_mode?: string;
    languages?: string[];
    duration_months?: number;
    tuition_usd_min?: number;
    tuition_usd_max?: number;
  };
}

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

    const body: BulkRequest = await req.json();
    const { action, program_ids, filters, defaults } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ ok: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query based on program_ids or filters
    let targetIds: string[] = [];

    if (program_ids && program_ids.length > 0) {
      targetIds = program_ids;
    } else if (filters) {
      // Fetch IDs based on filters
      let query = g.srv.from('programs').select('id');
      
      if (filters.publish_status) {
        query = query.eq('publish_status', filters.publish_status);
      }
      if (filters.university_id) {
        query = query.eq('university_id', filters.university_id);
      }
      if (filters.country_code) {
        query = query.eq('country_code', filters.country_code);
      }
      
      const { data: filtered, error: filterError } = await query;
      if (filterError) throw filterError;
      targetIds = (filtered || []).map((p: any) => p.id);
    }

    if (targetIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, updated: 0, message: 'No programs match the criteria' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updateData: Record<string, any> = {};
    let eventName = '';

    switch (action) {
      case 'publish':
        updateData = { published: true, publish_status: 'published' };
        eventName = 'programs_publish';
        break;
      case 'unpublish':
        updateData = { published: false, publish_status: 'draft' };
        eventName = 'programs_unpublish';
        break;
      case 'fill_and_publish':
        // Apply defaults first, then publish
        const d = defaults || {};
        updateData = {
          intake_months: d.intake_months || [9],
          next_intake_date: d.next_intake_date || '2025-09-01',
          study_mode: d.study_mode || 'on_campus',
          languages: d.languages || ['en'],
          duration_months: d.duration_months || 24,
          tuition_usd_min: d.tuition_usd_min || 10000,
          tuition_usd_max: d.tuition_usd_max || 30000,
          published: true,
          publish_status: 'published',
        };
        eventName = 'programs_fill_and_publish';
        break;
      default:
        return new Response(
          JSON.stringify({ ok: false, error: 'Invalid action. Use: publish, unpublish, fill_and_publish' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Bulk update in chunks of 500 to avoid timeout
    const chunkSize = 500;
    let updatedCount = 0;

    for (let i = 0; i < targetIds.length; i += chunkSize) {
      const chunk = targetIds.slice(i, i + chunkSize);
      const { data, error } = await g.srv
        .from('programs')
        .update(updateData)
        .in('id', chunk)
        .select('id');

      if (error) throw error;
      updatedCount += data?.length || 0;
    }

    // Log telemetry
    await g.srv.from('events').insert({
      name: eventName,
      visitor_id: 'admin',
      properties: {
        count: updatedCount,
        filters,
        action,
      }
    });

    return new Response(
      JSON.stringify({ ok: true, updated: updatedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[admin-programs-bulk] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
