// Adapters للمصادر الثانوية للأسعار
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeHash } from "./tuition-extractor.ts";

export interface UniLite {
  id: string;
  name: string;
  country_code: string;
}

export interface AuxTuitionData {
  amount: number;
  currency: string;
  academic_year?: string;
  source: string;
  link: string;
}

/**
 * تشغيل جميع adapters المصادر الثانوية
 */
export async function runAuxAdapters(
  supabase: SupabaseClient,
  university: UniLite,
  degreeLevel: string,
  audience: string
): Promise<void> {
  const adapters = [
    studyPortalsAdapter,
    topUniversitiesAdapter,
    uniRankAdapter,
    umultirankAdapter
  ];

  console.log(`[aux-adapters] Running for ${university.name}`);

  for (const adapter of adapters) {
    try {
      const data = await adapter(university);
      if (!data) continue;

      const hash = await computeHash(
        `${university.id}|${data.source}|${data.amount}|${data.currency}|${data.link}`
      );

      await supabase.from("tuition_snapshots").insert({
        university_id: university.id,
        degree_level: degreeLevel,
        audience,
        amount: data.amount,
        currency: data.currency,
        amount_usd: null,
        academic_year: data.academic_year ?? null,
        source_url: data.link,
        source_name: data.source,
        is_official: false,
        content_hash: hash,
        confidence: 0.6
      });

      console.log(`[aux-adapters] ✓ ${data.source} for ${university.name}`);
    } catch (error) {
      console.error(`[aux-adapters] ✗ ${adapter.name} failed:`, error);
    }
  }
}

/**
 * StudyPortals adapter (MastersPortal, BachelorsPortal)
 */
async function studyPortalsAdapter(
  uni: UniLite
): Promise<AuxTuitionData | null> {
  // في التنفيذ الفعلي، استخدم API أو web scraping
  // هذا مثال توضيحي
  console.log(`[studyportals] Checking ${uni.name}...`);
  
  // يمكن استخدام البحث في الموقع:
  // const searchUrl = `https://www.mastersportal.com/search/university/${encodeURIComponent(uni.name)}`;
  
  // للتبسيط، نرجع null (لم نجد بيانات)
  return null;
}

/**
 * TopUniversities (QS) adapter
 */
async function topUniversitiesAdapter(
  uni: UniLite
): Promise<AuxTuitionData | null> {
  console.log(`[topuniversities] Checking ${uni.name}...`);
  
  // const searchUrl = `https://www.topuniversities.com/universities/${uni.slug}`;
  
  return null;
}

/**
 * UniRank adapter
 */
async function uniRankAdapter(
  uni: UniLite
): Promise<AuxTuitionData | null> {
  console.log(`[unirank] Checking ${uni.name}...`);
  
  // const searchUrl = `https://www.4icu.org/reviews/${uni.country_code.toLowerCase()}/${uni.slug}.htm`;
  
  return null;
}

/**
 * U-Multirank adapter
 */
async function umultirankAdapter(
  uni: UniLite
): Promise<AuxTuitionData | null> {
  console.log(`[umultirank] Checking ${uni.name}...`);
  
  // const searchUrl = `https://www.umultirank.org/search?search=${encodeURIComponent(uni.name)}`;
  
  return null;
}
