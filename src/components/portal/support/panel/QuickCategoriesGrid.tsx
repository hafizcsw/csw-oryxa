import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  CreditCard,
  FileText,
  GraduationCap,
  Wrench,
  MessageSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface QuickCategoriesGridProps {
  onPick: (subjectKey: string) => void;
  onClose?: () => void;
}

type Cell =
  | { kind: "submit"; key: string; icon: LucideIcon; labelKey: string }
  | { kind: "navigate"; to: string; icon: LucideIcon; labelKey: string };

const CELLS: Cell[] = [
  { kind: "submit", key: "identity", icon: ShieldCheck, labelKey: "portal.support.quick.identity" },
  { kind: "submit", key: "account_security", icon: Lock, labelKey: "portal.support.categories.account_security" },
  { kind: "submit", key: "payment", icon: CreditCard, labelKey: "portal.support.quick.payment" },
  { kind: "submit", key: "application", icon: FileText, labelKey: "portal.support.quick.application" },
  { kind: "submit", key: "programs", icon: GraduationCap, labelKey: "portal.support.categories.programs" },
  { kind: "submit", key: "technical", icon: Wrench, labelKey: "portal.support.quick.technical" },
  { kind: "navigate", to: "/messages", icon: MessageSquare, labelKey: "portal.support.categories.messages" },
  { kind: "navigate", to: "/about-oryxa", icon: Sparkles, labelKey: "portal.support.categories.oryxa" },
];

export function QuickCategoriesGrid({ onPick, onClose }: QuickCategoriesGridProps) {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-3">
      <div className="grid grid-cols-4 gap-1">
        {CELLS.map((cell, i) => {
          const Icon = cell.icon;
          const handle = () => {
            if (cell.kind === "submit") {
              onPick(cell.key);
            } else {
              navigate(cell.to);
              onClose?.();
            }
          };
          return (
            <motion.button
              key={cell.kind === "submit" ? cell.key : cell.to}
              type="button"
              onClick={handle}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2, ease: "easeOut" }}
              whileTap={reduced ? undefined : { scale: 0.96 }}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 px-1 py-3 rounded-xl",
                "hover:bg-muted/60 transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
              <span className="text-[11px] font-medium text-foreground text-center leading-tight line-clamp-2">
                {t(cell.labelKey)}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
