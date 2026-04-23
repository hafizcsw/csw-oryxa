import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { PanelCategoriesGrid } from "./PanelCategoriesGrid";
import type { PanelView } from "./PanelCategoriesGrid";
import type { IdentityStatus } from "@/api/identitySupportInvoke";

interface DefaultHomeViewProps {
  identityStatus: IdentityStatus | null;
  unreadCount: number;
  onSwitchView: (view: PanelView) => void;
  onClose: () => void;
  onOpenGetSupport: () => void;
}

export function DefaultHomeView({
  identityStatus,
  unreadCount,
  onSwitchView,
  onClose,
  onOpenGetSupport,
}: DefaultHomeViewProps) {
  const { t } = useLanguage();
  const { addMessage } = useMalakChat();

  const suggestions = [
    t("portal.support.panel.suggestions.s1", { defaultValue: "How do I verify my identity?" }),
    t("portal.support.panel.suggestions.s2", { defaultValue: "How to apply to a university?" }),
    t("portal.support.panel.suggestions.s3", { defaultValue: "What payment methods are accepted?" }),
    t("portal.support.panel.suggestions.s4", { defaultValue: "How to track my application?" }),
    t("portal.support.panel.suggestions.s5", { defaultValue: "Available scholarships" }),
    t("portal.support.panel.suggestions.s6", { defaultValue: "Update my account info" }),
  ];

  const askOryxa = (text: string) => {
    addMessage({ from: "user", type: "text", content: text });
    onSwitchView("oryxa");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <PanelCategoriesGrid
        activeView="default"
        identityStatus={identityStatus}
        unreadCount={unreadCount}
        onSwitchView={onSwitchView}
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
          {t("portal.support.panel.suggestions.title", {
            defaultValue: "You may want to ask",
          })}
        </p>
        <ol className="space-y-0.5">
          {suggestions.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => askOryxa(s)}
                className="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors text-start"
              >
                <span className="text-[12px] font-semibold text-primary/70 w-4 flex-shrink-0 leading-5">
                  {i + 1}
                </span>
                <span className="text-[12.5px] text-foreground/90 leading-5">
                  {s}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="p-3 border-t border-border/40 bg-card/50">
        <Button
          onClick={onOpenGetSupport}
          className="w-full h-11 gap-2 font-semibold"
          size="lg"
        >
          <LifeBuoy className="h-4 w-4" />
          {t("portal.support.panel.cats.getSupport", {
            defaultValue: "Get Support",
          })}
        </Button>
      </div>
    </div>
  );
}
