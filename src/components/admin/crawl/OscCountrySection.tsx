import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, ChevronDown, CheckCircle2, AlertTriangle,
  ExternalLink, FileText, Clock, File,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { OscUniversityDetail } from "./OscUniversityDetail";

interface CountrySummary {
  country_code: string;
  name_ar: string | null;
  name_en: string | null;
  university_count: number;
  avg_completeness: number | null;
  published_count: number;
  verifying_count: number;
  quarantined_count: number;
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

interface OscCountrySectionProps {
  country: CountrySummary;
  filters: Record<string, string>;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  queued:             { label: "في الانتظار",      bg: "bg-slate-100 dark:bg-slate-800",   text: "text-slate-600 dark:text-slate-300",   dot: "bg-slate-400" },
  fetching:           { label: "جاري الجلب",       bg: "bg-blue-50 dark:bg-blue-950",      text: "text-blue-700 dark:text-blue-300",     dot: "bg-blue-500" },
  extracting:         { label: "جاري الاستخراج",   bg: "bg-indigo-50 dark:bg-indigo-950",   text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  verifying:          { label: "جاري التحقق",      bg: "bg-amber-50 dark:bg-amber-950",    text: "text-amber-700 dark:text-amber-300",   dot: "bg-amber-500" },
  verified:           { label: "تم التحقق",        bg: "bg-teal-50 dark:bg-teal-950",      text: "text-teal-700 dark:text-teal-300",     dot: "bg-teal-500" },
  published:          { label: "تم النشر",         bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  published_partial:  { label: "نشر جزئي",         bg: "bg-lime-50 dark:bg-lime-950",      text: "text-lime-700 dark:text-lime-300",     dot: "bg-lime-500" },
  quarantined:        { label: "حجر صحي",          bg: "bg-orange-50 dark:bg-orange-950",   text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  failed:             { label: "فشل",              bg: "bg-red-50 dark:bg-red-950",        text: "text-red-700 dark:text-red-300",       dot: "bg-red-500" },
  special:            { label: "خاص",              bg: "bg-purple-50 dark:bg-purple-950",   text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
};



const PAGE_SIZE = 15;

function CompletenessRing({ score }: { score: number }) {
  const size = 40;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 60 ? "text-emerald-500" : score >= 30 ? "text-amber-500" : "text-rose-500";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" strokeWidth={stroke}
          className="stroke-muted/30" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className={`stroke-current ${color} transition-all duration-500`} />
      </svg>
      <span className={`absolute text-[10px] font-bold ${color}`}>{score}%</span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function useFileCount(universityId: string) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    supabase
      .from("crawl_file_artifacts" as any)
      .select("id", { count: "exact", head: true })
      .eq("university_id", universityId)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [universityId]);
  return count;
}

export function OscCountrySection({ country, filters }: OscCountrySectionProps) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [universities, setUniversities] = useState<OscUniversity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchUniversities = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("rpc_admin_osc_review_universities" as any, {
        p_country_code: country.country_code,
        p_filters: filters,
        p_limit: PAGE_SIZE,
        p_offset: (pageNum - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      const result = data as any;
      setUniversities(result.universities || []);
      setTotal(result.total || 0);
      setPage(pageNum);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [country.country_code, filters, toast]);

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (open && universities.length === 0) fetchUniversities();
  };

  const countryLabel = language === "ar" ? country.name_ar : (country.name_en || country.country_code);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const completeness = country.avg_completeness ?? 0;

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpen}>
      <CollapsibleTrigger className="w-full group">
        <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 transition-all group-hover:shadow-sm group-hover:border-primary/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-xs font-bold text-primary shrink-0">
            {country.country_code}
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-sm text-foreground">{countryLabel}</span>
              <span className="text-xs text-muted-foreground">
                {country.university_count.toLocaleString("ar-EG")} جامعة
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1.5 min-w-[100px]">
                <Progress value={completeness} className="h-1 flex-1" />
                <span className="text-[10px] font-mono text-muted-foreground w-8 text-left">{completeness}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                {country.published_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />{country.published_count}
                  </span>
                )}
                {country.verifying_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                    <Clock className="h-3 w-3" />{country.verifying_count}
                  </span>
                )}
                {country.quarantined_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="h-3 w-3" />{country.quarantined_count}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1 mr-4 border-r-2 border-primary/10 pr-4 space-y-1.5 py-2">
          {loading && universities.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
            </div>
          ) : (
            <>
              {universities.map(uni => (
                <UniversityRow
                  key={uni.university_id}
                  uni={uni}
                  isExpanded={expandedId === uni.university_id}
                  onToggle={() => setExpandedId(expandedId === uni.university_id ? null : uni.university_id)}
                />
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-3">
                  <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => fetchUniversities(page - 1)}>
                    السابق
                  </Button>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">{page} / {totalPages}</span>
                  <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => fetchUniversities(page + 1)}>
                    التالي
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function UniversityRow({ uni, isExpanded, onToggle }: { uni: OscUniversity; isExpanded: boolean; onToggle: () => void }) {
  const fileCount = useFileCount(uni.university_id);
  const score = uni.completeness_score ?? 0;

  return (
    <div className={`rounded-xl border transition-all ${isExpanded ? "bg-card shadow-sm border-primary/15" : "bg-card/60 hover:bg-card hover:shadow-sm"}`}>
      <button className="w-full px-4 py-3 flex items-center gap-3 text-right" onClick={onToggle}>
        <CompletenessRing score={score} />
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{uni.university_name}</span>
            <StatusDot status={uni.crawl_status} />
          </div>
          {uni.website && (
            <a href={uni.website} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-primary/70 hover:text-primary hover:underline truncate flex items-center gap-1"
              onClick={e => e.stopPropagation()}>
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{uni.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
          <span className="flex items-center gap-1 text-[11px]">
            <FileText className="h-3 w-3" />{uni.pages_scraped}
          </span>
          <span className={`flex items-center gap-1 text-[11px] ${fileCount && fileCount > 0 ? "text-primary font-medium" : "text-muted-foreground/50"}`}>
            <File className="h-3 w-3" />{fileCount === null ? "…" : fileCount}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-dashed px-4 pb-4 pt-3">
          <OscUniversityDetail uni={uni} />
        </div>
      )}
    </div>
  );
}