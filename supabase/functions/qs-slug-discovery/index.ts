import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

/**
 * qs-slug-discovery  (S1)
 *
 * ?phase=map   → Fetch QS sitemaps (FREE) → parse → filter → dedupe → staging
 * ?phase=match → Multi-layer matching v2 → update staging → coverage report
 */

const SITEMAP_PAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const BLACKLIST_TOKENS = [
  "search", "directory", "ranking", "rankings", "compare",
  "filter", "results", "page", "sitemap", "login", "register",
];

const COUNTRY_SLUGS = new Set([
  "armenia","azerbaijan","bahrain","barbados","bolivia","brunei",
  "cambodia","cameroon","chad","comoros","djibouti","eritrea",
  "eswatini","ethiopia","fiji","gabon","gambia","ghana","grenada",
  "guatemala","guinea","guyana","haiti","honduras","iceland",
  "iraq","jamaica","jordan","kenya","kiribati","kosovo","kuwait",
  "laos","latvia","lebanon","lesotho","liberia","libya",
  "liechtenstein","luxembourg","madagascar","malawi","maldives",
  "mali","malta","mauritania","mauritius","moldova","monaco",
  "mongolia","montenegro","mozambique","myanmar","namibia","nauru",
  "nepal","nicaragua","niger","oman","palau","palestine","panama",
  "paraguay","rwanda","samoa","senegal","seychelles","singapore",
  "somalia","sudan","suriname","tajikistan","tanzania","togo",
  "tonga","trinidad","tunisia","turkmenistan","tuvalu","uganda",
  "uruguay","uzbekistan","vanuatu","venezuela","vietnam","yemen",
  "zambia","zimbabwe",
]);

// ─── Normalization ───
const STRIP_TOKENS = new Set([
  "the","of","and","for","in","at","de","du","des","la","le","les","el",
  "university","universidad","universite","universitat","universiteit",
  "universita","universidade","universitaet","univerza","universitet",
  "universiteti","universiti","universitesi","universitetas",
  "college","institute","institution","school","academy","polytechnic",
  "politecnico","politecnica","escuela","ecole","faculte","fakultat",
  "hochschule","technische","teknisk","tekniska","technik",
  "national","state","federal","royal","imperial",
]);

function normalizeHeavy(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[''`ʻʼ]/g, "")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(w => !STRIP_TOKENS.has(w))
    .join("")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeLight(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[''`ʻʼ-]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeLight(s).split(" ").filter(w => w.length > 1 && !STRIP_TOKENS.has(w)));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function containmentScore(smaller: Set<string>, larger: Set<string>): number {
  if (smaller.size === 0) return 0;
  let contained = 0;
  for (const t of smaller) if (larger.has(t)) contained++;
  return contained / smaller.size;
}

// ─── Server ───
Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error, trace_id: tid }),
      { status: auth.status, headers: { "Content-Type": "application/json", ...cors } });
  }
  const supabase = auth.srv;
  const url = new URL(req.url);
  const phase = url.searchParams.get("phase") || "map";

  try {
    if (phase === "map") return await phaseMap(supabase, tid, cors);
    if (phase === "match") return await phaseMatch(supabase, tid, cors);
    return new Response(JSON.stringify({ ok: false, error: "phase must be 'map' or 'match'" }),
      { status: 400, headers: { "Content-Type": "application/json", ...cors } });
  } catch (err: any) {
    slog({ tid, level: "error", error: String(err) });
    return new Response(JSON.stringify({ ok: false, error: err?.message || String(err), trace_id: tid }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } });
  }
});

