import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { university_id, logo_url, action } = body;

    // Handle batch fetch action
    if (action === 'fetch-missing-images') {
      // Get universities missing images or logos
      const { data: universities, error } = await supabase
        .from('universities')
        .select('id, name, country_id, main_image_url, logo_url, website')
        .or('main_image_url.is.null,logo_url.is.null')
        .eq('is_active', true)
        .limit(50);

      if (error) throw error;

      const results = [];
      const bingKey = Deno.env.get('BING_SEARCH_API_KEY');
      
      if (!bingKey) {
        return new Response(
          JSON.stringify({ error: 'BING_SEARCH_API_KEY not configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      for (const uni of universities || []) {
        const result: any = {
          id: uni.id,
          name: uni.name,
          hasImage: !!uni.main_image_url,
          hasLogo: !!uni.logo_url
        };

        // Search and download university image
        if (!uni.main_image_url) {
          try {
            const searchQuery = `${uni.name} university campus building exterior`;
            const searchResponse = await fetch(
              `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(searchQuery)}&count=1&imageType=Photo&size=Large&license=Public`,
              {
                headers: {
                  'Ocp-Apim-Subscription-Key': bingKey
                }
              }
            );

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              if (searchData.value && searchData.value.length > 0) {
                const imageUrl = searchData.value[0].contentUrl;
                
                try {
                  const imageResponse = await fetch(imageUrl);
                  const imageBlob = await imageResponse.blob();
                  const arrayBuffer = await imageBlob.arrayBuffer();
                  const uint8Array = new Uint8Array(arrayBuffer);

                  const fileName = `universities/${uni.id}-campus.jpg`;
                  const { error: uploadError } = await supabase.storage
                    .from('public')
                    .upload(fileName, uint8Array, {
                      contentType: 'image/jpeg',
                      upsert: true
                    });

                  if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                      .from('public')
                      .getPublicUrl(fileName);

                    await supabase
                      .from('universities')
                      .update({ main_image_url: publicUrl })
                      .eq('id', uni.id);

                    result.newImage = publicUrl;
                  }
                } catch (downloadError) {
                  console.error(`Failed to download image for ${uni.name}:`, downloadError);
                  result.imageError = 'Download failed';
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching image for ${uni.name}:`, error);
            const errMsg = error instanceof Error ? error.message : String(error);
            result.imageError = errMsg;
          }
        }

        // Search and download university logo
        if (!uni.logo_url) {
          try {
            const logoQuery = `${uni.name} university logo official`;
            const logoResponse = await fetch(
              `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(logoQuery)}&count=1&imageType=Clipart&size=Medium&license=Public`,
              {
                headers: {
                  'Ocp-Apim-Subscription-Key': bingKey
                }
              }
            );

            if (logoResponse.ok) {
              const logoData = await logoResponse.json();
              if (logoData.value && logoData.value.length > 0) {
                const logoUrl = logoData.value[0].contentUrl;
                
                try {
                  const logoImageResponse = await fetch(logoUrl);
                  const logoBlob = await logoImageResponse.blob();
                  const logoArrayBuffer = await logoBlob.arrayBuffer();
                  const logoUint8Array = new Uint8Array(logoArrayBuffer);

                  const logoFileName = `universities/${uni.id}-logo.png`;
                  const { error: logoUploadError } = await supabase.storage
                    .from('public')
                    .upload(logoFileName, logoUint8Array, {
                      contentType: 'image/png',
                      upsert: true
                    });

                  if (!logoUploadError) {
                    const { data: { publicUrl } } = supabase.storage
                      .from('public')
                      .getPublicUrl(logoFileName);

                    await supabase
                      .from('universities')
                      .update({ logo_url: publicUrl })
                      .eq('id', uni.id);

                    result.newLogo = publicUrl;
                  }
                } catch (downloadError) {
                  console.error(`Failed to download logo for ${uni.name}:`, downloadError);
                  result.logoError = 'Download failed';
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching logo for ${uni.name}:`, error);
            const errMsg = error instanceof Error ? error.message : String(error);
            result.logoError = errMsg;
          }
        }

        results.push(result);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return new Response(
        JSON.stringify({ 
          ok: true, 
          processed: results.length,
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Original single logo fetch logic
    if (!university_id || !logo_url) {
      throw new Error("university_id and logo_url are required");
    }

    if (!university_id || !logo_url) {
      throw new Error("university_id and logo_url are required");
    }

    // Fetch logo
    const response = await fetch(logo_url);
    if (!response.ok) throw new Error(`Failed to fetch logo: ${response.statusText}`);

    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Determine file extension
    const contentType = response.headers.get("content-type") || "image/png";
    const ext = contentType.split("/")[1] || "png";
    const filename = `${university_id}.${ext}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("logos")
      .upload(filename, uint8Array, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filename);

    // Update university
    await supabase
      .from("universities")
      .update({ logo_url: urlData.publicUrl })
      .eq("id", university_id);

    console.log(`[logos-fetch] Saved logo for university ${university_id}`);

    return new Response(
      JSON.stringify({ ok: true, logo_url: urlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[logos-fetch] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
