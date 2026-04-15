import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  
  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('list-lookups called');

    const [
      { data: countriesRaw, error: countriesError },
      { data: degrees, error: degreesError },
      { data: certificates, error: certificatesError },
      { data: subjects, error: subjectsError },
      { data: disciplinesRaw, error: disciplinesError }
    ] = await Promise.all([
      supabase.from('countries').select('id, name_ar, slug, country_code').order('name_ar', { ascending: true }),
      supabase.from('degrees').select('id, name, slug').order('name', { ascending: true }),
      supabase.from('certificate_types').select('id, name').order('name', { ascending: true }),
      supabase.from('subjects').select('id, name, slug').order('name', { ascending: true }),
      supabase.from('disciplines').select('id, slug, name_ar, name_en').order('name_ar', { ascending: true })
    ]);

    if (countriesError) throw countriesError;
    if (degreesError) throw degreesError;
    if (certificatesError) throw certificatesError;
    if (subjectsError) throw subjectsError;
    if (disciplinesError) throw disciplinesError;

    // Map countries: provide both name and name_ar for UI compatibility
    const countries = (countriesRaw || []).map((c: any) => ({
      id: c.id,
      name: c.name_ar || c.name_en || c.slug,
      name_ar: c.name_ar,
      slug: c.slug,
      country_code: c.country_code
    }));

    const disciplines = (disciplinesRaw || []).map((d: any) => ({
      id: d.id,
      slug: d.slug,
      name: d.name_ar || d.name_en || d.slug,
      name_ar: d.name_ar,
      name_en: d.name_en
    }));

    console.log(`Returning ${countries?.length} countries, ${degrees?.length} degrees, ${certificates?.length} certificates, ${subjects?.length} subjects, ${disciplines?.length} disciplines`);

    return new Response(
      JSON.stringify({
        ok: true,
        countries,
        degrees: degrees || [],
        certificates: certificates || [],
        subjects: subjects || [],
        disciplines
      }),
      { 
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in list-lookups:', error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: String(error),
        countries: [],
        degrees: [],
        certificates: [],
        subjects: [],
        disciplines: []
      }),
      { 
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