// ════════════════════════════════════════════
// Phase MAP: Fetch QS sitemaps (FREE) → parse → staging
// ════════════════════════════════════════════
async function phaseMap(supabase: any, tid: string, cors: Record<string, string>) {
  slog({ tid, level: "info", action: "sitemap_discovery_start" });
  const validSlugs = new Map<string, string>();
  let totalUrlsParsed = 0;
  let pagesProcessed = 0;

  for (const pageNum of SITEMAP_PAGES) {
    try {
      const res = await fetch(`https://www.topuniversities.com/sitemap.xml?page=${pageNum}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LaVistaBot/1.0)" },
      });
      if (!res.ok) { await res.text(); continue; }
      const xml = await res.text();
      const urlMatches = xml.match(/https?:\/\/www\.topuniversities\.com\/universities\/[a-z0-9][a-z0-9-]*[a-z0-9]/gi) || [];
      totalUrlsParsed += urlMatches.length;
      for (const rawUrl of urlMatches) {
        const m = rawUrl.match(/\/universities\/([a-z0-9][a-z0-9-]*[a-z0-9])$/i);
        if (!m) continue;
        const slug = m[1].toLowerCase();
        if (slug.length < 3) continue;
        if (BLACKLIST_TOKENS.some(t => slug === t || slug.includes(t))) continue;
        if (COUNTRY_SLUGS.has(slug)) continue;
        if (!validSlugs.has(slug)) validSlugs.set(slug, `https://www.topuniversities.com/universities/${slug}`);
      }
      pagesProcessed++;
    } catch (_e) { /* skip */ }
  }

  await supabase.from("qs_slug_staging").delete().neq("slug", "__impossible__");
  const rows = Array.from(validSlugs.entries()).map(([slug, url]) => ({
    slug, source_url: url, match_status: "pending",
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await supabase.from("qs_slug_staging").insert(rows.slice(i, i + 500));
  }

  return new Response(JSON.stringify({
    ok: true, phase: "map", trace_id: tid,
    firecrawl_credits_used: 0,
    sitemap_pages_processed: pagesProcessed,
    total_urls_found: totalUrlsParsed,
    valid_slugs_stored: rows.length,
    message: "Run ?phase=match next.",
  }, null, 2), { headers: { "Content-Type": "application/json", ...cors } });
}

// ════════════════════════════════════════════
// Phase MATCH v2 — Multi-layer
// ════════════════════════════════════════════
interface UniRecord {
  id: string;
  name_en: string | null;
  slug: string | null;
  uniranks_slug: string | null;
  website_host: string | null;
}

interface MatchResult {
  slug: string;
  uid: string | null;
  name: string;
  reason: string;
  conf: number;
  status: string; // matched | ambiguous | unmatched
}

async function phaseMatch(supabase: any, tid: string, cors: Record<string, string>) {
  slog({ tid, level: "info", action: "match_v2_start" });

  // ── Load all staging slugs ──
  const allSlugs: string[] = [];
  let off = 0;
  while (true) {
    const { data } = await supabase.from("qs_slug_staging").select("slug").range(off, off + 999);
    if (!data || data.length === 0) break;
    allSlugs.push(...data.map((r: any) => r.slug));
    if (data.length < 1000) break;
    off += 1000;
  }

  // ── Load all universities ──
  const allUnis: UniRecord[] = [];
  off = 0;
  while (true) {
    const { data } = await supabase
      .from("universities")
      .select("id, name_en, slug, uniranks_slug, website_host")
      .eq("is_active", true)
      .range(off, off + 999);
    if (!data || data.length === 0) break;
    allUnis.push(...data);
    if (data.length < 1000) break;
    off += 1000;
  }

  // ── Load aliases ──
  const aliasMap = new Map<string, string>(); // normalized_alias → university_id
  {
    const { data } = await supabase.from("university_aliases").select("university_id, alias_normalized");
    if (data) for (const a of data) {
      if (a.alias_normalized) aliasMap.set(normalizeHeavy(a.alias_normalized), a.university_id);
    }
  }

  // ── Build indexes ──
  const heavyNameIdx = new Map<string, UniRecord[]>();
  const ourSlugIdx = new Map<string, UniRecord>();
  const uniranksSlugIdx = new Map<string, UniRecord>();
  const hostIdx = new Map<string, UniRecord[]>();
  // Inverted token index: token → Set<uni_id>
  const tokenToUnis = new Map<string, Set<string>>();
  const uniById = new Map<string, UniRecord>();
  const uniTokenCache = new Map<string, Set<string>>();

  for (const u of allUnis) {
    uniById.set(u.id, u);
    if (u.name_en) {
      const h = normalizeHeavy(u.name_en);
      if (h) {
        const arr = heavyNameIdx.get(h) || [];
        arr.push(u);
        heavyNameIdx.set(h, arr);
      }
      const ts = tokenSet(u.name_en);
      if (ts.size >= 2) {
        uniTokenCache.set(u.id, ts);
        for (const t of ts) {
          const s = tokenToUnis.get(t) || new Set();
          s.add(u.id);
          tokenToUnis.set(t, s);
        }
      }
    }
    if (u.slug) ourSlugIdx.set(normalizeHeavy(u.slug.replace(/-/g, " ")), u);
    if (u.uniranks_slug) uniranksSlugIdx.set(normalizeHeavy(u.uniranks_slug.replace(/-/g, " ")), u);
    if (u.website_host) {
      const parts = u.website_host.replace(/^www\./, "").split(".");
      if (parts.length > 0 && parts[0].length >= 2) {
        const key = parts[0].toLowerCase();
        const arr = hostIdx.get(key) || [];
        arr.push(u);
        hostIdx.set(key, arr);
      }
    }
  }

  // ── Match each slug ──
  const usedUniIds = new Set<string>();
  const results: MatchResult[] = [];

  for (const qsSlug of allSlugs) {
    const qsHeavy = normalizeHeavy(qsSlug.replace(/-/g, " "));
    const qsTokens = tokenSet(qsSlug.replace(/-/g, " "));
    let best: { uid: string; name: string; reason: string; conf: number } | null = null;

    // Layer 1: Exact heavy-normalized name
    const nameHits = heavyNameIdx.get(qsHeavy);
    if (nameHits && nameHits.length === 1) {
      best = { uid: nameHits[0].id, name: nameHits[0].name_en || "", reason: "L1_exact_name", conf: 0.97 };
    } else if (nameHits && nameHits.length > 1) {
      best = { uid: nameHits[0].id, name: nameHits.map(h => h.name_en).join(" | "), reason: "L1_exact_multi", conf: 0.50 };
    }

    // Layer 2: Our internal slug match
    if (!best) {
      const slugHit = ourSlugIdx.get(qsHeavy);
      if (slugHit) best = { uid: slugHit.id, name: slugHit.name_en || "", reason: "L2_internal_slug", conf: 0.95 };
    }

    // Layer 3: UniRanks slug match
    if (!best) {
      const urHit = uniranksSlugIdx.get(qsHeavy);
      if (urHit) best = { uid: urHit.id, name: urHit.name_en || "", reason: "L3_uniranks_slug", conf: 0.94 };
    }

    // Layer 4: Alias table
    if (!best) {
      const aliasUid = aliasMap.get(qsHeavy);
      if (aliasUid) {
        const aliasUni = allUnis.find(u => u.id === aliasUid);
        if (aliasUni) best = { uid: aliasUni.id, name: aliasUni.name_en || "", reason: "L4_alias", conf: 0.93 };
      }
    }

    // Layer 5: Domain/host token match
    if (!best) {
      // Extract slug tokens and check host index
      const slugParts = qsSlug.split("-").filter(p => p.length >= 2);
      for (const part of slugParts) {
        const hostHits = hostIdx.get(part);
        if (hostHits && hostHits.length === 1) {
          // Verify with jaccard > 0.3 to avoid false positives
          const hTokens = tokenSet(hostHits[0].name_en || "");
          if (jaccardSimilarity(qsTokens, hTokens) >= 0.25) {
            best = { uid: hostHits[0].id, name: hostHits[0].name_en || "", reason: "L5_domain", conf: 0.85 };
            break;
          }
        }
      }
    }

    // Layer 6+7: Token containment + fuzzy via INVERTED INDEX (not brute force)
    if (!best && qsTokens.size >= 2) {
      // Find candidate unis that share at least 1 token
      const candidateIds = new Set<string>();
      for (const t of qsTokens) {
        const uids = tokenToUnis.get(t);
        if (uids) for (const uid of uids) {
          if (!usedUniIds.has(uid)) candidateIds.add(uid);
        }
      }
      // Score only candidates (typically < 500, not 36k)
      let bestCandidate: { uid: string; name: string; score: number; layer: string } | null = null;
      for (const uid of candidateIds) {
        const tokens = uniTokenCache.get(uid);
        if (!tokens || tokens.size < 2) continue;
        const j = jaccardSimilarity(qsTokens, tokens);
        if (j >= 0.45) {
          const contain = containmentScore(qsTokens, tokens);
          const revContain = containmentScore(tokens, qsTokens);
          const layer = (Math.max(contain, revContain) >= 0.8 && j >= 0.5) ? "L6_containment" : "L7_fuzzy_jaccard";
          if (!bestCandidate || j > bestCandidate.score) {
            const uni = uniById.get(uid);
            bestCandidate = { uid, name: uni?.name_en || "", score: j, layer };
          }
        }
      }
      if (bestCandidate) {
        const conf = bestCandidate.layer === "L6_containment"
          ? Math.min(0.92, 0.75 + bestCandidate.score * 0.2)
          : Math.min(0.89, 0.70 + bestCandidate.score * 0.25);
        best = { uid: bestCandidate.uid, name: bestCandidate.name, reason: bestCandidate.layer, conf };
      }
    }

    // ── Apply confidence policy ──
    if (best) {
      if (usedUniIds.has(best.uid)) {
        results.push({ slug: qsSlug, uid: best.uid, name: best.name, reason: best.reason + "_dup", conf: Math.min(best.conf, 0.40), status: "ambiguous" });
      } else if (best.conf >= 0.92) {
        usedUniIds.add(best.uid);
        results.push({ slug: qsSlug, uid: best.uid, name: best.name, reason: best.reason, conf: best.conf, status: "matched" });
      } else if (best.conf >= 0.75) {
        results.push({ slug: qsSlug, uid: best.uid, name: best.name, reason: best.reason, conf: best.conf, status: "ambiguous" });
      } else {
        results.push({ slug: qsSlug, uid: null, name: best.name, reason: best.reason + "_low", conf: best.conf, status: "unmatched" });
      }
    } else {
      results.push({ slug: qsSlug, uid: null, name: "", reason: "no_match", conf: 0, status: "unmatched" });
    }
  }

  // ── Write to staging via upsert ──
  const upsertRows = results.map(r => ({
    slug: r.slug,
    source_url: `https://www.topuniversities.com/universities/${r.slug}`,
    match_university_id: r.uid,
    match_reason: r.reason,
    match_confidence: r.conf,
    match_status: r.status,
  }));
  for (let i = 0; i < upsertRows.length; i += 500) {
    await supabase.from("qs_slug_staging").upsert(upsertRows.slice(i, i + 500), { onConflict: "slug" });
  }

  // ── Build report ──
  const matched = results.filter(r => r.status === "matched");
  const ambiguousR = results.filter(r => r.status === "ambiguous");
  const unmatchedR = results.filter(r => r.status === "unmatched");

  const reasonCounts: Record<string, number> = {};
  for (const r of results) {
    reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
  }

  const report = {
    ok: true,
    phase: "match_v2",
    trace_id: tid,
    firecrawl_credits_used: 0,
    pipeline_counts: {
      sitemap_slugs_in_staging: allSlugs.length,
      universities_in_db: allUnis.length,
      aliases_loaded: aliasMap.size,
    },
    total_matched: matched.length,
    total_ambiguous: ambiguousR.length,
    total_unmatched: unmatchedR.length,
    coverage_pct: allUnis.length > 0 ? +(matched.length / allUnis.length * 100).toFixed(1) : 0,
    qs_coverage_pct: allSlugs.length > 0 ? +(matched.length / allSlugs.length * 100).toFixed(1) : 0,
    breakdown_by_rule: reasonCounts,
    sample_30_matched: matched.sort((a,b) => b.conf - a.conf).slice(0, 30).map(r => ({
      university_id: r.uid, name_en: r.name, qs_slug: r.slug, rule: r.reason, confidence: r.conf,
    })),
    top_50_ambiguous: ambiguousR.sort((a,b) => b.conf - a.conf).slice(0, 50).map(r => ({
      qs_slug: r.slug, candidate_name: r.name, rule: r.reason, confidence: r.conf,
    })),
    top_50_unmatched: unmatchedR.slice(0, 50).map(r => ({
      qs_slug: r.slug, reason: r.reason,
    })),
  };

  slog({ tid, level: "info", action: "match_v2_done", matched: matched.length, ambiguous: ambiguousR.length, unmatched: unmatchedR.length });

  return new Response(JSON.stringify(report, null, 2), {
    headers: { "Content-Type": "application/json", ...cors },
  });
}
