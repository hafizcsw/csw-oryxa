import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UniRankUniversity {
  name: string;
  slug: string;
  country: string;
  rank: number;
  score: number | null;
  logo_url: string | null;
  is_verified: boolean;
  tier: string | null;
}

/**
 * Convert slug to readable name
 */
function slugToName(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Lightweight parsing - only extract slugs to reduce CPU usage
 * Full parsing caused CPU Time exceeded errors on large pages
 */
function parseUniversitiesLightweight(html: string): UniRankUniversity[] {
  const universities: UniRankUniversity[] = [];
  const seenSlugs = new Set<string>();
  
  // Simple pattern: just extract university slugs from links
  const linkPattern = /href="https:\/\/www\.uniranks\.com\/universities\/([a-z0-9-]+)"/gi;
  
  let match;
  let rankCounter = 1;
  
  while ((match = linkPattern.exec(html)) !== null) {
    const slug = match[1].trim();
    
    // Skip duplicates
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    
    universities.push({
      slug,
      name: slugToName(slug),
      score: null,
      country: 'Unknown', // Will be enriched later
      rank: rankCounter++,
      is_verified: true,
      logo_url: null,
      tier: null,
    });
  }
  
  return universities;
}

/**
 * Try to extract additional info with a separate, bounded regex pass
 */
function enrichUniversitiesFromHtml(universities: UniRankUniversity[], html: string): void {
  // Limit processing to avoid CPU spikes - only process first 50 universities per page
  const toEnrich = universities.slice(0, 50);
  
  for (const uni of toEnrich) {
    try {
      // Look for country near this university's link (within 2000 chars)
      const slugIndex = html.indexOf(`/universities/${uni.slug}`);
      if (slugIndex === -1) continue;
      
      // Extract a small window around the slug
      const start = Math.max(0, slugIndex - 500);
      const end = Math.min(html.length, slugIndex + 1500);
      const window = html.substring(start, end);
      
      // Try to find country
      const countryMatch = window.match(/Location[\s\S]{0,100}?<span[^>]*>([^<]+)<\/span>/i);
      if (countryMatch) {
        uni.country = countryMatch[1].trim();
      }
      
      // Try to find score
      const scoreMatch = window.match(/Score[\s\S]{0,50}?<span[^>]*>([\d.]+)<\/span>/i);
      if (scoreMatch) {
        uni.score = parseFloat(scoreMatch[1]);
      }
      
      // Try to find rank
      const rankMatch = window.match(/World[\s#]*(\d+)/i);
      if (rankMatch) {
        uni.rank = parseInt(rankMatch[1], 10);
      }
    } catch {
      // Skip enrichment errors silently
    }
  }
}

/**
 * Fetch HTML directly with timeout
 */
async function fetchHtmlDirect(url: string): Promise<string> {
  console.log(`[Direct] Fetching: ${url}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`[Direct] Got ${html.length} chars`);
    return html;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Import a single batch of universities to staging
 */
async function importBatchToStaging(
  universities: UniRankUniversity[],
  supabase: any
): Promise<number> {
  const stagingData = universities.map(uni => ({
    source: 'uniranks',
    external_id: `uniranks_${uni.slug}`,
    name: uni.name,
    country_name: uni.country,
    rank: uni.rank,
    score: uni.score,
    website_url: `https://www.uniranks.com/universities/${uni.slug}`,
    logo_url: uni.logo_url,
    is_verified: uni.is_verified,
    tier: uni.tier,
    raw_data: uni,
    imported_at: new Date().toISOString(),
    status: 'pending',
  }));
  
  const { data, error } = await supabase
    .from('university_import_staging')
    .upsert(stagingData, { onConflict: 'source,external_id' })
    .select('id');
  
  if (error) {
    console.error('[Import] Batch error:', error);
    return 0;
  }
  
  return data?.length || 0;
}

/**
 * Process a single page (one page per invocation to stay within CPU limits)
 */
async function processSinglePage(
  jobId: string,
  category: string,
  page: number,
  maxPages: number,
  baseFound: number,
  baseImported: number,
  supabase: any
): Promise<{ completed: boolean; nextPage: number; totalFound: number; totalImported: number; stopReason?: string }> {
  const baseUrl = `https://www.uniranks.com/ranking/${category}`;
  
  try {
    const pageUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
    console.log(`[Crawl] Processing page ${page}/${maxPages}...`);

    const html = await fetchHtmlDirect(pageUrl);
    
    // Use lightweight parsing to avoid CPU spikes
    const unis = parseUniversitiesLightweight(html);
    
    if (unis.length === 0) {
      console.log(`[Crawl] No universities on page ${page}, stopping.`);
      return { 
        completed: true, 
        nextPage: page, 
        totalFound: 0, 
        totalImported: 0,
        stopReason: `No universities found on page ${page}`
      };
    }
    
    // Enrich with additional data (limited to avoid CPU issues)
    enrichUniversitiesFromHtml(unis, html);

    // Import to staging
    const imported = await importBatchToStaging(unis, supabase);

    // Persist progress immediately
    const newTotalFound = baseFound + unis.length;
    const newTotalImported = baseImported + imported;

    const { error: progressError } = await supabase
      .from("uniranks_crawl_jobs")
      .update({
        current_page: page,
        total_found: newTotalFound,
        total_imported: newTotalImported,
        status: "processing",
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (progressError) {
      console.error("[Crawl] Progress update error:", progressError);
    }

    console.log(`[Crawl] Page ${page}: found ${unis.length}, imported ${imported}`);

    return {
      completed: page >= maxPages,
      nextPage: page + 1,
      totalFound: unis.length,
      totalImported: imported,
    };
  } catch (pageError: any) {
    console.error(`[Crawl] Error on page ${page}:`, pageError);
    return {
      completed: true,
      nextPage: page,
      totalFound: 0,
      totalImported: 0,
      stopReason: `Error on page ${page}: ${pageError.message}`
    };
  }
}

/**
 * Small delay to avoid rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Background crawl - processes one page then schedules next with delay
 */
async function processCrawlJob(jobId: string, category: string, startPage: number, maxPages: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Get current job state
    const { data: job } = await supabase
      .from('uniranks_crawl_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (!job) {
      console.log(`[Crawl] Job ${jobId} not found.`);
      return;
    }
    
    if (job.status === 'completed' || job.status === 'failed') {
      console.log(`[Crawl] Job ${jobId} already finished (${job.status}).`);
      return;
    }
    
    // Update to processing
    await supabase
      .from('uniranks_crawl_jobs')
      .update({ 
        status: 'processing', 
        started_at: job.started_at || new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    // Process single page
    const baseFound = job.total_found || 0;
    const baseImported = job.total_imported || 0;

    const result = await processSinglePage(jobId, category, startPage, maxPages, baseFound, baseImported, supabase);

    // Update progress
    const newTotalFound = baseFound + result.totalFound;
    const newTotalImported = baseImported + result.totalImported;

    if (result.completed) {
      // Job finished (either completed or error)
      await supabase
        .from('uniranks_crawl_jobs')
        .update({ 
          current_page: result.nextPage,
          total_found: newTotalFound,
          total_imported: newTotalImported,
          status: result.stopReason ? 'failed' : 'completed',
          error_message: result.stopReason || null,
          completed_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      console.log(`[Crawl] Job ${jobId} finished: ${newTotalFound} found, ${newTotalImported} imported. Reason: ${result.stopReason || 'completed all pages'}`);
    } else {
      // Schedule next page with a small delay to avoid rate limiting
      console.log(`[Crawl] Scheduling next page ${result.nextPage} after delay...`);
      
      // Add 500ms delay between pages to reduce load
      await delay(500);

      const selfUrl = `${supabaseUrl}/functions/v1/firecrawl-uniranks`;
      const resp = await fetch(selfUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({
          action: 'continue',
          job_id: jobId,
          category,
          start_page: result.nextPage,
          max_pages: maxPages,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error(`[Crawl] Self-invocation failed (${resp.status}): ${text}`);
        
        // Mark job as paused so user can resume
        await supabase
          .from('uniranks_crawl_jobs')
          .update({ 
            status: 'paused',
            error_message: `Self-invocation failed at page ${result.nextPage}: HTTP ${resp.status}`,
            last_activity_at: new Date().toISOString()
          })
          .eq('id', jobId);
      } else {
        // Consume response body
        await resp.text().catch(() => {});
      }
    }
    
  } catch (error: any) {
    console.error(`[Crawl] Job ${jobId} failed:`, error);
    await supabase
      .from('uniranks_crawl_jobs')
      .update({ 
        status: 'failed', 
        error_message: `Unexpected error: ${error.message}`,
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      action = 'crawl',
      category = 'verified-universities',
      max_pages = 150,
      job_id,
    } = body;
    
    console.log(`[uniranks] Action: ${action}, Category: ${category}`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // ============ START CRAWL (returns immediately with job_id) ============
    if (action === 'crawl') {
      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('uniranks_crawl_jobs')
        .insert({ 
          category, 
          max_pages, 
          status: 'pending',
          current_page: 0,
          total_found: 0,
          total_imported: 0
        })
        .select('id')
        .single();
      
      if (jobError || !job) {
        throw new Error(`Failed to create job: ${jobError?.message}`);
      }
      
      // Start background processing
      // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(processCrawlJob(job.id, category, 1, max_pages));
      
      // Return immediately
      return new Response(
        JSON.stringify({
          ok: true,
          job_id: job.id,
          message: 'Crawl started in background. Poll /status to check progress.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ============ CONTINUE CRAWL (self-invocation for next page) ============
    if (action === 'continue') {
      const start_page = body.start_page || 1;
      
      if (!job_id) {
        throw new Error('job_id required for continue action');
      }
      
      // Continue processing in background
      // @ts-ignore
      EdgeRuntime.waitUntil(processCrawlJob(job_id, category, start_page, max_pages));
      
      return new Response(
        JSON.stringify({ ok: true, message: 'Continuing...' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ============ RESUME PAUSED JOB ============
    if (action === 'resume') {
      if (!job_id) {
        throw new Error('job_id required for resume action');
      }
      
      // Get job state
      const { data: job } = await supabase
        .from('uniranks_crawl_jobs')
        .select('*')
        .eq('id', job_id)
        .single();
      
      if (!job) {
        throw new Error('Job not found');
      }
      
      if (job.status === 'completed') {
        throw new Error('Job already completed');
      }
      
      // Resume from next page
      const resumePage = (job.current_page || 0) + 1;
      
      // Update status
      await supabase
        .from('uniranks_crawl_jobs')
        .update({ 
          status: 'processing',
          error_message: null,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', job_id);
      
      // Start background processing
      // @ts-ignore
      EdgeRuntime.waitUntil(processCrawlJob(job_id, job.category, resumePage, job.max_pages));
      
      return new Response(
        JSON.stringify({ 
          ok: true, 
          message: `Resumed from page ${resumePage}`,
          resume_page: resumePage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ============ CHECK JOB STATUS ============
    if (action === 'status') {
      if (job_id) {
        // Get specific job status
        const { data: job } = await supabase
          .from('uniranks_crawl_jobs')
          .select('*')
          .eq('id', job_id)
          .single();
        
        return new Response(
          JSON.stringify({
            ok: true,
            job,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get latest job and staging count
      const { data: latestJob } = await supabase
        .from('uniranks_crawl_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      const { count } = await supabase
        .from('university_import_staging')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'uniranks');
      
      return new Response(
        JSON.stringify({
          ok: true,
          latest_job: latestJob,
          total_staged: count || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // ============ TEST SINGLE PAGE ============
    if (action === 'test') {
      const baseUrl = `https://www.uniranks.com/ranking/${category}`;
      const html = await fetchHtmlDirect(baseUrl);
      const universities = parseUniversitiesLightweight(html);
      enrichUniversitiesFromHtml(universities, html);
      
      return new Response(
        JSON.stringify({
          ok: true,
          count: universities.length,
          sample: universities.slice(0, 10),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    throw new Error(`Unknown action: ${action}`);
    
  } catch (error: any) {
    console.error('[uniranks] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
