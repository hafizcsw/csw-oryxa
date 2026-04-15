import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const g = await requireAdmin(req);
    if (!g.ok) {
      return new Response(JSON.stringify({ ok: false, error: g.error }), {
        status: g.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { urls } = await req.json();
    
    if (!urls || !Array.isArray(urls)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'urls array required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const results = [];
    const baseUrl = Deno.env.get('SITE_URL') || 'https://your-site.com';

    for (const path of urls.slice(0, 100)) { // Limit to 100 per run
      const fullUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;
      
      try {
        const startTime = Date.now();
        const response = await fetch(fullUrl, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(10000),
        });
        const ttfb = Date.now() - startTime;

        // Get full page for meta analysis
        const pageResponse = await fetch(fullUrl, { 
          signal: AbortSignal.timeout(10000),
        });
        const html = await pageResponse.text();

        const hasTitle = /<title[^>]*>.*?<\/title>/i.test(html);
        const hasMetaDesc = /<meta[^>]+name=["']description["'][^>]+content=/i.test(html);
        const hasH1 = /<h1[^>]*>.*?<\/h1>/i.test(html);
        
        const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
        const canonical = canonicalMatch ? canonicalMatch[1] : null;
        
        const noindex = /meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);

        const snapshot = {
          page: path,
          status: response.status,
          ttfb_ms: ttfb,
          has_title: hasTitle,
          has_meta_desc: hasMetaDesc,
          has_h1: hasH1,
          canonical,
          noindex,
        };

        results.push(snapshot);

        // Insert into DB
        await g.srv.from('seo_crawl_snapshots').insert(snapshot);
      } catch (error) {
        console.error(`[seo-crawl-snap] Failed to crawl ${fullUrl}:`, error);
        results.push({
          page: path,
          status: 0,
          ttfb_ms: 0,
          has_title: false,
          has_meta_desc: false,
          has_h1: false,
          canonical: null,
          noindex: false,
          error: String(error),
        });
      }
    }

    // Log event
    await g.srv.from('analytics_events').insert({
      event_name: 'seo_crawl_completed',
      meta: { 
        urls_checked: urls.length,
        successful: results.filter(r => r.status === 200).length,
        failed: results.filter(r => r.status !== 200).length,
      }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.status === 200).length,
          missing_title: results.filter(r => !r.has_title).length,
          missing_meta: results.filter(r => !r.has_meta_desc).length,
          missing_h1: results.filter(r => !r.has_h1).length,
          noindex: results.filter(r => r.noindex).length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error('[seo-crawl-snap] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
