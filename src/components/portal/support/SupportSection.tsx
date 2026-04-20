import { useState } from "react";
import { LifeBuoy, Plus, Loader2, CheckCircle2, Clock, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { SupportSubmitDialog } from "./SupportSubmitDialog";
import { cn } from "@/lib/utils";

export function SupportSection() {
  const { t, language } = useLanguage();
  const { tickets, loading } = useSupportTickets();
  const [open, setOpen] = useState(false);
  const isRtl = language === "ar";

  const stateIcon = (s: string) => {
    if (s === "submitted") return <Clock className="w-4 h-4 text-warning" />;
    if (s === "under_review") return <RotateCw className="w-4 h-4 text-primary" />;
    return <CheckCircle2 className="w-4 h-4 text-success" />;
  };

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      className="rounded-2xl border border-border bg-card p-5"
      aria-label={t("portal.support.section.title")}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            {t("portal.support.section.title")}
          </h3>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 me-1" />
          {t("portal.support.section.new")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {t("portal.support.section.hint")}
      </p>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-4">
          {t("portal.support.section.empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {tickets.slice(0, 5).map((tk) => (
            <li
              key={tk.ticket_id}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl bg-muted/40 border border-border/60 p-3 text-sm",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {stateIcon(tk.ui_state)}
                <span className="text-foreground truncate">
                  {tk.subject_key
                    ? t(`portal.support.subject.${tk.subject_key}`)
                    : `#${tk.ticket_id.slice(0, 8)}`}
                </span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {t(`portal.support.uiState.${tk.ui_state}`)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <SupportSubmitDialog open={open} onOpenChange={setOpen} />
    </section>
  );
}
