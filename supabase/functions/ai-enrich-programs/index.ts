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
    const { program_id, source_urls = [] } = body;

    if (!program_id || !Array.isArray(source_urls) || source_urls.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'program_id and source_urls required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // 1) جلب محتوى الصفحات (مع Allowlist للدومينات الآمنة)
    const allowedDomains = ['.edu', '.ac', '.edu.eg', '.ac.uk', '.de', '.tr', '.gov'];
    const pages: string[] = [];

    for (const urlStr of source_urls) {
      try {
        const url = new URL(urlStr);
        const isAllowed = allowedDomains.some((d) => url.hostname.endsWith(d));
        if (!isAllowed) {
          console.warn(`[ai-enrich] Skipping non-allowed domain: ${url.hostname}`);
          continue;
        }

        const response = await fetch(urlStr, {
          headers: { 'User-Agent': 'CSW-Assistant/1.0' },
        });
        if (!response.ok) continue;

        const html = await response.text();
        pages.push(html.slice(0, 200000)); // حد أقصى 200KB لكل صفحة
      } catch (e) {
        console.error(`[ai-enrich] Failed to fetch ${urlStr}:`, e);
      }
    }

    if (pages.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'No valid pages fetched' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) استخراج قيم باستخدام Regex بسيط (قابل للتبديل بـ LLM)
    const suggestions: any[] = [];
    const reFee = /(\d{3,6})(?:\s?)(USD|GBP|EUR|TRY|SAR)/gi;
    const reIELTS = /IELTS[^0-9]*([5-8](?:\.\d)?)/gi;
    const reIntake = /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s?(\d{4})/gi;

    for (const page of pages) {
      // Fee extraction
      const feeMatches = [...page.matchAll(reFee)];
      if (feeMatches.length > 0) {
        const [amount, currency] = [feeMatches[0][1], feeMatches[0][2].toUpperCase()];
        suggestions.push({
          field: 'tuition_yearly',
          proposed_value: { amount: Number(amount), currency },
          confidence: 0.6,
        });
      }

      // IELTS extraction
      const ieltsMatches = [...page.matchAll(reIELTS)];
      if (ieltsMatches.length > 0) {
        suggestions.push({
          field: 'ielts_required',
          proposed_value: Number(ieltsMatches[0][1]),
          confidence: 0.7,
        });
      }

      // Intake extraction
      const intakeMatches = [...page.matchAll(reIntake)];
      if (intakeMatches.length > 0) {
        const [_, month, year] = intakeMatches[0];
        const monthNum = monthToNumber(month);
        suggestions.push({
          field: 'next_intake_date',
          proposed_value: `${year}-${monthNum}-01`,
          confidence: 0.5,
        });
      }
    }

    // 3) إنشاء Job وحفظ الاقتراحات
    const { data: job, error: jobError } = await supabase
      .from('ai_enrichment_jobs')
      .insert({
        target_type: 'program',
        target_id: program_id,
        source_urls: source_urls,
        status: 'done',
        result: { suggestions_count: suggestions.length },
        created_by: payload.sub,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    for (const sg of suggestions) {
      await supabase.from('ai_enrichment_suggestions').insert({
        job_id: job.id,
        ...sg,
      });
    }

    console.log(`[ai-enrich] Created ${suggestions.length} suggestions for program ${program_id}`);

    return new Response(
      JSON.stringify({ ok: true, job_id: job.id, suggestions: suggestions.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[ai-enrich] Error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function monthToNumber(month: string): string {
  const map: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  return map[month.slice(0, 3).toLowerCase()] || '09';
}
