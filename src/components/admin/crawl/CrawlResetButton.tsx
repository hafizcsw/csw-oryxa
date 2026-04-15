import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface CrawlResetButtonProps { onReset?: () => void; }

export function CrawlResetButton({ onReset }: CrawlResetButtonProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await api("/admin-crawl-reset-data", { method: "POST", timeout: 60000 });
      const deleted = res.deleted as Record<string, number>;
      const summary = Object.entries(deleted).map(([k, v]) => `${k}: ${v}`).join("\n");
      toast({ title: t("admin.singleTest.resetDataSuccess"), description: summary });
      onReset?.();
    } catch (err: any) {
      toast({ variant: "destructive", title: t("admin.singleTest.resetDataError"), description: err.message });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Trash2 className="h-4 w-4 ml-2" />}
        {t("admin.singleTest.resetDataButton")}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.singleTest.resetDataTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <p>{t("admin.singleTest.resetDataDesc")}</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t("admin.singleTest.resetDataDrafts")}</li>
                <li>{t("admin.singleTest.resetDataUrls")}</li>
                <li>{t("admin.singleTest.resetDataErrors")}</li>
                <li>{t("admin.singleTest.resetDataEvents")}</li>
                <li>{t("admin.singleTest.resetDataBatches")}</li>
              </ul>
              <p className="font-semibold text-destructive">{t("admin.singleTest.resetDataWarning")}</p>
              <p className="text-xs text-muted-foreground">{t("admin.singleTest.resetDataIrreversible")}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>{t("admin.singleTest.resetDataCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              {t("admin.singleTest.resetDataConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
