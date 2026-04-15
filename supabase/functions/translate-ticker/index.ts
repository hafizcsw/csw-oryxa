import { corsHeaders } from '../_shared/http.ts';

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text_en, label_en, target_lang } = await req.json();

    if (!text_en || !target_lang) {
      return new Response(
        JSON.stringify({ error: 'Missing text_en or target_lang' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If target language is English, return as-is
    if (target_lang === 'en') {
      return new Response(
        JSON.stringify({ text: text_en, label: label_en }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!OPENAI_API_KEY) {
      console.error('[translate-ticker] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Translation service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const languageNames: Record<string, string> = {
      ar: 'Arabic',
      fr: 'French',
      ru: 'Russian',
      es: 'Spanish',
      zh: 'Chinese',
      de: 'German',
      tr: 'Turkish',
    };

    const targetLanguageName = languageNames[target_lang] || target_lang;

    console.log(`[translate-ticker] Translating to ${targetLanguageName}:`, { text_en, label_en });

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the given text from English to ${targetLanguageName}. 
Keep the same tone, emojis, and formatting. 
Return ONLY a JSON object with two fields: "text" (the translated main text) and "label" (the translated label/badge text).
Do not include any explanation or markdown formatting.`
          },
          {
            role: 'user',
            content: JSON.stringify({ text: text_en, label: label_en })
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[translate-ticker] AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later', text: text_en, label: label_en }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Fallback to English on error
      return new Response(
        JSON.stringify({ text: text_en, label: label_en }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    console.log('[translate-ticker] AI response content:', content);

    if (!content) {
      console.error('[translate-ticker] No content in AI response');
      return new Response(
        JSON.stringify({ text: text_en, label: label_en }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response from AI
    let parsed;
    try {
      // Clean up the response in case it has markdown formatting
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('[translate-ticker] Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({ text: text_en, label: label_en }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = {
      text: parsed.text || text_en,
      label: parsed.label || label_en,
    };

    console.log('[translate-ticker] Translation result:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600' // Cache translations for 1 hour
        } 
      }
    );

  } catch (error) {
    console.error('[translate-ticker] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Translation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
