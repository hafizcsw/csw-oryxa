import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, CreditCard, FileText, Wrench } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface SupportQuickCategoriesProps {
  onPick: (subjectKey: string) => void;
}

const CATEGORIES: { key: string; icon: typeof ShieldCheck; labelKey: string }[] = [
  { key: "identity", icon: ShieldCheck, labelKey: "portal.support.quick.identity" },
  { key: "payment", icon: CreditCard, labelKey: "portal.support.quick.payment" },
  { key: "application", icon: FileText, labelKey: "portal.support.quick.application" },
  { key: "technical", icon: Wrench, labelKey: "portal.support.quick.technical" },
];

export function SupportQuickCategories({ onPick }: SupportQuickCategoriesProps) {
  const { t, language } = useLanguage();
  const reduced = useReducedMotion();
  const isRtl = language === "ar";

  return (
    <div className="grid grid-cols-2 gap-2">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        return (
          <motion.button
            key={cat.key}
            type="button"
            onClick={() => onPick(cat.key)}
            whileHover={reduced ? undefined : { x: isRtl ? -2 : 2 }}
            whileTap={reduced ? undefined : { scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "flex items-center gap-2.5 p-3 rounded-xl",
              "border border-border/50 bg-muted/20",
              "hover:bg-muted/50 hover:border-border transition-colors",
              "text-start outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="text-sm font-medium text-foreground truncate">
              {t(cat.labelKey)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
