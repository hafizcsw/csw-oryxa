import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  FileText,
  Link2,
  Ban,
} from "lucide-react";

interface UniversityReviewDrawerProps {
  universityId: string;
  open: boolean;
  onClose: () => void;
}

interface UniDetail {
  id: string;
  name: string;
  name_en: string | null;
  slug: string;
  website: string | null;
  logo_url: string | null;
  country_code: string | null;
  crawl_status: string;
  publish_status: string;
  published_at: string | null;
  uniranks_profile_url: string | null;
  uniranks_verified: boolean | null;
  uniranks_recognized: boolean | null;
  uniranks_rank: number | null;
  uniranks_score: number | null;
  uniranks_country_rank: number | null;
  uniranks_region_rank: number | null;
  uniranks_world_rank: number | null;
  uniranks_region_label: string | null;
  uniranks_badges: string[] | null;
  uniranks_top_buckets: string[] | null;
  uniranks_sections_present: string[] | null;
  uniranks_snapshot: any;
  uniranks_snapshot_at: string | null;
  uniranks_snapshot_trace_id: string | null;
  uniranks_last_trace_id: string | null;
}

interface ProgramDraft {
  id: number;
  title: string;
  title_en: string | null;
  degree_level: string | null;
  language: string | null;
  duration_months: number | null;
  tuition_fee: number | null;
  currency: string | null;
  source_url: string | null;
  source_program_url: string | null;
  status: string;
  review_status: string;
  missing_fields: string[] | null;
  flags: string[] | null;
  confidence_score: number | null;
  final_confidence: number | null;
  field_evidence_map: Record<string, any> | null;
  extracted_json: any;
  schema_version: string | null;
  extractor_version: string | null;
  last_extracted_at: string | null;
  program_key: string | null;
  published_program_id: string | null;
  published_at: string | null;
  created_at: string | null;
}

interface ReviewObservation {
  id: string;
  field_name: string;
  fact_group: string | null;
  source_url: string | null;
  source_type: string | null;
  value_raw: string | null;
  evidence_snippet: string | null;
  status: string;
  reason_code: string | null;
  confidence: number | null;
  page_title: string | null;
}

interface ReviewFileArtifact {
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
}

interface ReviewCrawlRow {
  id: string;
  job_id: string;
  crawl_status: string;
  pages_scraped: number | null;
  pages_mapped: number | null;
  reason_codes: string[] | null;
  error_message: string | null;
  updated_at: string;
}

