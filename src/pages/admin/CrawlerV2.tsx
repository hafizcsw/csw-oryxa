import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Play, RefreshCw, Globe, Building2, GraduationCap,
  Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronRight, Copy, StopCircle, PauseCircle, RotateCcw,
  Link2, FileSearch, Wrench,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ───────────────────────────────────────────────────────────────────

type Scope = "all" | "country" | "university";
type Mode =
  | "missing_or_stale"
  | "failed_only"
  | "full_refresh"
  | "evidence_only"
  | "orx_only"
  | "media_only"
  | "programs_only"
  | "housing_only";

interface CrawlerRun {
  id: string;
  scope: string;
  mode: string;
  status: string;
  total_targets: number | null;
  trace_id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  filters_json: Record<string, unknown> | null;
  queued?: number;
  failed?: number;
  completed?: number;
  needs_review?: number;
  published?: number;
  failure_breakdown?: Record<string, number>;
}

interface RunDetail extends CrawlerRun {
  run: CrawlerRun;
  status_breakdown: Record<string, number>;
  items: Array<{
    id: string;
    university_id: string;
    university_name: string | null;
    website: string | null;
    status: string;
    stage: string | null;
    progress_percent: number;
    failure_reason: string | null;
    trace_id: string;
    created_at: string;
    updated_at: string;
    evidence_count: number;
    pages_found: number;
    pages_fetched: number;
  }>;
}

interface PageCandidate {
  id: string;
  crawler_run_item_id: string;
  candidate_url: string;
  candidate_type: string;
  discovery_method: string;
  priority: number;
  status: string;
  fetch_error: string | null;
  trace_id: string | null;
  created_at: string;
}

interface EvidenceItem {
  id: string;
  crawler_run_item_id: string;
  university_id: string;
  entity_type: string;
  fact_group: string;
  field_key: string;
  value_raw: string;
  evidence_quote: string | null;
  source_url: string;
  confidence_0_100: number;
  trust_level: string;
  validation_status: string;
  review_status: string;
  publish_status: string;
  extraction_method: string | null;
  model_provider: string | null;
  model_name: string | null;
  trace_id: string | null;
  orx_layer: string | null;
  orx_signal_family: string | null;
  created_at: string;
  updated_at: string | null;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MODES: Mode[] = [
  "missing_or_stale",
  "failed_only",
  "full_refresh",
  "evidence_only",
  "orx_only",
  "media_only",
  "programs_only",
  "housing_only",
];

const STATUS_BADGE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/20 text-green-700 dark:text-green-300",
  failed: "bg-destructive/20 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const ITEM_BADGE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  completed: "bg-green-500/20 text-green-700 dark:text-green-300",
  failed: "bg-destructive/20 text-destructive",
  needs_review: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  published: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function callControl(body: Record<string, unknown>) {
  return supabase.functions.invoke("crawler-v2-control", { body });
}

function StatusBadge({ status, map, t, prefix }: { status: string; map: Record<string, string>; t: (k: string) => string; prefix: string }) {
  const cls = map[status] ?? "bg-muted text-muted-foreground";
  const key = `${prefix}.${status}`;
  const label = t(key);
  return (
    <Badge className={`text-xs font-medium ${cls}`}>
      {label === key ? status : label}
    </Badge>
  );
}

// ── Run Control Card ─────────────────────────────────────────────────────────

interface RunCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  scope: Scope;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  extra?: React.ReactNode;
  onSubmit: () => void;
  creating: boolean;
  t: (k: string, opts?: Record<string, unknown>) => string;
  submitDisabled?: boolean;
}

