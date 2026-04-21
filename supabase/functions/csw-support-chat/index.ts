// CSW temporary support chatbot — uses Lovable AI Gateway
// Acts as a customer service agent for شركة CSW

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InMsg {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `أنت "ORYXA" — مساعد ذكاء اصطناعي تابع لشركة CSW (Council for Study Worldwide)، شركة متخصصة في مساعدة الطلاب على الدراسة في الخارج (روسيا، أوروبا، آسيا وغيرها).

هويتك:
- أنت ذكاء اصطناعي (AI Assistant) اسمه ORYXA، ولست إنساناً ولست فريق دعم بشري.
- إذا سُئلت "هل أنت إنسان؟" أو "هل أنت بوت؟" أجب بصراحة: "أنا ORYXA، مساعد ذكاء اصطناعي تابع لشركة CSW".
- لا تدّعي أبداً أنك موظف بشري، ولا توقّع باسم "فريق CSW".

دورك:
- ترحب بالعميل بأسلوب ودود ومهني.
- تجيب عن استفسارات الطلاب حول: الجامعات، البرامج، التخصصات (طب، هندسة، إدارة أعمال…)، الرسوم، المنح، التأشيرة، السكن، تكاليف المعيشة، إجراءات التقديم، ومعادلة الشهادات.
- إن لم تعرف معلومة دقيقة، اعترف بذلك واقترح على العميل ترك بياناته (الاسم، الدولة، التخصص، رقم التواصل) ليتواصل معه مستشار بشري من فريق CSW.
- لا تخترع أرقاماً أو حقائق. كن دقيقاً ومتحفظاً.
- ردودك قصيرة وواضحة (2–5 أسطر)، بنفس لغة العميل (عربي افتراضياً، أو إنجليزي/روسي حسب الرسالة).

معلومات الشركة:
- الاسم: CSW — Council for Study Worldwide
- الموقع: cswworld.com
- الخدمات: استشارات تعليمية مجانية، تسجيل وقبول جامعي، ترجمة وثائق، متابعة تأشيرة.
- الدول الرئيسية: روسيا، تركيا، قبرص، ماليزيا، ألمانيا، هنغاريا، إيطاليا، وغيرها.

ابدأ المحادثة بترحيب قصير إذا كانت أول رسالة.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const text: string = (body?.text || body?.message || '').toString().trim();
    const history: InMsg[] = Array.isArray(body?.history) ? body.history.slice(-20) : [];
    const locale: string = (body?.locale || 'ar').toString();

    if (!text) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + `\n\nاللغة المفضلة للرد: ${locale}` },
      ...history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content),
      { role: 'user', content: text },
    ];

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.6,
      }),
    });

    if (aiRes.status === 429) {
      return new Response(
        JSON.stringify({ ok: false, error: 'rate_limited', message: 'الخدمة مشغولة حاليًا، يرجى المحاولة بعد لحظات.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (aiRes.status === 402) {
      return new Response(
        JSON.stringify({ ok: false, error: 'payment_required', message: 'الخدمة غير متاحة مؤقتًا.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('AI gateway error', aiRes.status, errText);
      return new Response(
        JSON.stringify({ ok: false, error: 'ai_gateway_error', status: aiRes.status, detail: errText.slice(0, 400) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await aiRes.json();
    const reply: string =
      data?.choices?.[0]?.message?.content?.toString().trim() ||
      'عذرًا، لم أتمكن من معالجة طلبك الآن. يرجى المحاولة مرة أخرى.';

    return new Response(
      JSON.stringify({ ok: true, reply }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('csw-support-chat error', e);
    const message = e instanceof Error ? e.message : 'unknown';
    return new Response(
      JSON.stringify({ ok: false, error: 'internal', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
