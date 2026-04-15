import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillParams {
  mode: 'dry_run' | 'apply';
  limit?: number;
  offset?: number;
  only_missing?: boolean;
  ids?: string[];
  trace_id?: string;
  include_description?: boolean;
}

interface Suggestion {
  university_id: string;
  original_name: string;
  original_name_en: string | null;
  suggested_name_ar: string;
  original_description: string | null;
  suggested_description_ar: string | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'ai_gemini';
  trace_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  const traceStart = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const params: BackfillParams = await req.json();
    const {
      mode = 'dry_run',
      limit = 25,
      only_missing = true,
      ids,
      trace_id = crypto.randomUUID(),
      include_description = false,
    } = params;

    // Clamp limit to safe range
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const offset = Math.max(0, params.offset ?? 0);

    console.log(`[backfill-name-ar] trace=${trace_id} mode=${mode} limit=${safeLimit} offset=${offset} only_missing=${only_missing} include_description=${include_description} ids=${ids?.length ?? 'all'}`);

    // ── Step 1: Select targets ──
    let query = supabase
      .from('universities')
      .select('id, name, name_en, name_ar, description, description_ar')
      .order('name', { ascending: true })
      .range(offset, offset + safeLimit - 1);

    if (only_missing) {
      if (include_description) {
        query = query.or('name_ar.is.null,name_ar.eq.,description_ar.is.null');
      } else {
        query = query.or('name_ar.is.null,name_ar.eq.');
      }
    }

    if (ids && ids.length > 0) {
      query = query.in('id', ids);
    }

    const { data: targets, error: selectErr } = await query;
    if (selectErr) throw selectErr;
    if (!targets || targets.length === 0) {
      return respond({ ok: true, mode, trace_id, message: 'No targets found', suggestions: [], stats: { total: 0, translated: 0, skipped: 0 } });
    }

    console.log(`[backfill-name-ar] trace=${trace_id} found ${targets.length} targets`);

    // ── Step 2: Build AI prompt ──
    const namesToTranslate = targets.map(t => ({
      id: t.id,
      name: t.name,
      name_en: t.name_en,
      ...(include_description && t.description ? { description: t.description } : {}),
    }));

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const systemPrompt = include_description
      ? `You are a university translator. Translate university names AND descriptions to Arabic.

NAMING RULES:
1. "University" → "جامعة" (before the name), "Institute" → "معهد", "Academy" → "أكاديمية", "College" → "كلية", "School" → "مدرسة"
2. Personal/brand names → TRANSLITERATE phonetically (Harvard → هارفارد, MIT → إم آي تي)
3. City/country names → standard Arabic equivalents (Moscow → موسكو)
4. "State" → "الحكومية"/"الوطنية", "Technical" → "التقنية", "Medical" → "الطبية", "National" → "الوطنية", "Federal" → "الفيدرالية"

DESCRIPTION RULES:
1. Translate the full description naturally into Arabic
2. Keep factual data (ranks, scores, numbers) as-is
3. Use formal Arabic (فصحى) suitable for educational context
4. If no description is provided, omit description_ar from the result

Return a JSON array with:
- id: university id (string)
- name_ar: Arabic name (string)
- description_ar: Arabic description (string, omit if no description provided)
- confidence: "high"/"medium"/"low"

IMPORTANT: Return ONLY valid JSON array. No markdown, no explanation.`
      : `You are a university name translator. Translate university names to Arabic following these rules:

RULES:
1. "University" → "جامعة" (placed BEFORE the name in Arabic)
2. "Institute" → "معهد"
3. "Academy" → "أكاديمية"  
4. "College" → "كلية"
5. "School" → "مدرسة"
6. Personal names and brand names should be TRANSLITERATED (phonetic Arabic), NOT translated semantically.
   Example: "Harvard" → "هارفارد", "MIT" → "إم آي تي", "Oxford" → "أكسفورد"
7. City/country names should use their standard Arabic equivalents.
   Example: "Moscow" → "موسكو", "London" → "لندن"
8. Keep the structure natural in Arabic. Example: "Moscow State University" → "جامعة موسكو الحكومية"
9. "State" in university context → "الحكومية" or "الوطنية"
10. "Technical" → "التقنية", "Technological" → "التكنولوجية"
11. "Medical" → "الطبية", "Engineering" → "الهندسية"
12. "National" → "الوطنية", "Federal" → "الفيدرالية"

Return a JSON array of objects with exactly these fields:
- id: the university id (string)
- name_ar: the Arabic translation (string)
- confidence: "high" if you're very sure, "medium" if reasonable, "low" if unsure

IMPORTANT: Return ONLY valid JSON array. No markdown, no explanation.`;

