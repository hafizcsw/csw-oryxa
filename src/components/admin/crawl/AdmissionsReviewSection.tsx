import { Badge } from "@/components/ui/badge";
import { AlertCircle, ExternalLink, FileCheck, FileText, Calendar, DollarSign, Shield, Globe, BookOpen, GraduationCap } from "lucide-react";

interface Observation {
  id: number;
  fact_group: string;
  field_name: string;
  value: string | null;
  source_url: string | null;
  evidence_snippet: string | null;
  confidence: number | null;
  status: string | null;
}

interface AdmissionRoute {
  id: string; route_type: string; platform_name: string | null; platform_url: string | null;
  route_notes: string | null; pre_enrolment_required: boolean; pre_enrolment_platform: string | null;
  pre_enrolment_url: string | null; preparatory_route_required: boolean; preparatory_route_name: string | null;
  review_status: string | null; source_url: string | null;
}

interface EligibilityRule {
  id: string; rule_type: string; condition_text: string | null; min_value: number | null;
  applies_to_countries: string[] | null; linked_exam: string | null;
  review_status: string | null; source_url: string | null; evidence_snippet: string | null;
}

interface RequiredDocument {
  id: string; document_type: string; document_name: string | null;
  translation_required: boolean; certified_copy_required: boolean;
  review_status: string | null; source_url: string | null;
}

interface ProgramDeadline {
  id: string; deadline_type: string; deadline_date: string | null; deadline_text: string | null;
  academic_year: string | null; review_status: string | null; source_url: string | null;
}

interface Props {
  observations: Observation[];
  routes: AdmissionRoute[];
  eligibilityRules: EligibilityRule[];
  requiredDocuments: RequiredDocument[];
  deadlines: ProgramDeadline[];
}

const ROUTE_LABELS: Record<string, string> = {
  direct: "تقديم مباشر", uni_assist: "uni-assist / VPD", universitaly: "Universitaly",
  national_portal: "بوابة وطنية", centralized_platform: "منصة مركزية",
  pre_enrolment: "تسجيل مبدئي", preparatory: "سنة تحضيرية", other: "أخرى",
};

const RULE_LABELS: Record<string, string> = {
  prior_degree: "درجة سابقة", gpa_minimum: "حد أدنى GPA", subject_match: "تطابق التخصص",
  equivalency: "معادلة الشهادة", academic_coherence: "التوافق الأكاديمي",
  degree_length: "مدة الدرجة", country_specific: "شرط قُطري", other: "أخرى",
};

const DOC_LABELS: Record<string, string> = {
  transcript: "كشف درجات", diploma: "شهادة الدرجة", gpa_statement: "بيان المعدل",
  grading_scale: "سلم الدرجات", cv: "السيرة الذاتية", motivation_letter: "خطاب الدافع",
  recommendation_letter: "خطاب توصية", portfolio: "ملف أعمال", passport_copy: "صورة جواز",
  language_certificate: "شهادة لغة", translation: "ترجمة مطلوبة", certified_copy: "نسخة موثقة",
  other: "أخرى",
};

const DEADLINE_LABELS: Record<string, string> = {
  application: "موعد التقديم", supporting_documents: "المستندات الداعمة",
  fee: "الرسوم", results: "إعلان النتائج", acceptance_reply: "تأكيد القبول",
  enrollment: "التسجيل",
};

const ADMISSION_FIELDS = new Set([
  "admission_route_type", "admission_platform_name", "admission_platform_url",
  "pre_enrolment_required", "pre_enrolment_platform", "pre_enrolment_url",
  "preparatory_route_required", "preparatory_route_type", "preparatory_route_name",
  "eligibility_prior_degree", "eligibility_subject_match", "eligibility_equivalency",
  "eligibility_degree_length", "eligibility_gpa_minimum", "eligibility_academic_coherence",
  "country_condition",
  "required_doc_transcript", "required_doc_diploma", "required_doc_cv",
  "required_doc_motivation_letter", "required_doc_recommendation_letter",
  "required_doc_passport_copy", "required_doc_language_certificate", "required_doc_portfolio",
  "required_doc_grading_scale", "required_doc_translation", "required_doc_certified_copy",
  "application_fee_amount", "application_fee_currency", "fee_exemption_rule", "fee_rule_notes",
  "aptitude_assessment_required", "multi_stage_selection", "ranking_selection", "selection_notes",
  "supporting_documents_deadline", "fee_deadline", "results_date",
  "acceptance_reply_deadline", "enrollment_deadline",
]);

