import { X, Headset, Maximize2, Minimize2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PanelHeaderProps {
  onClose: () => void;
  closeRef?: React.RefObject<HTMLButtonElement>;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function PanelHeader({ onClose, closeRef, expanded, onToggleExpand }: PanelHeaderProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Headset className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground truncate">
          {t("portal.support.panel.title")}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={
              expanded
                ? t("portal.support.launcher.ariaCollapse", { defaultValue: "Collapse panel" })
                : t("portal.support.launcher.ariaExpand", { defaultValue: "Expand panel" })
            }
            className="hidden sm:flex h-8 w-8 rounded-full items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              <Maximize2 className="h-4 w-4" strokeWidth={2.25} />
            )}
          </button>
        )}
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
    </div>
  );
}
