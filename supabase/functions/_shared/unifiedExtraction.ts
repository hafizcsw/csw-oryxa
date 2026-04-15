export type EvidenceEntry = { quote: string; url?: string };

export interface UnifiedProgram {
  name: string;
  degree: { raw: string | null; level: string | null };
  discipline_hint?: string | null;
  tuition: {
    usd_min: number | null;
    usd_max: number | null;
    basis: "per_year" | "per_semester" | "per_credit" | "total" | null;
    scope: "international" | "domestic" | "all" | null;
    currency: string | null;
  };
  duration: { months: number | null };
  languages: string[];
  study_mode: "on_campus" | "online" | "hybrid" | null;
  intake_months: number[];
  requirements: {
    ielts_min_overall: number | null;
    toefl_min: number | null;
    gpa_min: number | null;
  };
  scholarship: { available: boolean | null; type: string | null };
  description: string | null;
  evidence: Record<string, EvidenceEntry>;
  source: { url: string; content_hash: string };
}

export const normalizeText = (value: string | null | undefined): string =>
  (value || "").toLowerCase().replace(/\s+/g, " ").trim();

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeProgramKey(sourceUrl: string, name: string, degreeHint: string | null): Promise<string> {
  return sha256Hex(`${normalizeText(sourceUrl)}|${normalizeText(name)}|${normalizeText(degreeHint || "")}`);
}

function basisFromText(value: string): UnifiedProgram["tuition"]["basis"] {
  if (/semester/i.test(value)) return "per_semester";
  if (/credit/i.test(value)) return "per_credit";
  if (/total|full\s*program/i.test(value)) return "total";
  if (/year|annum|annual/i.test(value)) return "per_year";
  return null;
}

function currencyFromText(value: string): string | null {
  if (/\$|usd/i.test(value)) return "USD";
  if (/€|eur/i.test(value)) return "EUR";
  if (/£|gbp/i.test(value)) return "GBP";
  return null;
}

function parseDurationMonths(value: string): number | null {
  const num = value.match(/(\d{1,3})/);
  if (!num) return null;
  const n = Number(num[1]);
  if (/year/i.test(value)) return n * 12;
  return n;
}

function buildProgram(name: string, sourceUrl: string, contentHash: string): UnifiedProgram {
  return {
    name,
    degree: { raw: null, level: null },
    discipline_hint: name,
    tuition: { usd_min: null, usd_max: null, basis: null, scope: null, currency: null },
    duration: { months: null },
    languages: [],
    study_mode: null,
    intake_months: [],
    requirements: { ielts_min_overall: null, toefl_min: null, gpa_min: null },
    scholarship: { available: null, type: null },
    description: null,
    evidence: { name: { quote: name, url: sourceUrl } },
    source: { url: sourceUrl, content_hash: contentHash },
  };
}

function parseHeaderMap(headerLine: string): Record<string, number> {
  const cells = headerLine.split("|").map((v) => normalizeText(v)).filter(Boolean);
  const map: Record<string, number> = {};
  cells.forEach((cell, idx) => {
    if (/program|course|title|name/.test(cell)) map.name = idx;
    if (/degree|qualification|level/.test(cell)) map.degree = idx;
    if (/duration|length/.test(cell)) map.duration = idx;
    if (/tuition|fee|cost/.test(cell)) map.tuition = idx;
    if (/language/.test(cell)) map.language = idx;
  });
  return map;
}

function extractFromTables(markdown: string, sourceUrl: string, contentHash: string): UnifiedProgram[] {
  const programs: UnifiedProgram[] = [];
  const lines = markdown.split("\n");

  for (let i = 0; i < lines.length - 2; i++) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|/.test(lines[i + 1])) continue;
    const header = lines[i];
    const sep = lines[i + 1];
    if (!/---/.test(sep)) continue;

    const map = parseHeaderMap(header);
    if (map.name === undefined) continue;

    let j = i + 2;
    while (j < lines.length && /^\s*\|/.test(lines[j])) {
      const cols = lines[j].split("|").map((v) => v.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const name = cols[map.name]?.trim();
      if (!name || /program|name|---/i.test(name)) {
        j++;
        continue;
      }

      const p = buildProgram(name, sourceUrl, contentHash);
      const degreeCell = map.degree !== undefined ? cols[map.degree] : null;
      const durationCell = map.duration !== undefined ? cols[map.duration] : null;
      const tuitionCell = map.tuition !== undefined ? cols[map.tuition] : null;
      const languageCell = map.language !== undefined ? cols[map.language] : null;

      if (degreeCell) {
        p.degree = { raw: degreeCell, level: normalizeText(degreeCell) };
        p.evidence["degree.raw"] = { quote: degreeCell, url: sourceUrl };
      }
      if (durationCell) {
        p.duration.months = parseDurationMonths(durationCell);
        p.evidence["duration.months"] = { quote: durationCell, url: sourceUrl };
      }
      if (tuitionCell) {
        const n = tuitionCell.match(/(\d{1,3}(?:,\d{3})*)/);
        const amount = n ? Number(n[1].replace(/,/g, "")) : null;
        p.tuition.usd_min = amount;
        p.tuition.usd_max = amount;
        p.tuition.basis = basisFromText(tuitionCell);
        p.tuition.currency = currencyFromText(tuitionCell);
        p.evidence["tuition.usd_min"] = { quote: tuitionCell, url: sourceUrl };
        if (p.tuition.basis) p.evidence["tuition.basis"] = { quote: tuitionCell, url: sourceUrl };
      }
      if (languageCell) {
        p.languages = languageCell.split(/[,/;]/).map((v) => normalizeText(v)).filter(Boolean);
        p.evidence["languages"] = { quote: languageCell, url: sourceUrl };
      }

      programs.push(p);
      j++;
    }

    i = j;
  }

  return programs;
}

