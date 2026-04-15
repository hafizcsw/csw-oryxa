import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { 
  Play, Pause, RotateCcw, Globe, Search, Download, 
  Brain, CheckCircle, Upload, AlertCircle, Clock
} from "lucide-react";

interface BatchStatus {
  id: string;
  status: string;
  universities_count: number;
  programs_discovered: number;
  programs_extracted: number;
  programs_auto_ready: number;
  programs_quick_review: number;
  programs_deep_review: number;
  programs_published: number;
  urls_pending?: number;
  urls_fetched?: number;
  drafts_total?: number;
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

const STAGE_KEYS = [
  { key: "pending", icon: Clock },
  { key: "websites", icon: Globe },
  { key: "discovery", icon: Search },
  { key: "fetching", icon: Download },
  { key: "extracting", icon: Brain },
  { key: "verifying", icon: CheckCircle },
  { key: "ready", icon: Upload },
  { key: "publishing", icon: Upload },
  { key: "done", icon: CheckCircle },
];

const STAGE_LABELS: Record<string, string> = {
  pending: "جاهز",
  websites: "المواقع",
  discovery: "الاكتشاف",
  fetching: "الجلب",
  extracting: "الاستخراج",
  verifying: "التحقق",
  ready: "جاهز للنشر",
  publishing: "النشر",
  done: "منتهي",
};

export function BatchCrawlDashboard() {
  const { t } = useTranslation("common");
  const [batchSize, setBatchSize] = useState(100);
  const [currentBatch, setCurrentBatch] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadLatestBatch();
  }, []);

  async function loadLatestBatch() {
    const { data, error } = await supabase
      .from("crawl_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data && !error) {
      setCurrentBatch(data);
      await refreshBatchStats(data.id);
    }
  }

  async function refreshBatchStats(batchId: string) {
    const { data, error } = await supabase.functions.invoke("crawl-orchestrator", {
      body: { action: "get_status", batch_id: batchId }
    });
    if (data && !error) setCurrentBatch(data);
  }

  async function createBatch() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crawl-orchestrator", {
        body: { action: "create_batch", size: batchSize, filter: { needs_website: true } }
      });
      if (error) throw error;
      toast({
        title: t("admin.crawl.batchCreated"),
        description: t("admin.crawl.universitiesSelected", { count: data.universities_selected })
      });
      if (data.batch_id) await refreshBatchStats(data.batch_id);
    } catch (error: any) {
      toast({ title: t("common.error", "Error"), description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: string, extraParams: Record<string, any> = {}) {
    if (!currentBatch) return;
    setActionLoading(action);
    try {
      let functionName = "crawl-orchestrator";
      let body: Record<string, any> = { action, batch_id: currentBatch.id, ...extraParams };

      if (action === "fetch_batch" || action === "retry_failed") {
        functionName = "crawl-fetch-worker";
      } else if (["extract_programs", "link_fees_pages", "target_missing"].includes(action)) {
        functionName = "crawl-extract-worker";
      } else if (["verify_local", "verify_arbiter", "publish_batch"].includes(action)) {
        functionName = "crawl-verify-publish";
      }

      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;
      toast({ title: t("admin.crawl.actionDone"), description: JSON.stringify(data) });
      await refreshBatchStats(currentBatch.id);
    } catch (error: any) {
      toast({ title: t("common.error", "Error"), description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  function getStageProgress(): number {
    if (!currentBatch) return 0;
    const stageIndex = STAGE_KEYS.findIndex(s => s.key === currentBatch.status);
    return ((stageIndex + 1) / STAGE_KEYS.length) * 100;
  }

  return (
    <div className="space-y-6">
      {/* Create Batch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t("admin.crawl.batchTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("admin.crawl.batchSize")}:</span>
              <Input type="number" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="w-24" min={10} max={500} />
            </div>
            <Button onClick={createBatch} disabled={loading}>
              {loading ? t("admin.crawl.creating") : t("admin.crawl.createBatch")}
            </Button>
            {currentBatch && (
              <Button variant="outline" onClick={() => refreshBatchStats(currentBatch.id)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {t("admin.crawl.refresh")}
              </Button>
            )}
          </div>
          {currentBatch && (
            <div className="text-sm text-muted-foreground">
              Batch: <code className="bg-muted px-1 rounded">{currentBatch.id.slice(0, 8)}</code>
              <Badge className="ml-2" variant={currentBatch.status === "done" ? "default" : "secondary"}>
                {currentBatch.status}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage Progress */}
      {currentBatch && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("admin.crawl.stageProgress")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={getStageProgress()} className="h-3" />
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
              {STAGE_KEYS.map((stage) => {
                const Icon = stage.icon;
                const isActive = currentBatch.status === stage.key;
                const isPast = STAGE_KEYS.findIndex(s => s.key === currentBatch.status) > 
                               STAGE_KEYS.findIndex(s => s.key === stage.key);
                return (
                  <div key={stage.key} className={`flex flex-col items-center p-2 rounded-lg text-center ${
                    isActive ? "bg-primary/10 border border-primary" :
                    isPast ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/50"
                  }`}>
                    <Icon className={`h-5 w-5 mb-1 ${isActive ? "text-primary" : isPast ? "text-green-600" : "text-muted-foreground"}`} />
                    <span className="text-xs font-medium">{STAGE_LABELS[stage.key]}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {currentBatch && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("admin.crawl.operations")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ActionButton label={t("admin.crawl.resolveWebsites")} loading={actionLoading === "resolve_websites"} onClick={() => runAction("resolve_websites", { limit: 100 })} icon={Globe} />
              <ActionButton label={t("admin.crawl.discoverPrograms")} loading={actionLoading === "discover_programs"} onClick={() => runAction("discover_programs", { limit_unis: 20 })} icon={Search} />
              <ActionButton label={t("admin.crawl.fetchContent")} loading={actionLoading === "fetch_batch"} onClick={() => runAction("fetch_batch", { limit: 50 })} icon={Download} />
              <ActionButton label={t("admin.crawl.extractAI")} loading={actionLoading === "extract_programs"} onClick={() => runAction("extract_programs", { limit: 20 })} icon={Brain} />
              <ActionButton label={t("admin.crawl.linkFees")} loading={actionLoading === "link_fees_pages"} onClick={() => runAction("link_fees_pages", { limit: 50 })} icon={Search} />
              <ActionButton label={t("admin.crawl.fillMissing")} loading={actionLoading === "target_missing"} onClick={() => runAction("target_missing", { limit: 50, fields: ["tuition", "language"] })} icon={Brain} />
              <ActionButton label={t("admin.crawl.verifyLocal")} loading={actionLoading === "verify_local"} onClick={() => runAction("verify_local", { limit: 100 })} icon={CheckCircle} />
              <ActionButton label={t("admin.crawl.verifyArbiter")} loading={actionLoading === "verify_arbiter"} onClick={() => runAction("verify_arbiter", { limit: 50 })} icon={Brain} />
            </div>

            <div className="mt-6 flex gap-4">
              <Button size="lg" onClick={() => runAction("publish_batch", { mode: "auto_only" })} disabled={actionLoading === "publish_batch" || currentBatch.programs_auto_ready === 0} className="flex-1">
                <Upload className="h-4 w-4 mr-2" />
                {t("admin.crawl.publishAutoReady", { count: currentBatch.programs_auto_ready })}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => runAction("publish_batch", { mode: "auto_plus_quick" })} disabled={actionLoading === "publish_batch" || (currentBatch.programs_auto_ready + currentBatch.programs_quick_review) === 0} className="flex-1">
                <Upload className="h-4 w-4 mr-2" />
                {t("admin.crawl.publishAutoQuick", { count: currentBatch.programs_auto_ready + currentBatch.programs_quick_review })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActionButton({ label, loading, onClick, icon: Icon }: { label: string; loading: boolean; onClick: () => void; icon: any }) {
  return (
    <Button variant="outline" className="h-auto py-3 flex flex-col items-center gap-1" onClick={onClick} disabled={loading}>
      {loading ? <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" /> : <Icon className="h-5 w-5" />}
      <span className="text-xs">{label}</span>
    </Button>
  );
}
