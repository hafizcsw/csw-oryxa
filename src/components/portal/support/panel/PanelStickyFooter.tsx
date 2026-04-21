import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface PanelStickyFooterProps {
  onClick: () => void;
}

export function PanelStickyFooter({ onClick }: PanelStickyFooterProps) {
  const { t } = useLanguage();
  return (
    <div className="border-t border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3">
      <Button
        onClick={onClick}
        size="lg"
        className="w-full h-12 rounded-2xl text-sm font-semibold gap-2"
      >
        <Headset className="h-5 w-5" strokeWidth={2.25} />
        {t("portal.support.panel.getSupport")}
      </Button>
    </div>
  );
}
