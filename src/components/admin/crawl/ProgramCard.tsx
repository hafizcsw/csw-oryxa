import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ExternalLink, ChevronDown, AlertTriangle, Loader2,
  DollarSign, GraduationCap, Globe, BookOpen,
  Calendar, FileText, Home, Award,
} from "lucide-react";

export interface ProgramDraft {
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

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  needs_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

interface ProgramCardProps {
  program: ProgramDraft;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onStatusChange: () => void;
}

// Helper to safely get nested value
function ej(data: any, key: string) {
  return data?.[key] ?? null;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function ProgramCard({ program, selected, onToggleSelect, onStatusChange }: ProgramCardProps) {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [livingOpen, setLivingOpen] = useState(false);
  const [addReqsOpen, setAddReqsOpen] = useState(false);
  const [scholarshipsOpen, setScholarshipsOpen] = useState(false);

  const publishSingle = async () => {
    setActionLoading("publish");
    try {
      const { error } = await supabase.rpc("rpc_publish_programs", {
        p_program_draft_ids: [program.id],
        p_trace_id: `REVIEW-PUB-SINGLE-${Date.now()}`,
      });
      if (error) throw error;
      toast({ title: t("dev.crawlReview.programsPublished") });
      onStatusChange();
    } catch (err: any) {
      toast({ title: t("dev.crawlReview.error"), description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const setStatus = async (status: string) => {
    setActionLoading(`status_${status}`);
    try {
      const { error } = await supabase.rpc("rpc_set_review_status", {
        p_target_type: "program_draft",
        p_ids: [String(program.id)],
        p_status: status,
        p_trace_id: `REVIEW-STATUS-${Date.now()}`,
      });
      if (error) throw error;
      toast({ title: t("dev.crawlReview.statusUpdated") });
      onStatusChange();
    } catch (err: any) {
      toast({ title: t("dev.crawlReview.error"), description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const hasMissing = program.missing_fields && program.missing_fields.length > 0;
  const hasEvidence = program.field_evidence_map && Object.keys(program.field_evidence_map).length > 0;

  // Extract data from extracted_json
  const ext = program.extracted_json || {};
  const tuitionAmount = ej(ext, "tuition_amount");
  const tuitionCurrency = ej(ext, "tuition_currency") || program.currency || "USD";
  const tuitionPeriod = ej(ext, "tuition_period") || "year";
  const tuitionTotal = ej(ext, "tuition_total");
  const applicationFee = ej(ext, "application_fee");
  const ieltsMin = ej(ext, "ielts_min");
  const toeflMin = ej(ext, "toefl_min");
  const gpaMin = ej(ext, "gpa_min");
  const semesterStart = ej(ext, "semester_start_date");
  const appStart = ej(ext, "application_start_date");
  const appEnd = ej(ext, "application_end_date");
  const mainSubject = ej(ext, "main_subject");
  const studyMode = ej(ext, "study_mode");
  const studyLevel = ej(ext, "study_level");
  const requiredDocs: string[] = ej(ext, "required_documents") || [];
  const costOfLiving = ej(ext, "cost_of_living");
  const additionalReqs: string[] = ej(ext, "additional_requirements") || [];
  const scholarships: any[] = ej(ext, "scholarships") || [];
  const degree = ej(ext, "degree") || program.degree_level;
  const durationMonths = ej(ext, "duration_months") || program.duration_months;

  const hasFees = tuitionAmount || program.tuition_fee || tuitionTotal || applicationFee;
  const hasAdmission = ieltsMin || toeflMin || gpaMin;
  const hasDates = semesterStart || appStart || appEnd;
  const hasStudyInfo = studyMode || studyLevel || durationMonths;
  const hasDocs = requiredDocs.length > 0;
  const hasLiving = costOfLiving && typeof costOfLiving === "object" && Object.keys(costOfLiving).length > 0;
  const hasAddReqs = additionalReqs.length > 0;
  const hasScholarships = scholarships.length > 0;

  const feeAmount = tuitionAmount || program.tuition_fee;

  const formatDuration = () => {
    if (!durationMonths) return null;
    const years = Math.floor(durationMonths / 12);
    const months = durationMonths % 12;
    if (years > 0 && months > 0) return t("dev.crawlReview.durationYears", { years, months });
    if (years > 0) return `${years}y`;
    return t("dev.crawlReview.durationMonths", { count: durationMonths });
  };

  const livingKeys: { key: string; label: string }[] = [
    { key: "on_campus_housing", label: "onCampus" },
    { key: "off_campus_housing", label: "offCampus" },
    { key: "meals", label: "meals" },
    { key: "health_insurance", label: "healthInsurance" },
    { key: "transportation", label: "transportation" },
    { key: "books_supplies", label: "books" },
    { key: "personal_expenses", label: "personal" },
    { key: "visa_immigration", label: "visaCost" },
  ];

  return (
    <Card className={`border transition-colors overflow-hidden ${selected ? "border-primary ring-1 ring-primary/20" : "hover:border-primary/30"}`}>
      <CardContent className="p-0">
        {/* Header with title + badges */}
        <div className="flex items-start gap-2 p-3 pb-2">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(program.id)}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight line-clamp-2">
              {program.title || program.title_en || t("dev.crawlReview.noTitle")}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {degree && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                  <GraduationCap className="h-2.5 w-2.5 mr-0.5" />
                  {degree}
                </Badge>
              )}
              {program.language && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                  <Globe className="h-2.5 w-2.5 mr-0.5" />
                  {program.language}
                </Badge>
              )}
              <Badge className={`text-[10px] px-1.5 py-0 h-4 ${STATUS_COLORS[program.review_status] || ""}`}>
                {program.review_status}
              </Badge>
              {mainSubject && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                  <BookOpen className="h-2.5 w-2.5 mr-0.5" />
                  {mainSubject}
                </Badge>
              )}
            </div>
          </div>
          {hasMissing && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
        </div>

        {/* Fees Section */}
        {hasFees && (
          <div className="mx-3 mt-1 flex flex-wrap items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {feeAmount && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {t("dev.crawlReview.tuitionPerYear", { amount: Number(feeAmount).toLocaleString(), currency: tuitionCurrency, period: tuitionPeriod })}
              </Badge>
            )}
            {tuitionTotal && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                {t("dev.crawlReview.tuitionTotal", { amount: Number(tuitionTotal).toLocaleString(), currency: tuitionCurrency })}
              </Badge>
            )}
            {applicationFee && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                {t("dev.crawlReview.applicationFee", { amount: Number(applicationFee).toLocaleString(), currency: tuitionCurrency })}
              </Badge>
            )}
            {formatDuration() && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {formatDuration()}
              </Badge>
            )}
          </div>
        )}

        {/* Admission Requirements */}
        {hasAdmission && (
          <div className="mx-3 mt-1.5 flex flex-wrap items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {ieltsMin && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {t("dev.crawlReview.ielts", { score: ieltsMin })}
              </Badge>
            )}
            {toeflMin && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {t("dev.crawlReview.toefl", { score: toeflMin })}
              </Badge>
            )}
            {gpaMin && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                {t("dev.crawlReview.gpa", { score: gpaMin })}
              </Badge>
            )}
          </div>
        )}

        {/* Dates */}
        {hasDates && (
          <div className="mx-3 mt-1.5 flex flex-wrap items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {semesterStart && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {t("dev.crawlReview.semesterStart", { date: formatDate(semesterStart) })}
              </Badge>
            )}
            {(appStart || appEnd) && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {t("dev.crawlReview.applicationPeriod", { start: formatDate(appStart) || "?", end: formatDate(appEnd) || "?" })}
              </Badge>
            )}
          </div>
        )}

        {/* Study Mode / Level */}
        {hasStudyInfo && (
          <div className="mx-3 mt-1.5 flex flex-wrap items-center gap-1.5">
            {studyMode && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {studyMode}
              </Badge>
            )}
            {studyLevel && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {studyLevel}
              </Badge>
            )}
            {!hasFees && formatDuration() && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {formatDuration()}
              </Badge>
            )}
          </div>
        )}

        {/* Collapsible sections */}
        <div className="mx-3 mt-2 space-y-1">
          {/* Required Documents */}
          {hasDocs && (
            <Collapsible open={docsOpen} onOpenChange={setDocsOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-primary hover:underline w-full">
                <FileText className="h-3 w-3" />
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${docsOpen ? "rotate-180" : ""}`} />
                {t("dev.crawlReview.requiredDocs", { count: requiredDocs.length })}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 p-2 bg-muted/50 rounded text-[10px] space-y-0.5">
                  {requiredDocs.map((doc, i) => (
                    <div key={i} className="text-muted-foreground">• {typeof doc === "string" ? doc : JSON.stringify(doc)}</div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Cost of Living */}
          {hasLiving && (
            <Collapsible open={livingOpen} onOpenChange={setLivingOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-primary hover:underline w-full">
                <Home className="h-3 w-3" />
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${livingOpen ? "rotate-180" : ""}`} />
                {t("dev.crawlReview.costOfLiving")}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 p-2 bg-muted/50 rounded text-[10px] grid grid-cols-2 gap-1">
                  {livingKeys.map(({ key, label }) => {
                    const val = costOfLiving[key];
                    if (val == null) return null;
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{t(`dev.crawlReview.${label}`)}</span>
                        <span className="font-medium">{Number(val).toLocaleString()} {tuitionCurrency}</span>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Additional Requirements */}
          {hasAddReqs && (
            <Collapsible open={addReqsOpen} onOpenChange={setAddReqsOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-primary hover:underline w-full">
                <AlertTriangle className="h-3 w-3" />
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${addReqsOpen ? "rotate-180" : ""}`} />
                {t("dev.crawlReview.additionalReqs", { count: additionalReqs.length })}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 p-2 bg-muted/50 rounded text-[10px] space-y-0.5">
                  {additionalReqs.map((req, i) => (
                    <div key={i} className="text-muted-foreground">• {typeof req === "string" ? req : JSON.stringify(req)}</div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Scholarships */}
          {hasScholarships && (
            <Collapsible open={scholarshipsOpen} onOpenChange={setScholarshipsOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-primary hover:underline w-full">
                <Award className="h-3 w-3" />
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${scholarshipsOpen ? "rotate-180" : ""}`} />
                {t("dev.crawlReview.scholarships", { count: scholarships.length })}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 p-2 bg-muted/50 rounded text-[10px] space-y-0.5">
                  {scholarships.map((s, i) => (
                    <div key={i} className="text-muted-foreground">• {typeof s === "string" ? s : JSON.stringify(s)}</div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Missing Fields Warning */}
        {hasMissing && (
          <div className="mx-3 mt-2 flex items-start gap-1.5 p-1.5 bg-yellow-50 dark:bg-yellow-900/20 rounded text-[10px]">
            <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
            <span className="text-yellow-700 dark:text-yellow-300 line-clamp-1">{program.missing_fields!.join(", ")}</span>
          </div>
        )}

        {/* Source Links + Evidence */}
        <div className="px-3 pt-2 flex items-center gap-2 text-[10px] flex-wrap">
          {program.source_url && (
            <a href={program.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              <ExternalLink className="h-2.5 w-2.5" /> {t("dev.crawlReview.source")}
            </a>
          )}
          {program.source_program_url && (
            <a href={program.source_program_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              <ExternalLink className="h-2.5 w-2.5" /> {t("dev.crawlReview.programPage")}
            </a>
          )}
          {hasEvidence && (
            <Collapsible open={evidenceOpen} onOpenChange={setEvidenceOpen}>
              <CollapsibleTrigger className="text-primary hover:underline flex items-center gap-0.5">
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${evidenceOpen ? "rotate-180" : ""}`} />
                {t("dev.crawlReview.showEvidence", { count: Object.keys(program.field_evidence_map!).length })}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1.5 space-y-0.5">
                  {Object.entries(program.field_evidence_map!).map(([field, evidence]: [string, any]) => (
                    <div key={field} className="text-[10px] p-1.5 bg-muted rounded">
                      <span className="font-medium">{field}:</span>{" "}
                      <span className="text-muted-foreground">
                        {typeof evidence === "string" ? evidence : JSON.stringify(evidence)}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 p-3 pt-2">
          <Button size="sm" className="h-6 text-[11px] px-2.5" onClick={publishSingle} disabled={actionLoading !== null}>
            {actionLoading === "publish" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {t("dev.crawlReview.publish")}
          </Button>
          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2.5" onClick={() => setStatus("needs_review")} disabled={actionLoading !== null}>
            {t("dev.crawlReview.needsReview")}
          </Button>
          <Button size="sm" variant="destructive" className="h-6 text-[11px] px-2.5" onClick={() => setStatus("rejected")} disabled={actionLoading !== null}>
            {t("dev.crawlReview.reject")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
