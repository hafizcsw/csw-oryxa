import { getSupabaseAdmin } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/http.ts";

// Country name to ISO2 code mapping
const COUNTRY_MAP: Record<string, string> = {
  "USA": "US",
  "United States": "US",
  "United Kingdom": "GB",
  "UK": "GB",
  "China": "CN",
  "Japan": "JP",
  "Germany": "DE",
  "France": "FR",
  "Canada": "CA",
  "Australia": "AU",
  "Italy": "IT",
  "Netherlands": "NL",
  "Spain": "ES",
  "Switzerland": "CH",
  "South Korea": "KR",
  "Korea, South": "KR",
  "Republic of Korea": "KR",
  "Sweden": "SE",
  "Belgium": "BE",
  "Austria": "AT",
  "Denmark": "DK",
  "Norway": "NO",
  "Finland": "FI",
  "Israel": "IL",
  "Singapore": "SG",
  "Ireland": "IE",
  "Poland": "PL",
  "Russia": "RU",
  "Russian Federation": "RU",
  "Brazil": "BR",
  "Portugal": "PT",
  "Taiwan": "TW",
  "Chinese Taipei": "TW",
  "Hong Kong": "HK",
  "Greece": "GR",
  "Czech Republic": "CZ",
  "Czechia": "CZ",
  "Hungary": "HU",
  "New Zealand": "NZ",
  "Argentina": "AR",
  "Mexico": "MX",
  "Chile": "CL",
  "South Africa": "ZA",
  "India": "IN",
  "Turkey": "TR",
  "Türkiye": "TR",
  "Malaysia": "MY",
  "Thailand": "TH",
  "Saudi Arabia": "SA",
  "Iran": "IR",
  "Egypt": "EG",
  "Pakistan": "PK",
  "Indonesia": "ID",
  "Colombia": "CO",
  "Ukraine": "UA",
  "Romania": "RO",
  "Slovenia": "SI",
  "Croatia": "HR",
  "Slovakia": "SK",
  "Serbia": "RS",
  "Bulgaria": "BG",
  "Estonia": "EE",
  "Latvia": "LV",
  "Lithuania": "LT",
  "Cyprus": "CY",
  "Luxembourg": "LU",
  "Iceland": "IS",
  "Malta": "MT",
  "United Arab Emirates": "AE",
  "UAE": "AE",
  "Qatar": "QA",
  "Kuwait": "KW",
  "Bahrain": "BH",
  "Oman": "OM",
  "Jordan": "JO",
  "Lebanon": "LB",
  "Morocco": "MA",
  "Tunisia": "TN",
  "Algeria": "DZ",
  "Nigeria": "NG",
  "Kenya": "KE",
  "Ghana": "GH",
  "Vietnam": "VN",
  "Philippines": "PH",
  "Bangladesh": "BD",
  "Sri Lanka": "LK",
  "Nepal": "NP",
  "Peru": "PE",
  "Venezuela": "VE",
  "Ecuador": "EC",
  "Uruguay": "UY",
  "Costa Rica": "CR",
  "Panama": "PA",
  "Puerto Rico": "PR",
  "Cuba": "CU",
  "Belarus": "BY",
  "Kazakhstan": "KZ",
  "Uzbekistan": "UZ",
  "Azerbaijan": "AZ",
  "Georgia": "GE",
  "Armenia": "AM",
  "Iraq": "IQ",
  "Syria": "SY",
  "Macau": "MO",
  "Macao": "MO",
  "Brunei": "BN",
  "Cambodia": "KH",
  "Myanmar": "MM",
  "Laos": "LA"
};

