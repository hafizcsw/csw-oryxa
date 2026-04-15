import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const { entries, force } = await req.json();
    if (!entries?.length) return json({ ok: false, error: "no entries" }, 400);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;
    const errors: any[] = [];

    for (const entry of entries) {
      const { name, website } = entry;
      if (!name || !website || website === "http://http:/") continue;

      try {
        // Try exact match first (case-insensitive)
        let { data: unis } = await supabase
          .from("universities")
          .select("id, website")
          .ilike("name", name.trim())
          .eq("is_active", true)
          .limit(1);

        if (!unis?.length) {
          // Try without "The " prefix
          const altName = name.trim().replace(/^The /i, "");
          if (altName !== name.trim()) {
            const { data: unis2 } = await supabase
              .from("universities")
              .select("id, website")
              .ilike("name", altName)
              .eq("is_active", true)
              .limit(1);
            unis = unis2;
          }
        }

        if (!unis?.length) {
          notFound++;
          continue;
        }

        const target = unis[0];

        // Skip if already has same website
        if (target.website === website) {
          skipped++;
          continue;
        }

        // In non-force mode, skip if already has a website
        if (!force && target.website && target.website.trim() !== "") {
          skipped++;
          continue;
        }

        // In force mode, clear conflicting host first
        if (force) {
          const host = extractHost(website);
          if (host) {
            // Clear website from any other university with same host
            await supabase
              .from("universities")
              .update({ website: null })
              .eq("website_host", host)
              .neq("id", target.id);
          }
        } else {
          const host = extractHost(website);
          if (host) {
            const { data: existing } = await supabase
              .from("universities")
              .select("id")
              .eq("website_host", host)
              .neq("id", target.id)
              .limit(1);
            
            if (existing?.length) {
              skipped++;
              continue;
            }
          }
        }

        const { error } = await supabase
          .from("universities")
          .update({ website })
          .eq("id", target.id);

        if (error) {
          if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
            skipped++;
          } else {
            errors.push({ name, error: error.message?.slice(0, 100) });
          }
        } else {
          updated++;
        }
      } catch (e: any) {
        errors.push({ name, error: e?.message?.slice(0, 100) });
      }
    }

    return json({ ok: true, updated, skipped, notFound, errors: errors.slice(0, 20), total: entries.length });
  } catch (err: any) {
    return json({ ok: false, error: err?.message }, 500);
  }
});

function extractHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "") + "/";
  } catch {
    return null;
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
