import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { MessageSquare, Sparkles, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const ENTRIES = [
  {
    to: "/messages",
    icon: MessageSquare,
    labelKey: "portal.support.panel.messagesEntryLabel",
    hintKey: "portal.support.panel.messagesEntryHint",
  },
  {
    to: "/about-oryxa",
    icon: Sparkles,
    labelKey: "portal.support.panel.oryxaEntryLabel",
    hintKey: "portal.support.panel.oryxaEntryHint",
  },
];

export function PanelLinksRow() {
  const { t, language } = useLanguage();
  const reduced = useReducedMotion();
  const isRtl = language === "ar";

  return (
    <div className="space-y-1.5">
      {ENTRIES.map((e) => {
        const Icon = e.icon;
        return (
          <motion.div
            key={e.to}
            whileHover={reduced ? undefined : { x: isRtl ? -2 : 2 }}
            transition={{ duration: 0.15 }}
          >
            <Link
              to={e.to}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                "border border-border/40 bg-card",
                "hover:border-border hover:bg-muted/30 transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="h-9 w-9 rounded-full bg-muted/60 text-foreground flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {t(e.labelKey)}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {t(e.hintKey)}
                </div>
              </div>
              <ExternalLink
                className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
