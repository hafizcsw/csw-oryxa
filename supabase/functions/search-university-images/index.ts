import { handleCorsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { withRetry, mapPool, meetsMinimumRequirements } from "../_shared/helpers.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

// Exact prompts from analyze-university-image for consistency
const logoPrompt = (universityName: string) => `You are an expert at identifying university logos. Analyze this image VERY CAREFULLY.

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

University name: ${universityName}

First, describe EXACTLY what you see in the image in detail.
Then, determine if it meets the strict criteria for a university logo.

Respond in JSON format:
{
  "is_valid": boolean,
  "confidence": number (0-100, be VERY strict),
  "reasoning": string (explain your decision in detail),
  "detected_content": string (detailed description of what you actually see),
  "recommendation": "keep" or "regenerate"
}`;

const campusPrompt = (universityName: string) => `You are an expert at identifying university campus and building photos. Analyze this image VERY CAREFULLY.

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

University name: ${universityName}

First, describe EXACTLY what you see in the image in detail.
Then, determine if it meets the criteria for a campus/building photo.

Respond in JSON format:
{
  "is_valid": boolean,
  "confidence": number (0-100, be VERY strict),
  "reasoning": string (explain your decision in detail),
  "detected_content": string (detailed description of what you actually see),
  "recommendation": "keep" or "regenerate"
}`;

/**
 * Quick check if image URL is accessible
 */
async function isImageAccessible(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const contentType = response.headers.get('content-type');
    return response.ok && (contentType?.startsWith('image/') ?? false);
  } catch {
    return false;
  }
}

/**
 * Analyze single image with OpenAI Vision using retry and timeout
 */
