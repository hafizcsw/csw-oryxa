import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Globe, Image as ImageIcon, ChevronDown, ChevronUp, RotateCcw, Loader2, Link2 } from "lucide-react";

export interface Door2QueueRow {
  id: string;
  name: string;
  name_en: string | null;
  slug: string;
  crawl_status: string;
  publish_status: string;
  website: string | null;
  logo_url: string | null;
  uniranks_rank: number | null;
  country_code: string | null;
  program_draft_count: number;
  programs_published_count: number;
  door2_stage: string | null;
  door2_updated_at: string | null;
  door2_retries: number | null;
  door2_quarantine: string | null;
  about_status: string | null;
  logo_status: string | null;
  profile_main_status: string | null;
  programs_list_status: string | null;
  program_links_count: number;
}

const STAGE_COLORS: Record<string, string> = {
  profile_pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  profile_fetching: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  programs_pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_ICON: Record<string, string> = {
  ok: "✅",
  not_present: "—",
  fetch_error: "❌",
  js_required: "⚠️",
};

interface Door2UniversityCardProps {
  university: Door2QueueRow;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onOpenDrawer: (id: string) => void;
  onReset?: (id: string) => void;
}

export function Door2UniversityCard({
  university,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
  onOpenDrawer,
  onReset,
}: Door2UniversityCardProps) {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const [resetting, setResetting] = useState(false);
  const u = university;

  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (resetting) return;
    setResetting(true);
    try {
      const traceId = `RESET-UNI-${Date.now()}`;
      const { data, error } = await supabase.rpc("rpc_reset_uniranks_university" as any, {
        p_university_id: u.id,
        p_trace_id: traceId,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      toast({
        title: t("dev.crawlReview.resetSuccess"),
        description: t("dev.crawlReview.resetSuccessDesc", { count: result?.deleted_program_drafts ?? 0 }),
      });
      onReset?.(u.id);
    } catch (err: any) {
      toast({ title: t("dev.crawlReview.error"), description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return "—";
    const d = new Date(ts);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return t("admin.door2.live.timeNow");
    if (diffMin < 60) return t("admin.door2.live.timeMinutes", { count: diffMin });
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return t("admin.door2.live.timeHours", { count: diffH });
    return t("admin.door2.live.timeDays", { count: Math.floor(diffH / 24) });
  };

  return (
    <Card
      className={`cursor-pointer border transition-all shadow-sm hover:shadow-md hover:border-primary/40 overflow-hidden ${expanded ? "border-primary/60 ring-1 ring-primary/20" : ""} ${u.door2_quarantine ? "border-red-300 dark:border-red-800" : ""}`}
    >
      <CardContent className="p-3 space-y-2">
        {/* Top row: checkbox + logo + name */}
        <div className="flex items-start gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(u.id)}
            className="mt-1"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1 min-w-0" onClick={() => onToggleExpand(u.id)}>
            <div className="flex items-center gap-2">
              {u.logo_url ? (
                <img src={u.logo_url} alt="" className="w-8 h-8 rounded object-contain border shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded border flex items-center justify-center bg-muted shrink-0">
                  <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                </div>
              )}
              <p className="font-medium text-sm truncate">{(u.name_en || u.name).replace(/\*\*/g, '')}</p>
            </div>
          </div>
        </div>

        {/* Door2 Stage + Rank */}
        <div className="flex flex-wrap gap-1 items-center" onClick={() => onToggleExpand(u.id)}>
          {u.door2_stage && (
            <Badge className={`text-[10px] px-1.5 py-0 ${STAGE_COLORS[u.door2_stage] || "bg-muted text-muted-foreground"}`}>
              {u.door2_stage.replace(/_/g, " ")}
            </Badge>
          )}
          {u.uniranks_rank && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
              #{u.uniranks_rank}
            </Badge>
          )}
          {u.door2_retries && u.door2_retries > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              retry:{u.door2_retries}
            </Badge>
          )}
        </div>

        {/* Step Statuses Row */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground" onClick={() => onToggleExpand(u.id)}>
          <span title="Profile">{STATUS_ICON[u.profile_main_status || ""] || "—"} P</span>
          <span title="About">{STATUS_ICON[u.about_status || ""] || "—"} A</span>
          <span title="Logo">{STATUS_ICON[u.logo_status || ""] || "—"} L</span>
          <span title="Programs">{STATUS_ICON[u.programs_list_status || ""] || "—"} Pr</span>
          {u.program_links_count > 0 && (
            <span className="flex items-center gap-0.5 font-medium text-foreground">
              <Link2 className="h-3 w-3" />
              {u.program_links_count}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground" onClick={() => onToggleExpand(u.id)}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{u.program_draft_count}</span> {t("dev.crawlReview.programsCol")}
            {u.programs_published_count > 0 && (
              <span className="text-green-600">({u.programs_published_count}✓)</span>
            )}
          </div>
          <span className="text-[10px]">{formatTime(u.door2_updated_at)}</span>
        </div>

        {/* Icons row */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground" onClick={() => onToggleExpand(u.id)}>
          <div className="flex items-center gap-2">
            {u.website ? <Globe className="h-3 w-3 text-green-500" /> : <Globe className="h-3 w-3 opacity-30" />}
            {u.logo_url ? <ImageIcon className="h-3 w-3 text-green-500" /> : <ImageIcon className="h-3 w-3 opacity-30" />}
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-1">
            <button
              className="text-xs text-primary hover:underline"
              onClick={(e) => { e.stopPropagation(); onOpenDrawer(u.id); }}
            >
              {t("dev.crawlReview.details")}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleReset}
              disabled={resetting}
              title={t("dev.crawlReview.resetTooltip")}
            >
              {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            </Button>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground" onClick={() => onToggleExpand(u.id)}>
            {expanded ? (
              <><span>{t("dev.crawlReview.collapsePrograms")}</span><ChevronUp className="h-3 w-3" /></>
            ) : (
              <><span>{t("dev.crawlReview.expandPrograms")}</span><ChevronDown className="h-3 w-3" /></>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
