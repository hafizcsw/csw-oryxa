import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { limit = 5 } = await req.json().catch(() => ({}));

    // Get countries without images
    const { data: countries, error } = await supabase
      .from("countries")
      .select("id, slug, name_en, name_ar")
      .or("image_url.is.null,image_url.eq.")
      .order("display_order", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) throw error;
    if (!countries || countries.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "All countries have images", generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[gen-country-imgs] Generating images for ${countries.length} countries`);

    const results: any[] = [];

    for (const country of countries) {
      const name = country.name_en || country.name_ar;
      console.log(`[gen-country-imgs] Generating image for: ${name}`);

      try {
        // Generate image using Gemini Banana
        const aiResponse = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: `Generate a beautiful, high-quality landscape photograph of ${name}. Show the most iconic and recognizable landmark or natural scenery of this country. The image should be vibrant, professional, and suitable for a travel/education website header. Wide aspect ratio, cinematic lighting, no text or watermarks.`,
            n: 1,
            size: "1792x1024",
            quality: "standard",
            response_format: "b64_json",
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`[gen-country-imgs] AI error for ${name}:`, aiResponse.status, errText);
          results.push({ country: name, status: "failed", error: `AI ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const b64 = aiData.data?.[0]?.b64_json;
        const imageData = b64 ? `data:image/png;base64,${b64}` : null;

        if (!imageData) {
          console.error(`[gen-country-imgs] No image returned for ${name}`);
          results.push({ country: name, status: "failed", error: "No image in response" });
          continue;
        }

        // Extract base64 data
        const base64Match = imageData.match(/^data:image\/([\w+]+);base64,(.+)$/);
        if (!base64Match) {
          results.push({ country: name, status: "failed", error: "Invalid image format" });
          continue;
        }

        const ext = base64Match[1] === "png" ? "png" : "webp";
        const base64Data = base64Match[2];

        // Decode base64 to Uint8Array
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Upload to storage
        const filePath = `${country.slug}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("country-images")
          .upload(filePath, bytes, {
            contentType: `image/${ext}`,
            upsert: true,
          });

        if (uploadError) {
          console.error(`[gen-country-imgs] Upload error for ${name}:`, uploadError);
          results.push({ country: name, status: "failed", error: uploadError.message });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("country-images")
          .getPublicUrl(filePath);

        // Update country record
        const { error: updateError } = await supabase
          .from("countries")
          .update({ image_url: urlData.publicUrl })
          .eq("id", country.id);

        if (updateError) {
          console.error(`[gen-country-imgs] DB update error for ${name}:`, updateError);
          results.push({ country: name, status: "failed", error: updateError.message });
          continue;
        }

        console.log(`[gen-country-imgs] ✅ ${name} done`);
        results.push({ country: name, status: "success", url: urlData.publicUrl });

        // Delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[gen-country-imgs] Exception for ${name}:`, msg);
        results.push({ country: name, status: "failed", error: msg });
      }
    }

    const successful = results.filter((r) => r.status === "success").length;
    console.log(`[gen-country-imgs] Done: ${successful}/${results.length} successful`);

    return new Response(
      JSON.stringify({ ok: true, generated: successful, total: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[gen-country-imgs] Fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
