import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function callAI(prompt: string): Promise<string> {
  const resp = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`AI API error ${resp.status}: ${errText}`);
  }

  const json = await resp.json();
  return json.choices?.[0]?.message?.content || "";
}

async function translateUniversityNames(): Promise<{ translated: number; errors: number; total: number }> {
  const { data: unis, error } = await supabase
    .from("universities")
    .select("id, name, name_ar")
    .eq("country_code", "RU")
    .not("name_ar", "is", null);

  if (error || !unis) return { translated: 0, errors: 1, total: 0 };

  const literalOnes = unis.filter(u => u.name_ar && /[A-Za-z]{3,}/.test(u.name_ar));
  if (literalOnes.length === 0) return { translated: 0, errors: 0, total: 0 };

  const namesList = literalOnes.map(u => `${u.id}|||${u.name}`).join("\n");

  const prompt = `You are a professional translator specializing in Russian university names to Arabic.
Translate each university name from English to proper Arabic. Follow these rules:
1. Translate descriptive words: State=الحكومية, University=جامعة, Institute=معهد, Academy=أكاديمية, Technical=التقنية, Medical=الطبية, Pedagogical=التربوية, Agricultural=الزراعية, Federal=الفيدرالية, National=الوطنية, Research=للأبحاث
2. Transliterate city/proper names to Arabic: Moscow=موسكو, Saint Petersburg=سانت بطرسبرغ, Tomsk=تومسك, Kazan=قازان, Novosibirsk=نوفوسيبيرسك, Vladivostok=فلاديفوستوك, Ural=الأورال, Siberian=السيبيرية, Volgograd=فولغوغراد, Smolensk=سمولينسك, Kursk=كورسك, Kaluga=كالوغا, Tambov=تامبوف, Ryazan=ريازان, Vladimir=فلاديمير, Ivanovo=إيفانوفو
3. Remove abbreviations in parentheses.
4. Use natural Arabic sentence structure for university names.

Input format: ID|||English Name
Output format: ID|||Arabic Name (one per line, no extra text)

Input:
${namesList}`;

  try {
    const text = await callAI(prompt);
    const lines = text.trim().split("\n").filter((l: string) => l.includes("|||"));
    let translated = 0;
    let errors = 0;

    for (const line of lines) {
      const parts = line.split("|||");
      const id = parts[0]?.trim();
      const nameAr = parts[1]?.trim();
      if (!id || !nameAr) { errors++; continue; }

      const { error: updateErr } = await supabase
        .from("universities")
        .update({ name_ar: nameAr })
        .eq("id", id);

      if (updateErr) {
        console.error(`Failed to update ${id}:`, updateErr);
        errors++;
      } else {
        translated++;
      }
    }

    return { translated, errors, total: literalOnes.length };
  } catch (e) {
    console.error("Translation error:", e);
    return { translated: 0, errors: 1, total: literalOnes.length };
  }
}

async function repairMissingProgramData(): Promise<{ repaired: number; errors: number; total_missing: number; checked: number }> {
  // Process in batches of 500
  let totalRepaired = 0;
  let totalErrors = 0;
  let totalChecked = 0;
  let hasMore = true;
  let lastId = 0;

  while (hasMore) {
    const { data: drafts, error } = await supabase
      .from("program_draft")
      .select("id, title, extracted_json, tuition_fee, degree_level, duration_months")
      .eq("country_code", "RU")
      .is("degree_level", null)
      .not("extracted_json", "is", null)
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(500);

    if (error || !drafts || drafts.length === 0) {
      hasMore = false;
      break;
    }

    lastId = drafts[drafts.length - 1].id;
    totalChecked += drafts.length;

    for (const draft of drafts) {
      const ej = draft.extracted_json as Record<string, unknown> | null;
      if (!ej) continue;

      const updates: Record<string, unknown> = {};

      // Extract degree_level from study_level or degree_level or degree
      if (!draft.degree_level) {
        const dl = String(ej.study_level || ej.degree_level || ej.degree || "").toLowerCase();
        if (dl.includes("bachelor") || dl.includes("бакалавр")) updates.degree_level = "bachelor";
        else if (dl.includes("master") || dl.includes("магистр")) updates.degree_level = "master";
        else if (dl.includes("specialist") || dl.includes("специалист")) updates.degree_level = "specialist";
        else if (dl.includes("phd") || dl.includes("doctor") || dl.includes("postgraduate") || dl.includes("аспирант")) updates.degree_level = "phd";
        else if (dl.includes("preparatory") || dl.includes("подготов")) updates.degree_level = "preparatory";
      }

      // Extract tuition_fee from tuition_amount
      if (!draft.tuition_fee && ej.tuition_amount) {
        const fee = Number(ej.tuition_amount);
        if (!isNaN(fee) && fee > 0) {
          updates.tuition_fee = fee;
          const curr = String(ej.tuition_currency || "RUB");
          updates.currency = curr;
          updates.currency_code = curr;
        }
      }

      // Extract duration_months
      if (!draft.duration_months && ej.duration_months) {
        const dm = Number(ej.duration_months);
        if (!isNaN(dm) && dm > 0) updates.duration_months = dm;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from("program_draft")
          .update(updates)
          .eq("id", draft.id);

        if (updateErr) totalErrors++;
        else totalRepaired++;
      }
    }

    if (drafts.length < 500) hasMore = false;
  }

  const { count } = await supabase
    .from("program_draft")
    .select("id", { count: "exact", head: true })
    .eq("country_code", "RU")
    .is("degree_level", null);

  return { repaired: totalRepaired, errors: totalErrors, total_missing: count || 0, checked: totalChecked };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    if (action === "translate_names") {
      const result = await translateUniversityNames();
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "repair_programs") {
      const result = await repairMissingProgramData();
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "full_repair") {
      const translateResult = await translateUniversityNames();
      const repairResult = await repairMissingProgramData();
      return new Response(JSON.stringify({ translate: translateResult, repair: repairResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use: translate_names, repair_programs, full_repair" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
