import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Search, RotateCcw, Play, ExternalLink } from "lucide-react";

interface UniResult {
  id: string;
  name: string;
  name_en: string | null;
  slug: string;
  crawl_status: string | null;
  uniranks_profile_url: string | null;
  uniranks_program_pages_done: number | null;
  uniranks_program_pages_total: number | null;
}

interface TelemetryRow {
  id: number;
  metric: string;
  event_type: string;
  value: number;
  created_at: string;
  details_json: any;
}

interface CoverageProgram {
  id: number;
  title: string;
  degree_level: string | null;
  duration_months: number | null;
  tuition_fee: number | null;
  language: string | null;
  source_program_url: string | null;
}

export function SingleUniversityTest() {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [uni, setUni] = useState<UniResult | null>(null);
  const [resetting, setResetting] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [crawlResult, setCrawlResult] = useState<any>(null);
  const [lastTraceId, setLastTraceId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<CoverageProgram[]>([]);
  const [draftsCount, setDraftsCount] = useState(0);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  const searchUniversity = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setUni(null);
    setCrawlResult(null);
    setDrafts([]);
    setTelemetry([]);
    try {
      const q = searchQuery.trim();
      const isUuid = /^[0-9a-f]{8}-/.test(q);
      let query = supabase
        .from("universities")
        .select("id, name, name_en, slug, crawl_status, uniranks_profile_url, uniranks_program_pages_done, uniranks_program_pages_total") as any;

      if (isUuid) {
        query = query.eq("id", q).limit(1);
      } else {
        query = query.or(`slug.eq.${q},name.ilike.%${q}%,name_en.ilike.%${q}%`).limit(1);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) {
        toast({ title: t("admin.singleTest.notFound"), variant: "destructive" });
        return;
      }
      const found = data[0] as UniResult;
      setUni(found);
      await loadCoverage(found.id);
      await loadTelemetry(found.id, null);
    } catch (err: any) {
      toast({ title: t("dev.crawlReview.error"), description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [searchQuery, toast, t]);

  const loadCoverage = async (uniId: string) => {
    const { data, count } = await supabase
      .from("program_draft")
      .select("id, title, degree_level, duration_months, tuition_fee, language, source_program_url", { count: "exact" })
      .eq("university_id", uniId)
      .order("created_at", { ascending: false })
      .limit(5);
    setDrafts((data as CoverageProgram[]) || []);
    setDraftsCount(count ?? 0);
  };

  const loadTelemetry = async (uniId: string, _traceId: string | null) => {
    setTelemetryLoading(true);
    try {
      const { data } = await supabase
        .from("pipeline_health_events")
        .select("id, metric, event_type, value, created_at, details_json")
        .order("created_at", { ascending: false })
        .limit(10) as any;
      setTelemetry((data as TelemetryRow[]) || []);
    } catch (err) {
      console.error("Telemetry load error:", err);
    } finally {
      setTelemetryLoading(false);
    }
  };

  const handleReset = async () => {
    if (!uni) return;
    setResetting(true);
    try {
      const traceId = `RESET-UNI-${Date.now()}`;
      const { data, error } = await supabase.rpc("rpc_reset_uniranks_university" as any, {
        p_university_id: uni.id,
        p_trace_id: traceId,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      setLastTraceId(traceId);
      toast({
        title: t("dev.crawlReview.resetSuccess"),
        description: t("dev.crawlReview.resetSuccessDesc", { count: result?.deleted_program_drafts ?? 0 }),
      });
      // Refresh uni data
      const { data: refreshed } = await supabase
        .from("universities")
        .select("id, name, name_en, slug, crawl_status, uniranks_profile_url, uniranks_program_pages_done, uniranks_program_pages_total")
        .eq("id", uni.id)
        .single();
      if (refreshed) setUni(refreshed as UniResult);
      await loadCoverage(uni.id);
      await loadTelemetry(uni.id, traceId);
    } catch (err: any) {
      toast({ title: t("dev.crawlReview.error"), description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const handleRunCrawl = async () => {
    if (!uni) return;
    setCrawling(true);
    setCrawlResult(null);
    try {
      const traceId = `SINGLE-TEST-${Date.now()}`;
      setLastTraceId(traceId);
      const result = await api("/crawl-uniranks-direct-worker", {
        method: "POST",
        body: {
          slug: uni.slug,
          debug: true,
          trace_id: traceId,
          limit: 1,
          max_pages: 3,
        },
        timeout: 60000,
      });
      setCrawlResult(result);
      toast({
        title: t("admin.singleTest.crawlDone"),
        description: result.ok
          ? t("admin.singleTest.crawlDoneDesc", {
              found: result.programs_found ?? result.total_programs ?? 0,
              pages: result.pages_scraped ?? result.page_results?.length ?? 0,
            })
          : result.error,
      });
      // Refresh
      const { data: refreshed } = await supabase
        .from("universities")
        .select("id, name, name_en, slug, crawl_status, uniranks_profile_url, uniranks_program_pages_done, uniranks_program_pages_total")
        .eq("id", uni.id)
        .single();
      if (refreshed) setUni(refreshed as UniResult);
      await loadCoverage(uni.id);
      await loadTelemetry(uni.id, traceId);
    } catch (err: any) {
      toast({ title: t("dev.crawlReview.error"), description: err.message, variant: "destructive" });
    } finally {
      setCrawling(false);
    }
  };

  const pagesDone = uni?.uniranks_program_pages_done ?? 0;
  const pagesTotal = uni?.uniranks_program_pages_total ?? 0;
  const progressPct = pagesTotal > 0 ? Math.round((pagesDone / pagesTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.singleTest.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUniversity()}
                className="pl-9"
              />
            </div>
            <Button onClick={searchUniversity} disabled={searching || !searchQuery.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.singleTest.search")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {uni && (
        <>
          {/* University Info + Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{uni.name_en || uni.name}</span>
                <Badge variant={uni.crawl_status === "uniranks_done" ? "default" : "secondary"}>
                  {uni.crawl_status || "pending"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>slug: <code className="bg-muted px-1 rounded">{uni.slug}</code></span>
                <span>·</span>
                <span>ID: <code className="bg-muted px-1 rounded text-xs">{uni.id.slice(0, 8)}…</code></span>
                {uni.uniranks_profile_url && (
                  <a href={uni.uniranks_profile_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> UniRanks
                  </a>
                )}
              </div>

              {/* Progress */}
              {pagesTotal > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("admin.singleTest.pagesProgress")}: {pagesDone}/{pagesTotal}</span>
                    <span>{t("admin.singleTest.draftsCount")}: {draftsCount}</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>
              )}

              {lastTraceId && (
                <div className="text-xs text-muted-foreground">
                  trace_id: <code className="bg-muted px-1 rounded">{lastTraceId}</code>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReset}
                  disabled={resetting || crawling}
                >
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                  {t("admin.singleTest.reset")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleRunCrawl}
                  disabled={crawling || resetting}
                >
                  {crawling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                  {t("admin.singleTest.runCrawl")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Coverage Preview */}
          {drafts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("admin.singleTest.coverage")} ({draftsCount})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t("dev.crawlReview.fieldTitle")}</TableHead>
                        <TableHead className="text-xs">{t("dev.crawlReview.fieldDegree")}</TableHead>
                        <TableHead className="text-xs">{t("dev.crawlReview.fieldDuration")}</TableHead>
                        <TableHead className="text-xs">{t("dev.crawlReview.fieldFees")}</TableHead>
                        <TableHead className="text-xs">{t("dev.crawlReview.fieldLanguage")}</TableHead>
                        <TableHead className="text-xs">URL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drafts.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs max-w-[200px] truncate">{d.title}</TableCell>
                          <TableCell className="text-xs">{d.degree_level || "—"}</TableCell>
                          <TableCell className="text-xs">{d.duration_months ? `${d.duration_months}m` : "—"}</TableCell>
                          <TableCell className="text-xs">{d.tuition_fee ? `$${d.tuition_fee}` : "—"}</TableCell>
                          <TableCell className="text-xs">{d.language || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {d.source_program_url && (
                              <a href={d.source_program_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Crawl Result (debug response) */}
          {crawlResult && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("admin.singleTest.crawlResponse")}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-[300px] whitespace-pre-wrap" dir="ltr">
                  {JSON.stringify(crawlResult, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Telemetry */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{t("admin.singleTest.telemetry")}</span>
                {telemetryLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {telemetry.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">{t("admin.singleTest.noTelemetry")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">event_type</TableHead>
                        <TableHead className="text-xs">metric</TableHead>
                        <TableHead className="text-xs">value</TableHead>
                        <TableHead className="text-xs">trace_id</TableHead>
                        <TableHead className="text-xs">{t("admin.singleTest.time")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {telemetry.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs">{row.event_type}</TableCell>
                          <TableCell className="text-xs font-mono">{row.metric}</TableCell>
                          <TableCell className="text-xs">{row.value}</TableCell>
                          <TableCell className="text-xs font-mono truncate max-w-[100px]">
                            {row.details_json?.trace_id?.slice(0, 12) || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(row.created_at).toLocaleTimeString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
