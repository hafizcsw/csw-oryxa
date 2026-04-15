import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, id, locale = "ar" } = await req.json();

    if (!["university", "program", "scholarship", "country"].includes(type)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const table = type === "university" ? "universities" :
                  type === "program" ? "programs" :
                  type === "scholarship" ? "scholarships" : "countries";

    const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
    
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Simple rule-based suggestion (can be enhanced with AI later)
    const entityName = data.name || data.title;
    const country = data.country || data.country_name || "";
    const city = data.city || "";
    
    let title, description, h1;
    
    if (locale === "ar") {
      if (type === "university") {
        title = `${entityName} - ${city}${country ? ` | ${country}` : ''} | CSW`;
        description = `${entityName} في ${city}. استكشف البرامج والرسوم وشروط القبول والمنح الدراسية.`;
        h1 = entityName;
      } else if (type === "program") {
        title = `${entityName} - ${data.university_name || ''} | CSW`;
        description = `برنامج ${entityName}. تعرف على الرسوم والمدة وشروط القبول ومواعيد التقديم.`;
        h1 = entityName;
      } else if (type === "scholarship") {
        title = `${entityName} | منح دراسية 2026`;
        description = `${entityName}. تفاصيل المنحة والشروط والمواعيد والقيمة المالية.`;
        h1 = entityName;
      } else {
        title = `الدراسة في ${entityName}: جامعات ورسوم 2026`;
        description = `دليل شامل للدراسة في ${entityName}. أفضل الجامعات والبرامج والرسوم والمنح.`;
        h1 = `الدراسة في ${entityName}`;
      }
    } else {
      if (type === "university") {
        title = `${entityName} - ${city}${country ? ` | ${country}` : ''} | CSW`;
        description = `${entityName} in ${city}. Explore programs, fees, admissions and scholarships.`;
        h1 = entityName;
      } else if (type === "program") {
        title = `${entityName} - ${data.university_name || ''} | CSW`;
        description = `${entityName} program. Learn about fees, duration, requirements and deadlines.`;
        h1 = entityName;
      } else if (type === "scholarship") {
        title = `${entityName} | Scholarships 2026`;
        description = `${entityName}. Details about eligibility, deadlines and funding amount.`;
        h1 = entityName;
      } else {
        title = `Study in ${entityName}: Universities & Fees 2026`;
        description = `Complete guide to study in ${entityName}. Top universities, programs, fees and scholarships.`;
        h1 = `Study in ${entityName}`;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      title: title.slice(0, 60),
      description: description.slice(0, 155),
      h1: h1.slice(0, 70)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[seo-suggest] Error:', error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
