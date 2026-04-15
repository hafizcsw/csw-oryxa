import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProviderConfig {
  product: string;
  phone: string;
  token: string;
}

async function sendWhatsApp(cfg: ProviderConfig, to: string, text: string) {
  try {
    // Maytapi example - adjust for your provider
    const url = `https://api.maytapi.com/api/${cfg.product}/${cfg.phone}/sendMessage`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-maytapi-key": cfg.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        message: text,
      }),
    });

    const ok = response.ok;
    const body = await response.text().catch(() => "");

    return {
      ok,
      status: response.status,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: String(error),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Check if WhatsApp is enabled
    const { data: flags } = await supabase
      .from("feature_flags")
      .select("key,value")
      .in("key", ["whatsapp_enabled"]);

    const waFlag = flags?.find((x) => x.key === "whatsapp_enabled");
    const waEnabled = waFlag?.value?.enabled === true;

    if (!waEnabled) {
      console.log("[whatsapp-dispatch] WhatsApp is disabled");
      return new Response(
        JSON.stringify({ ok: true, reason: "wa_disabled", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const ratePerMin = waFlag?.value?.rate_per_min ?? 10;
    const maxRetries = 5;

    // Get provider config from environment
    const providerConfig: ProviderConfig = {
      product: Deno.env.get("MAYTAPI_PRODUCT_ID") || "",
      phone: Deno.env.get("MAYTAPI_PHONE_ID") || "",
      token: Deno.env.get("MAYTAPI_TOKEN") || "",
    };

    if (!providerConfig.product || !providerConfig.phone || !providerConfig.token) {
      console.error("[whatsapp-dispatch] WhatsApp provider not configured");
      return new Response(
        JSON.stringify({ ok: false, error: "provider_not_configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Pull pending items (rate limited)
    const { data: items } = await supabase
      .from("integration_outbox")
      .select("*")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(ratePerMin);

    if (!items || items.length === 0) {
      console.log("[whatsapp-dispatch] No pending items");
      return new Response(
        JSON.stringify({ ok: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`[whatsapp-dispatch] Processing ${items.length} items`);

    const results = [];
    for (const item of items) {
      const app = item.payload?.application || item.payload?.lead;
      const privacyConsent = !!(app?.privacy_consent);
      const whatsappOptIn = !!(app?.whatsapp_opt_in);
      const phone = app?.phone;
      const text = item.payload?.text || "مرحبا! هذا تذكير لطيف بشأن طلبك. سنبقى على تواصل.";

      // Check consent
      if (!privacyConsent || !whatsappOptIn || !phone) {
        console.warn(
          `[whatsapp-dispatch] Item ${item.id} missing consent or phone`
        );
        await supabase
          .from("integration_outbox")
          .update({
            status: "error",
            last_error: "no_consent_or_phone",
          })
          .eq("id", item.id);
        continue;
      }

      const startTime = performance.now();
      const result = await sendWhatsApp(providerConfig, phone, text);
      const duration = Math.round(performance.now() - startTime);

      if (result.ok) {
        // Success
        await supabase
          .from("integration_outbox")
          .update({
            status: "sent",
            attempts: (item.attempts || 0) + 1,
            last_error: null,
          })
          .eq("id", item.id);

        await supabase.from("events").insert({
          name: "whatsapp_dispatch_sent",
          properties: {
            outbox_id: item.id,
            status: result.status,
            duration_ms: duration,
          },
        });

        results.push({ id: item.id, sent: true });
        console.log(`[whatsapp-dispatch] Sent item ${item.id}`);
      } else {
        // Failure - retry with exponential backoff
        const attempts = (item.attempts || 0) + 1;
        const backoffSeconds = Math.min(300, Math.pow(2, Math.min(attempts, 8)));
        const nextAttempt = new Date(
          Date.now() + backoffSeconds * 1000
        ).toISOString();

        await supabase
          .from("integration_outbox")
          .update({
            status: attempts >= maxRetries ? "error" : "pending",
            attempts,
            last_error: `status=${result.status} ${result.body?.slice?.(0, 160) || ""}`,
            next_attempt_at: nextAttempt,
          })
          .eq("id", item.id);

        await supabase.from("events").insert({
          name: "whatsapp_dispatch_error",
          properties: {
            outbox_id: item.id,
            status: result.status,
            duration_ms: duration,
            attempts,
          },
        });

        results.push({ id: item.id, sent: false });
        console.error(
          `[whatsapp-dispatch] Failed item ${item.id}, status: ${result.status}`
        );
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[whatsapp-dispatch] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
