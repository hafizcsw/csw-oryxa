import { motion, useReducedMotion } from "framer-motion";
import { Inbox } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SupportTicketRow } from "@/api/identitySupportInvoke";
import { cn } from "@/lib/utils";

interface RecentTicketsListProps {
  tickets: SupportTicketRow[];
}

const STATE_DOT: Record<string, string> = {
  submitted: "bg-warning",
  under_review: "bg-primary",
  resolved: "bg-success",
};

function formatRelative(iso: string, locale: string, justNowLabel: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.max(1, Math.round((now - then) / 1000));
  if (diffSec < 60) return justNowLabel;
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (diffSec < 3600) return rtf.format(-Math.round(diffSec / 60), "minute");
    if (diffSec < 86400) return rtf.format(-Math.round(diffSec / 3600), "hour");
    if (diffSec < 2592000) return rtf.format(-Math.round(diffSec / 86400), "day");
    return rtf.format(-Math.round(diffSec / 2592000), "month");
  } catch {
    return new Date(iso).toLocaleDateString(locale);
  }
}

export function RecentTicketsList({ tickets }: RecentTicketsListProps) {
  const { t, language } = useLanguage();
  const reduced = useReducedMotion();
  const isRtl = language === "ar";

  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-6 flex flex-col items-center text-center">
        <span className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-2">
          <Inbox className="h-5 w-5" strokeWidth={2} />
        </span>
        <p className="text-xs text-muted-foreground">
          {t("portal.support.panel.recentTicketsEmpty")}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {tickets.map((tk) => {
        const dot = STATE_DOT[tk.ui_state] ?? "bg-muted-foreground";
        const subject = tk.subject_key
          ? t(`portal.support.subject.${tk.subject_key}`, {
              defaultValue: t(`portal.support.quick.${tk.subject_key}`, {
                defaultValue: `#${tk.ticket_id.slice(0, 6)}`,
              }),
            })
          : `#${tk.ticket_id.slice(0, 6)}`;
        const time = formatRelative(
          tk.last_reply_at ?? tk.updated_at ?? tk.created_at,
          language,
          t("portal.support.ticket.relativeJustNow"),
        );
        const stateLabel = t(`portal.support.uiState.${tk.ui_state}`);
        return (
          <motion.li
            key={tk.ticket_id}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-3 p-2.5 rounded-xl cursor-default"
          >
            <span className={cn("h-2 w-2 rounded-full shrink-0", dot)} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{subject}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span>{stateLabel}</span>
                <span className="opacity-60">•</span>
                <span>{time}</span>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
