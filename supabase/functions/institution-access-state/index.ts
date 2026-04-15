import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveEffectiveUniversityPageAccess } from "../_shared/universityPageAccess.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'NO_AUTH' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'INVALID_TOKEN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'resolve': {
        const access = await resolveEffectiveUniversityPageAccess(supabase, user.id);

        return new Response(JSON.stringify({
          ok: true,
          access_state: access.accessState,
          institution_id: access.institutionId,
          university_slug: access.universitySlug,
          institution_name: null,
          claim_id: null,
          role: access.role || 'owner',
          allowed_modules: [],
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'submit_claim': {
        const { claim } = body;
        
        const { data, error } = await supabase
          .from('institution_claims')
          .insert({
            user_id: user.id,
            institution_id: claim.institution_id,
            institution_name: claim.institution_name,
            official_email: claim.official_email,
            website: claim.website,
            country: claim.country,
            city: claim.city,
            job_title: claim.job_title,
            department: claim.department,
            evidence_paths: claim.evidence_paths || [],
            notes: claim.notes,
            claim_type: claim.claim_type,
            status: 'submitted',
          })
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true, claim_id: data.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_claim': {
        const { claim_id } = body;
        
        const { data, error } = await supabase
          .from('institution_claims')
          .select('*')
          .eq('id', claim_id)
          .eq('user_id', user.id)
          .single();

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true, claim: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'add_evidence': {
        const { claim_id, evidence_paths } = body;
        
        const { data: existing } = await supabase
          .from('institution_claims')
          .select('evidence_paths')
          .eq('id', claim_id)
          .eq('user_id', user.id)
          .single();

        const allPaths = [...(existing?.evidence_paths || []), ...evidence_paths];

        const { error } = await supabase
          .from('institution_claims')
          .update({ evidence_paths: allPaths })
          .eq('id', claim_id)
          .eq('user_id', user.id);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'resubmit_claim': {
        const { claim_id } = body;
        
        const { error } = await supabase
          .from('institution_claims')
          .update({ status: 'submitted' })
          .eq('id', claim_id)
          .eq('user_id', user.id)
          .in('status', ['rejected', 'more_info_requested']);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ ok: false, error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
