import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScrapeRequest {
  university_names?: string[];
  limit?: number;
  offset?: number;
  auto_continue?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body: ScrapeRequest = await req.json();
    const { limit = 10, offset = 0 } = body;

    console.log(`[qs-scrape] Starting scrape for ${limit} universities, offset ${offset}`);

    // Get universities to process
    const { data: universities, error: uniError } = await supabase
      .from("universities")
      .select("id, name, slug, cwur_world_rank")
      .order("cwur_world_rank", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (uniError) {
      throw new Error(`Failed to get universities: ${uniError.message}`);
    }

    console.log(`[qs-scrape] Found ${universities?.length || 0} universities to process`);

    const results: any[] = [];
    let totalPrograms = 0;
    let failedCount = 0;

    for (const uni of universities || []) {
      try {
        // Build QS URL from university name
        const slug = buildQSSlug(uni.name);
        const qsUrl = `https://www.topuniversities.com/universities/${slug}`;

        console.log(`[qs-scrape] Scraping: ${uni.name} -> ${qsUrl}`);

        // Scrape using Firecrawl
        const scraped = await scrapeWithFirecrawl(firecrawlKey, qsUrl);

        if (!scraped.success) {
          console.log(`[qs-scrape] Failed to scrape ${uni.name}: ${scraped.error}`);
          results.push({
            university_id: uni.id,
            university_name: uni.name,
            status: "failed",
            error: scraped.error,
          });
          failedCount++;
          continue;
        }

        // Extract programs from the page content
        const programs = extractPrograms(scraped.markdown || "", scraped.html || "");

        console.log(`[qs-scrape] Found ${programs.length} programs for ${uni.name}`);

        // Insert programs into database
        if (programs.length > 0) {
          const programsToInsert = programs.map((p: any) => ({
            university_id: uni.id,
            title: p.name,
            degree_level: p.level || null,
            publish_status: "draft",
            source_program_url: qsUrl,
            created_at: new Date().toISOString(),
          }));

          // Insert one by one to handle duplicates gracefully
          let insertedCount = 0;
          for (const program of programsToInsert) {
            const { error: insertError } = await supabase
              .from("programs")
              .insert(program);
            
            if (!insertError) {
              insertedCount++;
            }
          }
          totalPrograms += insertedCount;
        }

        results.push({
          university_id: uni.id,
          university_name: uni.name,
          status: "success",
          programs_count: programs.length,
        });

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[qs-scrape] Error processing ${uni.name}:`, message);
        results.push({
          university_id: uni.id,
          university_name: uni.name,
          status: "error",
          error: message,
        });
        failedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        processed: universities?.length || 0,
        success_count: (universities?.length || 0) - failedCount,
        failed_count: failedCount,
        total_programs_added: totalPrograms,
        next_offset: offset + limit,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[qs-scrape] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildQSSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function scrapeWithFirecrawl(
  apiKey: string,
  url: string
): Promise<{ success: boolean; markdown?: string; html?: string; error?: string }> {
  try {
    // Use Firecrawl as primary (supports JavaScript)
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: false, // Get full page to find programs
        waitFor: 3000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Fallback to direct fetch if Firecrawl fails
      console.log(`[qs-scrape] Firecrawl failed for ${url}, trying direct fetch`);
      return await directFetch(url);
    }

    return {
      success: true,
      markdown: data.data?.markdown || data.markdown || "",
      html: data.data?.html || data.html || "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log(`[qs-scrape] Firecrawl error: ${message}, trying direct fetch`);
    return await directFetch(url);
  }
}

async function directFetch(url: string): Promise<{ success: boolean; markdown?: string; html?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    
    // Convert HTML to simple markdown-like text
    const markdown = htmlToText(html);

    return { success: true, markdown, html };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

function htmlToText(html: string): string {
  let text = html;
  // Remove script and style tags
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  // Clean whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractPrograms(markdown: string, html: string): { name: string; level?: string }[] {
  const programs: { name: string; level?: string }[] = [];
  const seenNames = new Set<string>();

  // Patterns to find programs in the content
  const patterns = [
    // Bachelor/BSc/BA programs
    /(?:Bachelor|BSc|BA|B\.A\.|B\.Sc\.|Undergraduate|BS)\s*(?:of|in|:)?\s*([A-Z][A-Za-z\s&,]+?)(?:\n|\.|,|<|$)/gi,
    // Master/MSc/MA programs
    /(?:Master|MSc|MA|M\.A\.|M\.Sc\.|MBA|MPhil|MS)\s*(?:of|in|:)?\s*([A-Z][A-Za-z\s&,]+?)(?:\n|\.|,|<|$)/gi,
    // PhD/Doctoral programs
    /(?:PhD|Ph\.D\.|Doctorate|Doctoral|DPhil)\s*(?:of|in|:)?\s*([A-Z][A-Za-z\s&,]+?)(?:\n|\.|,|<|$)/gi,
    // Generic degree patterns
    /(?:Degree|Program|Course)\s*(?:in|:)\s*([A-Z][A-Za-z\s&,]+?)(?:\n|\.|,|<|$)/gi,
  ];

  const content = markdown + " " + html;

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = cleanProgramName(match[1]);
      if (name && name.length > 3 && name.length < 100 && !seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        programs.push({
          name,
          level: detectDegreeLevel(match[0]),
        });
      }
    }
  }

  // Also look for structured program lists
  const listPatterns = [
    /[-•]\s*([A-Z][A-Za-z\s&,]+(?:Bachelor|Master|PhD|Engineering|Science|Arts|Business|Medicine|Law)[A-Za-z\s&,]*)/g,
    /\d+\.\s*([A-Z][A-Za-z\s&,]+(?:Bachelor|Master|PhD|Engineering|Science|Arts|Business|Medicine|Law)[A-Za-z\s&,]*)/g,
  ];

  for (const pattern of listPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = cleanProgramName(match[1]);
      if (name && name.length > 3 && name.length < 100 && !seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        programs.push({ name, level: detectDegreeLevel(name) });
      }
    }
  }

  return programs.slice(0, 200); // Limit to 200 programs per university
}

function cleanProgramName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/^\s*[-•]\s*/, "")
    .trim();
}

function detectDegreeLevel(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("phd") || lower.includes("doctoral") || lower.includes("doctorate")) {
    return "phd";
  }
  if (lower.includes("master") || lower.includes("msc") || lower.includes("mba") || lower.includes("mphil")) {
    return "master";
  }
  if (lower.includes("bachelor") || lower.includes("bsc") || lower.includes("undergraduate")) {
    return "bachelor";
  }
  return undefined;
}

function mapDegreeLevel(level?: string): string | null {
  if (!level) return null;
  
  const mapping: Record<string, string> = {
    bachelor: "bachelor",
    master: "master",
    phd: "phd",
  };
  
  return mapping[level] || null;
}