export function AdmissionsReviewSection({ observations, routes, eligibilityRules, requiredDocuments, deadlines }: Props) {
  const admObs = observations.filter(o => ADMISSION_FIELDS.has(o.field_name));

  // Group observations by category
  const routeObs = admObs.filter(o => o.field_name.startsWith("admission_") || o.field_name.startsWith("pre_enrolment") || o.field_name.startsWith("preparatory"));
  const eligObs = admObs.filter(o => o.field_name.startsWith("eligibility_") || o.field_name === "country_condition");
  const docObs = admObs.filter(o => o.field_name.startsWith("required_doc_"));
  const feeObs = admObs.filter(o => ["application_fee_amount","application_fee_currency","fee_exemption_rule","fee_rule_notes"].includes(o.field_name));
  const selectionObs = admObs.filter(o => ["aptitude_assessment_required","multi_stage_selection","ranking_selection","selection_notes"].includes(o.field_name));
  const deadlineObs = admObs.filter(o => ["supporting_documents_deadline","fee_deadline","results_date","acceptance_reply_deadline","enrollment_deadline"].includes(o.field_name));

  const hasData = admObs.length > 0 || routes.length > 0 || eligibilityRules.length > 0 || requiredDocuments.length > 0 || deadlines.length > 0;

  if (!hasData) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 px-3 bg-muted/30 rounded-lg border border-dashed justify-center">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>لم يتم اكتشاف بيانات قبول أوروبية منظمة بعد</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        <MiniChip icon={<Globe className="h-3 w-3" />} label="مسارات" count={routeObs.length + routes.length} />
        <MiniChip icon={<GraduationCap className="h-3 w-3" />} label="أهلية" count={eligObs.length + eligibilityRules.length} />
        <MiniChip icon={<FileCheck className="h-3 w-3" />} label="وثائق" count={docObs.length + requiredDocuments.length} />
        <MiniChip icon={<Calendar className="h-3 w-3" />} label="مواعيد" count={deadlineObs.length + deadlines.length} />
        <MiniChip icon={<DollarSign className="h-3 w-3" />} label="رسوم" count={feeObs.length} />
        <MiniChip icon={<Shield className="h-3 w-3" />} label="اختيار" count={selectionObs.length} />
      </div>

      {/* Application Routes */}
      <FactSection title="مسار التقديم" icon={<Globe className="h-3.5 w-3.5" />}>
        {routes.length > 0 ? routes.map(r => (
          <div key={r.id} className="px-3 py-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{ROUTE_LABELS[r.route_type] || r.route_type}</span>
              <Badge variant="outline" className="text-[9px] py-0">{r.review_status}</Badge>
            </div>
            {r.platform_name && <div className="text-muted-foreground">المنصة: {r.platform_name}</div>}
            {r.platform_url && <SourceLink url={r.platform_url} />}
            {r.pre_enrolment_required && <div className="text-amber-600 text-[10px]">⚠ يتطلب تسجيل مبدئي</div>}
            {r.preparatory_route_required && <div className="text-amber-600 text-[10px]">⚠ يتطلب سنة تحضيرية: {r.preparatory_route_name}</div>}
          </div>
        )) : routeObs.length > 0 ? routeObs.map(o => <ObsRow key={o.id} obs={o} />) : <EmptySlot />}
      </FactSection>

      {/* Eligibility Rules */}
      <FactSection title="شروط الأهلية" icon={<GraduationCap className="h-3.5 w-3.5" />}>
        {eligibilityRules.length > 0 ? eligibilityRules.map(r => (
          <div key={r.id} className="px-3 py-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{RULE_LABELS[r.rule_type] || r.rule_type}</span>
              <Badge variant="outline" className="text-[9px] py-0">{r.review_status}</Badge>
            </div>
            {r.condition_text && <p className="text-muted-foreground text-[11px] bg-muted/40 rounded px-2 py-1">{r.condition_text.slice(0, 300)}</p>}
            {r.min_value != null && <span className="text-[10px]">الحد الأدنى: {r.min_value}</span>}
            {r.applies_to_countries && <span className="text-[10px] text-amber-600">الدول: {r.applies_to_countries.join(", ")}</span>}
            {r.evidence_snippet && <p className="text-[10px] text-muted-foreground/70 italic border-r-2 border-muted pr-2">{r.evidence_snippet.slice(0, 200)}</p>}
          </div>
        )) : eligObs.length > 0 ? eligObs.map(o => <ObsRow key={o.id} obs={o} />) : <EmptySlot />}
      </FactSection>

      {/* Required Documents */}
      <FactSection title="الوثائق المطلوبة" icon={<FileCheck className="h-3.5 w-3.5" />}>
        {requiredDocuments.length > 0 ? (
          <div className="px-3 py-2 flex flex-wrap gap-1.5">
            {requiredDocuments.map(d => (
              <Badge key={d.id} variant="secondary" className="text-[10px] gap-1">
                <FileText className="h-2.5 w-2.5" />
                {DOC_LABELS[d.document_type] || d.document_type}
                {d.translation_required && <span className="text-amber-600">🌐</span>}
                {d.certified_copy_required && <span className="text-blue-600">✓✓</span>}
              </Badge>
            ))}
          </div>
        ) : docObs.length > 0 ? (
          <div className="px-3 py-2 flex flex-wrap gap-1.5">
            {docObs.map(o => (
              <Badge key={o.id} variant="outline" className="text-[10px] gap-1">
                {DOC_LABELS[o.field_name.replace("required_doc_", "")] || o.field_name}
                <span className="text-muted-foreground">{o.status}</span>
              </Badge>
            ))}
          </div>
        ) : <EmptySlot />}
      </FactSection>

      {/* Deadlines */}
      <FactSection title="المواعيد النهائية" icon={<Calendar className="h-3.5 w-3.5" />}>
        {deadlines.length > 0 ? deadlines.map(d => (
          <div key={d.id} className="px-3 py-2 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{DEADLINE_LABELS[d.deadline_type] || d.deadline_type}:</span>
              <span className="font-medium">{d.deadline_date || d.deadline_text || "—"}</span>
              {d.academic_year && <span className="text-[10px] text-muted-foreground">({d.academic_year})</span>}
            </div>
            <Badge variant="outline" className="text-[9px] py-0">{d.review_status}</Badge>
          </div>
        )) : deadlineObs.length > 0 ? deadlineObs.map(o => <ObsRow key={o.id} obs={o} />) : <EmptySlot />}
      </FactSection>

      {/* Application Fees */}
      <FactSection title="رسوم التقديم" icon={<DollarSign className="h-3.5 w-3.5" />}>
        {feeObs.length > 0 ? feeObs.map(o => <ObsRow key={o.id} obs={o} />) : <EmptySlot />}
      </FactSection>

      {/* Selection Process */}
      <FactSection title="عملية الاختيار" icon={<Shield className="h-3.5 w-3.5" />}>
        {selectionObs.length > 0 ? selectionObs.map(o => <ObsRow key={o.id} obs={o} />) : <EmptySlot />}
      </FactSection>
    </div>
  );
}

function FactSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <div className="border rounded-lg divide-y overflow-hidden">{children}</div>
    </div>
  );
}

function ObsRow({ obs }: { obs: Observation }) {
  return (
    <div className="px-3 py-2 text-xs space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{obs.field_name}</span>
        <div className="flex items-center gap-1.5">
          {obs.confidence != null && (
            <span className={`text-[10px] font-mono ${obs.confidence >= 0.7 ? 'text-emerald-600' : obs.confidence >= 0.4 ? 'text-amber-600' : 'text-rose-600'}`}>
              {(obs.confidence * 100).toFixed(0)}%
            </span>
          )}
          <Badge variant="outline" className="text-[9px] py-0">{obs.status}</Badge>
        </div>
      </div>
      <p className="text-muted-foreground break-all leading-relaxed font-mono text-[11px] bg-muted/40 rounded px-2 py-1">
        {obs.value ? (obs.value.length > 200 ? obs.value.slice(0, 200) + "…" : obs.value) : <span className="italic text-muted-foreground/50">— فارغ —</span>}
      </p>
      {obs.evidence_snippet && (
        <p className="text-[10px] text-muted-foreground/70 italic border-r-2 border-muted pr-2">{obs.evidence_snippet.slice(0, 150)}</p>
      )}
      {obs.source_url && <SourceLink url={obs.source_url} />}
    </div>
  );
}

function SourceLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-0.5">
      <ExternalLink className="h-2.5 w-2.5" />
      {url.replace(/^https?:\/\//, '').slice(0, 50)}
    </a>
  );
}

function EmptySlot() {
  return (
    <div className="px-3 py-2 text-[10px] text-muted-foreground/50 italic text-center">— لم يُستخرج —</div>
  );
}

function MiniChip({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-[10px] ${count > 0 ? 'bg-emerald-50/60 border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-800/40' : 'bg-muted/30 border-border'}`}>
      <span className={count > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold tabular-nums ${count > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground/50'}`}>{count}</span>
    </div>
  );
}
