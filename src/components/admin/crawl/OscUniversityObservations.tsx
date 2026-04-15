import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, FileText, Database, Download, Eye, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

interface Observation {
  id: number;
  fact_group: string;
  field_name: string;
  value: string | null;
  source_url: string | null;
  evidence_snippet: string | null;
  confidence: number | null;
  status: string | null;
  created_at: string;
}

interface FileArtifact {
  id: string;
  source_url: string | null;
  file_name: string | null;
  artifact_type: string | null;
  mime_type: string | null;
  parse_status: string | null;
  parsed_pages: number | null;
  file_size_bytes: number | null;
  evidence_snippet: string | null;
  storage_path: string | null;
}

const FACT_GROUP_LABELS: Record<string, string> = {
  identity: "الهوية", contact_location: "الاتصال", admissions: "القبول",
  deadlines_intakes: "المواعيد", tuition_fees: "الرسوم", scholarships: "المنح",
  language_requirements: "اللغة", programs: "البرامج", housing: "السكن",
  student_life: "الحياة الطلابية", media_brochures: "الوسائط", cta_links: "روابط CTA",
  university_overview: "نظرة عامة", contact_info: "معلومات الاتصال", fees: "رسوم",
};

const PARSE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  parsed:       { label: "تم التحليل",   color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: CheckCircle2 },
  extracted:    { label: "تم الاستخراج",  color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",           icon: CheckCircle2 },
  parse_failed: { label: "فشل التحليل",   color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",               icon: XCircle },
  pending:      { label: "في الانتظار",   color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",       icon: AlertCircle },
};

export function OscUniversityObservations({ universityId }: { universityId: string }) {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [files, setFiles] = useState<FileArtifact[]>([]);
  const [obsFromFiles, setObsFromFiles] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [obsRes, filesRes, obsFileCountRes] = await Promise.all([
        supabase
          .from("official_site_observations" as any)
          .select("id, fact_group, field_name, value, source_url, evidence_snippet, confidence, status, created_at")
          .eq("university_id", universityId)
          .order("fact_group").order("field_name").limit(200),
        supabase
          .from("crawl_file_artifacts" as any)
          .select("id, source_url, file_name, artifact_type, mime_type, parse_status, parsed_pages, file_size_bytes, evidence_snippet, storage_path")
          .eq("university_id", universityId)
          .order("created_at", { ascending: false }).limit(50),
        supabase
          .from("official_site_observations" as any)
          .select("artifact_id")
          .eq("university_id", universityId)
          .not("artifact_id", "is", null).limit(500),
      ]);
      setObservations((obsRes.data as any) || []);
      setFiles((filesRes.data as any) || []);
      const countMap: Record<string, number> = {};
      ((obsFileCountRes.data as any) || []).forEach((row: any) => {
        if (row.artifact_id) countMap[row.artifact_id] = (countMap[row.artifact_id] || 0) + 1;
      });
      setObsFromFiles(countMap);
      setLoading(false);
    }
    load();
  }, [universityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = observations.reduce<Record<string, Observation[]>>((acc, obs) => {
    const g = obs.fact_group || "other";
    if (!acc[g]) acc[g] = [];
    acc[g].push(obs);
    return acc;
  }, {});

  const filesParsed = files.filter(f => f.parse_status === "parsed" || f.parse_status === "extracted").length;
  const filesFailed = files.filter(f => f.parse_status === "parse_failed").length;
  const filesPending = files.filter(f => !f.parse_status || f.parse_status === "pending").length;
  const filesWithObs = files.filter(f => obsFromFiles[f.id] > 0).length;

  return (
    <div className="space-y-4">
      {/* ── Files/PDF Section ── */}
      <div>
        <h4 className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <FileText className="h-3 w-3" />
          ملفات PDF والمستندات ({files.length})
        </h4>

        {files.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 px-3 bg-muted/30 rounded-lg border border-dashed">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>لم يتم اكتشاف أي ملفات PDF أو مستندات لهذه الجامعة</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2 px-1">
              <span className="text-emerald-600">{filesParsed} تم تحليلها</span>
              {filesFailed > 0 && <span className="text-destructive">{filesFailed} فشلت</span>}
              {filesPending > 0 && <span className="text-amber-600">{filesPending} في الانتظار</span>}
              <span className="text-primary">{filesWithObs} أنتجت ملاحظات</span>
            </div>

            <div className="border rounded-lg divide-y overflow-hidden">
              {files.map((f) => {
                const statusCfg = PARSE_STATUS_CONFIG[f.parse_status || "pending"] || PARSE_STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const obsCount = obsFromFiles[f.id] || 0;

                return (
                  <div key={f.id} className="px-3 py-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{f.file_name || f.artifact_type || "ملف"}</span>
                        {f.mime_type && (
                          <span className="text-[9px] text-muted-foreground/60 shrink-0">
                            {f.mime_type.split('/').pop()?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={`text-[9px] py-0 gap-1 ${statusCfg.color}`}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {statusCfg.label}
                        </Badge>
                        {f.artifact_type && <Badge variant="outline" className="text-[9px] py-0">{f.artifact_type}</Badge>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      {f.parsed_pages != null && <span>{f.parsed_pages} صفحة</span>}
                      {f.file_size_bytes != null && <span>{(f.file_size_bytes / 1024).toFixed(0)} KB</span>}
                      {f.storage_path ? (
                        <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" /> مخزن</span>
                      ) : (
                        <span className="text-rose-500 flex items-center gap-0.5"><XCircle className="h-2.5 w-2.5" /> غير مخزن</span>
                      )}
                      {obsCount > 0 ? (
                        <span className="text-primary flex items-center gap-0.5"><Database className="h-2.5 w-2.5" /> {obsCount} ملاحظة</span>
                      ) : f.parse_status === "parsed" || f.parse_status === "extracted" ? (
                        <span className="text-amber-500">تم التحليل — لا ملاحظات بعد</span>
                      ) : f.parse_status === "parse_failed" ? (
                        <span className="text-destructive">فشل — لا ملاحظات</span>
                      ) : (
                        <span className="text-muted-foreground/50">في الانتظار</span>
                      )}
                    </div>

                    {f.evidence_snippet && (
                      <p className="text-[10px] text-muted-foreground/70 italic border-r-2 border-muted pr-2">
                        {f.evidence_snippet.slice(0, 150)}…
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      {f.source_url && (
                        <a href={f.source_url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-0.5">
                          <Eye className="h-2.5 w-2.5" /> عرض المصدر
                        </a>
                      )}
                      {f.storage_path && (
                        <button
                          className="text-[10px] text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-0.5"
                          onClick={async () => {
                            const { data } = await supabase.storage.from("university-assets").createSignedUrl(f.storage_path!, 300);
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          }}
                        >
                          <Download className="h-2.5 w-2.5" /> تحميل
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Observations Section ── */}
      <div>
        <h4 className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <Database className="h-3 w-3" />
          الملاحظات المستخرجة ({observations.length})
        </h4>
        {observations.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 px-3 bg-muted/30 rounded-lg border border-dashed">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>لا توجد ملاحظات مستخرجة لهذه الجامعة بعد</span>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([group, obs]) => (
              <div key={group} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{FACT_GROUP_LABELS[group] || group}</Badge>
                  <span className="text-[10px] text-muted-foreground">{obs.length} حقل</span>
                </div>
                <div className="border rounded-lg divide-y overflow-hidden">
                  {obs.map((o) => (
                    <div key={o.id} className="px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{o.field_name}</span>
                        <div className="flex items-center gap-1.5">
                          {o.confidence != null && (
                            <span className={`text-[10px] font-mono ${o.confidence >= 0.7 ? 'text-emerald-600' : o.confidence >= 0.4 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {(o.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                          {o.status && <Badge variant="outline" className="text-[9px] py-0">{o.status}</Badge>}
                        </div>
                      </div>
                      <p className="text-muted-foreground break-all leading-relaxed">
                        {o.value ? (o.value.length > 200 ? o.value.slice(0, 200) + "…" : o.value) : "—"}
                      </p>
                      {o.evidence_snippet && (
                        <p className="text-[10px] text-muted-foreground/70 italic border-r-2 border-muted pr-2">
                          {o.evidence_snippet.slice(0, 150)}
                        </p>
                      )}
                      {o.source_url && (
                        <a href={o.source_url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-0.5">
                          <ExternalLink className="h-2.5 w-2.5" />
                          {o.source_url.replace(/^https?:\/\//, '').slice(0, 60)}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}