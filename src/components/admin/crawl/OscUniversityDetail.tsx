import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, ExternalLink, FileText, Database, Download, Eye,
  AlertCircle, CheckCircle2, XCircle, GraduationCap, Globe,
  DollarSign, Calendar, BookOpen, Link2, MapPin, Phone, Mail, Building2,
  Shield,
} from "lucide-react";
import { ProgramCard, type ProgramDraft } from "./ProgramCard";
import { AdmissionsReviewSection } from "./AdmissionsReviewSection";

/* ── Types ── */
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

interface OscUniversity {
  university_id: string;
  university_name: string;
  website: string | null;
  crawl_status: string;
  completeness_score: number | null;
  completeness_by_section: Record<string, { found: boolean; score: number; weight: number }> | null;
  pages_scraped: number;
  pages_mapped: number;
  reason_codes: string[] | null;
  error_message: string | null;
  extracted_summary: Record<string, any> | null;
  updated_at: string;
}

/* ── Constants ── */
const FACT_GROUP_LABELS: Record<string, { label: string; icon: string }> = {
  identity: { label: "الهوية", icon: "🏛" },
  contact_location: { label: "الاتصال", icon: "📍" },
  admissions: { label: "القبول", icon: "📋" },
  deadlines_intakes: { label: "المواعيد", icon: "📅" },
  tuition_fees: { label: "الرسوم", icon: "💰" },
  scholarships: { label: "المنح", icon: "🎓" },
  language_requirements: { label: "اللغة", icon: "🌐" },
  programs: { label: "البرامج", icon: "📚" },
  housing: { label: "السكن", icon: "🏠" },
  student_life: { label: "الحياة الطلابية", icon: "⚽" },
  media_brochures: { label: "الوسائط", icon: "🖼" },
  cta_links: { label: "روابط CTA", icon: "🔗" },
  university_overview: { label: "نظرة عامة", icon: "📄" },
  contact_info: { label: "معلومات الاتصال", icon: "📞" },
  fees: { label: "رسوم", icon: "💵" },
};

