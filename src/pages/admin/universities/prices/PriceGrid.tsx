import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { InlineCell } from "@/components/admin/InlineCell";
import { ChevronDown, ChevronRight, AlertCircle, RefreshCw, DollarSign, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * PriceGrid - EDITOR ONLY (no program creation/deletion)
 * 
 * ⚠️ SoT RULE: Programs must be created via ProgramsTab ONLY.
 * This component ONLY edits tuition/pricing for EXISTING programs.
 * To add/delete programs, go to the "البرامج" tab.
 */
type Program = {
  id: string;
  title: string;
  tuition_usd_min: number | null;
  tuition_usd_max: number | null;
  duration_months: number | null;
  tuition_is_free: boolean | null;
  degrees?: { name: string };
  csw_program_guidance?: { csw_recommended: boolean | null; do_not_offer: boolean | null } | null;
};

type PriceGridProps = {
  universityId: string;
};

export default function PriceGrid({ universityId }: PriceGridProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  useEffect(() => {
    loadPrograms();
  }, [universityId]);

  const loadPrograms = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("programs")
      .select(`
        id, title, tuition_usd_min, tuition_usd_max,
        duration_months, tuition_is_free,
        degrees:degree_id (name),
        csw_program_guidance (csw_recommended, do_not_offer)
      `)
      .eq("university_id", universityId)
      .order("title");

    setPrograms((data as Program[]) || []);
    setLoading(false);
  };

  const toggleExpand = (programId: string) => {
    setExpandedRows((prev) =>
      prev.includes(programId)
        ? prev.filter((id) => id !== programId)
        : [...prev, programId]
    );
  };

  const updateField = async (programId: string, field: keyof Program, value: any) => {
    const { error } = await supabase
      .from("programs")
      .update({ [field]: value } as any)
      .eq("id", programId);

    if (error) {
      toast({ title: t("admin.prices.error"), description: error.message, variant: "destructive" });
      throw error;
    }

    setPrograms((prev) =>
      prev.map((p) => (p.id === programId ? { ...p, [field]: value } : p))
    );
  };

  if (loading) {
    return <div className="p-4">{t("admin.prices.loading")}</div>;
  }

  return (
    <Card className="p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t("admin.prices.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t("admin.prices.description")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{programs.length} {t("admin.prices.programs")}</Badge>
          <Button variant="outline" size="sm" onClick={loadPrograms}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">{t("admin.prices.noPrograms")}</p>
          <p className="text-sm text-muted-foreground">
            {t("admin.prices.addProgramsFirst")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10">
              <tr className="border-b">
                <th className="w-8"></th>
                <th className={`${language === 'ar' ? 'text-right' : 'text-left'} p-3 font-semibold sticky ${language === 'ar' ? 'right-0' : 'left-0'} bg-muted/90`}>{t("admin.prices.columns.program")}</th>
                <th className="p-3 font-semibold text-center">{t("admin.prices.columns.yearlyFees")}</th>
                <th className="p-3 font-semibold text-center">{t("admin.prices.columns.free")}</th>
                <th className="p-3 font-semibold text-center">{t("admin.prices.columns.duration")}</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => (
                <>
                  <tr key={program.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleExpand(program.id)}
                        className="h-8 w-8"
                      >
                        {expandedRows.includes(program.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </td>
                    
                    <td className={`p-3 font-medium sticky ${language === 'ar' ? 'right-0' : 'left-0'} bg-background`}>
                      <div className="flex items-center gap-2">
                        {/* CSW Recommendation Star */}
                        {program.csw_program_guidance?.csw_recommended && (
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <span>{program.title}</span>
                        {program.tuition_is_free && (
                          <Badge variant="secondary" className={`${language === 'ar' ? 'mr-2' : 'ml-2'} text-xs`}>{t("admin.prices.freeBadge")}</Badge>
                        )}
                      </div>
                    </td>
                    
                    <td className="p-3">
                      <div className="flex gap-1 items-center justify-center">
                        <InlineCell
                          value={program.tuition_usd_min}
                          type="number"
                          onSave={(val) => updateField(program.id, "tuition_usd_min", val)}
                          placeholder={t("admin.prices.minPlaceholder")}
                          className="text-center font-semibold w-24"
                          min={0}
                        />
                        <span className="text-muted-foreground">—</span>
                        <InlineCell
                          value={program.tuition_usd_max}
                          type="number"
                          onSave={(val) => updateField(program.id, "tuition_usd_max", val)}
                          placeholder={t("admin.prices.maxPlaceholder")}
                          className="text-center font-semibold w-24"
                          min={0}
                        />
                      </div>
                    </td>
                    
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={program.tuition_is_free || false}
                        onChange={(e) => updateField(program.id, "tuition_is_free", e.target.checked)}
                        className="h-4 w-4"
                      />
                    </td>
                    
                    <td className="p-3">
                      <InlineCell
                        value={program.duration_months}
                        type="number"
                        onSave={(val) => updateField(program.id, "duration_months", val)}
                        placeholder="12"
                        className="text-center w-16"
                        min={1}
                      />
                    </td>
                  </tr>
                  
                  {/* Expanded Row - Degree Info Only */}
                  {expandedRows.includes(program.id) && (
                    <tr className="bg-muted/20 border-b">
                      <td colSpan={5} className="p-4">
                        <div className="flex items-center gap-4 text-sm">
                          <Label className="text-muted-foreground">{t("admin.prices.degreeInfo")}</Label>
                          <Badge variant="outline">
                            {program.degrees?.name || '—'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {t("admin.prices.editDegreeNote")}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
