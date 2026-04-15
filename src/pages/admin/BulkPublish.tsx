import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Eye, Rocket, Loader2, CheckCircle, XCircle, Plus, ArrowRight, Square, Database, RefreshCw, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from "xlsx";

interface RecordData {
  name: string;
  city?: string;
  website?: string;
  ranking?: number;
  annual_fees?: number;
  monthly_living?: number;
  logo_url?: string;
  description?: string;
  [key: string]: unknown;
}

interface PreviewResult {
  name: string;
  status: "matched" | "new" | "updated" | "error" | "no_change";
  university_id?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  error?: string;
}

interface DbUni {
  id: string;
  name: string;
  city: string | null;
  website: string | null;
  ranking: number | null;
  annual_fees: number | null;
  monthly_living: number | null;
  logo_url: string | null;
  description: string | null;
}

/** Fields where we OVERWRITE even existing values */
const OVERWRITE_FIELDS = new Set(["ranking"]);

function parseRankingValue(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const raw = String(value).trim();
  if (!raw) return undefined;

  // Handle forms like: "1401+", "1201-1400", "#57", "Rank 88"
  const normalized = raw.replace(/[\s,]/g, "");
  const firstNumber = normalized.match(/(\d{1,5})/);
  if (!firstNumber) return undefined;

  const parsed = Number(firstNumber[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeRows(jsonData: Record<string, unknown>[]): RecordData[] {
  return jsonData.map((row) => {
    const r: RecordData = { name: "" };
    for (const [key, val] of Object.entries(row)) {
      const k = key.toLowerCase().trim().replace(/^\uFEFF/, "");
      if (k === "name" || k === "university" || k === "university_name" || k === "اسم الجامعة" || k === "الجامعة") {
        r.name = String(val || "").trim();
      } else if (k === "city" || k === "المدينة") {
        r.city = String(val || "").trim();
      } else if (k === "website" || k === "الموقع" || k === "الموقع الرسمي") {
        r.website = String(val || "").trim();
      } else if (k === "ranking" || k === "التصنيف" || k === "qs_2026_rank") {
        r.ranking = parseRankingValue(val);
      } else if (k === "annual_fees" || k === "الرسوم السنوية") {
        r.annual_fees = Number(val) || undefined;
      } else if (k === "monthly_living" || k === "تكلفة المعيشة") {
        r.monthly_living = Number(val) || undefined;
      } else if (k === "logo_url" || k === "الشعار") {
        r.logo_url = String(val || "").trim();
      } else if (k === "description" || k === "الوصف") {
        r.description = String(val || "").trim();
      } else {
        r[k] = val;
      }
    }
    return r;
  }).filter((r) => r.name !== "");
}

/** Fetch ALL universities from DB (paginated) */
async function fetchAllUniversities(): Promise<DbUni[]> {
  const all: DbUni[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("universities")
      .select("id, name, city, website, ranking, annual_fees, monthly_living, logo_url, description")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as DbUni[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/** Load file from public/data/ */
async function loadPublicFile(path: string): Promise<RecordData[]> {
  try {
    const response = await fetch(path);
    if (!response.ok) return [];
    
    if (path.endsWith(".csv")) {
      const text = await response.text();
      // Parse CSV manually
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) return [];
      const headers = lines[0].split(",").map(h => h.trim().replace(/^\uFEFF/, ""));
      const rows: Record<string, unknown>[] = [];
      for (let i = 1; i < lines.length; i++) {
        // Handle CSV with commas in values
        const values = lines[i].split(",").map(v => v.trim());
        const row: Record<string, unknown> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
        rows.push(row);
      }
      return normalizeRows(rows);
    } else {
      const buffer = await response.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      return normalizeRows(jsonData);
    }
  } catch (err) {
    console.error(`Failed to load ${path}:`, err);
    return [];
  }
}

/** Merge multiple sources: later sources override earlier for same university+field */
function mergeSources(sources: { name: string; records: RecordData[] }[]): RecordData[] {
  const map = new Map<string, RecordData>();
  
  for (const source of sources) {
    for (const record of source.records) {
      const key = record.name.toLowerCase().trim();
      if (!key) continue;
      const existing = map.get(key) || { name: record.name };
      
      // Merge fields - non-empty values from later sources win
      for (const field of ["city", "website", "logo_url", "description"] as const) {
        if (record[field] && String(record[field]).trim()) {
          existing[field] = String(record[field]).trim();
        }
      }
      for (const field of ["ranking", "annual_fees", "monthly_living"] as const) {
        if (record[field] !== undefined && record[field] !== null) {
          existing[field] = Number(record[field]);
        }
      }
      
      map.set(key, existing);
    }
  }
  
  return Array.from(map.values());
}

/** Normalize a university name for fuzzy matching */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove content in parentheses: "MIT (Massachusetts...)" → "mit"
    .replace(/\s*\(.*?\)\s*/g, " ")
    // Remove common prefixes/suffixes
    .replace(/^the\s+/i, "")
    .replace(/^university of /i, "")
    // Normalize punctuation and special chars
    .replace(/[''`]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/&/g, "and")
    .replace(/[^\w\s'-]/g, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract abbreviation from parentheses: "Massachusetts Institute of Technology (MIT)" → "mit" */
function extractAbbreviation(name: string): string | null {
  const match = name.match(/\(([A-Z]{2,10})\)/);
  return match ? match[1].toLowerCase() : null;
}

/** Build multiple lookup keys for a university name */
function buildLookupKeys(name: string): string[] {
  const keys: string[] = [];
  const lower = name.toLowerCase().trim();
  
  // 1. Exact lowercase
  keys.push(lower);
  
  // 2. Normalized
  keys.push(normalizeName(name));
  
  // 3. Without "The " prefix
  if (lower.startsWith("the ")) keys.push(lower.replace(/^the\s+/, ""));
  else keys.push("the " + lower);
  
  // 4. Without parenthetical content
  const noParens = lower.replace(/\s*\(.*?\)\s*/g, " ").trim();
  if (noParens !== lower) keys.push(noParens);
  
  // 5. Abbreviation only
  const abbr = extractAbbreviation(name);
  if (abbr) keys.push(abbr);
  
  // 6. Content inside parentheses as full name
  const parenMatch = name.match(/\((.+?)\)/);
  if (parenMatch) keys.push(parenMatch[1].toLowerCase().trim());
  
  // 7. Replace "University" ↔ "Université" ↔ "Universidad" ↔ "Universität" etc.
  const uniVariants = ["university", "université", "universidad", "universität", "universidade", "universitas", "universitesi", "üniversitesi"];
  for (const v of uniVariants) {
    if (lower.includes(v)) {
      for (const r of uniVariants) {
        if (r !== v) keys.push(lower.replace(v, r));
      }
    }
  }
  
  // 8. Normalized without "university of" prefix
  const normNoUni = normalizeName(name);
  keys.push(normNoUni);
  
  return [...new Set(keys.filter(k => k.length > 2))];
}

/** Client-side matching & diffing with fuzzy name matching */
function matchAndDiff(records: RecordData[], dbUnis: DbUni[]): PreviewResult[] {
  // Build multiple indexes for DB universities
  const exactMap = new Map<string, DbUni>();
  const normalizedMap = new Map<string, DbUni>();
  const abbrMap = new Map<string, DbUni>();
  
  for (const u of dbUnis) {
    const lower = u.name.toLowerCase().trim();
    exactMap.set(lower, u);
    
    const norm = normalizeName(u.name);
    if (!normalizedMap.has(norm)) normalizedMap.set(norm, u);
    
    const abbr = extractAbbreviation(u.name);
    if (abbr && !abbrMap.has(abbr)) abbrMap.set(abbr, u);
    
    // Also index content inside parentheses
    const parenMatch = u.name.match(/\((.+?)\)/);
    if (parenMatch) {
      const inner = parenMatch[1].toLowerCase().trim();
      if (!exactMap.has(inner)) exactMap.set(inner, u);
    }
    
    // Index without parentheses
    const noParens = lower.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
    if (noParens !== lower && !exactMap.has(noParens)) {
      exactMap.set(noParens, u);
    }
    
    // Index without "The "
    if (lower.startsWith("the ")) {
      const noThe = lower.replace(/^the\s+/, "");
      if (!exactMap.has(noThe)) exactMap.set(noThe, u);
    }
  }

  function findMatch(name: string): DbUni | undefined {
    const keys = buildLookupKeys(name);
    
    // Try exact map first
    for (const k of keys) {
      const found = exactMap.get(k);
      if (found) return found;
    }
    
    // Try normalized map
    for (const k of keys) {
      const found = normalizedMap.get(k);
      if (found) return found;
    }
    
    // Try abbreviation map
    const abbr = extractAbbreviation(name);
    if (abbr) {
      const found = abbrMap.get(abbr);
      if (found) return found;
    }
    
    return undefined;
  }

  return records.map((record) => {
    const cleanName = (record.name || "").trim();
    if (!cleanName) return { name: "(empty)", status: "error" as const, error: "Missing name" };

    const uni = findMatch(cleanName);

    if (!uni) {
      return { name: cleanName, status: "new" as const };
    }

    const changes: Record<string, { old: unknown; new: unknown }> = {};
    
    // String fields: fill gaps only
    for (const key of ["city", "website", "logo_url", "description"] as const) {
      const newVal = record[key];
      if (newVal && typeof newVal === "string" && newVal.trim() !== "") {
        const oldVal = uni[key];
        if (!oldVal || (typeof oldVal === "string" && oldVal.trim() === "")) {
          changes[key] = { old: oldVal ?? null, new: newVal.trim() };
        }
      }
    }
    
    // Numeric fields: fill gaps OR overwrite if in OVERWRITE_FIELDS
    for (const key of ["ranking", "annual_fees", "monthly_living"] as const) {
      const newVal = record[key];
      if (newVal !== undefined && newVal !== null && String(newVal) !== "") {
        const numVal = Number(newVal);
        if (!isNaN(numVal)) {
          if (OVERWRITE_FIELDS.has(key)) {
            if (uni[key] !== numVal) {
              changes[key] = { old: uni[key] ?? null, new: numVal };
            }
          } else {
            if (uni[key] === null || uni[key] === undefined) {
              changes[key] = { old: null, new: numVal };
            }
          }
        }
      }
    }

    if (Object.keys(changes).length === 0) {
      return { name: cleanName, status: "no_change" as const, university_id: uni.id };
    }

    return { name: cleanName, status: "matched" as const, university_id: uni.id, changes };
  });

  
}

interface SourceInfo {
  name: string;
  path: string;
  count: number;
  loaded: boolean;
  description: string;
}

export default function BulkPublish() {
  const [records, setRecords] = useState<RecordData[]>([]);
  const [previewResults, setPreviewResults] = useState<PreviewResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [dbUnis, setDbUnis] = useState<DbUni[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  // Multi-source tracking
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [mergedRecords, setMergedRecords] = useState<RecordData[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  // Progress tracking
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [batchErrors, setBatchErrors] = useState(0);
  const abortRef = useRef(false);
  const [qsExporting, setQsExporting] = useState(false);
  const [qsExportProgress, setQsExportProgress] = useState("");

  const handleExportQsRanking = async () => {
    setQsExporting(true);
    setQsExportProgress("جاري جلب البيانات...");
    try {
      const allRows: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("universities")
          .select("name, ranking, city, website, countries(name_en), country_id, is_active")
          .not("ranking", "is", null)
          .order("ranking", { ascending: true })
          .range(from, from + batchSize - 1);
        if (error) throw error;
        const batch = data || [];
        allRows.push(...batch);
        setQsExportProgress(`جاري الجلب... ${allRows.length} سجل`);
        if (batch.length < batchSize) break;
        from += batchSize;
      }
      const escape = (v: string | null) => {
        if (!v) return "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
      };
      const header = "#,QS_Rank,الجامعة,الدولة,المدينة,الموقع الرسمي,لديها_دولة,نشطة";
      const csvRows = allRows.map((r: any, i: number) =>
        [
          i + 1,
          r.ranking ?? "",
          escape(r.name),
          escape(r.countries?.name_en || ""),
          escape(r.city),
          escape(r.website),
          r.country_id ? "نعم" : "لا",
          r.is_active ? "نعم" : "لا",
        ].join(",")
      );
      const content = "\uFEFF" + [header, ...csvRows].join("\n");
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qs_ranking_universities_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setQsExportProgress(`✅ تم تحميل ${allRows.length} جامعة`);
    } catch (err: any) {
      setQsExportProgress("❌ خطأ: " + (err.message || "حاول مرة أخرى"));
    } finally {
      setQsExporting(false);
    }
  };

  // Auto-load all sources on mount
  useEffect(() => {
    loadAllSources();
  }, []);

  const loadAllSources = async () => {
    setSourcesLoading(true);
    setProgressLabel("جاري تحميل مصادر البيانات...");

    const sourceConfigs: { name: string; path: string; description: string }[] = [];
    // Legacy sources removed — already published

    const loadedSources: { name: string; records: RecordData[] }[] = [];
    const sourceInfos: SourceInfo[] = [];

    for (const cfg of sourceConfigs) {
      const recs = await loadPublicFile(cfg.path);
      sourceInfos.push({
        name: cfg.name,
        path: cfg.path,
        count: recs.length,
        loaded: recs.length > 0,
        description: cfg.description,
      });
      if (recs.length > 0) {
        loadedSources.push({ name: cfg.name, records: recs });
      }
    }

    setSources(sourceInfos);

    // Merge all sources
    const merged = mergeSources(loadedSources);
    setMergedRecords(merged);
    setRecords(merged);

    const totalRecs = sourceInfos.reduce((s, si) => s + si.count, 0);
    toast.success(`✅ تم تحميل ${totalRecs.toLocaleString()} سجل من ${sourceInfos.filter(s => s.loaded).length} مصادر → ${merged.length.toLocaleString()} جامعة فريدة`);
    
    setSourcesLoading(false);
    setProgressLabel("");
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    console.log("[BulkPublish] File selected:", f.name, f.size);
    setPreviewResults([]);
    setPublished(false);
    setStep("upload");
    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      console.log("[BulkPublish] Raw rows:", jsonData.length);
      const parsed = normalizeRows(jsonData);
      console.log("[BulkPublish] Parsed rows:", parsed.length);
      
      if (parsed.length === 0) {
        toast.error("الملف لا يحتوي على بيانات صالحة");
        return;
      }
      
      // Add as additional source and re-merge
      const allSources = [
        { name: "Merged Sources", records: mergedRecords },
        { name: f.name, records: parsed },
      ];
      const merged = mergeSources(allSources);
      setRecords(merged);
      setMergedRecords(merged);
      toast.success(`تم دمج ${parsed.length} سجل إضافي → ${merged.length} جامعة فريدة`);

      // Auto-trigger preview after file upload
      console.log("[BulkPublish] Starting auto-preview, merged:", merged.length, "dbUnis:", dbUnis.length);
      setLoading(true);
      setProgressTotal(merged.length);
      setProgressCurrent(0);
      try {
        let unis = dbUnis;
        if (unis.length === 0) {
          console.log("[BulkPublish] Fetching universities from DB...");
          setDbLoading(true);
          setProgressLabel("جاري تحميل قاعدة البيانات...");
          unis = await fetchAllUniversities();
          console.log("[BulkPublish] Fetched universities:", unis.length);
          setDbUnis(unis);
          setDbLoading(false);
        }
        setProgressLabel("جاري المطابقة...");
        const results = matchAndDiff(merged, unis);
        console.log("[BulkPublish] Match results:", results.length);
        setPreviewResults(results);
        setProgressCurrent(merged.length);
        setStep("preview");
        setProgressLabel("✅ اكتمل التحليل");
        toast.success("تم تحليل البيانات تلقائياً!");
      } catch (previewErr) {
        console.error("[BulkPublish] Auto-preview error:", previewErr);
        toast.error("تم رفع الملف بنجاح، اضغط 'تحليل ومعاينة' للمتابعة");
      } finally {
        setLoading(false);
      }
    } catch (err) {
      console.error("Parse error:", err);
      toast.error("فشل في قراءة الملف");
    }
  }, [mergedRecords, dbUnis]);

  /** Load all DB universities once */
  const ensureDbLoaded = useCallback(async (): Promise<DbUni[]> => {
    if (dbUnis.length > 0) return dbUnis;
    setDbLoading(true);
    setProgressLabel("جاري تحميل قاعدة البيانات...");
    try {
      const unis = await fetchAllUniversities();
      setDbUnis(unis);
      toast.success(`✅ تم تحميل ${unis.length.toLocaleString()} جامعة من قاعدة البيانات`);
      return unis;
    } catch (err) {
      toast.error("فشل تحميل قاعدة البيانات");
      throw err;
    } finally {
      setDbLoading(false);
    }
  }, [dbUnis]);

  /** Preview: instant client-side matching */
  const handlePreview = async () => {
    setLoading(true);
    setProgressTotal(records.length);
    setProgressCurrent(0);
    try {
      const unis = await ensureDbLoaded();
      setProgressLabel("جاري المطابقة...");
      const results = matchAndDiff(records, unis);
      setPreviewResults(results);
      setProgressCurrent(records.length);
      setStep("preview");
      setProgressLabel("✅ اكتمل التحليل");
      toast.success("تم تحليل البيانات فوراً!");
    } catch (err) {
      console.error("Preview error:", err);
      toast.error("فشل التحليل");
    } finally {
      setLoading(false);
    }
  };

  /** Publish: send only actual updates directly via supabase */
  const handlePublish = async () => {
    setPublishing(true);
    abortRef.current = false;
    setBatchErrors(0);

    const updates: { id: string; data: Record<string, unknown> }[] = [];
    const inserts: Record<string, unknown>[] = [];

    for (const r of previewResults) {
      if (r.status === "matched" && r.changes && r.university_id) {
        const data: Record<string, unknown> = {};
        for (const [field, { new: newVal }] of Object.entries(r.changes)) {
          data[field] = newVal;
        }
        updates.push({ id: r.university_id, data });
      } else if (r.status === "new") {
        const rec = records.find((x) => x.name.trim() === r.name);
        if (rec) {
          const insertData: Record<string, unknown> = { name: rec.name };
          if (rec.city) insertData.city = rec.city;
          if (rec.website) insertData.website = rec.website;
          if (rec.logo_url) insertData.logo_url = rec.logo_url;
          if (rec.description) insertData.description = rec.description;
          if (rec.ranking) insertData.ranking = Number(rec.ranking);
          if (rec.annual_fees) insertData.annual_fees = Number(rec.annual_fees);
          if (rec.monthly_living) insertData.monthly_living = Number(rec.monthly_living);
          inserts.push(insertData);
        }
      }
    }

    const totalOps = updates.length + inserts.length;
    setProgressTotal(totalOps);
    setProgressCurrent(0);
    setProgressLabel(`جاري النشر... (${totalOps} عملية)`);

    let done = 0;
    let errorCount = 0;

    const UPDATE_BATCH = 200;
    for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
      if (abortRef.current) break;
      const batch = updates.slice(i, i + UPDATE_BATCH);
      const batchNum = Math.floor(i / UPDATE_BATCH) + 1;
      const totalBatches = Math.ceil(updates.length / UPDATE_BATCH);
      setProgressLabel(`تحديث الدفعة ${batchNum}/${totalBatches} (${Math.min(i + UPDATE_BATCH, updates.length)}/${updates.length})`);

      const promises = batch.map(({ id, data }) =>
        supabase.from("universities").update(data as any).eq("id", id)
      );
      const results = await Promise.all(promises);
      for (const { error } of results) {
        if (error) errorCount++;
      }
      done += batch.length;
      setProgressCurrent(done);
    }

    if (!abortRef.current && inserts.length > 0) {
      for (let i = 0; i < inserts.length; i += UPDATE_BATCH) {
        if (abortRef.current) break;
        const batch = inserts.slice(i, i + UPDATE_BATCH);
        setProgressLabel(`إدراج ${Math.min(i + UPDATE_BATCH, inserts.length)}/${inserts.length}`);
        const { error } = await supabase.from("universities").insert(batch as any);
        if (error) errorCount++;
        done += batch.length;
        setProgressCurrent(done);
      }
    }

    setBatchErrors(errorCount);

    if (!abortRef.current) {
      setPublished(true);
      setStep("done");
      setPreviewResults((prev) =>
        prev.map((r) => (r.status === "matched" ? { ...r, status: "updated" as const } : r))
      );
      setProgressLabel(`✅ تم النشر — تحديث: ${updates.length} | جديد: ${inserts.length} | أخطاء: ${errorCount}`);
      toast.success(`تم النشر! تحديث: ${updates.length} | جديد: ${inserts.length}`);
      setDbUnis([]);
    } else {
      setProgressLabel("⏹ تم الإيقاف");
      toast.info("تم إيقاف النشر");
    }

    setPublishing(false);
  };

  const handleAbort = () => {
    abortRef.current = true;
    setProgressLabel("⏹ جاري الإيقاف...");
  };

  const summary = previewResults.length > 0 ? {
    total: previewResults.length,
    with_changes: previewResults.filter((r) => r.status === "matched" || r.status === "updated").length,
    new: previewResults.filter((r) => r.status === "new").length,
    no_change: previewResults.filter((r) => r.status === "no_change").length,
    errors: previewResults.filter((r) => r.status === "error").length,
    updated: previewResults.filter((r) => r.status === "updated").length,
  } : null;

  const changesOnly = previewResults.filter(
    (r) => (r.status === "matched" && Object.keys(r.changes || {}).length > 0) || r.status === "new" || r.status === "updated" || r.status === "error"
  );

  // Count ranking changes specifically
  const rankingChanges = previewResults.filter(
    (r) => r.changes && r.changes["ranking"]
  ).length;

  const isProcessing = loading || publishing || dbLoading || sourcesLoading;
  const progressPercent = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📦 النشر الجماعي — متعدد المصادر</h1>
        <p className="text-muted-foreground mt-1">دمج QS Ranking + مدن الزحف + المواقع الرسمية → معاينة → نشر</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={step === "upload" ? "default" : "secondary"}>1. تحميل المصادر</Badge>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <Badge variant={step === "preview" ? "default" : "secondary"}>2. معاينة</Badge>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <Badge variant={step === "done" ? "default" : "secondary"}>3. نشر</Badge>
      </div>

      {/* Sources Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            مصادر البيانات
          </CardTitle>
          <CardDescription>
            يتم دمج جميع المصادر تلقائياً — الترتيب (ranking) يُكتب فوق القيم الحالية، باقي الحقول تملأ الفراغات فقط
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sourcesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري تحميل المصادر...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sources.map((s) => (
                  <div
                    key={s.path}
                    className={`p-3 rounded-lg border ${
                      s.loaded ? "border-primary/30 bg-primary/5" : "border-muted bg-muted/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{s.name}</span>
                      {s.loaded ? (
                        <Badge variant="default" className="text-xs">{s.count.toLocaleString()}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">غير موجود</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                  </div>
                ))}
              </div>

              {/* QS Ranking Export Button */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-accent/30 bg-accent/5">
                <div>
                  <p className="text-sm font-medium">📥 تصدير جامعات QS Ranking</p>
                  <p className="text-xs text-muted-foreground">
                    {qsExportProgress || "تحميل ملف CSV بجميع الجامعات التي لديها ترتيب QS"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportQsRanking} disabled={qsExporting} className="gap-2">
                  {qsExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  تحميل CSV
                </Button>
              </div>

              {mergedRecords.length > 0 && (
                <div className="flex items-center justify-between pt-3 border-t">
                  <div>
                    <p className="text-sm font-medium">
                      ✅ إجمالي بعد الدمج: <strong>{mergedRecords.length.toLocaleString()}</strong> جامعة فريدة
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ⚠️ ترتيب QS سيُكتب فوق الترتيب الحالي في قاعدة البيانات
                    </p>
                  </div>
                  <Button onClick={handlePreview} disabled={isProcessing} className="gap-2">
                    <Eye className="w-4 h-4" />
                    تحليل ومعاينة
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Additional file upload */}
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">أو أضف ملف إضافي:</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      {(isProcessing || progressLabel) && progressTotal > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{progressLabel}</p>
              <span className="text-sm text-muted-foreground font-mono">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{progressCurrent.toLocaleString()} / {progressTotal.toLocaleString()}</span>
            </div>
            {batchErrors > 0 && <p className="text-xs text-destructive">⚠️ {batchErrors} خطأ</p>}
            {publishing && (
              <Button onClick={handleAbort} variant="destructive" size="sm" className="gap-2">
                <Square className="w-4 h-4" />
                إيقاف
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {summary && !isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle>📊 ملخص التحليل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{summary.total.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">إجمالي</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-accent/20">
                <div className="text-2xl font-bold text-accent-foreground">{(summary.with_changes || summary.updated).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">سيتم تحديثه</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <div className="text-2xl font-bold text-primary">{summary.new.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">جديد</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-muted-foreground">{(summary.no_change ?? 0).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">بدون تغيير</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-destructive/10">
                <div className="text-2xl font-bold text-destructive">{summary.errors.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">أخطاء</div>
              </div>
            </div>

            {rankingChanges > 0 && (
              <div className="mt-3 p-3 bg-accent/10 rounded-lg text-sm">
                <RefreshCw className="w-4 h-4 inline ml-1" />
                <strong>{rankingChanges.toLocaleString()}</strong> جامعة سيتم تحديث ترتيبها من QS 2026 (كتابة فوق القيم الحالية)
              </div>
            )}

            {!published && step === "preview" && (summary.with_changes > 0 || summary.new > 0) && (
              <Button
                onClick={handlePublish}
                disabled={isProcessing}
                size="lg"
                className="w-full mt-4 gap-2 text-lg"
              >
                <Rocket className="w-5 h-5" />
                🚀 نشر {((summary.with_changes || 0) + summary.new).toLocaleString()} تغيير الآن
              </Button>
            )}

            {published && (
              <div className="mt-4 p-4 bg-accent/20 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                <span className="font-semibold">تم النشر بنجاح!</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Changes table */}
      {changesOnly.length > 0 && !isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {published ? "📋 التغييرات المطبقة" : "📋 التغييرات المقترحة"}
              <Badge variant="outline">{changesOnly.length.toLocaleString()}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الجامعة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التغييرات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changesOnly.slice(0, 200).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{r.name}</TableCell>
                      <TableCell>
                        {r.status === "new" && <Badge variant="secondary"><Plus className="w-3 h-3 ml-1" />جديد</Badge>}
                        {r.status === "matched" && <Badge variant="default">تحديث</Badge>}
                        {r.status === "updated" && <Badge variant="default"><CheckCircle className="w-3 h-3 ml-1" />تم</Badge>}
                        {r.status === "error" && <Badge variant="destructive"><XCircle className="w-3 h-3 ml-1" />خطأ</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.error && <span className="text-destructive">{r.error}</span>}
                        {r.changes && Object.entries(r.changes).map(([field, { old: oldVal, new: newVal }]) => (
                          <div key={field} className="flex items-center gap-1">
                            <span className="font-medium">{field}:</span>
                            {OVERWRITE_FIELDS.has(field) && oldVal !== null ? (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">overwrite</Badge>
                            ) : null}
                            <span className="text-muted-foreground line-through">{String(oldVal ?? "—")}</span>
                            <ArrowRight className="w-3 h-3" />
                            <span className="text-primary">{String(newVal)}</span>
                          </div>
                        ))}
                        {r.status === "new" && !r.changes && <span className="text-primary">سيتم إنشاؤه</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {changesOnly.length > 200 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  يعرض 200 من أصل {changesOnly.length.toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
