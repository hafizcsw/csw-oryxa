import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Activity, AlertTriangle, Clock, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface Door2Row {
  university_id: string;
  name: string | null;
  name_en: string | null;
  country_code: string | null;
  uniranks_rank: number | null;
  logo_url: string | null;
  stage: string;
  retry_count: number;
  quarantine_reason: string | null;
  last_updated: string;
  locked_until: string | null;
  about_status: string | null;
  logo_status: string | null;
  profile_status: string | null;
  programs_list_status: string | null;
  program_links_count: number;
  source: string | null;
  entity_type: string | null;
  qs_sections_extracted: number | null;
  qs_sections_total: number | null;
}

interface Counters {
  processed_15m: number;
  errors_15m: number;
  pending_total: number;
}

const STAGE_COLORS: Record<string, string> = {
  profile_pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  profile_fetching: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  programs_pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_ICON: Record<string, string> = {
  ok: "✅",
  not_present: "—",
  fetch_error: "❌",
  js_required: "⚠️",
};

export function Door2LiveQueue() {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const [rows, setRows] = useState<Door2Row[]>([]);
  const [counters, setCounters] = useState<Counters>({ processed_15m: 0, errors_15m: 0, pending_total: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [timeWindow, setTimeWindow] = useState("24h");
  const PAGE_SIZE = 20;

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (stage) filters.stage = stage;
      if (timeWindow) filters.time_window = timeWindow;
      if (search.trim()) filters.search = search.trim();

      const { data, error } = await supabase.rpc("rpc_get_door2_live", {
        p_filters: filters,
        p_page: page,
        p_page_size: PAGE_SIZE,
      });
      if (error) throw error;
      const result = data as any;
      setRows(result.rows || []);
      setTotal(result.total || 0);
      setCounters(result.counters || { processed_15m: 0, errors_15m: 0, pending_total: 0 });
    } catch (err: any) {
      console.error("Door2 Live error:", err);
      if (!silent) toast({ title: t("dev.crawlReview.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [stage, timeWindow, search, page, toast, t]);

  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t("admin.door2.live.timeNow");
    if (diffMin < 60) return t("admin.door2.live.timeMinutes", { count: diffMin });
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return t("admin.door2.live.timeHours", { count: diffH });
    return t("admin.door2.live.timeDays", { count: Math.floor(diffH / 24) });
  };

  const TIME_WINDOW_LABELS: Record<string, string> = {
    "15m": t("admin.door2.live.last15m"),
    "1h": t("admin.door2.live.last1h"),
    "6h": t("admin.door2.live.last6h"),
    "24h": t("admin.door2.live.last24h"),
  };

  return (
    <div className="space-y-4">
      {/* Counters */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{counters.processed_15m}</div>
              <div className="text-xs text-muted-foreground">{t("admin.door2.live.updated15m")}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{counters.errors_15m}</div>
              <div className="text-xs text-muted-foreground">{t("admin.door2.live.errors15m")}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{counters.pending_total.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{t("admin.door2.live.pendingTotal")}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.door2.live.searchPlaceholder")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={stage || "all"} onValueChange={(v) => { setStage(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder={t("admin.door2.live.stagePlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.door2.live.allStages")}</SelectItem>
                <SelectItem value="profile_pending">{t("admin.door2.live.profilePending")}</SelectItem>
                <SelectItem value="profile_fetching">{t("admin.door2.live.profileFetching")}</SelectItem>
                <SelectItem value="programs_pending">{t("admin.door2.live.programsPending")}</SelectItem>
                <SelectItem value="done">{t("admin.door2.live.stageDone")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeWindow} onValueChange={(v) => { setTimeWindow(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder={t("admin.door2.live.timeWindowPlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">{t("admin.door2.live.last15m")}</SelectItem>
                <SelectItem value="1h">{t("admin.door2.live.last1h")}</SelectItem>
                <SelectItem value="6h">{t("admin.door2.live.last6h")}</SelectItem>
                <SelectItem value="24h">{t("admin.door2.live.last24h")}</SelectItem>
                <SelectItem value="all">{t("admin.door2.live.allTime")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{total.toLocaleString()}</span> {t("admin.door2.live.universityCount", { count: total })}
        {timeWindow !== "all" && ` · ${TIME_WINDOW_LABELS[timeWindow] || timeWindow}`}
      </div>

      {/* Table */}
      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t("admin.door2.live.noResults")}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px] text-center">{t("admin.door2.live.rank")}</TableHead>
                <TableHead>{t("admin.door2.live.university")}</TableHead>
                <TableHead className="w-[70px] text-center">Source</TableHead>
                <TableHead className="w-[140px] text-center">{t("admin.door2.live.stage")}</TableHead>
                <TableHead className="w-[60px] text-center">Profile</TableHead>
                <TableHead className="w-[60px] text-center">About</TableHead>
                <TableHead className="w-[60px] text-center">Logo</TableHead>
                <TableHead className="w-[60px] text-center">Programs</TableHead>
                <TableHead className="w-[60px] text-center">{t("admin.door2.live.links")}</TableHead>
                <TableHead className="w-[60px] text-center">Retry</TableHead>
                <TableHead className="w-[80px] text-center">{t("admin.door2.live.lastUpdate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.university_id} className={row.quarantine_reason ? "bg-red-50 dark:bg-red-950/20" : ""}>
                  <TableCell className="text-center font-mono text-xs">
                    {row.uniranks_rank || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {row.logo_url && (
                        <img src={row.logo_url} alt="" className="w-6 h-6 rounded object-contain bg-white" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate max-w-[250px]">
                          {row.name_en || row.name || row.university_id.slice(0, 8)}
                        </div>
                        {row.country_code && (
                          <div className="text-xs text-muted-foreground">{row.country_code}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <Badge variant="outline" className={`text-[9px] ${row.source === "qs" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" : "bg-muted"}`}>
                        {row.source === "qs" ? "QS" : "UR"}
                      </Badge>
                      {row.source === "qs" && row.entity_type && row.entity_type !== "university" && (
                        <span className="text-[8px] text-muted-foreground">{row.entity_type}</span>
                      )}
                      {row.source === "qs" && row.qs_sections_extracted != null && (
                        <span className="text-[8px] text-muted-foreground">{row.qs_sections_extracted}/{row.qs_sections_total ?? "?"}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`text-xs ${STAGE_COLORS[row.stage] || "bg-muted"}`}>
                      {row.stage.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">{STATUS_ICON[row.profile_status || ""] || "—"}</TableCell>
                  <TableCell className="text-center text-sm">{STATUS_ICON[row.about_status || ""] || "—"}</TableCell>
                  <TableCell className="text-center text-sm">{STATUS_ICON[row.logo_status || ""] || "—"}</TableCell>
                  <TableCell className="text-center text-sm">{STATUS_ICON[row.programs_list_status || ""] || "—"}</TableCell>
                  <TableCell className="text-center text-sm font-mono">
                    {row.program_links_count > 0 ? row.program_links_count : "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {row.retry_count > 0 ? (
                      <Badge variant="destructive" className="text-xs">{row.retry_count}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {formatTime(row.last_updated)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline" size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline" size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
