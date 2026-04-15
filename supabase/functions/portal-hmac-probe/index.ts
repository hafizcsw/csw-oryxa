import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = '2026-01-27_portal_probe_v1';
console.log(`[portal-hmac-probe] VERSION=${VERSION}`);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const HMAC_SECRET = Deno.env.get("PORTAL_KB_HMAC_SECRET") || Deno.env.get("HMAC_SHARED_SECRET") || "";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate HMAC signature
async function signRequest(body: string, ts: number, nonce: string): Promise<string> {
  const canonical = `${ts}.${nonce}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { test_type } = await req.json();
    
    let payload: Record<string, unknown>;
    let testName: string;
    
    // Build test payloads
    if (test_type === 'happy') {
      testName = 'TEST-P1-HAPPY';
      payload = {
        contract_version: 'kb_search_v1_3_final_hardened',
        request_id: `PORTAL_HAPPY_${Date.now()}`,
        display_lang: 'en',
        program_filters: {
          country_code: 'RU',
          tuition_usd_min: 0,
          tuition_usd_max: 50000,
          tuition_basis: 'year'
        },
        paging: { limit: 5, offset: 0 }
      };
    } else if (test_type === 'conflicts') {
      testName = 'TEST-P2-CONFLICTS';
      payload = {
        contract_version: 'kb_search_v1_3_final_hardened',
        request_id: `PORTAL_CONFLICTS_${Date.now()}`,
        display_lang: 'en',
        program_filters: {
          country_code: 'RU',
          country_codes: ['US', 'GB'],  // CONFLICT!
          tuition_usd_min: 0,
          tuition_usd_max: 50000,
          tuition_basis: 'year'
        },
        paging: { limit: 5 }
      };
    } else if (test_type === 'unknown') {
      testName = 'TEST-P3-UNKNOWN';
      payload = {
        contract_version: 'kb_search_v1_3_final_hardened',
        request_id: `PORTAL_UNKNOWN_${Date.now()}`,
        display_lang: 'en',
        program_filters: {
          fake_filter_xyz: 'test',      // UNKNOWN KEY!
          invalid_param_abc: 123,        // UNKNOWN KEY!
          tuition_usd_min: 0,
          tuition_usd_max: 50000,
          tuition_basis: 'year'
        },
        paging: { limit: 5 }
      };
    } else if (test_type === 'sot_smoke') {
      // ✅ SMOKE TEST: Tests all 7 SoT filters (study_mode, has_dorm, monthly_living, intake_months, scholarship, deadline)
      testName = 'TEST-P4-SOT-SMOKE';
      payload = {
        contract_version: 'kb_search_v1_3_final_hardened',
        request_id: `PORTAL_SOT_SMOKE_${Date.now()}`,
        display_lang: 'ar',
        program_filters: {
          // Tuition trio (mandatory)
          tuition_usd_min: 0,
          tuition_usd_max: 100000,
          tuition_basis: 'year',
          // SoT Filter #1: study_mode
          study_mode: 'on_campus',
          // SoT Filter #2: has_dorm
          has_dorm: true,
          // SoT Filter #3: monthly_living_usd_max
          monthly_living_usd_max: 2000,
          // SoT Filter #4: intake_months (array)
          intake_months: [9, 10],
          // SoT Filter #5: scholarship_available
          scholarship_available: true,
          // SoT Filter #6: scholarship_type (when available)
          scholarship_type: 'partial',
          // SoT Filter #7: deadline_before
          deadline_before: '2027-01-01'
        },
        paging: { limit: 10, offset: 0 }
      };
    } else if (test_type === 'sot_harvard') {
      // ✅ TARGETED TEST: Matches Harvard data exactly (has_dorm=true, scholarship_type=partial, study_mode=on_campus)
      testName = 'TEST-P5-SOT-HARVARD';
      payload = {
        contract_version: 'kb_search_v1_3_final_hardened',
        request_id: `PORTAL_SOT_HARVARD_${Date.now()}`,
        display_lang: 'ar',
        program_filters: {
          tuition_usd_min: 0,
          tuition_usd_max: 100000,
          tuition_basis: 'year',
          // Only test 3 filters that Harvard has
          has_dorm: true,
          scholarship_available: true,
          scholarship_type: 'partial'
        },
        paging: { limit: 10, offset: 0 }
      };
    } else if (test_type === 'sot_dorm_only') {
      // ✅ SIMPLE TEST: Just has_dorm filter
      testName = 'TEST-P6-SOT-DORM-ONLY';
      payload = {
        contract_version: 'kb_search_v1_3_final_hardened',
        request_id: `PORTAL_SOT_DORM_${Date.now()}`,
        display_lang: 'ar',
        program_filters: {
          tuition_usd_min: 0,
          tuition_usd_max: 100000,
          tuition_basis: 'year',
          has_dorm: true
        },
        paging: { limit: 10, offset: 0 }
      };
    } else {
      return Response.json({ error: 'Invalid test_type. Use: happy, conflicts, unknown, sot_smoke, sot_harvard, sot_dorm_only' }, { status: 400, headers: corsHeaders });
    }

    const bodyStr = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID();
    const signature = await signRequest(bodyStr, ts, nonce);

    console.log(`[portal-hmac-probe] Executing ${testName} request_id=${payload.request_id}`);

    // Call portal-programs-search with HMAC headers
    const response = await fetch(`${SUPABASE_URL}/functions/v1/portal-programs-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ts': String(ts),
        'x-nonce': nonce,
        'x-signature': signature,
        'x-request-id': payload.request_id as string,
      },
      body: bodyStr,
    });

    const responseBody = await response.json();
    
    console.log(`[portal-hmac-probe] ${testName} status=${response.status} ok=${responseBody.ok} request_id=${payload.request_id}`);

    return Response.json({
      test: testName,
      request_id: payload.request_id,
      http_status: response.status,
      response: responseBody,
      payload_sent: payload,
    }, { headers: corsHeaders });

  } catch (err) {
    console.error('[portal-hmac-probe] Error:', err);
    return Response.json({ error: String(err) }, { status: 500, headers: corsHeaders });
  }
});
