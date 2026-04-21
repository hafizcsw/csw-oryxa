import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  ShieldCheck,
  Sparkles,
  MessageCircle,
  FileText,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export type PanelView = "default" | "oryxa" | "messages" | "getSupport";

interface PanelCategoriesGridProps {
  activeView: PanelView;
  identityApproved: boolean;
  unreadCount: number;
  onSwitchView: (view: PanelView) => void;
  onClose: () => void;
}

type Cell =
  | {
      kind: "view";
      view: Exclude<PanelView, "default">;
      icon: LucideIcon;
      labelKey: string;
      defaultLabel: string;
    }
  | {
      kind: "navigate";
      to: string;
      icon: LucideIcon;
      labelKey: string;
      defaultLabel: string;
      iconKey?: "identity";
    };

const CELLS: Cell[] = [
  {
    kind: "navigate",
    to: "/account?tab=settings",
    icon: Settings,
    labelKey: "portal.support.panel.cats.settings",
    defaultLabel: "Settings",
  },
  {
    kind: "navigate",
    to: "/account?tab=overview#identity",
    icon: ShieldCheck,
    labelKey: "portal.support.panel.cats.identity",
    defaultLabel: "Identity",
    iconKey: "identity",
  },
  {
    kind: "view",
    view: "oryxa",
    icon: Sparkles,
    labelKey: "portal.support.panel.cats.oryxa",
    defaultLabel: "Oryxa AI",
  },
  {
    kind: "view",
    view: "messages",
    icon: MessageCircle,
    labelKey: "portal.support.panel.cats.messages",
    defaultLabel: "Messages",
  },
  {
    kind: "navigate",
    to: "/account?tab=applications",
    icon: FileText,
    labelKey: "portal.support.panel.cats.applications",
    defaultLabel: "Applications",
  },
  {
    kind: "navigate",
    to: "/services",
    icon: Briefcase,
    labelKey: "portal.support.panel.cats.services",
    defaultLabel: "Services",
  },
];

export function PanelCategoriesGrid({
  activeView,
  identityApproved,
  unreadCount,
  onSwitchView,
  onClose,
}: PanelCategoriesGridProps) {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const navigate = useNavigate();

  return (
    <div className="px-3 pt-1 pb-2 border-b border-border/40">
      <div className="grid grid-cols-4 gap-1">
        {CELLS.map((cell, i) => {
          const Icon = cell.icon;
          const isActive =
            cell.kind === "view" && activeView === cell.view;
          const isIdentityCell =
            cell.kind === "navigate" && cell.iconKey === "identity";
          const isMessagesCell =
            cell.kind === "view" && cell.view === "messages";

          const handle = () => {
            if (cell.kind === "view") {
              onSwitchView(activeView === cell.view ? "default" : cell.view);
            } else {
              navigate(cell.to);
              onClose();
            }
          };

          return (
            <motion.button
              key={cell.kind === "view" ? cell.view : cell.to}
              type="button"
              onClick={handle}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025, duration: 0.18, ease: "easeOut" }}
              whileTap={reduced ? undefined : { scale: 0.95 }}
              aria-pressed={isActive || undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-1 py-2.5 rounded-xl",
                "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "bg-primary/10" : "hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "relative h-9 w-9 rounded-full flex items-center justify-center",
                  isIdentityCell && identityApproved
                    ? "bg-success/15 text-success"
                    : isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-primary/10 text-primary",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
                {isMessagesCell && unreadCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold leading-none flex items-center justify-center ring-2 ring-card">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10.5px] font-medium text-center leading-tight line-clamp-2",
                  isActive ? "text-foreground" : "text-foreground/85",
                )}
              >
                {t(cell.labelKey, { defaultValue: cell.defaultLabel })}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
