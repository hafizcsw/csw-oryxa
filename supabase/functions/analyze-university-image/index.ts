import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_url, university_name, media_type } = await req.json();

    if (!image_url || !university_name || !media_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Convert local paths to full URLs
    let processedImageUrl = image_url;
    
    // If it's a local path starting with /, convert to full URL
    // - /logos/... => public asset served by the web app
    // - anything else => university-images storage bucket public URL
    if (image_url.startsWith('/') && !image_url.startsWith('http')) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      if (!SUPABASE_URL) {
        throw new Error("SUPABASE_URL not configured");
      }

      if (image_url.startsWith('/logos/')) {
        const base = req.headers.get('origin') || req.headers.get('referer') || '';
        const origin = base ? base.split('/').slice(0, 3).join('/') : '';
        if (!origin) {
          return new Response(
            JSON.stringify({ ok: false, error: 'invalid_origin', message: 'Cannot resolve public asset origin' }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        processedImageUrl = `${origin}${image_url}`;
        console.log(`[analyze-university-image] Converted public asset path to URL:`, processedImageUrl);
      } else {
        // Build the public URL: {SUPABASE_URL}/storage/v1/object/public/university-images{path}
        const path = image_url; // Keep the leading /
        processedImageUrl = `${SUPABASE_URL}/storage/v1/object/public/university-images${path}`;
        console.log(`[analyze-university-image] Converted storage path to URL:`, processedImageUrl);
      }
    }
    
    console.log(`[analyze-university-image] Processing image URL:`, processedImageUrl.substring(0, 100));

    // Verify the image exists before sending to AI
    try {
      const checkResponse = await fetch(processedImageUrl, { method: 'HEAD' });
      if (!checkResponse.ok) {
        console.log(`[analyze-university-image] Image not accessible (${checkResponse.status}):`, processedImageUrl);
        return new Response(
          JSON.stringify({
            ok: false,
            error: "image_not_found",
            message: `Image not accessible at URL (status: ${checkResponse.status})`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (fetchError) {
      console.log(`[analyze-university-image] Failed to verify image:`, fetchError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "image_fetch_failed",
          message: "Could not verify image accessibility",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare the prompt based on media type with improved instructions
    const prompt = media_type === "logo"
      ? `You are an expert at identifying university logos. Analyze this image VERY CAREFULLY.

STRICT RULES FOR UNIVERSITY LOGOS:
1. A logo is a graphic design element (emblem, crest, seal, or wordmark)
2. It should be clean, professional, and clearly designed for branding
3. It must NOT be a photo of buildings, people, or campus scenes
4. It must NOT be a watermark or overlay on another image

REJECT if the image shows:
- Campus buildings, architecture, or facilities (even with a logo visible)
- People, students, or crowds
- Street scenes, landscapes, or outdoor photos
- Screenshots or website headers
- Generic stock photos

ACCEPT only if:
- The image is EXCLUSIVELY a logo/emblem/seal
- It has institutional design elements (crests, emblems, shields, typography)
- It looks like it could be used on official documents or merchandise
- The background is plain or transparent

University name: ${university_name}

First, describe EXACTLY what you see in the image in detail.
Then, determine if it meets the strict criteria for a university logo.

IMPORTANT: Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "is_valid": boolean,
  "confidence": number (0-100, be VERY strict),
  "reasoning": "explain your decision in detail",
  "detected_content": "detailed description of what you actually see",
  "recommendation": "keep" or "regenerate"
}`
      : `You are an expert at identifying university campus and building photos. Analyze this image VERY CAREFULLY.

STRICT RULES FOR CAMPUS/BUILDING PHOTOS:
1. Must show actual physical university facilities (buildings, campus, classrooms, labs, libraries)
2. Must look professional and representative
3. Should be architectural or environmental photography

REJECT if the image shows:
- Close-up photos of individual people or student portraits
- Logos, emblems, or graphic design elements
- Random street scenes unrelated to campus
- Low-quality or blurry images
- Watermarks or text overlays dominating the image

ACCEPT if:
- Shows university buildings, architecture, or campus grounds
- Professional quality photograph
- Clearly represents an educational facility
- Wide or medium shots of campus environment

University name: ${university_name}

First, describe EXACTLY what you see in the image in detail.
Then, determine if it meets the criteria for a campus/building photo.

IMPORTANT: Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "is_valid": boolean,
  "confidence": number (0-100, be VERY strict),
  "reasoning": "explain your decision in detail",
  "detected_content": "detailed description of what you actually see",
  "recommendation": "keep" or "regenerate"
}`;

    console.log(`[analyze-university-image] Analyzing ${media_type} for ${university_name}`);

    // Call OpenAI (GPT-4o with Vision)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: processedImageUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[analyze-university-image] Lovable AI error:`, response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Invalid Lovable AI key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Clean the content - remove markdown code blocks if present
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const analysis = JSON.parse(cleanContent);

    console.log(`[analyze-university-image] Analysis result:`, {
      university: university_name,
      media_type,
      is_valid: analysis.is_valid,
      confidence: analysis.confidence,
      recommendation: analysis.recommendation,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        analysis,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[analyze-university-image] Error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
