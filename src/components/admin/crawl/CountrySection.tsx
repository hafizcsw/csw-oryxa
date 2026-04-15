import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ReviewUniversityCard, type QueueRow } from "./ReviewUniversityCard";
import { ProgramCard, type ProgramDraft } from "./ProgramCard";
import { useLanguage } from "@/contexts/LanguageContext";

interface CountrySummary {
  country_code: string;
  name_ar: string | null;
  name_en: string | null;
  university_count: number;
}

interface CountrySectionProps {
  country: CountrySummary;
  filters: Record<string, string>;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenDrawer: (id: string) => void;
  onDataChange: () => void;
}

const UNI_PAGE_SIZE = 10;
const PROGRAM_PAGE_SIZE = 20;

export function CountrySection({
  country,
  filters,
  selected,
  onToggleSelect,
  onOpenDrawer,
  onDataChange,
}: CountrySectionProps) {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [universities, setUniversities] = useState<QueueRow[]>([]);
  const [uniTotal, setUniTotal] = useState(0);
  const [uniPage, setUniPage] = useState(1);
  const [uniLoading, setUniLoading] = useState(false);
  const [expandedUniId, setExpandedUniId] = useState<string | null>(null);
  const [programsByUni, setProgramsByUni] = useState<Record<string, ProgramDraft[]>>({});
  const [programTotalByUni, setProgramTotalByUni] = useState<Record<string, number>>({});
  const [programPageByUni, setProgramPageByUni] = useState<Record<string, number>>({});
  const [programLoadingUni, setProgramLoadingUni] = useState<string | null>(null);
  const [selectedPrograms, setSelectedPrograms] = useState<Set<number>>(new Set());

  const countryName = language === "ar" ? (country.name_ar || country.name_en || country.country_code) : (country.name_en || country.name_ar || country.country_code);

  const fetchUniversities = useCallback(async (page: number, append = false) => {
    setUniLoading(true);
    try {
      const f = { ...filters, country_code: country.country_code };
      const { data, error } = await supabase.rpc("rpc_get_crawl_review_queue", {
        p_filters: f,
        p_page: page,
        p_page_size: UNI_PAGE_SIZE,
      });
      if (error) throw error;
      const result = data as any;
      if (append) {
        setUniversities(prev => [...prev, ...(result.rows || [])]);
      } else {
        setUniversities(result.rows || []);
      }
      setUniTotal(result.total || 0);
      setUniPage(page);
    } catch (err: any) {
      toast({ title: t("dev.crawlReview.error"), description: err.message, variant: "destructive" });
    } finally {
      setUniLoading(false);
    }
  }, [filters, country.country_code, toast, t]);

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (open && universities.length === 0) {
      fetchUniversities(1);
    }
  };

  const loadMoreUnis = () => {
    fetchUniversities(uniPage + 1, true);
  };

  const fetchPrograms = useCallback(async (uniId: string, page: number, append = false) => {
    setProgramLoadingUni(uniId);
    try {
      const { data, error } = await supabase.rpc("rpc_get_university_review", {
        p_university_id: uniId,
        p_program_page: page,
        p_program_page_size: PROGRAM_PAGE_SIZE,
      });
      if (error) throw error;
      const result = data as any;
      const progs = result.programs || [];
      if (append) {
        setProgramsByUni(prev => ({ ...prev, [uniId]: [...(prev[uniId] || []), ...progs] }));
      } else {
        setProgramsByUni(prev => ({ ...prev, [uniId]: progs }));
      }
      setProgramTotalByUni(prev => ({ ...prev, [uniId]: result.programs_count || 0 }));
      setProgramPageByUni(prev => ({ ...prev, [uniId]: page }));
    } catch (err: any) {
      toast({ title: t("dev.crawlReview.error"), description: err.message, variant: "destructive" });
    } finally {
      setProgramLoadingUni(null);
    }
  }, [toast, t]);

  const toggleExpand = (uniId: string) => {
    if (expandedUniId === uniId) {
      setExpandedUniId(null);
    } else {
      setExpandedUniId(uniId);
      if (!programsByUni[uniId]) {
        fetchPrograms(uniId, 1);
      }
    }
  };

  const toggleProgramSelect = (id: number) => {
    setSelectedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasMoreUnis = universities.length < uniTotal;

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors border-l-4 border-primary/30">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-base">{countryName}</span>
            <Badge className="bg-primary/10 text-primary border-0 text-xs">
              {t("dev.crawlReview.universitiesCount", { count: country.university_count })}
            </Badge>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-3 space-y-4">
          {uniLoading && universities.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* University Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {universities.map(uni => (
                  <ReviewUniversityCard
                    key={uni.id}
                    university={uni}
                    selected={selected.has(uni.id)}
                    expanded={expandedUniId === uni.id}
                    onToggleSelect={onToggleSelect}
                    onToggleExpand={toggleExpand}
                    onOpenDrawer={onOpenDrawer}
                    onReset={(resetId) => {
                      // Fix A: optimistic removal
                      setUniversities(prev => prev.filter(r => r.id !== resetId));
                      setUniTotal(prev => Math.max(0, prev - 1));
                      if (expandedUniId === resetId) setExpandedUniId(null);
                      onDataChange();
                    }}
                  />
                ))}
              </div>

              {/* Expanded University Programs */}
              {expandedUniId && programsByUni[expandedUniId] && (
                <div className="border rounded-lg p-4 bg-muted/20 space-y-3 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {t("dev.crawlReview.programsTitle", { count: programTotalByUni[expandedUniId] || 0 })}
                    </span>
                    {selectedPrograms.size > 0 && (
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            const { error } = await supabase.rpc("rpc_publish_programs", {
                              p_program_draft_ids: Array.from(selectedPrograms),
                              p_trace_id: `REVIEW-PUB-BULK-${Date.now()}`,
                            });
                            if (error) throw error;
                            toast({ title: t("dev.crawlReview.programsPublished") });
                            setSelectedPrograms(new Set());
                            fetchPrograms(expandedUniId!, 1);
                            onDataChange();
                          } catch (err: any) {
                            toast({ title: t("dev.crawlReview.error"), description: err.message, variant: "destructive" });
                          }
                        }}
                      >
                        {t("dev.crawlReview.publishSelectedCount", { count: selectedPrograms.size })}
                      </Button>
                    )}
                  </div>

                  {programLoadingUni === expandedUniId && !programsByUni[expandedUniId]?.length ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : programsByUni[expandedUniId].length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("dev.crawlReview.noPrograms")}</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {programsByUni[expandedUniId].map(prog => (
                          <ProgramCard
                            key={prog.id}
                            program={prog}
                            selected={selectedPrograms.has(prog.id)}
                            onToggleSelect={toggleProgramSelect}
                            onStatusChange={() => {
                              fetchPrograms(expandedUniId!, 1);
                              onDataChange();
                            }}
                          />
                        ))}
                      </div>

                      {/* Load More Programs */}
                      {(programsByUni[expandedUniId]?.length || 0) < (programTotalByUni[expandedUniId] || 0) && (
                        <div className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchPrograms(expandedUniId!, (programPageByUni[expandedUniId] || 1) + 1, true)}
                            disabled={programLoadingUni === expandedUniId}
                          >
                            {programLoadingUni === expandedUniId && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                            {t("dev.crawlReview.loadMorePrograms")}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Load More Universities */}
              {hasMoreUnis && (
                <div className="text-center">
                  <Button variant="outline" size="sm" onClick={loadMoreUnis} disabled={uniLoading}>
                    {uniLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                    {t("dev.crawlReview.loadMoreUnis")}
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
