import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { findOfficialPages } from "../_shared/find-official-pages.ts";
import { fetchText } from "../_shared/extract-utils.ts";
import { extractTuitionFromText, validateTuitionData, computeHash } from "../_shared/tuition-extractor.ts";
import { runAuxAdapters } from "../_shared/tuition-aux-adapters.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Request {
  country_code?: string;
  limit?: number;
  audience?: "international" | "home";
  degree_level?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const {
      country_code,
      limit = 50,
      audience = "international",
      degree_level = "pg"
    } = await req.json() as Request;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[tuition-refresh] Starting: country=${country_code}, limit=${limit}`);

    // 1) جلب الجامعات المستهدفة
    let query = supabase
      .from("universities")
      .select("id, name, country_code, location, currency")
      .limit(limit);

    if (country_code) {
      query = query.eq("country_code", country_code);
    }

    const { data: universities, error } = await query;
    if (error) throw error;

    console.log(`[tuition-refresh] Found ${universities?.length || 0} universities`);

    let processed = 0;
    let changed = 0;
    let nochange = 0;
    let errors = 0;

    // 2) معالجة كل جامعة
    for (const uni of universities || []) {
      processed++;
      console.log(`[tuition-refresh] ${processed}/${universities?.length}: ${uni.name}`);

      try {
        // A) اكتشاف صفحة الرسوم
        const feeUrl = uni.location || await discoverFeeUrl(uni);
        if (!feeUrl) {
          throw new Error("no_fee_page_found");
        }

        console.log(`[tuition-refresh] Fee URL: ${feeUrl}`);

        // B) جلب المحتوى
        const pageContent = await fetchText(feeUrl);

        // C) استخراج البيانات
        const tuitionData = extractTuitionFromText(
          pageContent,
          uni.currency,
          "en"
        );

        console.log(`[tuition-refresh] Extracted:`, tuitionData);

        if (!validateTuitionData(tuitionData, 0.5)) {
          throw new Error("low_confidence_or_invalid_data");
        }

        // D) حساب hash
        const hash = await computeHash(
          `${tuitionData.amount}|${tuitionData.currency}|${tuitionData.academic_year}|${feeUrl}`
        );

        // E) مقارنة بالسابق
        const { data: lastSnapshot } = await supabase
          .from("tuition_snapshots")
          .select("*")
          .eq("university_id", uni.id)
          .eq("is_official", true)
          .order("captured_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let diffPercent: number | null = null;
        if (lastSnapshot?.amount && tuitionData.amount) {
          diffPercent = Math.abs(
            (tuitionData.amount - Number(lastSnapshot.amount)) / Number(lastSnapshot.amount)
          ) * 100;
        }

        // F) حفظ snapshot جديد
        const { data: newSnapshot } = await supabase
          .from("tuition_snapshots")
          .insert({
            university_id: uni.id,
            degree_level,
            audience,
            amount: tuitionData.amount,
            currency: tuitionData.currency,
            academic_year: tuitionData.academic_year,
            source_url: feeUrl,
            source_name: "official",
            is_official: true,
            content_hash: hash,
            confidence: tuitionData.confidence
          })
          .select()
          .single();

        if (!newSnapshot) throw new Error("failed_to_save_snapshot");

        // G) تحديد ما إذا كان تغييراً كبيراً
        if (!lastSnapshot || (diffPercent !== null && diffPercent > 10)) {
          changed++;
          console.log(`[tuition-refresh] ✓ CHANGED (${diffPercent?.toFixed(1)}%)`);

          // إنشاء مقترح
          await supabase.from("tuition_change_proposals").insert({
            university_id: uni.id,
            old_snapshot: lastSnapshot?.id ?? null,
            new_snapshot: newSnapshot.id,
            diff_percent: diffPercent ?? 100,
            reason: lastSnapshot ? "official_changed" : "initial_capture",
            status: diffPercent && diffPercent < 20 ? "auto_approved" : "pending"
          });

          // إذا موافق تلقائياً، حدّث consensus
          if (diffPercent && diffPercent < 20) {
            await supabase.from("tuition_consensus").upsert({
              university_id: uni.id,
              snapshot_id: newSnapshot.id,
              updated_at: new Date().toISOString()
            });
          }
        } else {
          nochange++;
          console.log(`[tuition-refresh] = NO CHANGE`);

          // تحديث consensus timestamp
          await supabase.from("tuition_consensus").upsert({
            university_id: uni.id,
            snapshot_id: newSnapshot.id,
            updated_at: new Date().toISOString()
          });
        }

        // H) المصادر الثانوية (بالتوازي)
        await runAuxAdapters(supabase, uni, degree_level, audience);

        // I) Telemetry
        await supabase.from("events").insert({
          name: "tuition_refresh_success",
          properties: {
            university_id: uni.id,
            diff_percent: diffPercent,
            changed: changed > 0
          }
        });
      } catch (error) {
        errors++;
        console.error(`[tuition-refresh] ✗ Error for ${uni.name}:`, error);

        await supabase.from("events").insert({
          name: "tuition_refresh_error",
          properties: {
            university_id: uni.id,
            error: String(error)
          }
        });
      }
    }

    console.log(`[tuition-refresh] Complete: ${processed} processed, ${changed} changed, ${nochange} unchanged, ${errors} errors`);

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        changed,
        nochange,
        errors
      }),
      {
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[tuition-refresh] Fatal error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" }
      }
    );
  }
});

/**
 * اكتشاف URL صفحة الرسوم
 */
async function discoverFeeUrl(uni: any): Promise<string | null> {
  if (!uni.location) return null;

  try {
    // استخدام دالة findOfficialPages الموجودة
    const COUNTRY_PROFILES: any = {
      "GB": { name: "United Kingdom", feeTerms: ["tuition", "fee", "fees"], admissionTerms: [], scholarshipTerms: [], currency: "GBP" },
      "US": { name: "United States", feeTerms: ["tuition", "fee", "fees"], admissionTerms: [], scholarshipTerms: [], currency: "USD" }
    };
    
    const profile = COUNTRY_PROFILES[uni.country_code] || {
      name: uni.country_code,
      feeTerms: ["tuition", "fee", "fees", "cost"],
      admissionTerms: [],
      scholarshipTerms: [],
      currency: uni.currency || "USD"
    };
    
    const result = await findOfficialPages(uni.location, profile);

    return result.feeUrl;
  } catch {
    return null;
  }
}
