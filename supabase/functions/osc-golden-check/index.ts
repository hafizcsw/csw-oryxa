import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GOLDEN_TESTS, validateGoldenTests } from "../_shared/golden-tests.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const url = new URL(req.url);
  const parserVersion = url.searchParams.get("parser_version") || undefined;

  const results = await validateGoldenTests(db, { parser_version: parserVersion });
  const allPass = results.every(r => r.pass);

  return new Response(
    JSON.stringify({
      status: allPass ? "PASS" : "FAIL",
      tests: results.length,
      passed: results.filter(r => r.pass).length,
      failed: results.filter(r => !r.pass).length,
      results,
      golden_cases: GOLDEN_TESTS.map(t => ({ id: t.id, university: t.university, class: t.class })),
    }),
    {
      status: allPass ? 200 : 422,
      headers: { ...corsHeaders, "content-type": "application/json" },
    },
  );
});
