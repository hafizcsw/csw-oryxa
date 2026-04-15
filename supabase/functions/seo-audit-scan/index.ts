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

    const { urls = [] } = await req.json().catch(() => ({}));
    
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '') || '';
    
    // Default URLs to scan if none provided
    const scanUrls = urls.length > 0 ? urls : [
      '/',
      '/universities',
      '/programs',
      '/scholarships'
    ];

    const findings = [];

    // Scan each URL
    for (const path of scanUrls) {
      const url = baseUrl + path;
      
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'SEO-Audit-Bot/1.0' }
        });
        
        const html = await response.text();
        
        // Check title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch?.[1] || '';
        if (!title) {
          findings.push({
            url: path,
            rule: 'title_missing',
            severity: 'error',
            details: { message: 'Page has no title tag' }
          });
        } else if (title.length > 60) {
          findings.push({
            url: path,
            rule: 'title_length',
            severity: 'warn',
            details: { length: title.length, max: 60 }
          });
        }

        // Check meta description
        const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
        const metaDesc = metaDescMatch?.[1] || '';
        if (!metaDesc) {
          findings.push({
            url: path,
            rule: 'meta_desc_missing',
            severity: 'warn',
            details: { message: 'Page has no meta description' }
          });
        } else if (metaDesc.length > 160) {
          findings.push({
            url: path,
            rule: 'meta_desc_length',
            severity: 'info',
            details: { length: metaDesc.length, max: 160 }
          });
        }

        // Check H1
        const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const h1 = h1Match?.[1] || '';
        if (!h1) {
          findings.push({
            url: path,
            rule: 'h1_missing',
            severity: 'error',
            details: { message: 'Page has no H1 tag' }
          });
        }

        // Check canonical
        const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/i);
        if (!canonicalMatch) {
          findings.push({
            url: path,
            rule: 'canonical',
            severity: 'info',
            details: { message: 'Page has no canonical tag' }
          });
        }

        // Check robots meta
        const robotsMatch = html.match(/<meta\s+name=["']robots["']\s+content=["'](.*?)["']/i);
        const robotsContent = robotsMatch?.[1] || '';
        if (robotsContent.includes('noindex')) {
          findings.push({
            url: path,
            rule: 'robots',
            severity: 'warn',
            details: { content: robotsContent, message: 'Page is noindexed' }
          });
        }

      } catch (e) {
        findings.push({
          url: path,
          rule: '404',
          severity: 'error',
          details: { error: String(e) }
        });
      }
    }

    // Clear old findings for these URLs
    await g.srv
      .from('seo_audit_findings')
      .delete()
      .in('url', scanUrls);

    // Insert new findings
    if (findings.length > 0) {
      await g.srv.from('seo_audit_findings').insert(findings);
    }

    // Update cron status
    await g.srv.from('seo_cron_jobs')
      .update({ 
        status: 'ok', 
        last_run_at: new Date().toISOString(),
        last_error: null
      })
      .eq('job_name', 'audit_scan');

    // Log telemetry
    await g.srv.from("events").insert({
      name: "seo_audit_scan_done",
      properties: {
        urls: scanUrls.length,
        findings: findings.length
      }
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      findings: findings.length,
      scanned: scanUrls.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("[seo-audit-scan] Exception:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
