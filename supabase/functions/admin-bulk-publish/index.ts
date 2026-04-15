import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface UniRecord {
  name: string;
  city?: string;
  website?: string;
  ranking?: number;
  annual_fees?: number;
  monthly_living?: number;
  logo_url?: string;
  description?: string;
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

    const { mode, records } = await req.json() as {
      mode: 'preview' | 'publish';
      records: UniRecord[];
    };

    if (!records?.length) {
      return json({ ok: false, error: 'No records' }, 400);
    }

    console.log(`[bulk-publish] mode=${mode}, records=${records.length}`);

    // Fetch ALL universities in one go (paginated to bypass 1000 limit)
    const allUnis: Array<{
      id: string; name: string; city: string | null;
      website: string | null; ranking: number | null;
      annual_fees: number | null; monthly_living: number | null;
      logo_url: string | null; description: string | null;
    }> = [];

    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('universities')
        .select('id, name, city, website, ranking, annual_fees, monthly_living, logo_url, description')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allUnis.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    console.log(`[bulk-publish] Loaded ${allUnis.length} universities from DB`);

    // Build lookup map: lowercase name -> uni
    const uniMap = new Map<string, typeof allUnis[0]>();
    for (const u of allUnis) {
      uniMap.set(u.name.toLowerCase().trim(), u);
    }

    // Process records in-memory
    const results: Array<{
      name: string;
      status: 'matched' | 'new' | 'updated' | 'error' | 'no_change';
      university_id?: string;
      changes?: Record<string, { old: unknown; new: unknown }>;
      error?: string;
    }> = [];

    const updatesToApply: Array<{ id: string; data: Record<string, unknown> }> = [];
    const insertsToApply: Array<Record<string, unknown>> = [];

    for (const record of records) {
      const cleanName = (record.name || '').trim();
      if (!cleanName) { results.push({ name: '(empty)', status: 'error', error: 'Missing name' }); continue; }

      // Match: exact -> lowercase -> without "The "
      let uni = uniMap.get(cleanName.toLowerCase());
      if (!uni && !cleanName.toLowerCase().startsWith('the ')) {
        uni = uniMap.get(`the ${cleanName.toLowerCase()}`);
      }
      if (!uni && cleanName.toLowerCase().startsWith('the ')) {
        uni = uniMap.get(cleanName.toLowerCase().replace(/^the\s+/, ''));
      }

      if (!uni) {
        if (mode === 'publish') {
          const insertData: Record<string, unknown> = { name: cleanName };
          if (record.city) insertData.city = record.city;
          if (record.website) insertData.website = record.website;
          if (record.logo_url) insertData.logo_url = record.logo_url;
          if (record.description) insertData.description = record.description;
          if (record.ranking) insertData.ranking = Number(record.ranking);
          if (record.annual_fees) insertData.annual_fees = Number(record.annual_fees);
          if (record.monthly_living) insertData.monthly_living = Number(record.monthly_living);
          insertsToApply.push(insertData);
        }
        results.push({ name: cleanName, status: 'new' });
        continue;
      }

      // Calculate diff
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const updateData: Record<string, unknown> = {};

      for (const key of ['city', 'website', 'logo_url', 'description'] as const) {
        const newVal = record[key];
        if (newVal && typeof newVal === 'string' && newVal.trim() !== '') {
          const oldVal = uni[key];
          if (!oldVal || (typeof oldVal === 'string' && oldVal.trim() === '')) {
            changes[key] = { old: oldVal ?? null, new: newVal.trim() };
            updateData[key] = newVal.trim();
          }
        }
      }

      for (const key of ['ranking', 'annual_fees', 'monthly_living'] as const) {
        const newVal = record[key];
        if (newVal !== undefined && newVal !== null && newVal !== '') {
          if (uni[key] === null || uni[key] === undefined) {
            const numVal = Number(newVal);
            if (!isNaN(numVal)) {
              changes[key] = { old: null, new: numVal };
              updateData[key] = numVal;
            }
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        results.push({ name: cleanName, status: 'no_change', university_id: uni.id });
        continue;
      }

      if (mode === 'publish') {
        updatesToApply.push({ id: uni.id, data: updateData });
      }
      results.push({ name: cleanName, status: mode === 'publish' ? 'updated' : 'matched', university_id: uni.id, changes });
    }

    // Apply changes in publish mode
    if (mode === 'publish') {
      // Batch updates (one by one but fast since it's just writes)
      let updateErrors = 0;
      for (const { id, data } of updatesToApply) {
        const { error } = await supabase.from('universities').update(data).eq('id', id);
        if (error) { updateErrors++; console.error(`Update error for ${id}:`, error.message); }
      }

      // Batch inserts
      if (insertsToApply.length > 0) {
        for (let i = 0; i < insertsToApply.length; i += 200) {
          const batch = insertsToApply.slice(i, i + 200);
          const { error } = await supabase.from('universities').insert(batch);
          if (error) console.error('Insert error:', error.message);
        }
      }

      if (updateErrors > 0) console.log(`[bulk-publish] ${updateErrors} update errors`);
    }

    const summary = {
      total: records.length,
      with_changes: results.filter(r => r.status === 'matched' || r.status === 'updated').length,
      new: results.filter(r => r.status === 'new').length,
      no_change: results.filter(r => r.status === 'no_change').length,
      errors: results.filter(r => r.status === 'error').length,
      updated: results.filter(r => r.status === 'updated').length,
    };

    console.log(`[bulk-publish] Done:`, JSON.stringify(summary));
    return json({ ok: true, mode, summary, results });
  } catch (e: unknown) {
    console.error('[bulk-publish] Fatal:', e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
