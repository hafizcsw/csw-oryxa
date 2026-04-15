import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * crawl-logo-worker: Fetches university logos from official sites, UniRanks, or QS.
 * Called by crawl-runner-tick or manually via admin trigger.
 * Stores logos in university-logos bucket, updates via rpc_set_university_logo.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 🔒 Internal-only: reject any request not bearing the service_role key
  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${SRV_KEY}`) {
    return new Response(
      JSON.stringify({ ok: false, error: "forbidden", trace_id: `logo-${Date.now()}` }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SRV_KEY);

  let limit = 10;
  let traceId = `logo-${Date.now()}`;
  try {
    const body = await req.json().catch(() => ({}));
    limit = body?.limit ?? 10;
    traceId = body?.trace_id ?? traceId;
  } catch {}

  try {
    // Read crawl_policy for logo_source_order
    const { data: policySetting } = await supabase
      .from("crawl_settings")
      .select("value")
      .eq("key", "crawl_policy")
      .single();

    const logoSourceOrder: string[] = policySetting?.value?.logo_source_order ?? ["official", "uniranks", "qs"];

    // Get universities missing logos
    const { data: unis, error } = await supabase
      .from("universities")
      .select("id, name, website, uniranks_profile_url, qs_profile_url")
      .is("logo_url", null)
      .eq("is_active", true)
      .limit(limit);

    if (error) throw error;
    if (!unis?.length) {
      return json({ ok: true, processed: 0, trace_id: traceId });
    }

    let processed = 0;
    const results: any[] = [];

    for (const uni of unis) {
      let logoUrl: string | null = null;
      let source: string | null = null;

      for (const src of logoSourceOrder) {
        if (logoUrl) break;

        if (src === "official" && uni.website) {
          logoUrl = await extractLogoFromPage(uni.website);
          if (logoUrl) source = "official";
        }
        if (src === "uniranks" && uni.uniranks_profile_url) {
          logoUrl = await extractLogoFromPage(uni.uniranks_profile_url);
          if (logoUrl) source = "uniranks";
        }
        if (src === "qs" && uni.qs_profile_url) {
          logoUrl = await extractLogoFromPage(uni.qs_profile_url);
          if (logoUrl) source = "qs";
        }
      }

      if (logoUrl) {
        try {
          // Download image
          const imgRes = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) });
          if (!imgRes.ok) { await imgRes.text(); continue; }

          const blob = await imgRes.blob();
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);

          // Hash for dedup
          const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
          const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

          const ext = guessExt(imgRes.headers.get("content-type"));
          const fileName = `${uni.id}/${hash}.${ext}`;

          // Upload to bucket
          const { error: uploadErr } = await supabase.storage
            .from("university-logos")
            .upload(fileName, bytes, {
              contentType: imgRes.headers.get("content-type") || "image/png",
              upsert: true,
            });

          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage
              .from("university-logos")
              .getPublicUrl(fileName);

            // Update via RPC
            await supabase.rpc("rpc_set_university_logo", {
              p_university_id: uni.id,
              p_logo_url: publicUrl,
              p_source: source,
            });

            processed++;
            results.push({ id: uni.id, name: uni.name, logo: publicUrl, source });
          }
        } catch (e: any) {
          console.error(`Logo download failed for ${uni.name}:`, e?.message);
          results.push({ id: uni.id, name: uni.name, error: e?.message?.slice(0, 100) });
        }
      } else {
        results.push({ id: uni.id, name: uni.name, error: "no_logo_found" });
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    }

    return json({ ok: true, processed, total: unis.length, results, trace_id: traceId });
  } catch (err: any) {
    console.error("[crawl-logo-worker] Error:", err);
    return json({ ok: false, error: err?.message, trace_id: traceId }, 500);
  }
});

// Extract logo URL from an HTML page using og:image, favicon, or img heuristics
async function extractLogoFromPage(pageUrl: string): Promise<string | null> {
  try {
    const r = await fetch(pageUrl, {
      headers: { "User-Agent": "LavistaCrawler/1.0" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!r.ok) { await r.text(); return null; }

    const html = await r.text();
    const origin = new URL(pageUrl).origin;

    // 1. og:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch?.[1]) return resolveUrl(ogMatch[1], origin);

    // 2. apple-touch-icon
    const touchMatch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
    if (touchMatch?.[1]) return resolveUrl(touchMatch[1], origin);

    // 3. <img> with logo/brand in class/id/alt
    const logoImgMatch = html.match(/<img[^>]+(class|id|alt)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i)
      || html.match(/<img[^>]+src=["']([^"']+)["'][^>]+(class|id|alt)=["'][^"']*logo[^"']*["']/i);
    if (logoImgMatch) {
      const src = logoImgMatch[2] || logoImgMatch[1];
      if (src && !src.startsWith("data:")) return resolveUrl(src, origin);
    }

    // 4. favicon as last resort
    const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
    if (faviconMatch?.[1]) return resolveUrl(faviconMatch[1], origin);

    return null;
  } catch {
    return null;
  }
}

function resolveUrl(href: string, origin: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("/")) return origin + href;
  return origin + "/" + href;
}

function guessExt(contentType: string | null): string {
  if (!contentType) return "png";
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "png";
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
