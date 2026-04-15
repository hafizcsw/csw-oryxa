import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Globe,
  Search,
  ShieldCheck,
  Upload,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Eye,
  Target,
  X,
  FileText,
  Link2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ── Types ─────────────────────────────────────────────── */

interface PreflightResult {
  total_eligible: number;
  with_website: number;
  without_website: number;
  already_enriched: number;
  needs_crawl: number;
  blockers: string[];
}

/*
  Status Mapping Contract (mirrors orchestrator):
  ─────────────────────────────────────────────────
  Raw DB crawl_status → UI counter:
  
  queued / fetching / extracting → in-progress (not counted as "processed")
  verifying       → crawled
  verified        → crawled + verified
  published       → crawled + verified + published (actual DB write)
  published_partial → crawled + verified + published (obs-only, no DB write needed)
  quarantined     → quarantined
  failed          → failed
  special         → special_queue
  
  UI "تم النشر" combines published + published_partial
*/

interface JobStatus {
  id: string;
  status: string;
  phase: "crawl" | "verify" | "publish" | "idle";
  total: number;
  crawled: number;
  verified: number;
  published: number; // published + published_partial combined
  published_actual: number; // only rows with actual DB writes
  quarantined: number;
  failed: number;
  special_queue: number;
  started_at: string | null;
  updated_at: string | null;
}

interface CoverageStats {
  description: {
    attempted: number;
    found: number;
    verified: number;
    published: number;
  };
  logo: {
    attempted: number;
    found: number;
    verified: number;
    published: number;
  };
  programs: {
    attempted: number;
    found: number;
    verified: number;
    published: number;
  };
  fees: {
    attempted: number;
    found: number;
    verified: number;
    published: number;
  };
  housing: {
    attempted: number;
    found: number;
    verified: number;
    published: number;
  };
  images: {
    attempted: number;
    found: number;
    verified: number;
    published: number;
  };
  contact: {
    attempted: number;
    found: number;
    verified: number;
    published: number;
  };
}

interface ReasonCodeSummary {
  code: string;
  count: number;
}

interface CrawlFileArtifact {
  id: string;
  file_name: string | null;
  source_url: string;
  source_page_url: string | null;
  parse_status: string;
  artifact_type: string;
  mime_type: string | null;
  parsed_pages: number | null;
  file_size_bytes: number | null;
  storage_path: string | null;
  created_at: string;
}

interface CrawlRowDetail {
  id: string;
  job_id: string;
  university_id: string;
  university_name: string | null;
  crawl_status: string;
  pages_scraped: number | null;
  pages_mapped: number | null;
  reason_codes: string[] | null;
  error_message: string | null;
  updated_at: string;
}

