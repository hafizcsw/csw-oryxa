/**
 * translate-field: Glossary-aware field translation using AI.
 * 
 * Translates a text field from source to target locale,
 * enforcing glossary constraints from translation_glossary.
 * 
 * Input: { text, source_locale, target_locale, domain?, context? }
 * Output: { ok, translated, glossary_terms_used, prompt_block }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchGlossaryTerms, formatGlossaryForPrompt } from "../_shared/glossaryHelper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { text, source_locale = 'en', target_locale = 'ar', domain, context, provider = 'lovable_gateway' } = await req.json();
    if (!text) throw new Error("Missing text to translate");

    const aiEnabled = Deno.env.get('ENABLE_AI_TRANSLATION') !== '0';
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')?.trim();

    // 1. Fetch glossary terms
    const terms = await fetchGlossaryTerms(supabase, source_locale, target_locale, domain);
    const glossaryBlock = formatGlossaryForPrompt(terms);

    console.log(`[translate-field] Glossary: ${terms.length} terms loaded for ${source_locale}→${target_locale}`);

    // 2. Build translation prompt with glossary constraints
    const systemPrompt = `You are a professional translator specializing in higher education content.
Translate the following text from ${source_locale} to ${target_locale}.
${context ? `Context: ${context}` : ''}

${glossaryBlock}

Rules:
- Follow glossary constraints EXACTLY
- Preserve proper nouns, abbreviations, and acronyms as specified
- Maintain the original meaning and tone
- Do not add explanations — output ONLY the translated text`;

    let translated = text;
    let fallbackReason: string | null = null;

    // 3. Call AI provider when enabled and configured
    if (!aiEnabled) {
      fallbackReason = 'ai_translation_disabled';
    } else if (!openaiApiKey) {
      fallbackReason = 'missing_openai_api_key';
    } else {
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: 0.2,
          max_tokens: 2000,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        translated = aiData.choices?.[0]?.message?.content?.trim() || text;
      } else {
        const errText = await aiResponse.text();
        fallbackReason = `provider_error:${aiResponse.status}`;
        console.warn(`[translate-field] AI call failed (${aiResponse.status}): ${errText}`);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        translated,
        source_locale,
        target_locale,
        glossary_terms_used: terms.length,
        glossary_block: glossaryBlock,
        provider_used: fallbackReason ? 'fallback' : provider,
        fallback_reason: fallbackReason,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error("[translate-field] Error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