async function analyzeImageWithOpenAI(
  imageUrl: string, 
  prompt: string, 
  apiKey: string, 
  timeoutMs = Number(Deno.env.get('IMG_AI_TIMEOUT_MS') || 12000)
) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  
  try {
    const resp = await withRetry(() => fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert image analyzer. Always respond with valid JSON."
          },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      }),
      signal: controller.signal
    }), 3);
    
    clearTimeout(to);
    
    if (!resp.ok) {
      const errorBody = await resp.text();
      console.error('[search-university-images] OpenAI API Error:', {
        status: resp.status,
        statusText: resp.statusText,
        body: errorBody,
        imageUrl: imageUrl.substring(0, 100)
      });
      return { 
        ok: false, 
        error: `openai_${resp.status}`, 
        details: errorBody,
        latency_ms: Date.now() - started 
      };
    }
    
    const data = await resp.json();
    const analysis = JSON.parse(data.choices[0].message.content);
    
    return { 
      ok: true, 
      analysis, 
      latency_ms: Date.now() - started 
    };
  } catch (e) {
    clearTimeout(to);
    const errMsg = (e as any)?.message || String(e);
    return { 
      ok: false, 
      error: errMsg, 
      latency_ms: Date.now() - started 
    };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  // Admin authentication required - this function consumes paid APIs
  const authCheck = await requireAdmin(req);
  if (!authCheck.ok) {
    console.log('[search-university-images] Unauthorized access attempt');
    return new Response(
      JSON.stringify({ error: authCheck.error }),
      { 
        status: authCheck.status, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  try {
    const { university_name, media_type } = await req.json();
    console.log('[search-university-images] Admin', authCheck.user.id, 'searching for:', { university_name, media_type });

    if (!university_name) {
      return new Response(JSON.stringify({ error: 'university_name required' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const GOOGLE_SEARCH_API_KEY = Deno.env.get("GOOGLE_SEARCH_API_KEY");
    const GOOGLE_SEARCH_ENGINE_ID = Deno.env.get("GOOGLE_SEARCH_ENGINE_ID");

    console.log('[search-university-images] API Key present:', !!GOOGLE_SEARCH_API_KEY);
    console.log('[search-university-images] Engine ID present:', !!GOOGLE_SEARCH_ENGINE_ID);

    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
      console.log('[search-university-images] Google Search API not configured, will fallback to AI');
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'search_api_not_configured',
        fallback_to_ai: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Build search query based on media type
    let searchQuery = '';
    let siteRestrict = '';
    
    if (media_type === 'main_image') {
      searchQuery = `"${university_name}" university campus building official high quality`;
      const universityDomain = university_name.toLowerCase()
        .replace(/university|college|institute/gi, '')
        .replace(/\s+/g, '')
        .trim();
      siteRestrict = `site:${universityDomain}.edu OR site:${universityDomain}.ac.uk OR site:${universityDomain}.edu.tr`;
    } else if (media_type === 'logo') {
      searchQuery = `"${university_name}" university logo official transparent`;
      const universityDomain = university_name.toLowerCase()
        .replace(/university|college|institute/gi, '')
        .replace(/\s+/g, '')
        .trim();
      siteRestrict = `site:${universityDomain}.edu OR site:${universityDomain}.ac.uk OR site:${universityDomain}.edu.tr`;
    } else {
      searchQuery = `"${university_name}" university official`;
    }

    console.log('[search-university-images] Search query:', searchQuery);

    // Call Google Custom Search API
    const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
    searchUrl.searchParams.append('key', GOOGLE_SEARCH_API_KEY);
    searchUrl.searchParams.append('cx', GOOGLE_SEARCH_ENGINE_ID);
    searchUrl.searchParams.append('q', searchQuery);
    searchUrl.searchParams.append('searchType', 'image');
    searchUrl.searchParams.append('num', '10');
    searchUrl.searchParams.append('imgSize', 'xxlarge');
    searchUrl.searchParams.append('imgType', 'photo');
    searchUrl.searchParams.append('safe', 'active');

    const searchResponse = await fetch(searchUrl.toString());
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('[search-university-images] Google Search API error:', searchResponse.status);
      
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'search_api_error',
        details: errorText,
        fallback_to_ai: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.items || searchData.items.length === 0) {
      console.log('[search-university-images] No images found, will fallback to AI');
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'no_images_found',
        fallback_to_ai: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Extract and filter images
    const images = searchData.items.map((item: any) => ({
      url: item.link,
      thumbnail: item.image?.thumbnailLink,
      width: item.image?.width,
      height: item.image?.height,
      source: item.image?.contextLink,
      title: item.title
    }));
    
    const filteredImages = images.filter((img: any) => {
      if (img.width < 1024 || img.height < 768) return false;
      if (img.title?.toLowerCase().includes('watermark') || 
          img.title?.toLowerCase().includes('stock') ||
          img.title?.toLowerCase().includes('getty') ||
          img.title?.toLowerCase().includes('shutterstock')) return false;
      return true;
    });

    console.log('[search-university-images] Found', filteredImages.length, 'images after initial filtering');

    if (filteredImages.length === 0) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'no_quality_images_found',
        fallback_to_ai: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // === ADD OPENAI VALIDATION LAYER ===
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const ALLOW_UNVALIDATED_FALLBACK = (Deno.env.get("ALLOW_UNVALIDATED_FALLBACK") || "false") === "true";
    const POOL = Number(Deno.env.get("IMG_AI_POOL") || 3);
    const BATCH = Number(Deno.env.get("IMG_AI_BATCH") || 5);
    const MIN_CONF = Number(Deno.env.get("IMG_AI_MIN_CONFIDENCE") || 70);
    
    let fallbackUsed = false;
    
    if (!OPENAI_API_KEY) {
      console.log('[search-university-images] OpenAI not configured, returning unvalidated results');
      return new Response(JSON.stringify({ 
        ok: true, 
        images: filteredImages,
        primary_image: filteredImages[0],
        alternative_images: filteredImages.slice(1),
        fallback_used: true 
      }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const prompt = media_type === 'logo' 
      ? logoPrompt(university_name) 
      : campusPrompt(university_name);
    
    const target = filteredImages.slice(0, Math.max(10, BATCH));
    
    console.log('[search-university-images] Starting OpenAI validation for', target.length, 'images');
    
    // Process images in parallel and collect results
    const results = await mapPool(target, POOL, async (img: any) => {
      if (!meetsMinimumRequirements(img, media_type)) {
        console.log('[search-university-images] Image failed minimum requirements:', img.url.substring(0, 50));
        return null;
      }
      
      // Check if image is accessible
      const accessible = await isImageAccessible(img.url);
      if (!accessible) {
        console.log('[search-university-images] Image not accessible:', img.url.substring(0, 50));
        return null;
      }
      
      const res = await analyzeImageWithOpenAI(img.url, prompt, OPENAI_API_KEY);
      
      if (!res.ok) {
        console.log('[search-university-images] OpenAI analysis failed:', {
          error: res.error,
          details: res.details,
          imageUrl: img.url.substring(0, 50)
        });
        fallbackUsed = true;
        
        // Return unvalidated image
        return {
          ...img,
          ai_validated: false,
          ai_error: res.error,
          ai_note: "Image found via Google Search but could not be validated by AI"
        };
      }
      
      const a = res.analysis;
      
      if (a.is_valid && a.confidence >= MIN_CONF) {
        console.log('[search-university-images] Image validated:', {
          url: img.url.substring(0, 50),
          confidence: a.confidence,
          recommendation: a.recommendation
        });
        
        return {
          ...img,
          ai_validated: true,
          ai_confidence: a.confidence,
          ai_reasoning: a.reasoning,
          ai_detected_content: a.detected_content,
          ai_recommendation: a.recommendation,
          ai_model: "gpt-4o-mini",
          ai_provider: "openai",
          ai_latency_ms: res.latency_ms
        };
      } else {
        console.log('[search-university-images] Image rejected:', {
          url: img.url.substring(0, 50),
          is_valid: a.is_valid,
          confidence: a.confidence
        });
        
        // Return as unvalidated
        return {
          ...img,
          ai_validated: false,
          ai_confidence: a.confidence,
          ai_note: `Rejected by AI: ${a.reasoning}`
        };
      }
    });
    
    // Filter out null results and separate validated from unvalidated
    const allImages = results.filter(r => r !== null);
    const validated = allImages.filter((img: any) => img.ai_validated === true);
    const unvalidated = allImages.filter((img: any) => img.ai_validated === false);
    
    console.log('[search-university-images] Validation complete:', {
      validated: validated.length,
      unvalidated: unvalidated.length,
      total: allImages.length,
      all_results: results.length,
      null_count: results.filter(r => r === null).length
    });
    
    // Use validated images first, then unvalidated, then fallback to all filtered images
    const finalImages = validated.length > 0 
      ? validated 
      : unvalidated.length > 0
        ? unvalidated
        : filteredImages.slice(0, 5).map((img: any) => ({
            ...img,
            ai_validated: false,
            ai_note: "Real image from Google Search (AI validation unavailable)"
          }));
    
    if (!finalImages.length) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "no_valid_images", 
        fallback_to_ai: true 
      }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      search_query: searchQuery,
      images: finalImages,
      primary_image: finalImages[0],
      alternative_images: finalImages.slice(1),
      fallback_used: fallbackUsed
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('[search-university-images] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: message,
      fallback_to_ai: true 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, 
      status: 500 
    });
  }
});
