import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const g = await requireAdmin(req);
    if (!g.ok) {
      return new Response(JSON.stringify({ ok: false, error: g.error }), {
        status: g.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const locale = url.searchParams.get('locale') || 'ar';

    if (!slug) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing slug parameter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Fetch country data
    const { data: country, error: countryError } = await g.srv
      .from('countries')
      .select('*')
      .eq('slug', slug)
      .single();

    if (countryError || !country) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Country not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Generate FAQ using Lovable AI
    const prompt = locale === 'ar'
      ? `أنشئ 5-7 أسئلة شائعة (FAQ) حول الدراسة في ${country.name_ar || country.name_en} باللغة العربية. اجعل الأسئلة عملية ومفيدة للطلاب الدوليين. أرجع النتيجة بصيغة JSON array مثل: [{"q":"السؤال؟","a":"الإجابة"}]`
      : `Generate 5-7 frequently asked questions (FAQ) about studying in ${country.name_en} in English. Make questions practical and helpful for international students. Return as JSON array: [{"q":"Question?","a":"Answer"}]`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY') || ''}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    if (!aiResponse.ok) {
      console.error('[FAQ Generate] AI API failed');
      // Fallback: return basic FAQ
      const fallbackFaq = locale === 'ar' ? [
        { q: 'ما هي تكلفة الدراسة؟', a: 'تختلف التكلفة حسب الجامعة والبرنامج.' },
        { q: 'هل أحتاج لفيزا؟', a: 'نعم، معظم الطلاب الدوليين يحتاجون فيزا دراسية.' },
        { q: 'ما لغة التدريس؟', a: 'تختلف حسب الجامعة والبرنامج.' }
      ] : [
        { q: 'What are the tuition costs?', a: 'Costs vary by university and program.' },
        { q: 'Do I need a visa?', a: 'Yes, most international students require a study visa.' },
        { q: 'What is the language of instruction?', a: 'Varies by university and program.' }
      ];
      
      return new Response(
        JSON.stringify({ ok: true, faqs: fallbackFaq }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData?.choices?.[0]?.message?.content || '[]';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const faqs = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Telemetry
    await g.srv.from('analytics_events').insert({
      event_name: 'country_faq_generated',
      meta: { slug, locale, count: faqs.length }
    });

    return new Response(
      JSON.stringify({ ok: true, faqs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error('[admin-country-faq-generate] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
