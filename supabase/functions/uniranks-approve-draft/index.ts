import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ========== DEGREE LOOKUP (same logic as enrich) ==========
async function lookupDegree(supabase: any, degreeText: string): Promise<{ id: string; slug: string } | null> {
  const normalized = degreeText.toLowerCase().trim();
  const variants: Record<string, string> = {
    'bachelor': 'bachelor', 'bsc': 'bachelor', 'bs': 'bachelor', 'ba': 'bachelor',
    'master': 'master', 'msc': 'master', 'ma': 'master', 'mba': 'master',
    'phd': 'phd', 'doctorate': 'phd', 'dphil': 'phd',
    'diploma': 'diploma', 'dip': 'diploma', 'pgdip': 'diploma',
    'certificate': 'certificate', 'cert': 'certificate',
    'associate': 'diploma', 'postgraduate': 'master', 'foundation': 'certificate',
  };
  
  // Try direct match first
  const slug = variants[normalized] || normalized;
  const { data } = await supabase.from('degrees').select('id, slug').eq('slug', slug).maybeSingle();
  
  if (data) return data;
  
  // Try ilike as fallback
  for (const [key, mappedSlug] of Object.entries(variants)) {
    if (normalized.includes(key)) {
      const { data: fallback } = await supabase.from('degrees').select('id, slug').eq('slug', mappedSlug).maybeSingle();
      if (fallback) return fallback;
    }
  }
  
  return null;
}

// ========== DISCIPLINE LOOKUP ==========
async function lookupDiscipline(supabase: any, title: string): Promise<string | null> {
  const { data: disciplines } = await supabase.from('disciplines').select('id, slug, name_en');
  if (!disciplines) return null;
  
  const lower = title.toLowerCase();
  for (const d of disciplines) {
    if (lower.includes(d.slug) || lower.includes(d.name_en?.toLowerCase() || '')) return d.id;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { draft_id, overrides } = body;

    if (!draft_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'draft_id required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[uniranks-approve] Processing draft: ${draft_id}`);

    // Fetch draft with extracted data
    const { data: draft, error: draftError } = await supabase
      .from('program_draft')
      .select('*')
      .eq('id', draft_id)
      .maybeSingle();

    if (draftError || !draft) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Draft not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const extracted = draft.extracted_json || {};

    // ========== VALIDATION: Required fields ==========
    if (!draft.title || draft.title.length < 4) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid title' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========== DEGREE LOOKUP (with variants) ==========
    const degree = await lookupDegree(supabase, draft.degree_level || extracted.degree_level || '');
    if (!degree) {
      return new Response(
        JSON.stringify({ ok: false, error: `Degree not found: ${draft.degree_level}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========== DISCIPLINE LOOKUP ==========
    let disciplineId = extracted.discipline_id || null;
    if (!disciplineId) {
      disciplineId = await lookupDiscipline(supabase, draft.title);
    }
    if (!disciplineId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'discipline_id could not be determined from title' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ========== EXPLICIT FIELD MAPPING (NO wholesale extracted_json) ==========
    const programPayload: Record<string, any> = {
      university_id: draft.university_id,
      title: draft.title,
      degree_id: degree.id,
      discipline_id: disciplineId,
      source_url: draft.source_url,
      publish_status: 'draft', // Start as draft, require manual publish
    };

    // Map allowed fields ONLY
    const allowedNumeric = ['duration_months', 'tuition_usd_min', 'tuition_usd_max'];
    const allowedStrings = ['study_mode', 'tuition_basis', 'tuition_scope', 'scholarship_type'];
    const allowedArrays = ['intake_months'];
    const allowedBooleans = ['has_scholarship'];
    const allowedDates = ['next_intake_date'];

    // duration_months from extracted (duration_years * 12)
    if (extracted.duration_years && typeof extracted.duration_years === 'number') {
      programPayload.duration_months = extracted.duration_years * 12;
    }

    // tuition
    if (extracted.tuition_usd && typeof extracted.tuition_usd === 'number') {
      programPayload.tuition_usd_min = extracted.tuition_usd;
      programPayload.tuition_usd_max = extracted.tuition_usd;
    }

    // Map other allowed fields
    for (const field of allowedStrings) {
      if (extracted[field] && typeof extracted[field] === 'string') {
        programPayload[field] = extracted[field];
      }
    }
    for (const field of allowedArrays) {
      if (Array.isArray(extracted[field])) {
        programPayload[field] = extracted[field];
      }
    }
    for (const field of allowedBooleans) {
      if (typeof extracted[field] === 'boolean') {
        programPayload[field] = extracted[field];
      }
    }
    for (const field of allowedDates) {
      if (extracted[field]) {
        programPayload[field] = extracted[field];
      }
    }

    console.log(`[uniranks-approve] Inserting program with payload:`, JSON.stringify(programPayload));

    // ========== INSERT PROGRAM ==========
    const { data: newProgram, error: insertError } = await supabase
      .from('programs')
      .insert(programPayload)
      .select('id')
      .maybeSingle();

    if (insertError || !newProgram) {
      console.error(`[uniranks-approve] Program insert failed:`, insertError);
      return new Response(
        JSON.stringify({ ok: false, error: `Failed to create program: ${insertError?.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[uniranks-approve] Created program: ${newProgram.id}`);

    // ========== INSERT PROGRAM_LANGUAGES ==========
    const languages = extracted.languages || [];
    if (languages.length > 0) {
      // Get language IDs
      const { data: langRecords } = await supabase
        .from('languages')
        .select('id, code')
        .in('code', languages.map((l: string) => l.toLowerCase().substring(0, 2)));

      if (langRecords && langRecords.length > 0) {
        const langInserts = langRecords.map((lang: any) => ({
          program_id: newProgram.id,
          language_id: lang.id,
        }));

        const { error: langError } = await supabase
          .from('program_languages')
          .insert(langInserts);

        if (langError) {
          console.error(`[uniranks-approve] Language insert failed:`, langError);
        } else {
          console.log(`[uniranks-approve] Inserted ${langInserts.length} languages for program`);
        }
      }
    }

    // ========== TRANSFER EVIDENCE RECORDS ==========
    const { error: evidenceError } = await supabase
      .from('source_evidence')
      .update({ program_id: newProgram.id })
      .eq('program_draft_id', draft_id);

    if (evidenceError) {
      console.error(`[uniranks-approve] Evidence transfer failed:`, evidenceError);
    } else {
      console.log(`[uniranks-approve] Evidence transferred to program ${newProgram.id}`);
    }

    // ========== MARK DRAFT AS APPROVED ==========
    const { error: updateError } = await supabase
      .from('program_draft')
      .update({
        status: 'approved',
        published_program_id: newProgram.id,
      })
      .eq('id', draft_id);

    if (updateError) {
      console.error(`[uniranks-approve] Draft update failed:`, updateError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        program_id: newProgram.id,
        draft_id,
        message: 'Draft approved and program created (pending publish)',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[uniranks-approve] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
