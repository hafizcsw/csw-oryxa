import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface FAQSuggestionsListProps {
  onPick: (subjectKey: string, message: string) => void;
}

const FAQS: { id: string; subjectKey: string; questionKey: string }[] = [
  { id: "q1", subjectKey: "identity", questionKey: "portal.support.faq.q1" },
  { id: "q2", subjectKey: "identity", questionKey: "portal.support.faq.q2" },
  { id: "q3", subjectKey: "application", questionKey: "portal.support.faq.q3" },
  { id: "q4", subjectKey: "account_security", questionKey: "portal.support.faq.q4" },
  { id: "q5", subjectKey: "payment", questionKey: "portal.support.faq.q5" },
  { id: "q6", subjectKey: "application", questionKey: "portal.support.faq.q6" },
];

export function FAQSuggestionsList({ onPick }: FAQSuggestionsListProps) {
  const { t } = useLanguage();
  const reduced = useReducedMotion();

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-2">
      <h3 className="px-2 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("portal.support.panel.faqTitle")}
      </h3>
      <ul className="divide-y divide-border/40">
        {FAQS.map((q, i) => {
          const text = t(q.questionKey);
          return (
            <motion.li
              key={q.id}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.2, ease: "easeOut" }}
            >
              <button
                type="button"
                onClick={() => onPick(q.subjectKey, text)}
                className={cn(
                  "w-full flex items-start gap-3 px-2 py-2.5 rounded-lg text-start",
                  "hover:bg-muted/50 transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="shrink-0 w-5 text-sm font-semibold text-primary tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground leading-snug">{text}</span>
              </button>
            </motion.li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => onPick("other", "")}
        className={cn(
          "mt-1 w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg",
          "text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {t("portal.support.panel.faqViewMore")}
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