function parseRank(str: string): number | null {
  if (!str || str.trim() === "-" || str.trim() === "") return null;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseScore(str: string): number | null {
  if (!str || str.trim() === "-" || str.trim() === "") return null;
  const num = parseFloat(str.replace(",", "."));
  return isNaN(num) ? null : num;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function extractSlugFromUrl(url: string): string | null {
  const match = url.match(/\/([^\/]+)\.php$/);
  if (match) {
    return match[1];
  }
  return null;
}

// Normalize university name for better matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\bthe\b/gi, "")
    .replace(/\buniversity\b/gi, "uni")
    .replace(/\binstitute\b/gi, "inst")
    .replace(/\btechnology\b/gi, "tech")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();
  
  // Get parameters - support batching
  let startRank = 1;
  let batchSize = 100; // Increased batch size
  let forceUpdate = false;
  
  try {
    const body = await req.json().catch(() => ({}));
    if (body.startRank) startRank = parseInt(body.startRank);
    if (body.batchSize) batchSize = Math.min(parseInt(body.batchSize), 100);
    if (body.forceUpdate) forceUpdate = true;
  } catch {
    // Use defaults
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[CWUR Import] ${msg}`);
    logs.push(msg);
  };

  try {
    log(`Starting CWUR 2025 import from rank ${startRank}, batch size ${batchSize}, forceUpdate: ${forceUpdate}...`);

    // Step 1: Fetch CWUR 2025 page
    log("Fetching CWUR 2025 rankings page...");
    const cwurResponse = await fetch("https://cwur.org/2025.php", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    });

    if (!cwurResponse.ok) {
      throw new Error(`Failed to fetch CWUR page: ${cwurResponse.status}`);
    }

    const html = await cwurResponse.text();
    log(`Fetched HTML: ${html.length} bytes`);

    // Step 2: Parse HTML table
    const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) {
      throw new Error("Could not find table body in HTML");
    }

    const tbody = tbodyMatch[1];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const allRows: Array<{
      world_rank: number;
      name: string;
      location: string;
      national_rank: number | null;
      education_rank: number | null;
      employability_rank: number | null;
      faculty_rank: number | null;
      research_rank: number | null;
      score: number | null;
      profile_url: string | null;
    }> = [];

    let match;
    while ((match = rowRegex.exec(tbody)) !== null) {
      const rowHtml = match[1];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1]);
      }

      if (cells.length >= 9) {
        const anchorMatch = cells[1].match(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/i);
        const name = anchorMatch ? anchorMatch[2].trim() : cells[1].replace(/<[^>]*>/g, "").trim();
        const profileUrl = anchorMatch ? anchorMatch[1] : null;
        
        const worldRank = parseRank(cells[0]);
        if (worldRank === null) continue;

        allRows.push({
          world_rank: worldRank,
          name,
          location: cells[2].replace(/<[^>]*>/g, "").trim(),
          national_rank: parseRank(cells[3]),
          education_rank: parseRank(cells[4]),
          employability_rank: parseRank(cells[5]),
          faculty_rank: parseRank(cells[6]),
          research_rank: parseRank(cells[7]),
          score: parseScore(cells[8]),
          profile_url: profileUrl ? `https://cwur.org${profileUrl}` : null
        });
      }
    }

    log(`Parsed ${allRows.length} total universities from CWUR`);

    // Filter to only process the current batch
    const endRank = startRank + batchSize - 1;
    const rows = allRows.filter(r => r.world_rank >= startRank && r.world_rank <= endRank);
    
    log(`Processing batch: ranks ${startRank} to ${endRank} (${rows.length} universities)`);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          done: true,
          message: "No more universities to process",
          stats: { total_parsed: allRows.length, inserted: 0, updated: 0, errors: 0 },
          logs
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Get existing countries
    const { data: existingCountries } = await supabase
      .from("countries")
      .select("id, country_code, name_en, slug");

    const countryByCode = new Map<string, { id: string; country_code: string }>();
    const countryByName = new Map<string, { id: string; country_code: string }>();
    
    for (const c of existingCountries || []) {
      if (c.country_code) {
        countryByCode.set(c.country_code.toUpperCase(), { id: c.id, country_code: c.country_code });
      }
      if (c.name_en) {
        countryByName.set(c.name_en.toLowerCase(), { id: c.id, country_code: c.country_code });
      }
    }

    // Step 4: Get all existing universities for matching
    const { data: existingUnis } = await supabase
      .from("universities")
      .select("id, name, slug");
    
    // Build a map for faster lookups
    const uniByNormalizedName = new Map<string, { id: string; name: string }>();
    const uniBySlug = new Map<string, { id: string; name: string }>();
    
    for (const uni of existingUnis || []) {
      if (uni.name) {
        uniByNormalizedName.set(normalizeName(uni.name), { id: uni.id, name: uni.name });
      }
      if (uni.slug) {
        uniBySlug.set(uni.slug, { id: uni.id, name: uni.name });
      }
    }

    // Step 5: Process each university
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        // Find country
        let countryId: string | null = null;
        let countryCode = COUNTRY_MAP[row.location] || null;
        
        if (countryCode) {
          const found = countryByCode.get(countryCode.toUpperCase());
          if (found) countryId = found.id;
        }
        
        if (!countryId) {
          const found = countryByName.get(row.location.toLowerCase());
          if (found) {
            countryId = found.id;
            countryCode = found.country_code;
          }
        }

        // Create country if needed
        if (!countryId && countryCode) {
          const { data: newCountry } = await supabase
            .from("countries")
            .insert({
              country_code: countryCode,
              slug: countryCode.toLowerCase(),
              name_en: row.location,
              name_ar: row.location
            })
            .select("id, country_code")
            .single();

          if (newCountry) {
            countryId = newCountry.id;
            countryByCode.set(countryCode.toUpperCase(), { id: newCountry.id, country_code: countryCode });
          }
        }

        const cwurSlug = extractSlugFromUrl(row.profile_url || "") || generateSlug(row.name);
        const normalizedName = normalizeName(row.name);

        // CWUR data to update
        const cwurData = {
          cwur_world_rank: row.world_rank,
          cwur_national_rank: row.national_rank,
          cwur_education_rank: row.education_rank,
          cwur_employability_rank: row.employability_rank,
          cwur_faculty_rank: row.faculty_rank,
          cwur_research_rank: row.research_rank,
          cwur_score: row.score,
          cwur_profile_url: row.profile_url,
          cwur_year: 2025
        };

        // Try to find existing university by normalized name first (most reliable)
        let existingUni = uniByNormalizedName.get(normalizedName);
        
        // If not found, try by slug
        if (!existingUni) {
          existingUni = uniBySlug.get(cwurSlug);
        }

        // If still not found, try a database search with ilike
        if (!existingUni) {
          const { data: dbMatch } = await supabase
            .from("universities")
            .select("id, name")
            .ilike("name", `%${row.name.substring(0, 20)}%`)
            .limit(5);
          
          if (dbMatch && dbMatch.length > 0) {
            // Find best match by comparing normalized names
            for (const candidate of dbMatch) {
              if (normalizeName(candidate.name) === normalizedName) {
                existingUni = { id: candidate.id, name: candidate.name };
                break;
              }
            }
            // If no exact match, use first result if name is very similar
            if (!existingUni && dbMatch.length === 1) {
              const similarity = normalizedName.includes(normalizeName(dbMatch[0].name)) || 
                                normalizeName(dbMatch[0].name).includes(normalizedName);
              if (similarity) {
                existingUni = { id: dbMatch[0].id, name: dbMatch[0].name };
              }
            }
          }
        }

        if (existingUni) {
          // Update existing university with all CWUR fields
          const { error: updateError } = await supabase
            .from("universities")
            .update(cwurData)
            .eq("id", existingUni.id);
          
          if (updateError) {
            errors.push(`Update ${row.name}: ${updateError.message}`);
          } else {
            updated++;
            log(`Updated: ${row.name} (rank #${row.world_rank})`);
          }
        } else {
          // Insert new university
          const { error: insertError } = await supabase
            .from("universities")
            .insert({
              name: row.name,
              slug: cwurSlug,
              country_id: countryId,
              is_active: true,
              ...cwurData
            });

          if (insertError) {
            // Try with alternate slug
            const altSlug = `${cwurSlug}-${row.location.toLowerCase().replace(/\s+/g, "-")}`;
            const { error: retryError } = await supabase
              .from("universities")
              .insert({
                name: row.name,
                slug: altSlug,
                country_id: countryId,
                is_active: true,
                ...cwurData
              });

            if (retryError) {
              errors.push(`Insert ${row.name}: ${retryError.message}`);
            } else {
              inserted++;
              log(`Inserted (alt slug): ${row.name} (rank #${row.world_rank})`);
            }
          } else {
            inserted++;
            log(`Inserted: ${row.name} (rank #${row.world_rank})`);
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${row.name}: ${errMsg}`);
      }
    }

    const nextStartRank = endRank + 1;
    const hasMore = nextStartRank <= allRows.length;

    log(`Batch complete! Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors.length}`);
    log(`Next batch starts at rank: ${nextStartRank}, hasMore: ${hasMore}`);

    return new Response(
      JSON.stringify({
        ok: true,
        done: !hasMore,
        nextStartRank: hasMore ? nextStartRank : null,
        stats: {
          total_parsed: allRows.length,
          batch_start: startRank,
          batch_end: endRank,
          inserted,
          updated,
          errors: errors.length
        },
        logs,
        errors: errors.slice(0, 20)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log(`Fatal error: ${errMsg}`);
    return new Response(
      JSON.stringify({ ok: false, error: errMsg, logs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
