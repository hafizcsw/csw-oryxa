import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    const match = filename.match(/^(\w+)(?:-(\d+))?\.xml$/);
    if (!match) {
      return new Response('Invalid sitemap name', { 
        status: 400,
        headers: corsHeaders,
      });
    }

    const kind = match[1];
    const validKinds = ['countries', 'universities', 'programs', 'scholarships'];
    if (!validKinds.includes(kind)) {
      return new Response('Invalid sitemap kind', { 
        status: 400,
        headers: corsHeaders,
      });
    }

    const fileIndex = match[2] ? parseInt(match[2]) - 1 : 0;
    const limit = 50000;
    const offset = fileIndex * limit;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { data, error } = await supabase.rpc('sitemap_urls', {
      _kind: kind,
      _limit: limit,
      _offset: offset,
    });

    if (error) {
      console.error('Sitemap RPC error:', error);
      return new Response('Error generating sitemap', { 
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!data || data.length === 0) {
      return new Response('No URLs found', { 
        status: 404,
        headers: corsHeaders,
      });
    }

    const urls = data.map((item: any) => `
  <url>
    <loc>${item.loc}</loc>
    <lastmod>${new Date(item.lastmod).toISOString().split('T')[0]}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: corsHeaders,
    });
  }
});
