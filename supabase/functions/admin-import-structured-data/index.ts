import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProgramInput {
  university_name: string;
  program_name: string;
  degree_level: string;
  tuition_fee?: number;
  currency?: string;
  academic_year?: string;
  language: string;
  ielts_requirement?: string;
  academic_requirements?: string;
  pathway_available?: string;
  country: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { programs } = await req.json() as { programs: ProgramInput[] };

    if (!programs || !Array.isArray(programs)) {
      throw new Error("Missing or invalid programs array");
    }

    console.log(`[import-structured-data] Processing ${programs.length} programs`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Get all countries
    const { data: countries } = await supabase
      .from('countries')
      .select('id, name, name_ar');

    // Get all degrees
    const { data: degrees } = await supabase
      .from('degrees')
      .select('id, name, name_ar');

    for (const prog of programs) {
      try {
        // Find or create university
        let { data: university } = await supabase
          .from('universities')
          .select('id')
          .ilike('name', prog.university_name)
          .single();

        if (!university) {
          // Find country
          const country = countries?.find(c => 
            c.name.toLowerCase().includes(prog.country.toLowerCase()) ||
            c.name_ar?.includes(prog.country)
          );

          if (!country) {
            results.errors.push(`Country not found for: ${prog.country}`);
            results.failed++;
            continue;
          }

          // Create university
          const { data: newUni, error: uniError } = await supabase
            .from('universities')
            .insert({
              name: prog.university_name,
              country_id: country.id,
              state: 'draft'
            })
            .select('id')
            .single();

          if (uniError || !newUni) {
            results.errors.push(`Failed to create university: ${prog.university_name} - ${uniError?.message}`);
            results.failed++;
            continue;
          }

          university = newUni;
        }

        // Find degree
        const degreeMap: Record<string, string[]> = {
          'bachelor': ['bachelor', 'بكالوريوس', 'bba', 'bsc', 'ba', 'beng'],
          'master': ['master', 'ماجستير', 'msc', 'ma', 'mba', 'meng'],
          'diploma': ['diploma', 'دبلوم', 'certificate', 'شهادة'],
          'phd': ['phd', 'doctorate', 'دكتوراه']
        };

        let degreeId: string | null = null;
        const progLower = prog.degree_level.toLowerCase();

        for (const [key, keywords] of Object.entries(degreeMap)) {
          if (keywords.some(k => progLower.includes(k))) {
            const degree = degrees?.find(d => 
              d.name.toLowerCase() === key || 
              d.name_ar?.includes(key)
            );
            if (degree) {
              degreeId = degree.id;
              break;
            }
          }
        }

        if (!degreeId) {
          // Default to bachelor if unclear
          const defaultDegree = degrees?.find(d => d.name.toLowerCase() === 'bachelor');
          degreeId = defaultDegree?.id || null;
        }

        if (!degreeId) {
          results.errors.push(`Degree not found for: ${prog.degree_level}`);
          results.failed++;
          continue;
        }

        // Create program
        const programData: any = {
          university_id: university.id,
          title: prog.program_name,
          degree_id: degreeId,
          tuition_fee: prog.tuition_fee,
          currency: prog.currency,
          state: 'draft'
        };

        // Add optional fields to description
        const descParts: string[] = [];
        if (prog.academic_year) descParts.push(`السنة الأكاديمية: ${prog.academic_year}`);
        if (prog.language) descParts.push(`لغة الدراسة: ${prog.language}`);
        if (prog.ielts_requirement) descParts.push(`متطلبات IELTS: ${prog.ielts_requirement}`);
        if (prog.academic_requirements) descParts.push(`متطلبات أكاديمية: ${prog.academic_requirements}`);
        if (prog.pathway_available) descParts.push(`مسار تحضيري: ${prog.pathway_available}`);

        if (descParts.length > 0) {
          programData.description = descParts.join('\n');
        }

        const { error: progError } = await supabase
          .from('programs')
          .insert(programData);

        if (progError) {
          results.errors.push(`Failed to create program: ${prog.program_name} - ${progError.message}`);
          results.failed++;
        } else {
          results.success++;
        }

      } catch (err: any) {
        results.errors.push(`Error processing ${prog.program_name}: ${err.message}`);
        results.failed++;
      }
    }

    console.log(`[import-structured-data] Completed: ${results.success} success, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        results,
        message: `Successfully imported ${results.success} programs. ${results.failed} failed.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (e: any) {
    console.error("[import-structured-data] Error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e.message || e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