const PARSE_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending: {
    label: "Discovered",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  },
  parsed: {
    label: "Downloaded",
    tone: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  },
  extracted: {
    label: "Processed",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  parse_failed: {
    label: "Failed",
    tone: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  },
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileLabel(file: CrawlFileArtifact) {
  return (
    file.file_name ||
    file.source_url.split("/").pop() ||
    file.artifact_type ||
    "PDF file"
  );
}

/* ── Component ─────────────────────────────────────────── */

interface CountryOption {
  country_code: string;
  name_ar: string;
  name_en: string | null;
}

interface UniOption {
  id: string;
  name: string;
  website: string | null;
  country_code: string | null;
}

export function OfficialSiteCrawlPanel() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [coverage, setCoverage] = useState<CoverageStats | null>(null);
  const [reasonCodes, setReasonCodes] = useState<ReasonCodeSummary[]>([]);
  const [rankMode, setRankMode] = useState<string>("all");

  // Country selector state
  const [countrySearch, setCountrySearch] = useState("");
  const [countryResults, setCountryResults] = useState<CountryOption[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(
    null,
  );
  const [searchingCountry, setSearchingCountry] = useState(false);

  // University selector state
  const [uniSearch, setUniSearch] = useState("");
  const [uniResults, setUniResults] = useState<UniOption[]>([]);
  const [selectedUniIds, setSelectedUniIds] = useState<string[]>([]);
  const [selectedUniNames, setSelectedUniNames] = useState<string[]>([]);
  const [seedUrls, setSeedUrls] = useState("");
  const [maxPages, setMaxPages] = useState("20");
  const [searchingUni, setSearchingUni] = useState(false);
  const [crawlFiles, setCrawlFiles] = useState<CrawlFileArtifact[]>([]);
  const [crawlFilesLoading, setCrawlFilesLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CrawlRowDetail | null>(null);
  const [lastRunSelection, setLastRunSelection] = useState<{
    country: CountryOption | null;
    uniIds: string[];
    uniNames: string[];
    seedUrls: string;
    maxPages: string;
  } | null>(null);
  const jobRef = useRef(job);
  jobRef.current = job;

  // Fetch active job status
  const fetchStatus = useCallback(async () => {
    try {
      const data = await api("/official-site-crawl-orchestrator", {
        method: "POST",
        body: { action: "status" },
      });
      if (data.job) {
        const sc = data.synced_counters || {};
        const rs = data.row_stats || {};
        const published = sc.published ?? rs.published ?? 0;
        const publishedPartial =
          sc.published_partial ?? rs.published_partial ?? 0;
        const verified = sc.verified ?? rs.verified ?? 0;
        const verifying = sc.verifying ?? rs.verifying ?? 0;
        const quarantined = sc.quarantined ?? rs.quarantined ?? 0;
        const failed = sc.failed ?? rs.failed ?? 0;
        const special = sc.special ?? rs.special ?? 0;
        setJob({
          id: data.job.id,
          status: data.job.status,
          phase: data.job.phase || "idle",
          total: sc.total ?? data.job.total_universities ?? 0,
          crawled:
            verifying + verified + published + publishedPartial + quarantined,
          verified: verified + published + publishedPartial,
          published: published + publishedPartial,
          published_actual: published,
          quarantined,
          failed,
          special_queue: special,
          started_at: data.job.started_at,
          updated_at: data.job.updated_at,
        });
      }
      if (data.coverage) setCoverage(data.coverage);
      if (data.reason_codes) setReasonCodes(data.reason_codes);
    } catch {
      /* No active job */
    }
  }, []);

  // Poll status
  useEffect(() => {
    fetchStatus();
    const iv = setInterval(async () => {
      await fetchStatus();
      const current = jobRef.current;
      if (current && current.status === "crawling") {
        try {
          await api("/official-site-crawl-orchestrator", {
            method: "POST",
            body: { action: "tick", job_id: current.id },
          });
        } catch {
          /* tick failed */
        }
      }
    }, 5_000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  // Country search against countries table
  const searchCountries = useCallback(async (q: string) => {
    if (q.length < 1) {
      setCountryResults([]);
      return;
    }
    setSearchingCountry(true);
    try {
      const { data } = await supabase
        .from("countries")
        .select("country_code, name_ar, name_en")
        .or(
          `name_ar.ilike.%${q}%,name_en.ilike.%${q}%,country_code.ilike.%${q}%`,
        )
        .order("name_en")
        .limit(10);
      setCountryResults(
        (data || []).map((c) => ({
          country_code: c.country_code,
          name_ar: c.name_ar,
          name_en: c.name_en,
        })),
      );
    } catch {
      setCountryResults([]);
    } finally {
      setSearchingCountry(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchCountries(countrySearch), 250);
    return () => clearTimeout(t);
  }, [countrySearch, searchCountries]);

  // University search — linked to selected country
  const searchUniversities = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setUniResults([]);
        return;
      }
      setSearchingUni(true);
      try {
        let query = supabase
          .from("universities")
          .select("id, name_en, website, country_code")
          .or(`name_en.ilike.%${q}%,name_ar.ilike.%${q}%`)
          .not("website", "is", null)
          .order("cwur_world_rank", { ascending: true, nullsFirst: false })
          .limit(10);
        // Restrict to selected country
        if (selectedCountry) {
          query = query.eq("country_code", selectedCountry.country_code);
        }
        const { data } = await query;
        setUniResults(
          (data || []).map((u) => ({
            id: u.id,
            name: u.name_en || u.id,
            website: u.website,
            country_code: u.country_code,
          })),
        );
      } catch {
        setUniResults([]);
      } finally {
        setSearchingUni(false);
      }
    },
    [selectedCountry],
  );

  useEffect(() => {
    const t = setTimeout(() => searchUniversities(uniSearch), 300);
    return () => clearTimeout(t);
  }, [uniSearch, searchUniversities]);

  // When country changes, reset incompatible university selection
  const handleSelectCountry = (c: CountryOption) => {
    setSelectedCountry(c);
    setCountrySearch("");
    setCountryResults([]);
    // Reset university selection (stale state prevention)
    setSelectedUniIds([]);
    setSelectedUniNames([]);
    setSeedUrls("");
    setUniSearch("");
    setUniResults([]);
  };

  const handleClearCountry = () => {
    setSelectedCountry(null);
    setSelectedUniIds([]);
    setSelectedUniNames([]);
    setSeedUrls("");
  };

  // Select a university — auto-fill country if not set
  const handleSelectUniversity = async (u: UniOption) => {
    if (!selectedUniIds.includes(u.id)) {
      setSelectedUniIds((p) => [...p, u.id]);
      setSelectedUniNames((p) => [...p, u.name]);
    }
    setUniSearch("");
    setUniResults([]);

    // Auto-fill country from university if not already set
    if (!selectedCountry && u.country_code) {
      try {
        const { data } = await supabase
          .from("countries")
          .select("country_code, name_ar, name_en")
          .eq("country_code", u.country_code)
          .single();
        if (data) {
          setSelectedCountry({
            country_code: data.country_code,
            name_ar: data.name_ar,
            name_en: data.name_en,
          });
        }
      } catch {
        /* couldn't auto-fill */
      }
    }
  };

  const handleRemoveUniversity = (index: number) => {
    setSelectedUniIds((p) => p.filter((_, j) => j !== index));
    setSelectedUniNames((p) => p.filter((_, j) => j !== index));
    setSeedUrls(""); // Clear seeds when university changes
  };

  // Preflight check
  const runPreflight = async () => {
    if (selectedUniIds.length > 0 || selectedCountry) {
      // Skip preflight for targeted crawl, go straight to create
      startCrawl();
      return;
    }
    setLoading(true);
    try {
      const data = await api("/official-site-crawl-orchestrator", {
        method: "POST",
        body: { action: "preflight", rank_mode: rankMode },
      });
      setPreflight(data);
      setShowConfirm(true);
    } catch (err: any) {
      toast({
        title: "خطأ في الفحص",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Create & start crawl job
  const startCrawl = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      const createBody: any = {
        action: "create",
        rank_mode: rankMode,
        max_pages_per_uni: parseInt(maxPages) || 20,
      };
      if (selectedUniIds.length > 0) {
        createBody.university_ids = selectedUniIds;
        if (seedUrls.trim())
          createBody.seed_urls = seedUrls
            .trim()
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean);
      }
      if (selectedCountry)
        createBody.country_codes = [selectedCountry.country_code];
      const data = await api("/official-site-crawl-orchestrator", {
        method: "POST",
        body: createBody,
      });
      setLastRunSelection({
        country: selectedCountry,
        uniIds: selectedUniIds,
        uniNames: selectedUniNames,
        seedUrls,
        maxPages,
      });
      toast({
        title: "تم بدء الزحف",
        description: `Job ${data.job?.id?.slice(0, 8)}`,
      });
      await fetchStatus();
      await loadSelectionEvidence(
        selectedUniIds[0] || null,
        data.job?.id || null,
      );
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Job actions — guard against sending tick when not crawling
  const jobAction = async (action: string) => {
    if (!job) return;
    // Guard: don't send tick if not crawling
    if (action === "tick" && job.status !== "crawling") return;
    // Guard: don't verify if nothing crawled
    if (action === "start_verify" && job.crawled === 0) return;
    // Guard: don't publish if nothing verified
    if (action === "start_publish" && job.verified === 0) return;

    setLoading(true);
    try {
      await api("/official-site-crawl-orchestrator", {
        method: "POST",
        body: { action, job_id: job.id },
      });
      toast({ title: `تم: ${action}` });
      fetchStatus();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const activeTargetUniversityId = useMemo(
    () => selectedUniIds[0] || lastRunSelection?.uniIds?.[0] || null,
    [selectedUniIds, lastRunSelection],
  );

  const loadSelectionEvidence = useCallback(
    async (universityId: string | null, jobId?: string | null) => {
      if (!universityId) {
        setCrawlFiles([]);
        setSelectedRow(null);
        return;
      }

      setCrawlFilesLoading(true);
      try {
        let rowQuery = supabase
          .from("official_site_crawl_rows")
          .select(
            "id, job_id, university_id, university_name, crawl_status, pages_scraped, pages_mapped, reason_codes, error_message, updated_at",
          )
          .eq("university_id", universityId)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (jobId) rowQuery = rowQuery.eq("job_id", jobId);
        const { data: rowData } = await rowQuery;
        const row = (rowData?.[0] as CrawlRowDetail | undefined) || null;
        setSelectedRow(row);

        let fileQuery = supabase
          .from("crawl_file_artifacts")
          .select(
            "id, file_name, source_url, source_page_url, parse_status, artifact_type, mime_type, parsed_pages, file_size_bytes, storage_path, created_at",
          )
          .eq("university_id", universityId)
          .order("created_at", { ascending: false })
          .limit(25);
        if (row?.job_id) fileQuery = fileQuery.eq("job_id", row.job_id);
        const { data: fileData } = await fileQuery;
        setCrawlFiles((fileData as CrawlFileArtifact[]) || []);
      } catch (error) {
        console.error("Selection evidence load failed", error);
        setCrawlFiles([]);
        setSelectedRow(null);
      } finally {
        setCrawlFilesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadSelectionEvidence(activeTargetUniversityId, job?.id);
  }, [activeTargetUniversityId, job?.id, loadSelectionEvidence]);

  const isActive =
    job && ["crawling", "verifying", "publishing"].includes(job.status);
  const isPaused = job?.status === "paused";
  const totalProcessed = job ? job.crawled + job.failed + job.special_queue : 0;
  const progressPct =
    job && job.total > 0 ? Math.round((totalProcessed / job.total) * 100) : 0;
  const selectedTargetLabel =
    selectedUniNames.join(", ") ||
    (selectedCountry
      ? `${selectedCountry.name_en || selectedCountry.name_ar} (${selectedCountry.country_code})`
      : "No scoped target selected");
  const canRunSelectedCrawl = Boolean(
    selectedCountry || selectedUniIds.length > 0,
  );
  const fileCounts = {
    discovered: crawlFiles.filter((file) => file.parse_status === "pending")
      .length,
    downloaded: crawlFiles.filter((file) => file.parse_status === "parsed")
      .length,
    processed: crawlFiles.filter((file) => file.parse_status === "extracted")
      .length,
    failed: crawlFiles.filter((file) => file.parse_status === "parse_failed")
      .length,
  };

  return (
    <div className="space-y-4">
      {/* ── Row 0: Targeting Controls ── */}
      <Card className="border-dashed">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">استهداف الزحف</h3>
            {selectedUniIds.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedUniIds.length} جامعة مختارة
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Country selector — searches countries table */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                الدولة (بحث بالعربي أو الإنجليزي)
              </Label>
              {selectedCountry ? (
                <div className="flex items-center gap-2 h-8 px-2.5 border rounded-md bg-muted/30">
                  <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-medium flex-1 truncate">
                    {selectedCountry.name_ar} — {selectedCountry.name_en || ""}{" "}
                    ({selectedCountry.country_code})
                  </span>
                  <button onClick={handleClearCountry} className="shrink-0">
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Globe className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="اكتب اسم الدولة... (روسيا، Russia، TR)"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="h-8 text-xs pr-8"
                  />
                  {searchingCountry && (
                    <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
              {countryResults.length > 0 && !selectedCountry && (
                <div className="border rounded-md max-h-36 overflow-y-auto bg-popover shadow-md">
                  {countryResults.map((c) => (
                    <button
                      key={c.country_code}
                      className="w-full text-right px-3 py-2 text-xs hover:bg-accent flex items-center justify-between gap-2"
                      onClick={() => handleSelectCountry(c)}
                    >
                      <span className="truncate">
                        {c.name_ar} — {c.name_en || ""}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {c.country_code}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* University search — restricted to selected country */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                بحث عن جامعة محددة
                {selectedCountry && (
                  <span className="text-muted-foreground mr-1">
                    (في {selectedCountry.name_ar})
                  </span>
                )}
              </Label>
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={
                    selectedCountry
                      ? `ابحث في جامعات ${selectedCountry.name_ar}...`
                      : "اكتب اسم الجامعة..."
                  }
                  value={uniSearch}
                  onChange={(e) => setUniSearch(e.target.value)}
                  className="h-8 text-xs pr-8"
                />
                {searchingUni && (
                  <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              {uniResults.length > 0 && (
                <div className="border rounded-md max-h-36 overflow-y-auto bg-popover shadow-md">
                  {uniResults.map((u) => (
                    <button
                      key={u.id}
                      className="w-full text-right px-3 py-2 text-xs hover:bg-accent flex items-center justify-between gap-2"
                      onClick={() => handleSelectUniversity(u)}
                    >
                      <span className="truncate flex-1">{u.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {u.country_code && (
                          <Badge variant="outline" className="text-[9px]">
                            {u.country_code}
                          </Badge>
                        )}
                        {u.website && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                            {u.website.replace(/^https?:\/\//, "").slice(0, 25)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {/* Selected universities */}
              {selectedUniIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedUniNames.map((name, i) => (
                    <Badge
                      key={selectedUniIds[i]}
                      variant="outline"
                      className="text-[10px] gap-1 pr-1"
                    >
                      {name.slice(0, 30)}
                      <button onClick={() => handleRemoveUniversity(i)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Settings + run controls */}
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <div>
                  <p className="text-[11px] font-semibold text-foreground">
                    Selection ready for crawl testing
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Country + specific university stay in the panel, so rerun
                    does not require manual re-entry.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCountry && (
                    <Badge variant="secondary" className="text-[10px]">
                      Country:{" "}
                      {selectedCountry.name_en || selectedCountry.name_ar} (
                      {selectedCountry.country_code})
                    </Badge>
                  )}
                  {selectedUniNames.map((name, index) => (
                    <Badge
                      key={`${selectedUniIds[index]}-selected`}
                      variant="outline"
                      className="text-[10px]"
                    >
                      University: {name}
                    </Badge>
                  ))}
                  {!selectedCountry && selectedUniNames.length === 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      Select a country or university to enable direct crawl run.
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">
                    Pages / university
                  </Label>
                  <Input
                    type="number"
                    value={maxPages}
                    onChange={(e) => setMaxPages(e.target.value)}
                    className="h-8 text-xs w-24"
                    min={5}
                    max={50}
                  />
                </div>
                <Button
                  onClick={runPreflight}
                  disabled={loading || !canRunSelectedCrawl}
                  className="gap-1.5"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Run crawl now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || !lastRunSelection}
                  onClick={() => {
                    if (!lastRunSelection) return;
                    setSelectedCountry(lastRunSelection.country);
                    setSelectedUniIds(lastRunSelection.uniIds);
                    setSelectedUniNames(lastRunSelection.uniNames);
                    setSeedUrls(lastRunSelection.seedUrls);
                    setMaxPages(lastRunSelection.maxPages);
                    void startCrawl();
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-4 w-4" />
                  Rerun same target
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    handleClearCountry();
                    setUniSearch("");
                    setLastRunSelection(null);
                    setCrawlFiles([]);
                    setSelectedRow(null);
                  }}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset selection
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-[11px] md:grid-cols-3">
              <div className="rounded-md border bg-background px-3 py-2">
                <p className="font-medium text-foreground">Current target</p>
                <p className="text-muted-foreground break-words">
                  {selectedTargetLabel}
                </p>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <p className="font-medium text-foreground">
                  Job tied to evidence
                </p>
                <p className="text-muted-foreground">
                  {selectedRow?.job_id
                    ? selectedRow.job_id.slice(0, 8)
                    : job?.id?.slice(0, 8) || "No crawl job yet"}
                </p>
              </div>
              <div className="rounded-md border bg-background px-3 py-2">
                <p className="font-medium text-foreground">Row status</p>
                <p className="text-muted-foreground">
                  {selectedRow?.crawl_status || job?.status || "idle"}
                </p>
              </div>
            </div>
          </div>

          {/* Seed URLs — visible when university is selected */}
          {selectedUniIds.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                روابط بذرية (Seed URLs) — اختياري، سطر لكل رابط
              </Label>
              <Textarea
                placeholder="https://english.spbstu.ru/education/programs/programs-in-english/&#10;https://english.spbstu.ru/education/admissions/"
                value={seedUrls}
                onChange={(e) => setSeedUrls(e.target.value)}
                rows={3}
                className="text-xs font-mono"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Crawl evidence for selected target
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">
                Discovered PDFs
              </p>
              <p className="text-xl font-semibold">{fileCounts.discovered}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">
                Downloaded PDFs
              </p>
              <p className="text-xl font-semibold">{fileCounts.downloaded}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">
                Processed PDFs
              </p>
              <p className="text-xl font-semibold">{fileCounts.processed}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">Failed PDFs</p>
              <p className="text-xl font-semibold">{fileCounts.failed}</p>
            </div>
          </div>

          {selectedRow && (
            <div className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium text-foreground">
                  University row:
                </span>{" "}
                {selectedRow.university_name || activeTargetUniversityId}
              </p>
              <p>
                <span className="font-medium text-foreground">
                  Pages scraped/mapped:
                </span>{" "}
                {selectedRow.pages_scraped ?? 0} /{" "}
                {selectedRow.pages_mapped ?? 0}
              </p>
              {selectedRow.reason_codes &&
                selectedRow.reason_codes.length > 0 && (
                  <p>
                    <span className="font-medium text-foreground">
                      Reason codes:
                    </span>{" "}
                    {selectedRow.reason_codes.join(", ")}
                  </p>
                )}
              {selectedRow.error_message && (
                <p className="text-destructive">
                  <span className="font-medium">Error:</span>{" "}
                  {selectedRow.error_message}
                </p>
              )}
            </div>
          )}

          {crawlFilesLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading crawl
              files…
            </div>
          ) : crawlFiles.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
              No PDF/file artifacts found yet for the selected target and job.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Filename</th>
                    <th className="px-3 py-2 font-medium">Reference</th>
                    <th className="px-3 py-2 font-medium">Source page</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {crawlFiles.map((file) => {
                    const statusMeta =
                      PARSE_STATUS_LABELS[file.parse_status] ||
                      PARSE_STATUS_LABELS.pending;
                    return (
                      <tr key={file.id} className="border-t align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">
                            {getFileLabel(file)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {file.mime_type || file.artifact_type}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <a
                            href={file.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Link2 className="h-3 w-3" /> {file.source_url}
                          </a>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {file.source_page_url ? (
                            <a
                              href={file.source_page_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Eye className="h-3 w-3" /> {file.source_page_url}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={`text-[11px] ${statusMeta.tone}`}>
                            {statusMeta.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          <div>
                            {file.parsed_pages != null
                              ? `${file.parsed_pages} pages`
                              : "—"}
                          </div>
                          <div>{formatBytes(file.file_size_bytes)}</div>
                          <div
                            className={
                              file.storage_path
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }
                          >
                            {file.storage_path
                              ? "Stored artifact"
                              : "No stored file path"}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pipeline Phases ── */}
      <div className="space-y-3">
        {/* Phase indicator */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-1">
          <span
            className={`font-semibold ${!job || job.status === "idle" ? "text-primary" : "text-muted-foreground"}`}
          >
            ① الاستهداف
          </span>
          <span>→</span>
          <span
            className={`font-semibold ${job?.status === "crawling" ? "text-primary" : ""}`}
          >
            ② الزحف
          </span>
          <span>→</span>
          <span
            className={`font-semibold ${job?.status === "verifying" ? "text-amber-600" : ""}`}
          >
            ③ التحقق
          </span>
          <span>→</span>
          <span
            className={`font-semibold ${job?.status === "publishing" ? "text-green-600" : ""}`}
          >
            ④ النشر
          </span>
          {job?.status === "done" && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 mr-2 text-green-600 border-green-300"
            >
              ✓ مكتمل
            </Badge>
          )}
        </div>

        {/* Phase 2: Crawl Start */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">
                  {selectedUniIds.length > 0
                    ? `② زحف مستهدف (${selectedUniIds.length})`
                    : "② زحف المواقع الرسمية"}
                </h3>
              </div>
              {job && job.crawled > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {job.crawled} تم زحفها
                </Badge>
              )}
            </div>

            {/* Run summary box */}
            {selectedUniIds.length > 0 ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-primary">
                    زحف جامعة محددة
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pr-6">
                  <span className="text-muted-foreground">الجامعات:</span>
                  <span className="font-medium">
                    {selectedUniNames.join("، ")}
                  </span>
                  <span className="text-muted-foreground">
                    الحد الأقصى للصفحات:
                  </span>
                  <span className="font-medium">{maxPages} صفحة / جامعة</span>
                  {seedUrls.trim() && (
                    <>
                      <span className="text-muted-foreground">
                        روابط بذرية:
                      </span>
                      <span className="font-medium">
                        {seedUrls.trim().split("\n").filter(Boolean).length}{" "}
                        رابط
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : selectedCountry ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-primary">
                    زحف على مستوى الدولة
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pr-6">
                  <span className="text-muted-foreground">الدولة:</span>
                  <span className="font-medium">
                    {selectedCountry.name_ar} ({selectedCountry.country_code})
                  </span>
                  <span className="text-muted-foreground">النطاق:</span>
                  <span className="font-medium">
                    {rankMode === "all"
                      ? "جميع الجامعات"
                      : rankMode === "top500"
                        ? "Top 500"
                        : rankMode === "top1000"
                          ? "Top 1000"
                          : "تجريبي (10 جامعات)"}
                  </span>
                  <span className="text-muted-foreground">
                    الحد الأقصى للصفحات:
                  </span>
                  <span className="font-medium">{maxPages} صفحة / جامعة</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs font-medium text-destructive">
                  يرجى اختيار جامعة أو دولة أولاً لتحديد نطاق الزحف
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              {selectedUniIds.length === 0 && selectedCountry != null && (
                <Select value={rankMode} onValueChange={setRankMode}>
                  <SelectTrigger className="h-8 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="top500">Top 500</SelectItem>
                    <SelectItem value="top1000">Top 1000</SelectItem>
                    <SelectItem value="pilot10">تجريبي (10)</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button
                size="sm"
                onClick={runPreflight}
                disabled={
                  loading ||
                  !!isActive ||
                  (selectedUniIds.length === 0 && !selectedCountry)
                }
                className="gap-1.5"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {selectedUniIds.length > 0
                  ? "بدء زحف الجامعة"
                  : selectedCountry
                    ? "بدء زحف الدولة"
                    : "فحص وبدء"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Phase 3: Verify — only visible when job exists and has crawled rows */}
        {job && job.crawled > 0 && (
          <Card
            className={`border-amber-500/30 transition-opacity ${job.status === "crawling" ? "opacity-50" : "bg-amber-500/5"}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-amber-600" />
                    <div>
                      <h3 className="font-semibold text-sm">
                        ③ التحقق — 8 قواعد جودة
                      </h3>
                      <p className="text-[10px] text-muted-foreground">
                        فحص المصدر الرسمي، قوة الدليل، العملة، فترة الفوترة،
                        دورة 2025-2026، ثقة ≥ 0.4
                      </p>
                    </div>
                  </div>
                  {job.verified > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-amber-100 text-amber-800"
                    >
                      {job.verified} تم تحققها
                    </Badge>
                  )}
                  {(job as any).quarantined > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {(job as any).quarantined} محجور
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => jobAction("start_verify")}
                  disabled={
                    loading ||
                    !job ||
                    job.crawled === 0 ||
                    job.status === "crawling"
                  }
                  className="gap-1.5 border-amber-500/50 text-amber-700 hover:bg-amber-50"
                >
                  {job.status === "verifying" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  بدء التحقق
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phase 4: Publish — only visible when job has verified rows */}
        {job && job.verified > 0 && (
          <Card
            className={`border-green-500/30 transition-opacity ${["crawling", "verifying"].includes(job.status) ? "opacity-50" : "bg-green-500/5"}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-green-600" />
                    <div>
                      <h3 className="font-semibold text-sm">
                        ④ النشر — Lane A/B فقط
                      </h3>
                      <p className="text-[10px] text-muted-foreground">
                        A: وصف + شعار (ملء فارغ) · B: برامج + سكن (تسجيل فقط) ·
                        C: رسوم (محجورة)
                      </p>
                    </div>
                  </div>
                  {(job as any).published > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-green-100 text-green-800"
                    >
                      {(job as any).published} منشور
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => jobAction("start_publish")}
                  disabled={
                    loading ||
                    !job ||
                    job.verified === 0 ||
                    ["crawling", "verifying"].includes(job.status)
                  }
                  className="gap-1.5 border-green-500/50 text-green-700 hover:bg-green-50"
                >
                  {job.status === "publishing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  نشر المعتمد
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Row 2: Active Job Progress ── */}
      {job && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                حالة المهمة
                <Badge
                  variant={
                    isActive ? "default" : isPaused ? "secondary" : "outline"
                  }
                  className="text-xs"
                >
                  {job.status === "crawling" && "جاري الزحف"}
                  {job.status === "verifying" && "جاري التحقق"}
                  {job.status === "publishing" && "جاري النشر"}
                  {job.status === "paused" && "متوقف مؤقتاً"}
                  {job.status === "done" && "مكتمل"}
                  {job.status === "failed" && "فشل"}
                  {job.status === "cancelled" && "ملغى"}
                  {job.status === "idle" && "في الانتظار"}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {isActive && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => jobAction("pause")}
                    disabled={loading}
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </Button>
                )}
                {isPaused && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => jobAction("resume")}
                    disabled={loading}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                )}
                {(isActive || isPaused) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => jobAction("cancel")}
                    disabled={loading}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={fetchStatus}
                  disabled={loading}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {totalProcessed} / {job.total}
                </span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>

            {/* Stats grid — all statuses explicitly shown */}
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-center">
              <StatBox
                label="تم الزحف"
                value={job.crawled}
                color="text-blue-600"
              />
              <StatBox
                label="تم التحقق"
                value={job.verified}
                color="text-amber-600"
              />
              <StatBox
                label="تم النشر"
                value={job.published}
                color="text-green-600"
                tooltip={
                  job.published_actual < job.published
                    ? `كتابة فعلية: ${job.published_actual}`
                    : undefined
                }
              />
              <StatBox
                label="حجر صحي"
                value={job.quarantined}
                color="text-orange-500"
              />
              <StatBox
                label="فشل"
                value={job.failed}
                color="text-destructive"
              />
              <StatBox
                label="خاص"
                value={job.special_queue}
                color="text-purple-600"
              />
              <StatBox
                label="الإجمالي"
                value={job.total}
                color="text-foreground"
              />
            </div>

            {job.started_at && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                بدأ: {new Date(job.started_at).toLocaleString("ar")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Row 3: Coverage Matrix ── */}
      {coverage && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">مصفوفة التغطية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-1.5">
              {Object.entries(
                coverage as unknown as Record<string, CoverageStats[keyof CoverageStats]>,
              ).map(([field, stats]) => (
                <CoverageRow key={field} field={field} stats={stats} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Row 4: Top Reason Codes ── */}
      {reasonCodes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              أبرز أسباب الفشل / الحجر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {reasonCodes.slice(0, 15).map((rc) => (
                <Badge
                  key={rc.code}
                  variant="outline"
                  className="text-xs gap-1"
                >
                  {rc.code} <span className="font-bold">{rc.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Preflight Confirm Dialog ── */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              تأكيد بدء الزحف الشامل
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {preflight && (
                  <>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <InfoBox
                        label="جامعات مؤهلة"
                        value={preflight.total_eligible}
                      />
                      <InfoBox
                        label="لديها موقع رسمي"
                        value={preflight.with_website}
                      />
                      <InfoBox
                        label="تحتاج زحف"
                        value={preflight.needs_crawl}
                      />
                      <InfoBox
                        label="مُثرَاة مسبقاً"
                        value={preflight.already_enriched}
                      />
                    </div>
                    {preflight.blockers.length > 0 && (
                      <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
                        {preflight.blockers.map((b, i) => (
                          <p key={i}>⛔ {b}</p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={startCrawl}
              disabled={!preflight || preflight.blockers.length > 0}
            >
              تأكيد وبدء الزحف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */

function StatBox({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: number;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-2" title={tooltip}>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-muted/50 p-2 text-center">
      <p className="text-base font-bold">{value.toLocaleString("ar")}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  description: "الوصف",
  logo: "الشعار",
  programs: "البرامج",
  fees: "الرسوم",
  housing: "السكن",
  images: "الصور",
  contact: "التواصل",
};

function CoverageRow({
  field,
  stats,
}: {
  field: string;
  stats: {
    attempted: number;
    found: number;
    verified: number;
    published: number;
  };
}) {
  const max = Math.max(stats.attempted, 1);
  const pct = Math.round((stats.published / max) * 100);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-16 text-muted-foreground truncate">
        {FIELD_LABELS[field] || field}
      </span>
      <div className="flex-1">
        <Progress value={pct} className="h-1.5" />
      </div>
      <div className="flex gap-2 text-[10px] text-muted-foreground whitespace-nowrap">
        <span>محاولة {stats.attempted}</span>
        <span>وُجد {stats.found}</span>
        <span>تحقق {stats.verified}</span>
        <span className="text-green-600 font-medium">
          نُشر {stats.published}
        </span>
      </div>
    </div>
  );
}
