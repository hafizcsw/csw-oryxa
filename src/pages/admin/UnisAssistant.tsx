import { useState, lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ReviewQueue } from "@/components/admin/crawl/ReviewQueue";
import { OfficialSiteCrawlPanel } from "@/components/admin/crawl/OfficialSiteCrawlPanel";
import { CrawlPurgePanel } from "@/components/admin/crawl/CrawlPurgePanel";
import { ChevronDown, Upload, Settings, RotateCcw, AlertTriangle } from "lucide-react";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const BulkPublish = lazy(() => import("./BulkPublish"));

interface EligibleUni {
  id: string;
  name: string;
  name_en: string | null;
  website: string | null;
  country_code: string | null;
  unpublished_counts: { obs: number; rows: number; drafts: number; artifacts: number };
  total: number;
}

export default function UnisAssistantPage() {
  const { t } = useTranslation("common");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bulkPublishOpen, setBulkPublishOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);
  const [universities, setUniversities] = useState<EligibleUni[]>([]);
  const [selectedUniId, setSelectedUniId] = useState<string>("");
  const [loadingUnis, setLoadingUnis] = useState(false);

  const loadEligible = async () => {
    setLoadingUnis(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-crawl-purge", {
        body: { mode: "list_eligible" },
      });
      if (!error && data?.universities) {
        setUniversities(data.universities);
      }
    } finally {
      setLoadingUnis(false);
    }
  };

  useEffect(() => {
    if (resetOpen) loadEligible();
  }, [resetOpen]);

  const selectedUni = universities.find(u => u.id === selectedUniId);

  const formatUniLabel = (u: EligibleUni) => {
    const parts = [u.name];
    if (u.country_code) parts.push(u.country_code.toUpperCase());
    if (u.website) {
      try {
        parts.push(new URL(u.website).hostname);
      } catch {
        parts.push(u.website);
      }
    }
    parts.push(`${u.total} سجل غير منشور`);
    return parts.join(" — ");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("admin.unisAssistant.title")}</h1>
      </div>

      {/* Bulk Publish — collapsed by default */}
      <Collapsible open={bulkPublishOpen} onOpenChange={setBulkPublishOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors border border-primary/20">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">النشر الجماعي (رفع ملفات PDF/Excel)</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${bulkPublishOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3">
            <Suspense fallback={<div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>}>
              <BulkPublish />
            </Suspense>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Safe Single University Reset — collapsed by default */}
      <Collapsible open={resetOpen} onOpenChange={setResetOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 bg-amber-500/5 hover:bg-amber-500/10 rounded-lg transition-colors border border-amber-500/20">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium">إعادة تعيين البيانات غير المنشورة (جامعة واحدة)</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${resetOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 space-y-3">
            {loadingUnis ? (
              <div className="p-3 text-sm text-muted-foreground">جاري تحميل الجامعات المؤهلة...</div>
            ) : universities.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">لا توجد جامعات لديها بيانات غير منشورة</div>
            ) : (
              <Select value={selectedUniId} onValueChange={setSelectedUniId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الجامعة..." />
                </SelectTrigger>
                <SelectContent>
                  {universities.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {formatUniLabel(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedUniId && selectedUni && (
              <CrawlPurgePanel
                universityId={selectedUniId}
                universityName={selectedUni.name}
                onPurgeComplete={loadEligible}
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Danger Zone — Global Reset (hidden by default, requires typed confirmation) */}
      <Collapsible open={dangerZoneOpen} onOpenChange={setDangerZoneOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 bg-destructive/5 hover:bg-destructive/10 rounded-lg transition-colors border border-destructive/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">منطقة الخطر — إعادة تعيين شامل</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-destructive transition-transform ${dangerZoneOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3">
            <CrawlPurgePanel
              scope="global"
              universityName="جميع الجامعات"
              onPurgeComplete={loadEligible}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Advanced Controls — collapsed by default */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors border">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="text-sm font-medium">{t("admin.singleTest.advancedControls")}</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3">
            <OfficialSiteCrawlPanel />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ReviewQueue />
    </div>
  );
}
