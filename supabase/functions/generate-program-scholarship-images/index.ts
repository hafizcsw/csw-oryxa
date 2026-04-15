import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { type, id, name, metadata } = await req.json();
    
    if (!type || !id || !name) {
      throw new Error("Missing required parameters: type, id, name");
    }

    console.log(`[generate-image] Generating ${type} image for: ${name}`);

    // Generate image using OpenAI DALL-E
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    let prompt = "";
    if (type === 'program') {
      const subject = metadata?.subject || "education";
      const university = metadata?.university || name;
      prompt = `A professional, high-quality photograph of a university campus specializing in ${subject}. Show modern architecture, students studying, and academic facilities. Photorealistic, bright natural lighting, professional photography, 16:9 aspect ratio. ${university} style campus.`;
    } else if (type === 'scholarship') {
      const provider = metadata?.provider || name;
      const country = metadata?.country || "";
      prompt = `A professional, inspirational photograph representing educational scholarship and academic achievement at ${provider}${country ? ` in ${country}` : ''}. Show diverse students celebrating success, graduation ceremony, or modern university campus. Photorealistic, bright natural lighting, professional photography, 16:9 aspect ratio.`;
    }

    console.log(`[generate-image] Prompt: ${prompt}`);

    const aiResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1792x1024",
        quality: "standard",
        response_format: "b64_json",
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[generate-image] OpenAI API error:`, errorText);
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const b64 = aiData.data?.[0]?.b64_json;
    const imageUrl = b64 ? `data:image/png;base64,${b64}` : null;

    if (!imageUrl) {
      throw new Error("No image generated");
    }

    // Convert base64 to blob
    const base64Data = imageUrl.split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Upload to Supabase Storage
    const fileName = `${type}-${id}-${Date.now()}.png`;
    const bucketName = type === 'program' ? 'program-images' : 'scholarship-images';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, binaryData, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error(`[generate-image] Upload error:`, uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    // Update database
    const table = type === 'program' ? 'programs' : 'scholarships';
    const { error: updateError } = await supabase
      .from(table)
      .update({ image_url: publicUrl })
      .eq('id', id);

    if (updateError) {
      console.error(`[generate-image] Update error:`, updateError);
      throw updateError;
    }

    console.log(`[generate-image] Successfully generated and uploaded image for ${name}`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        imageUrl: publicUrl,
        type,
        id,
        name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[generate-image] Error:', error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error.message || String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
