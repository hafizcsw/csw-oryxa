import { Sparkles, MessageSquare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export type PanelTab = "oryxa" | "messages";

interface PanelTabsProps {
  active: PanelTab;
  onChange: (tab: PanelTab) => void;
  unreadCount?: number;
  showMessages: boolean;
}

export function PanelTabs({ active, onChange, unreadCount = 0, showMessages }: PanelTabsProps) {
  const { t } = useLanguage();

  const Tab = ({
    id,
    label,
    icon: Icon,
    badge,
  }: {
    id: PanelTab;
    label: string;
    icon: typeof Sparkles;
    badge?: number;
  }) => {
    const isActive = active === id;
    return (
      <button
        type="button"
        onClick={() => onChange(id)}
        className={cn(
          "relative flex-1 flex items-center justify-center gap-1.5 h-10 text-[13px] font-medium",
          "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={isActive}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span>{label}</span>
        {badge && badge > 0 ? (
          <span className="ms-1 inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold leading-none">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-primary"
          />
        )}
      </button>
    );
  };

  return (
    <div className="px-3 pt-1 border-b border-border/40">
      <div className="flex items-center gap-1">
        <Tab
          id="oryxa"
          label={t("portal.support.panel.tabs.oryxa", { defaultValue: "Oryxa AI" })}
          icon={Sparkles}
        />
        {showMessages && (
          <Tab
            id="messages"
            label={t("portal.support.panel.tabs.messages", { defaultValue: "Messages" })}
            icon={MessageSquare}
            badge={unreadCount}
          />
        )}
      </div>
    </div>
  );
}