const FILE_STATUS_META: Record<string, { label: string; tone: string }> = {
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
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function compactUrl(url: string | null) {
  if (!url) return "—";
  return url.replace(/^https?:\/\//, "");
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  needs_review:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

export function UniversityReviewDrawer({
  universityId,
  open,
  onClose,
}: UniversityReviewDrawerProps) {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const [uni, setUni] = useState<UniDetail | null>(null);
  const [programs, setPrograms] = useState<ProgramDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrograms, setSelectedPrograms] = useState<Set<number>>(
    new Set(),
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<number | null>(null);
  const [observations, setObservations] = useState<ReviewObservation[]>([]);
  const [files, setFiles] = useState<ReviewFileArtifact[]>([]);
  const [crawlRow, setCrawlRow] = useState<ReviewCrawlRow | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("rpc_get_university_review", {
        p_university_id: universityId,
      });
      if (error) throw error;
      const result = data as any;
      if (result.error) throw new Error(result.error);
      setUni(result.university);
      setPrograms(result.programs || []);

      const [obsRes, fileRes, rowRes] = await Promise.all([
        supabase
          .from("official_site_observations")
          .select(
            "id, field_name, fact_group, source_url, source_type, value_raw, evidence_snippet, status, reason_code, confidence, page_title",
          )
          .eq("university_id", universityId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("crawl_file_artifacts")
          .select(
            "id, file_name, source_url, source_page_url, parse_status, artifact_type, mime_type, parsed_pages, file_size_bytes, storage_path",
          )
          .eq("university_id", universityId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("official_site_crawl_rows")
          .select(
            "id, job_id, crawl_status, pages_scraped, pages_mapped, reason_codes, error_message, updated_at",
          )
          .eq("university_id", universityId)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);

      setObservations((obsRes.data as ReviewObservation[]) || []);
      setFiles((fileRes.data as ReviewFileArtifact[]) || []);
      setCrawlRow((rowRes.data?.[0] as ReviewCrawlRow | undefined) || null);
    } catch (err: any) {
      toast({
        title: t("dev.crawlReview.error"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [universityId, toast, t]);

  useEffect(() => {
    if (open) fetchDetail();
  }, [open, fetchDetail]);

  const publishUniversity = async (onlyEligible = true) => {
    setActionLoading("publish_uni");
    try {
      const traceId = `REVIEW-PUB-UNI-${Date.now()}`;
      const { data, error } = await supabase.rpc("rpc_publish_university", {
        p_university_id: universityId,
        p_options: {
          only_eligible: onlyEligible,
          ...(selectedPrograms.size > 0
            ? { program_draft_ids: Array.from(selectedPrograms) }
            : {}),
        },
        p_trace_id: traceId,
      });
      if (error) throw error;
      const result = data as any;
      toast({
        title: t("dev.crawlReview.publishedToast"),
        description: t("dev.crawlReview.publishedDesc", {
          published: result.published_count,
          skipped: result.skipped_count,
        }),
      });
      fetchDetail();
    } catch (err: any) {
      toast({
        title: t("dev.crawlReview.error"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const publishSelectedPrograms = async () => {
    if (selectedPrograms.size === 0) return;
    setActionLoading("publish_programs");
    try {
      const traceId = `REVIEW-PUB-PROG-${Date.now()}`;
      const { data, error } = await supabase.rpc("rpc_publish_programs", {
        p_program_draft_ids: Array.from(selectedPrograms),
        p_trace_id: traceId,
      });
      if (error) throw error;
      const result = data as any;
      toast({
        title: t("dev.crawlReview.programsPublished"),
        description: t("dev.crawlReview.programsPublishedDesc", {
          count: result.published_count,
        }),
      });
      setSelectedPrograms(new Set());
      fetchDetail();
    } catch (err: any) {
      toast({
        title: t("dev.crawlReview.error"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const setReviewStatus = async (
    targetType: string,
    ids: (string | number)[],
    status: string,
  ) => {
    setActionLoading(`status_${status}`);
    try {
      const traceId = `REVIEW-STATUS-${Date.now()}`;
      const { data, error } = await supabase.rpc("rpc_set_review_status", {
        p_target_type: targetType,
        p_ids: ids.map(String),
        p_status: status,
        p_trace_id: traceId,
      });
      if (error) throw error;
      toast({ title: t("dev.crawlReview.statusUpdated") });
      fetchDetail();
    } catch (err: any) {
      toast({
        title: t("dev.crawlReview.error"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const toggleProgramSelect = (id: number) => {
    setSelectedPrograms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPrograms = () => {
    if (selectedPrograms.size === programs.length) {
      setSelectedPrograms(new Set());
    } else {
      setSelectedPrograms(new Set(programs.map((p) => p.id)));
    }
  };

  const reviewBuckets = useMemo(() => {
    const htmlPages = Array.from(
      new Map(
        observations
          .filter(
            (obs) =>
              obs.source_url &&
              (!obs.source_type || obs.source_type !== "official_pdf") &&
              !/\.pdf([?#].*)?$/i.test(obs.source_url || ""),
          )
          .map((obs) => [obs.source_url as string, obs]),
      ),
    ).map(([, obs]) => obs);
    const pdfFields = observations.filter(
      (obs) =>
        obs.source_type === "official_pdf" ||
        /\.pdf([?#].*)?$/i.test(obs.source_url || ""),
    );
    const extractedFields = observations.filter((obs) =>
      Boolean(obs.value_raw),
    );
    const missingFields = programs.flatMap((program) =>
      (program.missing_fields || []).map((field) => ({
        program: program.title || program.title_en || `Program ${program.id}`,
        field,
      })),
    );
    const failures = [
      ...(crawlRow?.reason_codes || []).map((code) => ({
        type: "crawl_reason",
        label: code,
      })),
      ...(crawlRow?.error_message
        ? [{ type: "crawl_error", label: crawlRow.error_message }]
        : []),
      ...files
        .filter((file) => file.parse_status === "parse_failed")
        .map((file) => ({
          type: "pdf_failed",
          label: `${file.file_name || file.source_url} (${file.parse_status})`,
        })),
      ...observations
        .filter((obs) => obs.status === "blocked" || obs.reason_code)
        .map((obs) => ({
          type: "observation_issue",
          label: `${obs.field_name}${obs.reason_code ? ` — ${obs.reason_code}` : ""}`,
        })),
    ];
    return { htmlPages, pdfFields, extractedFields, missingFields, failures };
  }, [observations, programs, files, crawlRow]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{uni?.name_en || uni?.name || "..."}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : uni ? (
          <div className="space-y-4 mt-4">
            {/* University Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{t("dev.crawlReview.uniSummary")}</span>
                  <div className="flex gap-2">
                    <Badge className={STATUS_COLORS[uni.crawl_status] || ""}>
                      {uni.crawl_status}
                    </Badge>
                    <Badge className={STATUS_COLORS[uni.publish_status] || ""}>
                      {uni.publish_status}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Logo + Basic Info */}
                <div className="flex gap-4">
                  {uni.logo_url ? (
                    <img
                      src={uni.logo_url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-contain border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg border flex items-center justify-center bg-muted">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <p className="font-medium">{uni.name_en || uni.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {uni.slug} · {uni.country_code}
                    </p>
                    <div className="flex gap-2 text-sm flex-wrap">
                      {uni.website ? (
                        <a
                          href={uni.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Globe className="h-3 w-3" />{" "}
                          {t("dev.crawlReview.websiteLink")}
                        </a>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          <Globe className="h-3 w-3 mr-1 opacity-40" />{" "}
                          {t("dev.crawlReview.websiteNotAvailable")}
                        </Badge>
                      )}
                      {uni.uniranks_profile_url && (
                        <a
                          href={uni.uniranks_profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> UniRanks
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ranks */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <RankChip
                    label={t("country.globalRank")}
                    value={uni.uniranks_world_rank}
                  />
                  <RankChip
                    label={uni.uniranks_region_label || t("country.globalRank")}
                    value={uni.uniranks_region_rank}
                  />
                  <RankChip
                    label={t("country.country")}
                    value={uni.uniranks_country_rank}
                  />
                  <RankChip
                    label={t("university.ranking")}
                    value={uni.uniranks_score}
                    prefix=""
                  />
                </div>

                {/* Badges & Signals */}
                <div className="flex flex-wrap gap-1">
                  {uni.uniranks_verified && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                  {uni.uniranks_recognized && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Recognized
                    </Badge>
                  )}
                  {uni.uniranks_badges?.map((b) => (
                    <Badge key={b} variant="secondary" className="text-xs">
                      {b}
                    </Badge>
                  ))}
                  {uni.uniranks_top_buckets?.map((b) => (
                    <Badge key={b} variant="outline" className="text-xs">
                      {b}
                    </Badge>
                  ))}
                </div>

                {/* Sections Present */}
                {uni.uniranks_sections_present &&
                  uni.uniranks_sections_present.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground ml-1">
                        {t("dev.crawlReview.sections")}
                      </span>
                      {uni.uniranks_sections_present.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}

                {/* Trace Info */}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {uni.uniranks_snapshot_at && (
                    <p>
                      {t("dev.crawlReview.lastSnapshot")}{" "}
                      {new Date(uni.uniranks_snapshot_at).toLocaleString()}
                    </p>
                  )}
                  {uni.uniranks_last_trace_id && (
                    <p>Trace: {uni.uniranks_last_trace_id}</p>
                  )}
                </div>

                {/* University Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    onClick={() => publishUniversity(true)}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "publish_uni" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    {t("dev.crawlReview.publishUniAndPrograms")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setReviewStatus("university", [uni.id], "needs_review")
                    }
                    disabled={actionLoading !== null}
                  >
                    {t("dev.crawlReview.needsReview")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      setReviewStatus("university", [uni.id], "rejected")
                    }
                    disabled={actionLoading !== null}
                  >
                    {t("dev.crawlReview.reject")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Inspection review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <ReviewBucket
                    title="HTML pages"
                    icon={<Globe className="h-4 w-4 text-primary" />}
                    count={reviewBuckets.htmlPages.length}
                    empty="No HTML evidence pages loaded for this university yet."
                    items={reviewBuckets.htmlPages.slice(0, 12).map((obs) => ({
                      title: obs.page_title || obs.field_name,
                      subtitle: compactUrl(obs.source_url),
                      href: obs.source_url,
                      meta: obs.fact_group || obs.status,
                    }))}
                  />
                  <ReviewBucket
                    title="PDF files"
                    icon={<FileText className="h-4 w-4 text-primary" />}
                    count={files.length}
                    empty="No PDF/file artifacts recorded yet."
                    items={files.slice(0, 20).map((file) => ({
                      title: file.file_name || compactUrl(file.source_url),
                      subtitle: compactUrl(
                        file.source_page_url || file.source_url,
                      ),
                      href: file.source_url,
                      badge:
                        FILE_STATUS_META[file.parse_status || "pending"]
                          ?.label || file.parse_status,
                      badgeTone:
                        FILE_STATUS_META[file.parse_status || "pending"]?.tone,
                      meta: `${file.artifact_type} • ${formatBytes(file.file_size_bytes)}${file.parsed_pages ? ` • ${file.parsed_pages} pages` : ""}`,
                    }))}
                  />
                  <ReviewBucket
                    title="Extracted fields"
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    count={reviewBuckets.extractedFields.length}
                    empty="No extracted fields captured yet."
                    items={reviewBuckets.extractedFields
                      .slice(0, 20)
                      .map((obs) => ({
                        title: `${obs.fact_group || "field"} / ${obs.field_name}`,
                        subtitle: obs.value_raw || "—",
                        href: obs.source_url,
                        meta:
                          obs.confidence != null
                            ? `confidence ${(obs.confidence * 100).toFixed(0)}%`
                            : obs.status,
                      }))}
                  />
                  <ReviewBucket
                    title="Missing fields"
                    icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
                    count={reviewBuckets.missingFields.length}
                    empty="No missing-field flags on current program drafts."
                    items={reviewBuckets.missingFields
                      .slice(0, 20)
                      .map((item) => ({
                        title: item.field,
                        subtitle: item.program,
                        meta: "program draft missing field",
                      }))}
                  />
                </div>

                <ReviewBucket
                  title="Failures / blocked items"
                  icon={<Ban className="h-4 w-4 text-destructive" />}
                  count={reviewBuckets.failures.length}
                  empty="No failures or blocked items recorded for the latest crawl row."
                  items={reviewBuckets.failures.slice(0, 20).map((item) => ({
                    title: item.label,
                    meta: item.type,
                  }))}
                />

                {crawlRow && (
                  <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                    <p>
                      <span className="font-medium text-foreground">
                        Latest crawl row:
                      </span>{" "}
                      {crawlRow.job_id.slice(0, 8)} · {crawlRow.crawl_status}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Pages scraped / mapped:
                      </span>{" "}
                      {crawlRow.pages_scraped ?? 0} /{" "}
                      {crawlRow.pages_mapped ?? 0}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Updated:
                      </span>{" "}
                      {new Date(crawlRow.updated_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Programs Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    {t("dev.crawlReview.programsTitle", {
                      count: programs.length,
                    })}
                  </span>
                  <div className="flex gap-2">
                    {selectedPrograms.size > 0 && (
                      <>
                        <Button
                          size="sm"
                          onClick={publishSelectedPrograms}
                          disabled={actionLoading !== null}
                        >
                          {t("dev.crawlReview.publishSelectedCount", {
                            count: selectedPrograms.size,
                          })}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setReviewStatus(
                              "program_draft",
                              Array.from(selectedPrograms),
                              "needs_review",
                            )
                          }
                          disabled={actionLoading !== null}
                        >
                          {t("dev.crawlReview.needsReview")}
                        </Button>
                      </>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {programs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("dev.crawlReview.noPrograms")}
                  </div>
                ) : (
                  <div className="divide-y">
                    {/* Select all header */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/50">
                      <Checkbox
                        checked={
                          selectedPrograms.size === programs.length &&
                          programs.length > 0
                        }
                        onCheckedChange={toggleAllPrograms}
                      />
                      <span className="text-xs text-muted-foreground">
                        {t("dev.crawlReview.selectAll")}
                      </span>
                    </div>

                    {programs.map((prog) => (
                      <Collapsible
                        key={prog.id}
                        open={expandedProgram === prog.id}
                        onOpenChange={(o) =>
                          setExpandedProgram(o ? prog.id : null)
                        }
                      >
                        <div className="flex items-start gap-3 px-4 py-3">
                          <Checkbox
                            checked={selectedPrograms.has(prog.id)}
                            onCheckedChange={() => toggleProgramSelect(prog.id)}
                            className="mt-1"
                          />
                          <CollapsibleTrigger className="flex-1 text-right">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-sm">
                                  {prog.title ||
                                    prog.title_en ||
                                    t("dev.crawlReview.noTitle")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {prog.degree_level} · {prog.language} ·{" "}
                                  {prog.duration_months
                                    ? `${prog.duration_months} ${t("dev.crawlReview.months")}`
                                    : "—"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={
                                    STATUS_COLORS[prog.review_status] || ""
                                  }
                                >
                                  {prog.review_status}
                                </Badge>
                                {prog.missing_fields &&
                                  prog.missing_fields.length > 0 && (
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                  )}
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${expandedProgram === prog.id ? "rotate-180" : ""}`}
                                />
                              </div>
                            </div>
                          </CollapsibleTrigger>
                        </div>

                        <CollapsibleContent>
                          <ProgramDetail
                            program={prog}
                            t={t}
                            onPublish={() => {
                              setActionLoading("pub_single");
                              supabase
                                .rpc("rpc_publish_programs", {
                                  p_program_draft_ids: [prog.id],
                                  p_trace_id: `REVIEW-PUB-SINGLE-${Date.now()}`,
                                })
                                .then(({ error }) => {
                                  if (error)
                                    toast({
                                      title: t("dev.crawlReview.error"),
                                      description: error.message,
                                      variant: "destructive",
                                    });
                                  else {
                                    toast({
                                      title: t(
                                        "dev.crawlReview.programsPublished",
                                      ),
                                    });
                                    fetchDetail();
                                  }
                                  setActionLoading(null);
                                });
                            }}
                            onReject={() =>
                              setReviewStatus(
                                "program_draft",
                                [prog.id],
                                "rejected",
                              )
                            }
                            onNeedsReview={() =>
                              setReviewStatus(
                                "program_draft",
                                [prog.id],
                                "needs_review",
                              )
                            }
                            actionLoading={actionLoading !== null}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Snapshot Preview */}
            {uni.uniranks_snapshot && (
              <Collapsible>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{t("dev.crawlReview.snapshotTitle")}</span>
                        <ChevronDown className="h-4 w-4" />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <pre
                        className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-[400px] whitespace-pre-wrap"
                        dir="ltr"
                      >
                        {JSON.stringify(uni.uniranks_snapshot, null, 2)}
                      </pre>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            {t("dev.crawlReview.uniNotFound")}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ReviewBucket({
  title,
  icon,
  count,
  empty,
  items,
}: {
  title: string;
  icon: ReactNode;
  count: number;
  empty: string;
  items: Array<{
    title: string;
    subtitle?: string | null;
    href?: string | null;
    meta?: string | null;
    badge?: string | null;
    badgeTone?: string | null;
  }>;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          <span>{title}</span>
        </div>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className="max-h-64 overflow-auto">
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="divide-y">
            {items.map((item, index) => (
              <div
                key={`${title}-${index}`}
                className="space-y-1 px-3 py-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground break-words">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-muted-foreground break-words">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                  {item.badge && (
                    <Badge className={`text-[10px] ${item.badgeTone || ""}`}>
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  {item.meta && <span>{item.meta}</span>}
                  {item.href && (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Link2 className="h-3 w-3" /> Open source
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RankChip({
  label,
  value,
  prefix = "#",
}: {
  label: string;
  value: number | null;
  prefix?: string;
}) {
  return (
    <div className="text-center p-2 rounded-lg border bg-muted/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-bold text-sm">
        {value != null ? `${prefix}${value}` : "—"}
      </p>
    </div>
  );
}

function ProgramDetail({
  program,
  t,
  onPublish,
  onReject,
  onNeedsReview,
  actionLoading,
}: {
  program: ProgramDraft;
  t: (key: string, opts?: any) => string;
  onPublish: () => void;
  onReject: () => void;
  onNeedsReview: () => void;
  actionLoading: boolean;
}) {
  return (
    <div className="px-4 pb-4 mr-7 space-y-3 border-t bg-muted/20">
      {/* Fields Grid */}
      <div className="grid grid-cols-2 gap-2 pt-3 text-sm">
        <Field label={t("dev.crawlReview.fieldTitle")} value={program.title} />
        <Field
          label={t("dev.crawlReview.fieldTitleEn")}
          value={program.title_en}
        />
        <Field
          label={t("dev.crawlReview.fieldDegree")}
          value={program.degree_level}
        />
        <Field
          label={t("dev.crawlReview.fieldLanguage")}
          value={program.language}
        />
        <Field
          label={t("dev.crawlReview.fieldDuration")}
          value={
            program.duration_months
              ? `${program.duration_months} ${t("dev.crawlReview.months")}`
              : null
          }
        />
        <Field
          label={t("dev.crawlReview.fieldFees")}
          value={
            program.tuition_fee
              ? `${program.tuition_fee} ${program.currency || ""}`
              : null
          }
        />
        <Field
          label={t("dev.crawlReview.fieldConfidence")}
          value={
            program.final_confidence != null
              ? `${program.final_confidence}%`
              : null
          }
        />
        <Field
          label={t("dev.crawlReview.fieldVersion")}
          value={program.extractor_version}
        />
      </div>

      {/* Missing Fields Warning */}
      {program.missing_fields && program.missing_fields.length > 0 && (
        <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
              {t("dev.crawlReview.missingFields")}
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              {program.missing_fields.join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Source URLs */}
      <div className="flex gap-3 text-xs">
        {program.source_url && (
          <a
            href={program.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> {t("dev.crawlReview.source")}
          </a>
        )}
        {program.source_program_url && (
          <a
            href={program.source_program_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />{" "}
            {t("dev.crawlReview.programPage")}
          </a>
        )}
      </div>

      {/* Evidence Map */}
      {program.field_evidence_map &&
        Object.keys(program.field_evidence_map).length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1">
              <ChevronDown className="h-3 w-3" />{" "}
              {t("dev.crawlReview.showEvidence", {
                count: Object.keys(program.field_evidence_map).length,
              })}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1">
                {Object.entries(program.field_evidence_map).map(
                  ([field, evidence]: [string, any]) => (
                    <div key={field} className="text-xs p-2 bg-muted rounded">
                      <span className="font-medium">{field}:</span>{" "}
                      <span className="text-muted-foreground">
                        {typeof evidence === "string"
                          ? evidence
                          : JSON.stringify(evidence)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={onPublish} disabled={actionLoading}>
          {t("dev.crawlReview.publish")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onNeedsReview}
          disabled={actionLoading}
        >
          {t("dev.crawlReview.needsReview")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onReject}
          disabled={actionLoading}
        >
          {t("dev.crawlReview.reject")}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">
        {value || <span className="text-muted-foreground/50">—</span>}
      </p>
    </div>
  );
}