function RunCard({ icon, title, description, mode, onModeChange, extra, onSubmit, creating, t, submitDisabled }: RunCardProps) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-primary">{icon}</div>
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="space-y-2">
        <Select value={mode} onValueChange={(v) => onModeChange(v as Mode)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={t("crawlerV2.selectMode")} />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {t(`crawlerV2.mode.${m}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {extra}
      </div>
      <Button size="sm" className="w-full gap-2" onClick={onSubmit} disabled={creating || submitDisabled}>
        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        {t("crawlerV2.createRun")}
      </Button>
    </Card>
  );
}

// ── Progress Strip ───────────────────────────────────────────────────────────

function RunProgress({ run, t }: { run: CrawlerRun; t: (k: string) => string }) {
  const total = run.total_targets ?? 0;
  const done = (run.completed ?? 0) + (run.failed ?? 0) + (run.needs_review ?? 0) + (run.published ?? 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{done} / {total}</span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  detail: RunDetail | null;
  onClose: () => void;
  t: (k: string) => string;
  onCancel: (runId: string) => void;
  onPause: (runId: string) => void;
  onResume: (runId: string) => void;
  onRetryItem: (runItemId: string) => void;
  actioning: string | null;
}

function DetailPanel({ detail, onClose, t, onCancel, onPause, onResume, onRetryItem, actioning }: DetailPanelProps) {
  const [candidates, setCandidates] = useState<PageCandidate[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [tabDataLoaded, setTabDataLoaded] = useState<Record<string, boolean>>({});

  const loadTabData = useCallback(async (tab: string) => {
    if (!detail || tabDataLoaded[tab]) return;
    setTabDataLoaded((p) => ({ ...p, [tab]: true }));
    if (tab === "candidates") {
      const { data } = await callControl({ action: "get_run_candidates", run_id: detail.run.id });
      setCandidates(data?.candidates ?? []);
    } else if (tab === "evidence") {
      const { data } = await callControl({ action: "get_run_evidence", run_id: detail.run.id });
      setEvidence(data?.evidence ?? []);
    }
  }, [detail, tabDataLoaded]);

  useEffect(() => { setCandidates([]); setEvidence([]); setTabDataLoaded({}); }, [detail?.run?.id]);

  if (!detail) return null;
  const run = detail.run;
  const sb = detail.status_breakdown ?? {};
  const fb = detail.failure_breakdown ?? {};
  const total = run.total_targets ?? 0;

  return (
    <Sheet open={!!detail} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            {t("crawlerV2.runDetail")}
            <StatusBadge status={run.status} map={STATUS_BADGE} t={t} prefix="crawlerV2.status" />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">{t("crawlerV2.scopeLabel")}: </span>
              <span className="font-medium">{t(`crawlerV2.scope.${run.scope}`)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("crawlerV2.modeLabel")}: </span>
              <span className="font-medium">{t(`crawlerV2.mode.${run.mode}`)}</span>
            </div>
            <div className="col-span-2 flex items-center gap-1">
              <span className="text-muted-foreground">{t("crawlerV2.traceId")}: </span>
              <code className="font-mono text-[10px] truncate max-w-[200px]">{run.trace_id}</code>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => navigator.clipboard.writeText(run.trace_id)}>
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Queue controls */}
          <div className="flex gap-2 flex-wrap">
            {["running", "queued"].includes(run.status) && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={actioning === run.id}
                onClick={() => onPause(run.id)}>
                <PauseCircle className="w-3 h-3" />{t("crawlerV2.pause")}
              </Button>
            )}
            {run.status === "paused" && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={actioning === run.id}
                onClick={() => onResume(run.id)}>
                <Play className="w-3 h-3" />{t("crawlerV2.resume")}
              </Button>
            )}
            {["running", "queued", "paused"].includes(run.status) && (
              <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" disabled={actioning === run.id}
                onClick={() => onCancel(run.id)}>
                <StopCircle className="w-3 h-3" />{t("crawlerV2.cancel")}
              </Button>
            )}
          </div>

          <Separator />

          {/* Counts */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "totalTargets", val: total, icon: Globe, cls: "text-muted-foreground" },
              { key: "queued", val: sb.queued ?? 0, icon: Clock, cls: "text-amber-600 dark:text-amber-400" },
              { key: "failed", val: sb.failed ?? 0, icon: XCircle, cls: "text-destructive" },
              { key: "completed", val: sb.completed ?? 0, icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
              { key: "needsReview", val: sb.needs_review ?? 0, icon: AlertTriangle, cls: "text-yellow-600 dark:text-yellow-400" },
              { key: "published", val: sb.published ?? 0, icon: CheckCircle2, cls: "text-emerald-400 dark:text-emerald-300" },
            ].map(({ key, val, icon: Icon, cls }) => (
              <div key={key} className="flex flex-col items-center p-2 rounded-lg bg-muted/40 gap-1">
                <Icon className={`w-3.5 h-3.5 ${cls}`} />
                <span className="text-base font-bold tabular-nums">{val}</span>
                <span className="text-[10px] text-muted-foreground text-center">{t(`crawlerV2.${key}`)}</span>
              </div>
            ))}
          </div>

          {/* Failure breakdown */}
          {Object.keys(fb).length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-semibold">{t("crawlerV2.failureBreakdown")}</p>
                {Object.entries(fb).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t(`crawlerV2.failure.${reason}`) || reason}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">{count}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Tabs: Items / Candidates / Evidence */}
          <Tabs defaultValue="items" onValueChange={loadTabData}>
            <TabsList className="h-7 text-xs">
              <TabsTrigger value="items" className="text-xs h-6">{t("crawlerV2.tabItems")}</TabsTrigger>
              <TabsTrigger value="candidates" className="text-xs h-6">
                <Link2 className="w-3 h-3 mr-1" />{t("crawlerV2.tabCandidates")}
              </TabsTrigger>
              <TabsTrigger value="evidence" className="text-xs h-6">
                <FileSearch className="w-3 h-3 mr-1" />{t("crawlerV2.tabEvidence")}
              </TabsTrigger>
            </TabsList>

            {/* Items tab */}
            <TabsContent value="items" className="mt-2">
              {detail.items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("crawlerV2.noItems")}</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {detail.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/40">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.university_name ?? item.university_id}</p>
                        {item.website && <p className="text-muted-foreground truncate text-[10px]">{item.website}</p>}
                        <p className="font-mono text-[10px] text-muted-foreground truncate">
                          {[item.stage, `${item.progress_percent}%`, item.updated_at].filter(Boolean).join(" | ")}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground truncate">{item.trace_id}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <StatusBadge status={item.status} map={ITEM_BADGE} t={t} prefix="crawlerV2.itemStatus" />
                        {item.status === "failed" && (
                          <button title={t("crawlerV2.retry")} className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); onRetryItem(item.id); }}>
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Candidates tab */}
            <TabsContent value="candidates" className="mt-2">
              {candidates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("crawlerV2.noCandidates")}</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {candidates.map((c) => (
                    <div key={c.id} className="text-xs p-1.5 rounded hover:bg-muted/40">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">{c.candidate_type}</Badge>
                        <span className="font-mono truncate flex-1 text-[10px] text-muted-foreground">{c.candidate_url}</span>
                        <Badge className={`text-[10px] h-4 px-1 shrink-0 ${c.status === "fetched" ? "bg-green-500/20 text-green-700" : "bg-muted text-muted-foreground"}`}>{c.status}</Badge>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">
                        {[c.discovery_method, String(c.priority), c.created_at].filter(Boolean).join(" | ")}
                      </p>
                      {c.trace_id && <p className="font-mono text-[10px] text-muted-foreground truncate">{c.trace_id}</p>}
                      {c.fetch_error && <p className="text-[10px] text-destructive truncate">{c.fetch_error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Evidence tab */}
            <TabsContent value="evidence" className="mt-2">
              {evidence.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("crawlerV2.noEvidence")}</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {evidence.map((ev) => (
                    <div key={ev.id} className="text-xs p-1.5 rounded hover:bg-muted/40 border border-transparent hover:border-border">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-medium">{ev.fact_group}/{ev.field_key}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{ev.confidence_0_100}%</Badge>
                      </div>
                      <p className="text-muted-foreground truncate">{ev.value_raw}</p>
                      {ev.evidence_quote && <p className="text-[10px] text-muted-foreground truncate">{ev.evidence_quote}</p>}
                      <p className="font-mono text-[10px] text-muted-foreground truncate">{ev.source_url}</p>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">
                        {[ev.extraction_method, ev.model_provider, ev.model_name].filter(Boolean).join(" | ")}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">
                        {[ev.review_status, ev.publish_status, ev.created_at].filter(Boolean).join(" | ")}
                      </p>
                      {ev.trace_id && <p className="font-mono text-[10px] text-muted-foreground truncate">{ev.trace_id}</p>}
                      {ev.orx_signal_family && (
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">{ev.orx_layer}/{ev.orx_signal_family}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── University Search Autocomplete ───────────────────────────────────────────

interface UniSuggestion {
  id: string;
  name: string;
  name_en: string | null;
  name_ar: string | null;
  slug: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
}

interface UniversitySearchInputProps {
  selected: UniSuggestion | null;
  onSelect: (u: UniSuggestion | null) => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function UniversitySearchInput({ selected, onSelect, t }: UniversitySearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UniSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    if (selected) return; // do not search while a selection is active
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await callControl({
          action: "search_universities",
          query: q,
          limit: 20,
        });
        if (cancelled) return;
        if (error) {
          toast.error(error.message);
          setResults([]);
        } else if (data?.ok) {
          setResults((data.results ?? []) as UniSuggestion[]);
          setOpen(true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selected]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{selected.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {[selected.country, selected.city, selected.website].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px]"
          onClick={() => {
            onSelect(null);
            setQuery("");
            setResults([]);
          }}
        >
          {t("crawlerV2.changeUniversity", { defaultValue: "Change" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        className="h-8 text-xs"
        placeholder={t("crawlerV2.universitySearchPlaceholder", {
          defaultValue: "Search university by name, slug, or website…",
        })}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onBlur={() => {
          // Delay so click on a suggestion can register
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && (loading || results.length > 0) && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-72 overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("crawlerV2.searching", { defaultValue: "Searching…" })}
            </div>
          )}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
              {t("crawlerV2.noUniversitiesFound", { defaultValue: "No universities found" })}
            </div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              className="w-full text-left px-2 py-1.5 hover:bg-muted/60 border-b border-border/50 last:border-0"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(u);
                setOpen(false);
                setQuery("");
              }}
            >
              <p className="text-xs font-medium truncate">{u.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {[u.country, u.city, u.website].filter(Boolean).join(" · ") || u.id}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CrawlerV2Page() {
  const { t } = useTranslation("common");

  // Run controls state
  const [allMode, setAllMode] = useState<Mode>("missing_or_stale");
  const [countryMode, setCountryMode] = useState<Mode>("missing_or_stale");
  const [countryCode, setCountryCode] = useState("");
  const [uniMode, setUniMode] = useState<Mode>("missing_or_stale");
  const [selectedUniversity, setSelectedUniversity] = useState<UniSuggestion | null>(null);
  const [creating, setCreating] = useState<Scope | null>(null);

  // Runs list state
  const [runs, setRuns] = useState<CrawlerRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  // Publish review state
  const [pendingReview, setPendingReview] = useState<Array<{
    id: string; run_id: string; university_id: string; university_name: string | null;
    website: string | null; status: string; evidence_count: number; orx_signal_count: number; trace_id: string;
  }>>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const { data, error } = await callControl({ action: "list_runs" });
      if (error) throw error;
      setRuns(data?.runs ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  const fetchPendingReview = useCallback(async () => {
    setPendingLoading(true);
    try {
      const { data, error } = await callControl({ action: "get_pending_review" });
      if (error) throw error;
      setPendingReview(data?.items ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => { fetchRuns(); fetchPendingReview(); }, [fetchRuns, fetchPendingReview]);

  const fetchDetail = useCallback(async (runId: string) => {
    setDetailLoading(true);
    setSelectedRunId(runId);
    try {
      const { data, error } = await callControl({ action: "get_run", run_id: runId });
      if (error) throw error;
      setDetail(data as RunDetail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const runAction = useCallback(async (action: string, body: Record<string, unknown>, successMsg: string) => {
    const key = body.run_id as string ?? body.run_item_id as string ?? action;
    setActioning(key);
    try {
      const { data, error } = await callControl({ action, ...body });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? action + "_failed");
      toast.success(successMsg);
      await fetchRuns();
      if (detail && body.run_id === detail.run.id) {
        await fetchDetail(detail.run.id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setActioning(null);
    }
  }, [fetchRuns, fetchDetail, detail]);

  const createRun = useCallback(async (scope: Scope, mode: Mode, extra?: Record<string, unknown>) => {
    setCreating(scope);
    try {
      const { data, error } = await callControl({ action: "create_run", scope, mode, ...extra });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "create_run_failed");
      toast.success(t("crawlerV2.createdSuccessfully"), {
        description: `${t("crawlerV2.totalTargets")}: ${data.total_targets} • ${t("crawlerV2.queued")}: ${data.queued}`,
      });
      await fetchRuns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t("crawlerV2.failedToCreate"), { description: msg });
    } finally {
      setCreating(null);
    }
  }, [t, fetchRuns]);

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("crawlerV2.pageTitle")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("crawlerV2.pageSubtitle")}</p>
      </div>

      {/* Run Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RunCard
          icon={<Globe className="w-5 h-5" />}
          title={t("crawlerV2.runAll")}
          description={t("crawlerV2.runAllDesc")}
          scope="all"
          mode={allMode}
          onModeChange={setAllMode}
          onSubmit={() => createRun("all", allMode)}
          creating={creating === "all"}
          t={t}
          submitDisabled
        />
        <RunCard
          icon={<Building2 className="w-5 h-5" />}
          title={t("crawlerV2.runCountry")}
          description={t("crawlerV2.runCountryDesc")}
          scope="country"
          mode={countryMode}
          onModeChange={setCountryMode}
          extra={
            <Input
              className="h-8 text-xs"
              placeholder={t("crawlerV2.countryCode")}
              value={countryCode}
              maxLength={3}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
            />
          }
          onSubmit={() => createRun("country", countryMode, { country_code: countryCode })}
          creating={creating === "country"}
          t={t}
          submitDisabled
        />
        <RunCard
          icon={<GraduationCap className="w-5 h-5" />}
          title={t("crawlerV2.runUniversity")}
          description={t("crawlerV2.runUniversityDesc")}
          scope="university"
          mode={uniMode}
          onModeChange={setUniMode}
          extra={
            <UniversitySearchInput
              selected={selectedUniversity}
              onSelect={setSelectedUniversity}
              t={t}
            />
          }
          onSubmit={() => {
            if (!selectedUniversity) {
              toast.error(t("crawlerV2.selectUniversityFirst", { defaultValue: "Select a university first" }));
              return;
            }
            createRun("university", uniMode, { university_id: selectedUniversity.id });
          }}
          submitDisabled={!selectedUniversity}
          creating={creating === "university"}
          t={t}
        />
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t("crawlerV2.recentRuns")}</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchRuns} disabled={runsLoading} className="gap-1.5">
            {runsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t("crawlerV2.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {runsLoading && runs.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-10">{t("crawlerV2.noRunsYet")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("crawlerV2.scopeLabel")}</TableHead>
                  <TableHead className="text-xs">{t("crawlerV2.modeLabel")}</TableHead>
                  <TableHead className="text-xs">{t("crawlerV2.statusLabel")}</TableHead>
                  <TableHead className="text-xs text-right">{t("crawlerV2.totalTargets")}</TableHead>
                  <TableHead className="text-xs text-right">{t("crawlerV2.queued")}</TableHead>
                  <TableHead className="text-xs text-right">{t("crawlerV2.failed")}</TableHead>
                  <TableHead className="text-xs">{t("crawlerV2.createdAt")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => fetchDetail(run.id)}
                  >
                    <TableCell className="text-xs font-medium">{t(`crawlerV2.scope.${run.scope}`)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t(`crawlerV2.mode.${run.mode}`)}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} map={STATUS_BADGE} t={t} prefix="crawlerV2.status" />
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{run.total_targets ?? "—"}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{run.queued ?? 0}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{run.failed ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      {selectedRunId === run.id && detailLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Run progress cards for running jobs */}
      {runs.filter((r) => r.status === "running").map((run) => (
        <Card key={run.id} className="border-blue-200 dark:border-blue-800">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span className="text-xs font-medium">{t(`crawlerV2.scope.${run.scope}`)} — {t(`crawlerV2.mode.${run.mode}`)}</span>
              </div>
              <code className="text-[10px] text-muted-foreground font-mono">{run.trace_id}</code>
            </div>
            <RunProgress run={run} t={t} />
          </CardContent>
        </Card>
      ))}

      {/* Review & Publish panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />{t("crawlerV2.reviewPublish")}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchPendingReview} disabled={pendingLoading} className="gap-1.5">
            {pendingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t("crawlerV2.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {pendingLoading && pendingReview.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : pendingReview.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">{t("crawlerV2.noPendingReview")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("crawlerV2.university")}</TableHead>
                  <TableHead className="text-xs">{t("crawlerV2.statusLabel")}</TableHead>
                  <TableHead className="text-xs text-right">{t("crawlerV2.evidence")}</TableHead>
                  <TableHead className="text-xs text-right">{t("crawlerV2.orxSignals")}</TableHead>
                  <TableHead className="text-xs">{t("crawlerV2.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReview.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs font-medium">
                      {item.university_name ?? item.university_id}
                      {item.website && <p className="text-[10px] text-muted-foreground">{item.website}</p>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} map={ITEM_BADGE} t={t} prefix="crawlerV2.itemStatus" />
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{item.evidence_count}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{item.orx_signal_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {item.status === "needs_review" && (
                          <Button size="sm" variant="outline" className="h-6 text-xs gap-1"
                            disabled={actioning === item.id}
                            onClick={() => runAction("verify_item", { run_item_id: item.id }, t("crawlerV2.verifiedSuccessfully"))
                              .then(() => fetchPendingReview())}>
                            <CheckCircle2 className="w-3 h-3" />{t("crawlerV2.verify")}
                          </Button>
                        )}
                        {item.status === "verified" && (
                          publishConfirm === item.id ? (
                            <div className="flex gap-1">
                              <Button size="sm" variant="destructive" className="h-6 text-xs"
                                disabled={actioning === item.id}
                                onClick={() => {
                                  setPublishConfirm(null);
                                  runAction("publish_item", { run_item_id: item.id }, t("crawlerV2.publishedSuccessfully"))
                                    .then(() => fetchPendingReview());
                                }}>
                                {t("crawlerV2.confirmPublish")}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs"
                                onClick={() => setPublishConfirm(null)}>
                                {t("crawlerV2.cancel")}
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="default" className="h-6 text-xs gap-1"
                              onClick={() => setPublishConfirm(item.id)}>
                              <Play className="w-3 h-3" />{t("crawlerV2.publish")}
                            </Button>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Maintenance toolbar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="w-4 h-4" />{t("crawlerV2.maintenance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap pb-4">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            disabled={!!actioning}
            onClick={() => runAction("cleanup_locks", {}, t("crawlerV2.locksCleanedUp"))}>
            <RefreshCw className="w-3.5 h-3.5" />{t("crawlerV2.cleanupLocks")}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            disabled={!!actioning || !detail?.run?.id}
            onClick={() => runAction("mark_stuck_items_failed", { stuck_minutes: 30, run_id: detail?.run?.id }, t("crawlerV2.stuckMarked"))}>
            <AlertTriangle className="w-3.5 h-3.5" />{t("crawlerV2.markStuck")}
          </Button>
        </CardContent>
      </Card>

      {/* Detail Panel */}
      <DetailPanel
        detail={detail}
        onClose={() => { setDetail(null); setSelectedRunId(null); }}
        t={t}
        actioning={actioning}
        onCancel={(id) => runAction("cancel_run", { run_id: id }, t("crawlerV2.cancelledSuccessfully"))}
        onPause={(id) => runAction("pause_run", { run_id: id }, t("crawlerV2.pausedSuccessfully"))}
        onResume={(id) => runAction("resume_run", { run_id: id }, t("crawlerV2.resumedSuccessfully"))}
        onRetryItem={(itemId) => runAction("retry_failed_item", { run_item_id: itemId }, t("crawlerV2.retriedSuccessfully"))}
      />
    </div>
  );
}
