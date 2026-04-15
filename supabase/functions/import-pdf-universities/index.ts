import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface UniversityData {
  name: string;
  country_slug: string;
  city?: string;
  logo_url?: string;
  is_active: boolean;
}

interface ProgramData {
  university_name: string;
  title: string;
  title_en: string;
  degree_level: string;
  tuition_fee?: number;
  tuition_currency?: string;
  language: string;
  ielts_requirement?: string;
  has_foundation_year: boolean;
  duration_months?: number;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  
  if (handleCorsPreflight(req)) {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  try {
    const { pdfText } = await req.json();
    
    if (!pdfText) {
      return new Response(
        JSON.stringify({ ok: false, error: "No PDF text provided" }),
        { status: 400, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    console.log("Extracting data from PDF text...");

    // استخدام Lovable AI لاستخراج البيانات بشكل منظم
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `أنت مساعد متخصص في استخراج بيانات الجامعات والبرامج الدراسية من النصوص.
استخرج جميع الجامعات والبرامج من النص المعطى وأعد البيانات بتنسيق JSON.

لكل جامعة:
- name: اسم الجامعة بالإنجليزية
- country_slug: الدولة (usa, canada, uk, ireland, new-zealand, australia)
- city: المدينة (إذا كانت متاحة)

لكل برنامج:
- university_name: اسم الجامعة بالإنجليزية
- title: اسم البرنامج بالعربية
- title_en: اسم البرنامج بالإنجليزية
- degree_level: المستوى (bachelor, master, phd, certificate, diploma)
- tuition_fee: الرسوم الدراسية السنوية (رقم فقط، بدون عملة)
- tuition_currency: العملة (USD, CAD, GBP, EUR, NZD, AUD)
- language: لغة الدراسة (English)
- ielts_requirement: متطلبات IELTS (مثل: 6.5, 7.0)
- has_foundation_year: هل يتوفر برنامج تحضيري (true/false)
- duration_months: مدة البرنامج بالأشهر

مهم جدًا:
- تأكد من أن أسماء الجامعات باللغة الإنجليزية بشكل صحيح
- استخدم degree_level الصحيح: bachelor, master, phd, certificate, diploma فقط
- الرسوم يجب أن تكون أرقام فقط بدون رموز
- country_slug يجب أن يكون أحد القيم: usa, canada, uk, ireland, new-zealand, australia`
          },
          {
            role: "user",
            content: `استخرج جميع الجامعات والبرامج من هذا النص:\n\n${pdfText.substring(0, 100000)}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_universities_and_programs",
            description: "Extract all universities and programs data",
            parameters: {
              type: "object",
              properties: {
                universities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      country_slug: { type: "string", enum: ["usa", "canada", "uk", "ireland", "new-zealand", "australia"] },
                      city: { type: "string" }
                    },
                    required: ["name", "country_slug"]
                  }
                },
                programs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      university_name: { type: "string" },
                      title: { type: "string" },
                      title_en: { type: "string" },
                      degree_level: { type: "string", enum: ["bachelor", "master", "phd", "certificate", "diploma"] },
                      tuition_fee: { type: "number" },
                      tuition_currency: { type: "string", enum: ["USD", "CAD", "GBP", "EUR", "NZD", "AUD"] },
                      language: { type: "string" },
                      ielts_requirement: { type: "string" },
                      has_foundation_year: { type: "boolean" },
                      duration_months: { type: "number" }
                    },
                    required: ["university_name", "title", "title_en", "degree_level", "language"]
                  }
                }
              },
              required: ["universities", "programs"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_universities_and_programs" } },
        max_completion_tokens: 16000
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ ok: false, error: "AI extraction failed", details: errorText }),
        { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("AI Response:", JSON.stringify(aiData, null, 2));

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ ok: false, error: "No data extracted from AI" }),
        { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log(`Extracted ${extractedData.universities?.length || 0} universities and ${extractedData.programs?.length || 0} programs`);

    // الاتصال بـ Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // إضافة الجامعات
    const universitiesAdded: string[] = [];
    const universitiesErrors: string[] = [];

    for (const uni of extractedData.universities || []) {
      try {
        // البحث عن الدولة
        const { data: countryData } = await supabase
          .from('countries')
          .select('id')
          .eq('slug', uni.country_slug)
          .single();

        if (!countryData) {
          universitiesErrors.push(`Country not found for slug: ${uni.country_slug}`);
          continue;
        }

        // التحقق من عدم وجود الجامعة مسبقًا
        const { data: existing } = await supabase
          .from('universities')
          .select('id')
          .eq('name', uni.name)
          .eq('country_id', countryData.id)
          .single();

        if (existing) {
          console.log(`University already exists: ${uni.name}`);
          continue;
        }

        // إضافة الجامعة
        const { error: insertError } = await supabase
          .from('universities')
          .insert({
            name: uni.name,
            country_id: countryData.id,
            city: uni.city,
            is_active: true
          });

        if (insertError) {
          universitiesErrors.push(`Failed to insert ${uni.name}: ${insertError.message}`);
        } else {
          universitiesAdded.push(uni.name);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        universitiesErrors.push(`Error processing ${uni.name}: ${errMsg}`);
      }
    }

    // إضافة البرامج
    const programsAdded: string[] = [];
    const programsErrors: string[] = [];

    for (const prog of extractedData.programs || []) {
      try {
        // البحث عن الجامعة
        const { data: uniData } = await supabase
          .from('universities')
          .select('id, country_id')
          .eq('name', prog.university_name)
          .single();

        if (!uniData) {
          programsErrors.push(`University not found: ${prog.university_name}`);
          continue;
        }

        // البحث عن degree_id
        let degreeId = null;
        if (prog.degree_level) {
          const { data: degreeData } = await supabase
            .from('degrees')
            .select('id')
            .ilike('slug', prog.degree_level)
            .single();
          
          if (degreeData) {
            degreeId = degreeData.id;
          }
        }

        // التحقق من عدم وجود البرنامج مسبقًا
        const { data: existing } = await supabase
          .from('programs')
          .select('id')
          .eq('title_en', prog.title_en)
          .eq('university_id', uniData.id)
          .single();

        if (existing) {
          console.log(`Program already exists: ${prog.title_en}`);
          continue;
        }

        // إضافة البرنامج
        const { error: insertError } = await supabase
          .from('programs')
          .insert({
            university_id: uniData.id,
            title: prog.title,
            title_en: prog.title_en,
            degree_id: degreeId,
            tuition_fee: prog.tuition_fee,
            tuition_currency: prog.tuition_currency,
            language: prog.language || 'English',
            ielts_requirement: prog.ielts_requirement,
            has_foundation_year: prog.has_foundation_year || false,
            duration_months: prog.duration_months,
            is_active: true
          });

        if (insertError) {
          programsErrors.push(`Failed to insert ${prog.title_en}: ${insertError.message}`);
        } else {
          programsAdded.push(prog.title_en);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        programsErrors.push(`Error processing ${prog.title_en}: ${errMsg}`);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        summary: {
          universities_added: universitiesAdded.length,
          universities_errors: universitiesErrors.length,
          programs_added: programsAdded.length,
          programs_errors: programsErrors.length
        },
        details: {
          universities_added: universitiesAdded,
          universities_errors: universitiesErrors,
          programs_added: programsAdded.slice(0, 10), // أول 10 فقط لتقليل الحجم
          programs_errors: programsErrors.slice(0, 10) // أول 10 فقط لتقليل الحجم
        }
      }),
      { status: 200, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