function extractFromBullets(markdown: string, sourceUrl: string, contentHash: string): UnifiedProgram[] {
  const programs: UnifiedProgram[] = [];
  for (const b of markdown.matchAll(/^\s*[-*]\s+([^\n]{6,200})$/gm)) {
    const name = b[1].trim();
    if (/tuition|ranking|news/i.test(name)) continue;
    programs.push(buildProgram(name, sourceUrl, contentHash));
  }
  return programs;
}

function extractFromHeadings(markdown: string, sourceUrl: string, contentHash: string): UnifiedProgram[] {
  const programs: UnifiedProgram[] = [];
  for (const m of markdown.matchAll(/^#{2,4}\s+([^\n]{4,180})$/gm)) {
    const title = m[1].trim();
    if (/programs?|admissions?|fees?|requirements?/i.test(title)) continue;
    if (/undergraduate|postgraduate|graduate/i.test(title)) continue;

    const p = buildProgram(title, sourceUrl, contentHash);
    const near = markdown.slice(Math.max(0, m.index || 0), Math.min(markdown.length, (m.index || 0) + 240));
    const tuitionMatch = near.match(/(?:USD|\$)\s?(\d{1,3}(?:,\d{3})*)[^\n]{0,30}/i);
    if (tuitionMatch) {
      const snippet = tuitionMatch[0];
      const amount = Number(tuitionMatch[1].replace(/,/g, ""));
      p.tuition.usd_min = amount;
      p.tuition.usd_max = amount;
      p.tuition.basis = basisFromText(snippet);
      p.tuition.currency = currencyFromText(snippet) || "USD";
      p.evidence["tuition.usd_min"] = { quote: snippet, url: sourceUrl };
      if (p.tuition.basis) p.evidence["tuition.basis"] = { quote: snippet, url: sourceUrl };
    }
    const durationMatch = near.match(/\b\d{1,3}\s*(?:months?|years?)\b/i);
    if (durationMatch) {
      p.duration.months = parseDurationMonths(durationMatch[0]);
      p.evidence["duration.months"] = { quote: durationMatch[0], url: sourceUrl };
    }
    programs.push(p);
  }
  return programs;
}

export function extractProgramsRegex(markdown: string, sourceUrl: string, contentHash: string): UnifiedProgram[] {
  const merged = [
    ...extractFromTables(markdown, sourceUrl, contentHash),
    ...extractFromBullets(markdown, sourceUrl, contentHash),
    ...extractFromHeadings(markdown, sourceUrl, contentHash),
  ];

  const seen = new Set<string>();
  return merged.filter((p) => {
    const key = normalizeText(p.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function enforceEvidenceGuard(program: UnifiedProgram, sourceText: string): { program: UnifiedProgram; rejections: string[] } {
  const rejections: string[] = [];
  const hasQuote = (path: string) => {
    const quote = program.evidence?.[path]?.quote;
    return Boolean(quote && sourceText.includes(quote));
  };

  if (program.tuition.usd_min !== null && !hasQuote("tuition.usd_min")) {
    program.tuition.usd_min = null;
    program.tuition.usd_max = null;
    program.tuition.basis = null;
    program.tuition.scope = null;
    rejections.push("evidence_not_found:tuition.usd_min");
  }
  if (program.tuition.basis && !hasQuote("tuition.basis")) {
    program.tuition.basis = null;
    rejections.push("evidence_not_found:tuition.basis");
  }
  if (program.tuition.scope && !hasQuote("tuition.scope")) {
    program.tuition.scope = null;
    rejections.push("evidence_not_found:tuition.scope");
  }
  if (program.requirements.ielts_min_overall !== null && !hasQuote("requirements.ielts_min_overall")) {
    program.requirements.ielts_min_overall = null;
    rejections.push("evidence_not_found:requirements.ielts_min_overall");
  }
  if (program.requirements.toefl_min !== null && !hasQuote("requirements.toefl_min")) {
    program.requirements.toefl_min = null;
    rejections.push("evidence_not_found:requirements.toefl_min");
  }
  if (program.requirements.gpa_min !== null && !hasQuote("requirements.gpa_min")) {
    program.requirements.gpa_min = null;
    rejections.push("evidence_not_found:requirements.gpa_min");
  }
  if (program.description && !hasQuote("description")) {
    program.description = null;
    rejections.push("evidence_not_found:description");
  }

  return { program, rejections };
}
