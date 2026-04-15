import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

interface CrawlActivityFeedProps {
  batchId: string | null;
  isActive: boolean;
}

interface UniRow {
  university_id: string;
  name_ar?: string;
  name_en?: string;
  crawl_status?: string;
}

interface DraftRow {
  id: number;
  title: string;
  status: string;
  university_id: string;
  last_extracted_at: string | null;
}

export function CrawlActivityFeed({ batchId, isActive }: CrawlActivityFeedProps) {
  const { t } = useTranslation("common");
  const [unis, setUnis] = useState<UniRow[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  useEffect(() => {
    if (!isActive) return;

    const load = async () => {
      // Last 10 universities from batch
      if (batchId) {
        const { data } = await supabase
          .from("crawl_batch_universities")
          .select("university_id, universities!inner(id, name, name_en, crawl_status)")
          .eq("batch_id", batchId)
          .limit(10) as any;

        if (data) {
          setUnis(data.map((r: any) => ({
            university_id: r.university_id,
            name_ar: r.universities?.name,
            name_en: r.universities?.name_en,
            crawl_status: r.universities?.crawl_status,
          })));
        }
      }

      // Last 10 drafts
      const { data: draftData } = await supabase
        .from("program_draft")
        .select("id, title, status, university_id, last_extracted_at")
        .order("last_extracted_at", { ascending: false })
        .limit(10);

      if (draftData) setDrafts(draftData as DraftRow[]);
    };

    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [batchId, isActive]);

  if (!isActive || (unis.length === 0 && drafts.length === 0)) return null;

  const statusColor = (s: string) => {
    if (s === "discovery_done" || s === "verified" || s === "published") return "default";
    if (s === "extracted") return "secondary";
    if (s?.includes("error")) return "destructive";
    return "outline";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 animate-in fade-in duration-300">
      {/* Universities */}
      {unis.length > 0 && (
        <div className="border rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">🏫 {t("admin.singleTest.activityUniversities")}</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {unis.map((u) => (
              <div key={u.university_id} className="flex items-center justify-between text-xs">
                <span className="truncate flex-1">{u.name_ar || u.name_en || u.university_id.slice(0, 8)}</span>
                <Badge variant={statusColor(u.crawl_status || "")} className="text-[10px] ml-2">
                  {u.crawl_status || "pending"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="border rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">📚 {t("admin.singleTest.activityPrograms")}</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-xs">
                <span className="truncate flex-1">{d.title}</span>
                <Badge variant={statusColor(d.status)} className="text-[10px] ml-2">
                  {d.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