    const userPrompt = include_description
      ? `Translate these university names and descriptions to Arabic:\n\n${JSON.stringify(namesToTranslate, null, 2)}`
      : `Translate these university names to Arabic:\n\n${JSON.stringify(namesToTranslate, null, 2)}`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[backfill-name-ar] AI error: ${aiResponse.status} ${errText}`);
      if (aiResponse.status === 429) {
        return respond({ ok: false, error: 'Rate limited. Try again later.', trace_id }, 429);
      }
      if (aiResponse.status === 402) {
        return respond({ ok: false, error: 'Payment required for AI credits.', trace_id }, 402);
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '';
    
    // Parse AI response - handle markdown code blocks
    let cleanJson = rawContent.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    let translations: Array<{ id: string; name_ar: string; description_ar?: string; confidence: string }>;
    try {
      translations = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error(`[backfill-name-ar] Failed to parse AI response: ${cleanJson.substring(0, 500)}`);
      throw new Error('Failed to parse AI translation response');
    }

    // ── Step 3: Build suggestions ──
    const suggestions: Suggestion[] = [];
    const skipped: string[] = [];

    for (const target of targets) {
      const translation = translations.find(t => t.id === target.id);
      if (!translation || !translation.name_ar) {
        skipped.push(target.id);
        continue;
      }

      // Idempotency: skip if already has both name_ar and description_ar (when include_description)
      const needsName = !target.name_ar || target.name_ar.trim() === '';
      const needsDesc = include_description && target.description && (!target.description_ar || target.description_ar.trim() === '');
      
      if (!needsName && !needsDesc) {
        skipped.push(target.id);
        continue;
      }

      suggestions.push({
        university_id: target.id,
        original_name: target.name,
        original_name_en: target.name_en,
        suggested_name_ar: translation.name_ar,
        original_description: target.description || null,
        suggested_description_ar: translation.description_ar || null,
        confidence: (translation.confidence as 'high' | 'medium' | 'low') || 'medium',
        source: 'ai_gemini',
        trace_id,
      });
    }

    console.log(`[backfill-name-ar] trace=${trace_id} suggestions=${suggestions.length} skipped=${skipped.length}`);

    // ── Step 4: Apply if mode=apply ──
    let applied = 0;
    const errors: Array<{ id: string; error: string }> = [];

    if (mode === 'apply' && suggestions.length > 0) {
      for (const s of suggestions) {
        const updateData: Record<string, string> = {};
        
        // Only set name_ar if missing
        if (s.suggested_name_ar) {
          updateData.name_ar = s.suggested_name_ar;
        }
        // Only set description_ar if we have a suggestion and include_description is on
        if (include_description && s.suggested_description_ar) {
          updateData.description_ar = s.suggested_description_ar;
        }

        if (Object.keys(updateData).length === 0) continue;

        const { error: updateErr } = await supabase
          .from('universities')
          .update(updateData)
          .eq('id', s.university_id);

        if (updateErr) {
          errors.push({ id: s.university_id, error: updateErr.message });
          console.error(`[backfill-name-ar] trace=${trace_id} update failed for ${s.university_id}: ${updateErr.message}`);
        } else {
          applied++;
        }
      }
      console.log(`[backfill-name-ar] trace=${trace_id} applied=${applied} errors=${errors.length}`);
    }

    const elapsed = Date.now() - traceStart;

    return respond({
      ok: true,
      mode,
      trace_id,
      elapsed_ms: elapsed,
      stats: {
        total_targets: targets.length,
        suggestions: suggestions.length,
        skipped: skipped.length,
        applied: mode === 'apply' ? applied : 0,
        errors: errors.length,
      },
      suggestions: suggestions.map(s => ({
        university_id: s.university_id,
        original_name: s.original_name,
        original_name_en: s.original_name_en,
        suggested_name_ar: s.suggested_name_ar,
        suggested_description_ar: s.suggested_description_ar,
        confidence: s.confidence,
      })),
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (e: any) {
    console.error('[backfill-name-ar] Error:', e);
    return respond({ ok: false, error: String(e), trace_id: 'error' }, 500);
  }
});

function respond(body: any, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
