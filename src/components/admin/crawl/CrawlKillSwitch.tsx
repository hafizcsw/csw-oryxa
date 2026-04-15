import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CrawlKillSwitchProps {
  paused: boolean;
  lastChangeAt: string | null;
  onToggled: () => void;
}

export function CrawlKillSwitch({ paused, lastChangeAt, onToggled }: CrawlKillSwitchProps) {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await api("/admin-crawl-set-paused", {
        method: "POST",
        body: { paused: !paused },
      });
      onToggled();
      toast({ title: t("admin.crawl.toggleSuccess") });
    } catch (err: any) {
      toast({ title: t("common.error", "Error"), description: err.message, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card className={paused ? "border-destructive bg-destructive/5" : "border-green-500 bg-green-500/5"}>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-3 h-3 rounded-full shrink-0 ${paused ? "bg-destructive animate-pulse" : "bg-green-500"}`} />
          <div className="min-w-0">
            <p className="font-semibold text-base">
              {paused ? t("admin.crawl.paused") : t("admin.crawl.running")}
            </p>
            {lastChangeAt && (
              <p className="text-xs text-muted-foreground truncate">
                {t("admin.crawl.lastChange")}: {new Date(lastChangeAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {toggling && <Loader2 className="h-4 w-4 animate-spin" />}
          <Switch
            checked={!paused}
            onCheckedChange={handleToggle}
            disabled={toggling}
            className="scale-90"
          />
        </div>
      </CardContent>
    </Card>
  );
}
