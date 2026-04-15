import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyAdminJWT, corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await verifyAdminJWT(req.headers.get('authorization'));
    if (!payload) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { csv_data } = body;

    if (!csv_data || typeof csv_data !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'csv_data required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();
    const lines = csv_data.trim().split('\n');
    const headers = lines[0].split(',').map((h: string) => h.trim());
    
    const imported: any[] = [];
    const errors: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const values = parseCSVLine(line);
        const row: any = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx]?.trim() || null;
        });

        // Resolve university by name
        const { data: uni } = await supabase
          .from('universities')
          .select('id')
          .eq('name', row.university_name)
          .maybeSingle();

        if (!uni) {
          errors.push({ line: i + 1, error: `University not found: ${row.university_name}` });
          continue;
        }

        // Resolve degree by slug
        let degreeId = null;
        if (row.degree_slug) {
          const { data: deg } = await supabase
            .from('degrees')
            .select('id')
            .eq('slug', row.degree_slug)
            .maybeSingle();
          degreeId = deg?.id;
        }

        // Insert program
        const programData: any = {
          university_id: uni.id,
          title: row.program_name,
          degree_id: degreeId,
          teaching_language: row.teaching_language || 'en',
          delivery_mode: row.delivery_mode || 'on-campus',
          tuition_yearly: row.tuition_yearly ? Number(row.tuition_yearly) : null,
          currency_code: row.currency_code || null,
          ielts_required: row.ielts_required ? Number(row.ielts_required) : null,
          next_intake_date: row.next_intake_date || null,
          duration_months: row.duration_months ? Number(row.duration_months) : null,
        };

        const { error: insertError } = await supabase.from('programs').insert(programData);

        if (insertError) {
          errors.push({ line: i + 1, error: insertError.message });
        } else {
          imported.push(row.program_name);
        }
      } catch (e: any) {
        errors.push({ line: i + 1, error: e.message });
      }
    }

    console.log(`[import-csv] Imported ${imported.length} programs, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        ok: true,
        imported: imported.length,
        errors: errors,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[import-csv] Error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
