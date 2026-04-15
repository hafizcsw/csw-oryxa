import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { handleCorsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { computeImageHash, uploadImageToStorage } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('[admin-generate-university-media] Starting request processing');
    
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      console.log('[admin-generate-university-media] Auth failed:', auth.error);
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { university_id, media_type = 'both', quality = 'high' } = await req.json();
    console.log('[admin-generate-university-media] Request params:', { university_id, media_type, quality });

    if (!university_id) {
      console.log('[admin-generate-university-media] Missing university_id');
      return new Response(JSON.stringify({ error: 'university_id required' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      console.error('[admin-generate-university-media] OPENAI_API_KEY not configured');
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured. Please add it to Supabase secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get university details
    console.log('[admin-generate-university-media] Fetching university details for:', university_id);
    const { data: university, error: uniError } = await supabase
      .from('universities')
      .select('id, name, country_id, city, main_image_url, logo_url')
      .eq('id', university_id)
      .single();

    if (uniError || !university) {
      console.error('[admin-generate-university-media] University not found:', uniError);
      return new Response(JSON.stringify({ error: 'University not found' }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log('[admin-generate-university-media] University found:', university.name);

    const results = {
      university_id,
      university_name: university.name,
      suggestions: [] as any[]
    };

    // Generate main image if needed
    if ((media_type === 'both' || media_type === 'main_image') && !university.main_image_url) {
      console.log('[admin-generate-university-media] Generating main image for:', university.name);
      
      // Try to search for real images first
      let useRealImage = false;
      let searchResults = null;

      try {
        console.log('[admin-generate-university-media] Searching for real images first');
        
        // Call search function directly with fetch instead of supabase.functions.invoke
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        const searchResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/search-university-images`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ 
              university_name: university.name,
              media_type: 'main_image'
            })
          }
        );

        const searchData = await searchResponse.json();
        if (searchData?.ok && searchData.primary_image) {
          console.log('[admin-generate-university-media] Found real image from search');
          searchResults = searchData;
          useRealImage = true;
        } else {
          console.log('[admin-generate-university-media] No real images found, will use AI generation');
        }
      } catch (error) {
        console.log('[admin-generate-university-media] Search failed, will use AI generation:', error);
      }

      if (useRealImage && searchResults) {
        // Save real image suggestion
        const primaryImage = searchResults.primary_image;
        const imageUrlHash = await computeImageHash(primaryImage.url);
        const source = primaryImage.ai_validated ? 'web_search_ai' : 'web_search';
        
        // Upload to storage if it's base64
        let storageUrl = primaryImage.url;
        if (primaryImage.url.startsWith('data:image')) {
          const fileName = `${university_id}/main-image-${Date.now()}.png`;
          storageUrl = await uploadImageToStorage(supabase, primaryImage.url, fileName);
          console.log('[MAIN IMAGE] Uploaded real image to storage:', storageUrl);
        }
        
        const { data: suggestion, error: insertError } = await supabase
          .from('university_media_suggestions')
          .upsert({
            university_id,
            media_type: 'main_image',
            image_url: storageUrl,
            image_url_hash: imageUrlHash,
            image_data: null,
            quality,
            width: primaryImage.width || 1536,
            height: primaryImage.height || 1024,
            status: 'pending',
            source,
            search_query: searchResults.search_query,
            original_url: primaryImage.url,
            confidence_score: primaryImage.ai_confidence ? primaryImage.ai_confidence / 100 : 0.8,
            alternative_urls: searchResults.alternative_images?.map((img: any) => img.url) || [],
            ai_validated: primaryImage.ai_validated || false,
            ai_confidence: primaryImage.ai_confidence || null,
            ai_reasoning: primaryImage.ai_reasoning || null,
            ai_detected_content: primaryImage.ai_detected_content || null,
            ai_recommendation: primaryImage.ai_recommendation || null,
            ai_model: primaryImage.ai_model || null,
            ai_provider: primaryImage.ai_provider || 'openai',
            ai_latency_ms: primaryImage.ai_latency_ms || null
          })
          .select()
          .single();

        if (!insertError && suggestion) {
          console.log('[admin-generate-university-media] Real image suggestion saved:', suggestion.id);
          results.suggestions.push({
            type: 'main_image',
            suggestion_id: suggestion.id,
            source: 'web_search',
            preview_url: searchResults.primary_image.thumbnail
          });
        } else {
          console.error('[admin-generate-university-media] Error saving real image suggestion:', insertError);
        }
      } else {
        // Fallback to AI generation
        const imagePrompt = `Professional architectural photograph of ${university.name} university main campus building and grounds. 

MUST INCLUDE:
- Grand university building facade with clear architectural details
- Manicured lawns, pathways, or courtyard in foreground
- Academic institutional architecture (columns, towers, arches, or modern academic design)
- Wide-angle exterior view showing the full building
- Bright daylight, clear sky, professional photography composition

ABSOLUTELY DO NOT INCLUDE:
- People, students, crowds, or any human figures
- Close-ups of individuals or portraits
- Street scenes, cars, traffic, or urban environment
- Clothing, fashion, or retail items
- Text, signs, or watermarks
- Interior rooms or classrooms
- Random buildings not related to universities

Style: Professional real estate/architectural photography, 16:9 aspect ratio, ultra high resolution, realistic photographic style`;
        
        try {
          console.log('[admin-generate-university-media] Calling OpenAI API for main image');
          const aiResponse = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "dall-e-3",
              prompt: imagePrompt,
              n: 1,
              size: "1792x1024",
              quality: "standard",
              response_format: "b64_json",
            })
          });

          if (aiResponse.ok) {
            console.log('[admin-generate-university-media] OpenAI API response OK for main image');
            const data = await aiResponse.json();
            const b64 = data.data?.[0]?.b64_json;
            const imageData = b64 ? `data:image/png;base64,${b64}` : null;
            
            if (imageData) {
              console.log('[admin-generate-university-media] Image data received, uploading to storage...');
              
              // Upload to storage
              const fileName = `${university_id}/main-image-ai-${Date.now()}.png`;
              const storageUrl = await uploadImageToStorage(supabase, imageData, fileName);
              console.log('[MAIN IMAGE] Uploaded AI image to storage:', storageUrl);
              
              // Save suggestion to database with storage URL
              const { data: suggestion, error: insertError } = await supabase
                .from('university_media_suggestions')
                .insert({
                  university_id,
                  media_type: 'main_image',
                  image_url: storageUrl,
                  image_data: null,
                  quality,
                  width: 1536,
                  height: 1024,
                  status: 'pending',
                  source: 'ai_generation',
                  confidence_score: 0.6
                })
                .select()
                .single();

              if (!insertError && suggestion) {
                console.log('[admin-generate-university-media] AI suggestion saved to DB:', suggestion.id);
                results.suggestions.push({
                  type: 'main_image',
                  suggestion_id: suggestion.id,
                  source: 'ai_generation',
                  preview_url: storageUrl
                });
              } else {
                console.error('[admin-generate-university-media] Error saving suggestion:', insertError);
              }
            } else {
              console.error('[admin-generate-university-media] No image data in AI response');
            }
          } else {
            const errorText = await aiResponse.text();
            console.error('[admin-generate-university-media] AI API error:', aiResponse.status, errorText);
          }
        } catch (error) {
          console.error('[admin-generate-university-media] Error generating main image:', error);
        }
      }
    } else {
      console.log('[admin-generate-university-media] Skipping main image generation:', { media_type, has_image: !!university.main_image_url });
    }

    // Generate logo if needed
    if ((media_type === 'both' || media_type === 'logo') && !university.logo_url) {
      console.log('[admin-generate-university-media] Generating logo for:', university.name);
      
      // Try to search for real logo first
      let useRealLogo = false;
      let logoSearchResults = null;

      try {
        console.log('[admin-generate-university-media] Searching for real logo first');
        
        // Call search function directly with fetch
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        const searchResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/search-university-images`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ 
              university_name: university.name,
              media_type: 'logo'
            })
          }
        );

        const logoSearchData = await searchResponse.json();
        if (logoSearchData?.ok && logoSearchData.primary_image) {
          console.log('[admin-generate-university-media] Found real logo from search');
          logoSearchResults = logoSearchData;
          useRealLogo = true;
        } else {
          console.log('[admin-generate-university-media] No real logo found, will use AI generation');
        }
      } catch (error) {
        console.log('[admin-generate-university-media] Logo search failed, will use AI generation:', error);
      }

      if (useRealLogo && logoSearchResults) {
        // Save real logo suggestion
        const primaryLogo = logoSearchResults.primary_image;
        const imageUrlHash = await computeImageHash(primaryLogo.url);
        const source = primaryLogo.ai_validated ? 'web_search_ai' : 'web_search';
        
        // Upload to storage if it's base64
        let storageUrl = primaryLogo.url;
        if (primaryLogo.url.startsWith('data:image')) {
          const fileName = `${university_id}/logo-${Date.now()}.png`;
          storageUrl = await uploadImageToStorage(supabase, primaryLogo.url, fileName);
          console.log('[LOGO] Uploaded real logo to storage:', storageUrl);
        }
        
        const { data: suggestion, error: insertError } = await supabase
          .from('university_media_suggestions')
          .upsert({
            university_id,
            media_type: 'logo',
            image_url: storageUrl,
            image_url_hash: imageUrlHash,
            image_data: null,
            quality,
            width: primaryLogo.width || 512,
            height: primaryLogo.height || 512,
            status: 'pending',
            source,
            search_query: logoSearchResults.search_query,
            original_url: primaryLogo.url,
            confidence_score: primaryLogo.ai_confidence ? primaryLogo.ai_confidence / 100 : 0.8,
            alternative_urls: logoSearchResults.alternative_images?.map((img: any) => img.url) || [],
            ai_validated: primaryLogo.ai_validated || false,
            ai_confidence: primaryLogo.ai_confidence || null,
            ai_reasoning: primaryLogo.ai_reasoning || null,
            ai_detected_content: primaryLogo.ai_detected_content || null,
            ai_recommendation: primaryLogo.ai_recommendation || null,
            ai_model: primaryLogo.ai_model || null,
            ai_provider: primaryLogo.ai_provider || 'openai',
            ai_latency_ms: primaryLogo.ai_latency_ms || null
          })
          .select()
          .single();

        if (!insertError && suggestion) {
          console.log('[admin-generate-university-media] Real logo suggestion saved:', suggestion.id);
          results.suggestions.push({
            type: 'logo',
            suggestion_id: suggestion.id,
            source: 'web_search',
            preview_url: logoSearchResults.primary_image.thumbnail
          });
        } else {
          console.error('[admin-generate-university-media] Error saving real logo suggestion:', insertError);
        }
      } else {
        // Fallback to AI generation
        const logoPrompt = `Professional university logo design for ${university.name}.

MUST BE:
- A formal institutional emblem or seal
- Centered on plain white or transparent background
- Academic design elements: shield, crest, laurel wreath, book, torch, or academic building silhouette
- Clean, professional, minimalist design
- Suitable for official documents and merchandise
- Square 1:1 aspect ratio, high resolution

DESIGN ELEMENTS TO INCLUDE:
- University name text integrated into design
- Academic symbols (graduation cap, books, columns, torch)
- Formal institutional aesthetic (like Harvard, Oxford, Cambridge style)
- Professional typography

ABSOLUTELY DO NOT INCLUDE:
- Photos of buildings or campuses
- Photos of people or students
- Street scenes or landscapes
- Fashion or clothing items
- Text overlays on photos
- Watermarks or stock photo elements

Style: Professional logo design, vector-style clarity, institutional emblem, formal academic identity`;
        
        try {
          console.log('[admin-generate-university-media] Calling OpenAI API for logo');
          const aiResponse = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "dall-e-3",
              prompt: logoPrompt,
              n: 1,
              size: "1024x1024",
              quality: "standard",
              response_format: "b64_json",
            })
          });

          if (aiResponse.ok) {
            console.log('[admin-generate-university-media] OpenAI API response OK for logo');
            const data = await aiResponse.json();
            const b64 = data.data?.[0]?.b64_json;
            const imageData = b64 ? `data:image/png;base64,${b64}` : null;
            
            if (imageData) {
              console.log('[admin-generate-university-media] Logo data received, uploading to storage...');
              
              // Upload to storage
              const fileName = `${university_id}/logo-ai-${Date.now()}.png`;
              const storageUrl = await uploadImageToStorage(supabase, imageData, fileName);
              console.log('[LOGO] Uploaded AI logo to storage:', storageUrl);
              
              // Save suggestion to database with storage URL
              const { data: suggestion, error: insertError } = await supabase
                .from('university_media_suggestions')
                .insert({
                  university_id,
                  media_type: 'logo',
                  image_url: storageUrl,
                  image_data: null,
                  quality,
                  width: 512,
                  height: 512,
                  status: 'pending',
                  source: 'ai_generation',
                  confidence_score: 0.6
                })
                .select()
                .single();

              if (!insertError && suggestion) {
                console.log('[admin-generate-university-media] AI logo suggestion saved to DB:', suggestion.id);
                results.suggestions.push({
                  type: 'logo',
                  suggestion_id: suggestion.id,
                  source: 'ai_generation',
                  preview_url: storageUrl
                });
              } else {
                console.error('[admin-generate-university-media] Error saving logo suggestion:', insertError);
              }
            } else {
              console.error('[admin-generate-university-media] No logo data in AI response');
            }
          } else {
            const errorText = await aiResponse.text();
            console.error('[admin-generate-university-media] AI API error for logo:', aiResponse.status, errorText);
          }
        } catch (error) {
          console.error('[admin-generate-university-media] Error generating logo:', error);
        }
      }
    } else {
      console.log('[admin-generate-university-media] Skipping logo generation:', { media_type, has_logo: !!university.logo_url });
    }

    console.log('[admin-generate-university-media] Generation complete. Results:', results);
    return new Response(
      JSON.stringify({
        ok: true,
        ...results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[admin-generate-university-media] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: String(error),
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});