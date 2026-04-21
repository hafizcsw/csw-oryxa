import { forwardRef } from "react";
import { X, Headset } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PanelHeaderProps {
  onClose: () => void;
  closeRef?: React.RefObject<HTMLButtonElement>;
}

export function PanelHeader({ onClose, closeRef }: PanelHeaderProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Headset className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          {t("portal.support.panel.title")}
        </span>
      </div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t("portal.support.launcher.ariaClose")}
        className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}
