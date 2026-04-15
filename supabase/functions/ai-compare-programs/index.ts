import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { programs } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (!programs || !Array.isArray(programs) || programs.length < 2) {
      return new Response(
        JSON.stringify({ error: 'يجب إرسال برنامجين على الأقل' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build program details for the prompt
    const programDetails = programs.map((p: any, i: number) => {
      const lines = [`البرنامج ${i + 1}:`];
      if (p.program_name) lines.push(`  الاسم: ${p.program_name}`);
      if (p.university_name) lines.push(`  الجامعة: ${p.university_name}`);
      if (p.city) lines.push(`  المدينة: ${p.city}`);
      if (p.country_name) lines.push(`  الدولة: ${p.country_name}`);
      if (p.degree_name) lines.push(`  الدرجة: ${p.degree_name}`);
      if (p.fees_yearly) lines.push(`  الرسوم السنوية: $${p.fees_yearly}`);
      if (p.duration_months) lines.push(`  المدة: ${Math.round(p.duration_months / 12 * 10) / 10} سنة`);
      if (p.monthly_living_usd) lines.push(`  تكلفة المعيشة الشهرية: $${p.monthly_living_usd}`);
      if (p.instruction_languages?.length) lines.push(`  لغات الدراسة: ${p.instruction_languages.join('، ')}`);
      if (p.has_dorm) lines.push(`  سكن طلابي: متوفر`);
      if (p.scholarship_available) lines.push(`  منحة: متوفرة`);
      if (p.ranking) lines.push(`  الترتيب العالمي: #${p.ranking}`);
      return lines.join('\n');
    }).join('\n\n');

    const systemPrompt = `أنت مستشار تعليمي خبير متخصص في الدراسة بالخارج. مهمتك تحليل ومقارنة البرامج الجامعية المقدمة وتقديم نصيحة شاملة للطالب.

قواعد مهمة:
- اكتب بالعربية فقط
- كن موضوعياً ومبنياً على البيانات المقدمة
- استخدم تنسيق Markdown واضح
- قدم تحليلاً عملياً مفيداً`;

    const userPrompt = `قارن البرامج التالية وقدم تحليلاً شاملاً:

${programDetails}

قدم التحليل بالتنسيق التالي:

## 🏆 التوصية العامة
حدد أفضل برنامج واشرح لماذا بوضوح.

## 💰 مقارنة التكاليف
قارن التكلفة الإجمالية (رسوم + معيشة × مدة الدراسة) لكل برنامج. أيهم الأوفر؟

## 🚀 الآفاق المستقبلية والوظيفية
قيّم كل برنامج من حيث فرص العمل بعد التخرج وقوة الشهادة في سوق العمل.

## 🎓 جودة التعليم والبيئة
قارن جودة التعليم، الحياة الطلابية، والبيئة الاجتماعية لكل مدينة/جامعة.

## 💡 نصيحة للطالب
قدم نصيحة شخصية مباشرة تساعد الطالب في اتخاذ القرار.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'تم تجاوز حد الطلبات، حاول مرة أخرى لاحقاً' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'يرجى إضافة رصيد لاستخدام التحليل الذكي' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(
        JSON.stringify({ error: 'خطأ في خدمة الذكاء الاصطناعي' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('ai-compare-programs error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'خطأ غير متوقع' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