const PARSE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  parsed: { label: "تم التحليل", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200", icon: CheckCircle2 },
  extracted: { label: "تم الاستخراج", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200", icon: CheckCircle2 },
  parse_failed: { label: "فشل التحليل", color: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200", icon: XCircle },
  pending: { label: "في الانتظار", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200", icon: AlertCircle },
};

interface UniversityOffice {
  id: string;
  office_type: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  url: string | null;
  location: string | null;
  office_hours: string | null;
  review_status: string | null;
  source_url: string | null;
}

/* ── Component ── */
export function OscUniversityDetail({ uni }: { uni: OscUniversity }) {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [files, setFiles] = useState<FileArtifact[]>([]);
  const [programs, setPrograms] = useState<ProgramDraft[]>([]);
  const [offices, setOffices] = useState<UniversityOffice[]>([]);
  const [admRoutes, setAdmRoutes] = useState<any[]>([]);
  const [eligRules, setEligRules] = useState<any[]>([]);
  const [reqDocs, setReqDocs] = useState<any[]>([]);
  const [progDeadlines, setProgDeadlines] = useState<any[]>([]);
  const [obsFromFiles, setObsFromFiles] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [obsRes, filesRes, obsFileRes, progsRes, officesRes, routesRes, eligRes, docsRes, dlRes] = await Promise.all([
        supabase
          .from("official_site_observations" as any)
          .select("id, fact_group, field_name, value, source_url, evidence_snippet, confidence, status, created_at")
          .eq("university_id", uni.university_id)
          .order("fact_group").order("field_name").limit(500),
        supabase
          .from("crawl_file_artifacts" as any)
          .select("id, source_url, file_name, artifact_type, mime_type, parse_status, parsed_pages, file_size_bytes, evidence_snippet, storage_path")
          .eq("university_id", uni.university_id)
          .order("created_at", { ascending: false }).limit(50),
        supabase
          .from("official_site_observations" as any)
          .select("artifact_id")
          .eq("university_id", uni.university_id)
          .not("artifact_id", "is", null).limit(500),
        supabase
          .from("program_draft" as any)
          .select("*")
          .eq("university_id", uni.university_id)
          .order("title").limit(200),
        supabase
          .from("university_offices" as any)
          .select("id, office_type, name, email, phone, url, location, office_hours, review_status, source_url")
          .eq("university_id", uni.university_id)
          .order("office_type").limit(20),
        supabase
          .from("program_admission_routes" as any)
          .select("*")
          .eq("university_id", uni.university_id).limit(50),
        supabase
          .from("program_eligibility_rules" as any)
          .select("*")
          .eq("university_id", uni.university_id).limit(100),
        supabase
          .from("program_required_documents" as any)
          .select("*")
          .eq("university_id", uni.university_id).limit(100),
        supabase
          .from("program_deadlines" as any)
          .select("*")
          .eq("university_id", uni.university_id).limit(100),
      ]);

      setObservations((obsRes.data as any) || []);
      setFiles((filesRes.data as any) || []);
      setPrograms((progsRes.data as any) || []);
      setOffices((officesRes.data as any) || []);
      setAdmRoutes((routesRes.data as any) || []);
      setEligRules((eligRes.data as any) || []);
      setReqDocs((docsRes.data as any) || []);
      setProgDeadlines((dlRes.data as any) || []);

      const countMap: Record<string, number> = {};
      ((obsFileRes.data as any) || []).forEach((r: any) => {
        if (r.artifact_id) countMap[r.artifact_id] = (countMap[r.artifact_id] || 0) + 1;
      });
      setObsFromFiles(countMap);
      setLoading(false);
    }
    load();
  }, [uni.university_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = observations.reduce<Record<string, Observation[]>>((acc, o) => {
    const g = o.fact_group || "other";
    if (!acc[g]) acc[g] = [];
    acc[g].push(o);
    return acc;
  }, {});

  const filesParsed = files.filter(f => f.parse_status === "parsed" || f.parse_status === "extracted").length;
  const filesWithObs = files.filter(f => obsFromFiles[f.id] > 0).length;
  const conflictObs = observations.filter(o => o.status === "conflict" || o.status === "CONFLICT_WITH_PUBLISHED").length;

  // Extract canonical contacts/CTAs from observations
  const contactFields = ["email", "phone", "apply_url", "inquiry_url", "contact_url", "visit_url", "student_portal_url"];
  const contactObs = observations.filter(o => contactFields.includes(o.field_name) && o.fact_group === "contact_location" || o.fact_group === "cta_links");
  const officeObs = observations.filter(o => o.field_name?.startsWith("office_"));

  const OFFICE_TYPE_LABELS: Record<string, string> = {
    admission: "مكتب القبول",
    visa: "مكتب التأشيرات",
    international: "المكتب الدولي",
    registrar: "التسجيل",
    financial_aid: "المساعدات المالية",
    housing: "السكن",
    student_affairs: "شؤون الطلاب",
    other: "أخرى",
  };

  return (
    <div className="space-y-3">
      {/* ── Truth Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <SummaryChip icon={<Database className="h-3.5 w-3.5" />} label="حقائق مستخرجة" value={observations.length} color="text-emerald-600" />
        <SummaryChip icon={<GraduationCap className="h-3.5 w-3.5" />} label="برامج مستخرجة" value={programs.length} color="text-blue-600" />
        <SummaryChip icon={<FileText className="h-3.5 w-3.5" />} label="ملفات مكتشفة" value={files.length} sub={`${filesParsed} محللة`} color="text-amber-600" />
        <SummaryChip icon={<Building2 className="h-3.5 w-3.5" />} label="مكاتب" value={offices.length + officeObs.length} color="text-violet-600" />
        <SummaryChip icon={<AlertCircle className="h-3.5 w-3.5" />} label="تعارضات" value={conflictObs} color={conflictObs > 0 ? "text-rose-600" : "text-muted-foreground"} />
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full grid grid-cols-6 h-9">
          <TabsTrigger value="overview" className="text-xs">نظرة عامة</TabsTrigger>
          <TabsTrigger value="facts" className="text-xs">
            الحقائق
            {observations.length > 0 && <Badge variant="secondary" className="mr-1 text-[9px] px-1 py-0 h-4">{observations.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="programs" className="text-xs">
            البرامج
            {programs.length > 0 && <Badge variant="secondary" className="mr-1 text-[9px] px-1 py-0 h-4">{programs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="admissions" className="text-xs">
            القبول
            {(admRoutes.length + eligRules.length + reqDocs.length + progDeadlines.length) > 0 && <Badge variant="secondary" className="mr-1 text-[9px] px-1 py-0 h-4">{admRoutes.length + eligRules.length + reqDocs.length + progDeadlines.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs">
            الاتصال
            {(contactObs.length + offices.length) > 0 && <Badge variant="secondary" className="mr-1 text-[9px] px-1 py-0 h-4">{contactObs.length + offices.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="files" className="text-xs">
            الملفات
            {files.length > 0 && <Badge variant="secondary" className="mr-1 text-[9px] px-1 py-0 h-4">{files.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-3 mt-3">
          {/* Fact group grid */}
          {uni.completeness_by_section && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Object.entries(uni.completeness_by_section).map(([key, val]) => {
                const meta = FACT_GROUP_LABELS[key] || { label: key, icon: "📄" };
                const groupObs = grouped[key] || [];
                return (
                  <button
                    key={key}
                    onClick={() => { setActiveTab("facts"); }}
                    className={`rounded-lg p-2.5 text-center border transition-all hover:shadow-sm cursor-pointer ${
                      val.found
                        ? "bg-emerald-50/80 border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-800/40"
                        : "bg-rose-50/60 border-rose-200/60 dark:bg-rose-950/30 dark:border-rose-800/40"
                    }`}
                  >
                    <div className="text-base leading-none mb-1">{meta.icon}</div>
                    <div className={`text-[10px] font-semibold ${val.found ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                      {meta.label}
                    </div>
                    <div className={`text-[9px] mt-0.5 ${val.found ? "text-emerald-500" : "text-rose-400"}`}>
                      {groupObs.length > 0 ? `${groupObs.length} حقل` : (val.found ? "✓ تم" : "✗ ناقص")}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* University Contacts/CTAs Quick View */}
          {contactObs.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> بيانات الاتصال المكتشفة</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {contactObs.map(o => (
                  <div key={o.id} className="text-[10px] bg-muted/40 rounded px-2 py-1.5 flex items-center gap-1.5">
                    {o.field_name === "email" && <Mail className="h-2.5 w-2.5 text-muted-foreground" />}
                    {o.field_name === "phone" && <Phone className="h-2.5 w-2.5 text-muted-foreground" />}
                    {o.field_name?.includes("url") && <Link2 className="h-2.5 w-2.5 text-muted-foreground" />}
                    <span className="text-muted-foreground">{o.field_name}:</span>
                    <span className="font-mono text-foreground truncate">{o.value?.slice(0, 50)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offices Quick View */}
          {officeObs.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> مكاتب مؤسسية مكتشفة</h4>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set(officeObs.map(o => o.field_name?.split("_")[1]))].map(type => (
                  <Badge key={type} variant="outline" className="text-[10px] gap-1">
                    <Building2 className="h-2.5 w-2.5" />
                    {OFFICE_TYPE_LABELS[type || ""] || type}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {uni.reason_codes && uni.reason_codes.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-muted-foreground mb-1.5">تحذيرات</h4>
              <div className="flex flex-wrap gap-1.5">
                {uni.reason_codes.map((code, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-mono bg-amber-50/80 text-amber-700 border-amber-200/60 dark:bg-amber-950/30">
                    {code}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {uni.error_message && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-2.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{uni.error_message}</span>
            </div>
          )}

          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-dashed">
            <span>صفحات: {uni.pages_scraped} زحف · {uni.pages_mapped} خريطة</span>
            <span>آخر تحديث: {new Date(uni.updated_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </TabsContent>

        {/* ── Facts Tab ── */}
        <TabsContent value="facts" className="space-y-3 mt-3">
          {observations.length === 0 ? (
            <EmptyState message="لا توجد حقائق مستخرجة لهذه الجامعة بعد" />
          ) : (
            Object.entries(grouped).map(([group, obs]) => {
              const meta = FACT_GROUP_LABELS[group] || { label: group, icon: "📄" };
              return (
                <div key={group} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{meta.icon}</span>
                    <span className="text-xs font-semibold">{meta.label}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{obs.length}</Badge>
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
                            {o.status && (
                              <Badge variant="outline" className={`text-[9px] py-0 ${o.status?.includes('CONFLICT') ? 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30' : ''}`}>
                                {o.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-muted-foreground break-all leading-relaxed font-mono text-[11px] bg-muted/40 rounded px-2 py-1">
                          {o.value ? (o.value.length > 300 ? o.value.slice(0, 300) + "…" : o.value) : <span className="italic text-muted-foreground/50">— فارغ —</span>}
                        </p>
                        {o.evidence_snippet && (
                          <p className="text-[10px] text-muted-foreground/70 italic border-r-2 border-muted pr-2">
                            {o.evidence_snippet.slice(0, 200)}
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
              );
            })
          )}
        </TabsContent>

        {/* ── Programs Tab ── */}
        <TabsContent value="programs" className="space-y-3 mt-3">
          {programs.length === 0 ? (
            <EmptyState message="لم يتم استخراج برامج لهذه الجامعة بعد" />
          ) : (
            <>
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>{programs.length} برنامج مستخرج</span>
                <span>·</span>
                <span className="text-emerald-600">{programs.filter(p => p.review_status === 'published' || p.published_at).length} منشور</span>
                <span className="text-amber-600">{programs.filter(p => p.review_status === 'draft').length} مسودة</span>
                {programs.filter(p => p.missing_fields && p.missing_fields.length > 0).length > 0 && (
                  <span className="text-rose-600">{programs.filter(p => p.missing_fields && p.missing_fields.length > 0).length} ناقص</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {programs.map((prog) => (
                  <ProgramReviewCard key={prog.id} program={prog} />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Admissions Tab ── */}
        <TabsContent value="admissions" className="space-y-3 mt-3">
          <AdmissionsReviewSection
            observations={observations}
            routes={admRoutes}
            eligibilityRules={eligRules}
            requiredDocuments={reqDocs}
            deadlines={progDeadlines}
          />
        </TabsContent>

        {/* ── Contacts & Offices Tab ── */}
        <TabsContent value="contacts" className="space-y-3 mt-3">
          {/* Canonical contacts from observations */}
          {contactObs.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> بيانات الاتصال الجامعي</h4>
              <div className="border rounded-lg divide-y overflow-hidden">
                {contactObs.map(o => (
                  <div key={o.id} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground shrink-0">{o.field_name}</span>
                      <span className="font-mono text-foreground truncate">{o.value?.slice(0, 80)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {o.confidence != null && <span className="text-[10px] font-mono text-muted-foreground">{(o.confidence * 100).toFixed(0)}%</span>}
                      <Badge variant="outline" className="text-[9px] py-0">{o.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Institutional Offices */}
          {(officeObs.length > 0 || offices.length > 0) && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /> المكاتب المؤسسية</h4>
              {offices.length > 0 ? (
                <div className="border rounded-lg divide-y overflow-hidden">
                  {offices.map(off => (
                    <div key={off.id} className="px-3 py-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{OFFICE_TYPE_LABELS[off.office_type] || off.office_type}</span>
                        <Badge variant="outline" className="text-[9px] py-0">{off.review_status}</Badge>
                      </div>
                      {off.name && <div className="text-muted-foreground">{off.name}</div>}
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        {off.email && <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{off.email}</span>}
                        {off.phone && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{off.phone}</span>}
                        {off.url && <a href={off.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Link2 className="h-2.5 w-2.5" />رابط</a>}
                        {off.location && <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{off.location}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg divide-y overflow-hidden">
                  {officeObs.map(o => (
                    <div key={o.id} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground shrink-0">{o.field_name}</span>
                        <span className="font-mono text-foreground truncate">{o.value?.slice(0, 80)}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] py-0">{o.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {contactObs.length === 0 && officeObs.length === 0 && offices.length === 0 && (
            <EmptyState message="لم يتم اكتشاف بيانات اتصال أو مكاتب بعد" />
          )}
        </TabsContent>

        {/* ── Files Tab ── */}
        <TabsContent value="files" className="space-y-3 mt-3">
          {files.length === 0 ? (
            <EmptyState message="لم يتم اكتشاف ملفات PDF أو مستندات لهذه الجامعة" />
          ) : (
            <>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                <span className="text-emerald-600">{filesParsed} تم تحليلها</span>
                <span className="text-primary">{filesWithObs} أنتجت ملاحظات</span>
                {files.filter(f => f.parse_status === "parse_failed").length > 0 && (
                  <span className="text-destructive">{files.filter(f => f.parse_status === "parse_failed").length} فشلت</span>
                )}
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
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Program Review Card — rich design matching ProgramCard + review extras ── */
function ProgramReviewCard({ program }: { program: ProgramDraft }) {
  const ext = program.extracted_json || {};
  const degree = ext.degree || program.degree_level;
  const lang = ext.language || program.language;
  const duration = ext.duration_months || program.duration_months;
  const tuition = ext.tuition_amount || program.tuition_fee;
  const currency = ext.tuition_currency || program.currency || "USD";
  const studyMode = ext.study_mode;
  const intake = ext.semester_start_date || ext.intake_label;
  const deadline = ext.application_end_date;
  const applyUrl = ext.apply_url || program.source_program_url;
  const ielts = ext.ielts_min;
  const toefl = ext.toefl_min;
  const ects = ext.ects;
  const sourceType = ext.source_type || "page";

  const fields: { key: string; label: string; has: boolean }[] = [
    { key: "title", label: "العنوان", has: !!(program.title || program.title_en) },
    { key: "degree", label: "الدرجة", has: !!degree },
    { key: "language", label: "اللغة", has: !!lang },
    { key: "tuition", label: "الرسوم", has: !!tuition },
    { key: "duration", label: "المدة", has: !!duration },
    { key: "deadline", label: "الموعد", has: !!deadline },
    { key: "apply_url", label: "رابط التقديم", has: !!applyUrl },
    { key: "intake", label: "الالتحاق", has: !!intake },
    { key: "study_mode", label: "نمط الدراسة", has: !!studyMode },
  ];
  const filled = fields.filter(f => f.has).length;
  const total = fields.length;
  const pct = Math.round((filled / total) * 100);

  const statusColor = program.review_status === 'published'
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
    : program.review_status === 'needs_review'
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
    : 'bg-muted text-muted-foreground';

  const sourceIcon = sourceType === 'pdf' ? <FileText className="h-3 w-3" /> : sourceType === 'published' ? <CheckCircle2 className="h-3 w-3" /> : <Globe className="h-3 w-3" />;

  const title = program.title || program.title_en || "بدون عنوان";
  const firstLetter = title.charAt(0).toUpperCase();

  return (
    <div className="bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-200 flex flex-col h-full min-h-[320px]">
      {/* Header gradient — matching ProgramCardCompact */}
      <div className="h-20 bg-gradient-to-br from-primary/20 to-primary/5 relative flex items-center justify-center rounded-t-xl">
        <GraduationCap className="w-8 h-8 text-primary/30" />
        {/* Status badge — top-end */}
        <Badge className={`absolute top-2 end-2 text-[10px] px-2 py-0.5 h-5 ${statusColor}`}>
          {program.review_status || "draft"}
        </Badge>
        {/* Source type — top-start */}
        <span className="absolute top-2 start-2 text-[10px] bg-background/80 backdrop-blur-sm text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1 border border-border/50">
          {sourceIcon} {sourceType}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Avatar + Title — matching ProgramCardCompact */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-border text-primary font-semibold text-sm">
            {firstLetter}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight min-h-[2.5rem]">
              {title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {degree && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5"><GraduationCap className="h-2.5 w-2.5" />{degree}</Badge>}
              {lang && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5"><Globe className="h-2.5 w-2.5" />{lang}</Badge>}
              {studyMode && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{studyMode}</Badge>}
            </div>
          </div>
        </div>

        {/* Key stats — highlighted boxes matching ProgramCard design */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-2 text-center">
            <DollarSign className="h-3.5 w-3.5 text-primary mx-auto mb-0.5" />
            <div className="text-xs font-bold text-foreground tabular-nums">
              {tuition ? `${Number(tuition).toLocaleString()} ${currency}` : "—"}
            </div>
            <div className="text-[9px] text-muted-foreground">الرسوم</div>
          </div>
          <div className="rounded-lg bg-accent/10 border border-accent/20 p-2 text-center">
            <Calendar className="h-3.5 w-3.5 text-accent-foreground mx-auto mb-0.5" />
            <div className="text-xs font-bold text-foreground tabular-nums">
              {duration ? `${duration} شهر` : "—"}
            </div>
            <div className="text-[9px] text-muted-foreground">المدة</div>
          </div>
        </div>

        {/* Info grid — 2 columns with icons */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          {ielts && (
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">IELTS:</span>
              <span className="font-medium text-foreground">{ielts}</span>
            </div>
          )}
          {toefl && (
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">TOEFL:</span>
              <span className="font-medium text-foreground">{toefl}</span>
            </div>
          )}
          {intake && (
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">الالتحاق:</span>
              <span className="font-medium text-foreground truncate">{intake}</span>
            </div>
          )}
          {deadline && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">الموعد:</span>
              <span className="font-medium text-foreground truncate">{deadline}</span>
            </div>
          )}
          {ects && (
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">ECTS:</span>
              <span className="font-medium text-foreground">{ects}</span>
            </div>
          )}
        </div>

        {/* Completeness bar */}
        <div className="space-y-1.5 mt-auto pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>اكتمال الحقول</span>
            <span className={`font-mono font-bold ${pct >= 78 ? 'text-emerald-600' : pct >= 45 ? 'text-amber-600' : 'text-rose-600'}`}>
              {filled}/{total} ({pct}%)
            </span>
          </div>
          <div className="flex gap-0.5">
            {fields.map((f) => (
              <div
                key={f.key}
                title={`${f.label}: ${f.has ? '✓' : '✗'}`}
                className={`h-1.5 flex-1 rounded-full transition-colors ${f.has ? 'bg-emerald-500' : 'bg-rose-300 dark:bg-rose-800'}`}
              />
            ))}
          </div>
          {/* Field chips */}
          <div className="flex flex-wrap gap-1">
            {fields.map((f) => (
              <span
                key={f.key}
                className={`text-[9px] px-1.5 py-0.5 rounded-full border ${f.has
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                {f.has ? '✓' : '✗'} {f.label}
              </span>
            ))}
          </div>
        </div>

        {/* Source links footer */}
        <div className="flex items-center gap-2 text-[10px] flex-wrap pt-1">
          {program.source_url && (
            <a href={program.source_url} target="_blank" rel="noopener noreferrer" className="text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-0.5">
              <ExternalLink className="h-2.5 w-2.5" /> المصدر
            </a>
          )}
          {applyUrl && (
            <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-0.5">
              <Link2 className="h-2.5 w-2.5" /> رابط التقديم
            </a>
          )}
          {program.extractor_version && (
            <span className="text-muted-foreground/50">v{program.extractor_version}</span>
          )}
          {program.last_extracted_at && (
            <span className="text-muted-foreground/50">
              {new Date(program.last_extracted_at).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function SummaryChip({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-2">
      <div className={`${color}`}>{icon}</div>
      <div className="min-w-0">
        <div className={`text-sm font-bold tabular-nums ${color}`}>{value}</div>
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
        {sub && <div className="text-[9px] text-muted-foreground/70">{sub}</div>}
      </div>
    </div>
  );
}

function FieldRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      {value ? (
        <span className="font-medium text-foreground truncate">{value}</span>
      ) : (
        <span className="text-muted-foreground/40 italic">—</span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 px-3 bg-muted/30 rounded-lg border border-dashed justify-center">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
