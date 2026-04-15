import { supabase } from "@/integrations/supabase/client";

type ProgramData = {
  program_id: string;
  program_slug?: string;
  program_name?: string;
  program_name_ar?: string;
  program_name_en?: string; // ✅ P0-LOCK-3: For buildProgramSnapshot compatibility
  university_name?: string;
  university_name_ar?: string;
  university_name_en?: string; // ✅ P0-LOCK-3: For buildProgramSnapshot compatibility
  university_logo?: string;
  country_name?: string;
  country_name_ar?: string;
  country_name_en?: string; // ✅ P0-LOCK-3: For buildProgramSnapshot compatibility
  country_code?: string;
  country_slug?: string;
  degree_name?: string;
  duration_months?: number | null;
  tuition_usd_min?: number | null;
  tuition_usd_max?: number | null;
  fees_yearly?: number | null;
  language?: string;
  portal_url?: string;
};

function hasRequiredNames(p: Partial<ProgramData>): boolean {
  const pn = (p.program_name || p.program_name_ar || "").trim();
  const un = (p.university_name || p.university_name_ar || "").trim();
  return !!pn && !!un;
}

/**
 * ✅ Ensures complete program data before adding to shortlist
 * If chat data is incomplete (missing names/slug), fetches from catalog
 */
export async function ensureProgramDataFromCatalog(input: any): Promise<ProgramData> {
  const programId = input.program_id || input.program_ref_id || input.id;
  if (!programId) throw new Error("missing_program_id");

  // Build direct data from input
  const direct: ProgramData = {
    program_id: programId,
    program_slug: input.program_slug || input.slug,
    program_name: input.program_name_en || input.program_name,
    program_name_ar: input.program_name_ar,
    university_name: input.university_name_en || input.university_name,
    university_name_ar: input.university_name_ar,
    university_logo: input.logo_url || input.university_logo,
    country_name: input.country_name_en || input.country,
    country_name_ar: input.country_name_ar,
    country_code: input.country_code,
    country_slug: input.country_slug || (input.country_code || input.country || 'unknown').toLowerCase().replace(/\s+/g, '-'),
    degree_name: input.degree_name || input.degree,
    duration_months: input.duration_months ?? null,
    tuition_usd_min: input.tuition_usd_min ?? input.tuition_min ?? null,
    tuition_usd_max: input.tuition_usd_max ?? input.tuition_max ?? null,
    fees_yearly: input.fees_yearly ?? input.tuition_max ?? input.tuition_min ?? input.tuition_usd ?? null,
    language: input.language || 'English',
    portal_url: input.portal_url,
  };

  // ✅ If we have required names AND (slug OR portal_url), data is complete
  if (hasRequiredNames(direct) && (direct.program_slug || direct.portal_url)) {
    console.log('[ensureProgramData] ✅ Data complete from chat:', { 
      program_id: programId,
      program_name: direct.program_name,
      university_name: direct.university_name,
      program_slug: direct.program_slug,
    });
    // ✅ P0-LOCK-3: Add _en fields for buildProgramSnapshot compatibility
    return {
      ...direct,
      program_name_en: direct.program_name,
      university_name_en: direct.university_name,
      country_name_en: direct.country_name,
    };
  }

  // ✅ GLOBAL SOT: Fetch from unified API view (vw_program_search_api)
  // Using ORDER #3 contract columns for consistency
  console.log('[ensureProgramData] 🔍 Fetching from catalog (vw_program_search_api) for:', programId);
  
  const { data, error } = await supabase
    .from("vw_program_search_api")
    .select("program_id, program_name_ar, program_name_en, university_name_ar, university_name_en, university_logo, country_code, country_name_ar, country_name_en, degree_name, degree_slug, duration_months, tuition_usd_min, tuition_usd_max, languages, language, portal_url")
    .eq("program_id", programId)
    .maybeSingle();

  if (error || !data) {
    console.error('[ensureProgramData] ❌ Catalog lookup failed:', error);
    throw new Error("catalog_lookup_failed");
  }

  console.log('[ensureProgramData] ✅ Fetched from catalog (GLOBAL SOT):', {
    program_id: data.program_id,
    program_name_ar: data.program_name_ar,
    university_name_ar: data.university_name_ar,
    country_code: data.country_code,
  });

  // portal_url comes directly from the view now
  const portalUrl = data.portal_url || `/programs/${data.country_code?.toLowerCase()}/${data.program_id}`;

  return {
    program_id: data.program_id,
    program_slug: data.country_code ? `${data.country_code.toLowerCase()}/${data.program_id}` : undefined,
    program_name: data.program_name_ar || data.program_name_en || undefined,
    program_name_ar: data.program_name_ar || undefined,
    // ✅ GLOBAL SOT: Both _ar and _en come from the unified view
    program_name_en: data.program_name_en || data.program_name_ar || undefined,
    university_name: data.university_name_ar || data.university_name_en || undefined,
    university_name_ar: data.university_name_ar || undefined,
    university_name_en: data.university_name_en || data.university_name_ar || undefined,
    university_logo: data.university_logo || undefined,
    country_name: data.country_name_ar || data.country_name_en || undefined,
    country_name_ar: data.country_name_ar || undefined,
    country_name_en: data.country_name_en || data.country_name_ar || undefined,
    country_code: data.country_code || undefined,
    country_slug: data.country_code?.toLowerCase() || undefined,
    degree_name: data.degree_name || undefined,
    duration_months: data.duration_months ?? null,
    tuition_usd_min: data.tuition_usd_min ?? null,
    tuition_usd_max: data.tuition_usd_max ?? null,
    fees_yearly: data.tuition_usd_max ?? data.tuition_usd_min ?? null,
    language: data.language || (Array.isArray(data.languages) ? data.languages[0] : 'en') || 'en',
    portal_url: portalUrl,
  };
}
