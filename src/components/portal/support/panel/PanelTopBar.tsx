import { ChevronDown, Maximize2, Minimize2, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PanelTopBarProps {
  onClose: () => void;
  closeRef?: React.RefObject<HTMLButtonElement>;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function PanelTopBar({ onClose, closeRef, expanded, onToggleExpand }: PanelTopBarProps) {
  const { t, language, setLanguage } = useLanguage();

  const handleToggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-card/80 backdrop-blur-sm">
      <button
        type="button"
        onClick={handleToggleLanguage}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full px-2.5 py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("portal.support.panel.toggleLanguage", {
          defaultValue: language === "ar" ? "Switch to English" : "التبديل إلى العربية",
        })}
        title={t("portal.support.panel.toggleLanguage", {
          defaultValue: language === "ar" ? "Switch to English" : "التبديل إلى العربية",
        })}
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span className="text-[11px] font-medium uppercase tracking-wider">{language}</span>
      </button>

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
              <Minimize2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            )}
          </button>
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("portal.support.launcher.ariaMinimize", { defaultValue: "Minimize" })}
          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
