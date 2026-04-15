import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApplicationSubmitPayload {
  user_id?: string;
  visitor_id?: string;
  full_name: string;
  email: string;
  phone?: string;
  country_slug?: string;
  degree_slug?: string;
  language?: string;
  budget_fees?: number;
  program_ids: string[];
}

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

async function checkRateLimit(supabase: ReturnType<typeof createClient>, ip: string, endpoint: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

  const { data } = await supabase
    .from("rate_limits")
    .select("requests_count, window_start")
    .eq("domain", ip)
    .eq("endpoint", endpoint)
    .single();

  if (data) {
    const dataWindowStart = new Date(data.window_start);
    if (dataWindowStart > windowStart && data.requests_count >= RATE_LIMIT_MAX) {
      return false;
    }
    if (dataWindowStart <= windowStart) {
      await supabase
        .from("rate_limits")
        .update({ requests_count: 1, window_start: now.toISOString(), last_request_at: now.toISOString() })
        .eq("domain", ip)
        .eq("endpoint", endpoint);
    } else {
      await supabase
        .from("rate_limits")
        .update({ requests_count: data.requests_count + 1, last_request_at: now.toISOString() })
        .eq("domain", ip)
        .eq("endpoint", endpoint);
    }
  } else {
    await supabase.from("rate_limits").insert({
      domain: ip,
      endpoint,
      requests_count: 1,
      window_start: now.toISOString(),
      last_request_at: now.toISOString(),
    });
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Rate limiting by IP
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await checkRateLimit(supabase, clientIp, 'web-application-submit');
  if (!allowed) {
    return new Response(
      JSON.stringify({ ok: false, error: 'too_many_requests' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload: ApplicationSubmitPayload = await req.json();
    console.log('[web-application-submit] Request:', {
      user_id: payload.user_id ? '***' : undefined,
      visitor_id: payload.visitor_id ? '***' : undefined,
      programs_count: payload.program_ids?.length
    });

    // ✅ Validation
    if (!payload.user_id && !payload.visitor_id) {
      return new Response(
        JSON.stringify({ error: 'user_id or visitor_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.program_ids || payload.program_ids.length === 0 || payload.program_ids.length > 20) {
      return new Response(
        JSON.stringify({ error: 'program_ids required (max 20)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!payload.email || !emailRegex.test(payload.email.trim())) {
      return new Response(
        JSON.stringify({ error: 'valid email required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (payload.user_id && !uuidRegex.test(payload.user_id)) {
      return new Response(
        JSON.stringify({ error: 'invalid user_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    for (const pid of payload.program_ids) {
      if (!uuidRegex.test(pid)) {
        return new Response(
          JSON.stringify({ error: 'invalid program_id format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate phone format if provided
    if (payload.phone && !/^\+?[\d\s\-()]{6,25}$/.test(payload.phone.trim())) {
      return new Response(
        JSON.stringify({ error: 'invalid phone format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize string lengths
    payload.full_name = (payload.full_name || '').trim().slice(0, 200);
    payload.email = payload.email.trim().toLowerCase().slice(0, 255);
    if (payload.phone) payload.phone = payload.phone.trim().slice(0, 30);

    // 1️⃣ إنشاء application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        user_id: payload.user_id || null,
        visitor_id: payload.visitor_id || `user_${payload.user_id}`,
        full_name: payload.full_name,
        email: payload.email,
        phone: payload.phone,
        country_slug: payload.country_slug,
        degree_slug: payload.degree_slug,
        language: payload.language,
        budget_fees: payload.budget_fees,
        status: 'submitted',
      })
      .select('id')
      .single();

    if (appError || !application) {
      console.error('[web-application-submit] Failed to create application:', appError);
      throw new Error('submission_failed');
    }

    console.log('[web-application-submit] Application created:', application.id);

    // 2️⃣ إضافة البرامج إلى application_programs
    if (payload.program_ids.length > 0) {
      const programEntries = payload.program_ids.map((program_id: string) => ({
        application_id: application.id,
        program_id,
      }));

      const { error: programsError } = await supabase
        .from('application_programs')
        .insert(programEntries);

      if (programsError) {
        console.error('[web-application-submit] Failed to add programs:', programsError);
      }
    }

    // 3️⃣ مزامنة مع CRM (إذا كان user_id موجوداً)
    if (payload.user_id && payload.program_ids.length > 0) {
      const { data: programs } = await supabase
        .from('programs')
        .select(`
          id, 
          title, 
          tuition_fees, 
          duration_months,
          language,
          university_id, 
          universities!inner(id, name, country_id, countries!inner(slug))
        `)
        .in('id', payload.program_ids);

      if (programs && programs.length > 0) {
        const CRM_FUNCTIONS_URL = Deno.env.get('CRM_FUNCTIONS_URL');
        const CRM_API_KEY = Deno.env.get('CRM_API_KEY');

        if (!CRM_FUNCTIONS_URL || !CRM_API_KEY) {
          console.warn('[web-application-submit] CRM credentials not configured');
        } else {
          for (const program of programs) {
            const university = (program as any).universities;
            const country = university?.countries;
            
            const crmPayload = {
              web_user_id: payload.user_id,
              web_application_id: application.id,
              university_id: program.university_id,
              program_id: program.id,
              university_name: university?.name || 'Unknown',
              program_name: program.title,
              country: country?.slug || 'unknown',
              tuition_usd: (program as any).tuition_fees,
              duration_months: (program as any).duration_months,
              language: (program as any).language,
              status: 'submitted' as const,
            };

            try {
              const crmResponse = await fetch(
                `${CRM_FUNCTIONS_URL}/web-sync-application`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': CRM_API_KEY,
                  },
                  body: JSON.stringify(crmPayload),
                }
              );

              if (crmResponse.ok) {
                console.log('[web-application-submit] CRM sync successful for program:', program.id);
              } else {
                console.error('[web-application-submit] CRM sync failed for program:', program.id);
              }
            } catch (err) {
              console.error('[web-application-submit] CRM sync error for program:', program.id);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        application_id: application.id,
        programs_synced: payload.program_ids.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[web-application-submit] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: 'submission_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
