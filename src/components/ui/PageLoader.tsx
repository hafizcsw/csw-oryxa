import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PageLoader() {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground text-sm">{t("common.loading")}</span>
      </div>
    </div>
  );
}
