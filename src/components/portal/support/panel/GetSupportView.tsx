/**
 * GetSupportView — Create a real CRM support case from inside the FAB.
 * Wired to support_ticket_create (cutover → CRM web-sync-support-request).
 * The created case will subsequently appear in support_case_list.
 */
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, LifeBuoy, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { createSupportTicket } from "@/api/identitySupportInvoke";
import { cn } from "@/lib/utils";

interface GetSupportViewProps {
  onBack: () => void;
  /** Called after a real CRM ticket is created. */
  onSubmitted: () => void;
}

export function GetSupportView({ onBack, onSubmitted }: GetSupportViewProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isRtl = language === "ar";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const suggestions = [
    t("portal.support.panel.getSupport.s1", { defaultValue: "How do I verify my identity?" }),
    t("portal.support.panel.getSupport.s2", { defaultValue: "Payment issue" }),
    t("portal.support.panel.getSupport.s3", { defaultValue: "Question about a university" }),
    t("portal.support.panel.getSupport.s4", { defaultValue: "Update my account info" }),
  ];

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 4) {
      toast({
        title: t("portal.support.errors.bodyTooShort", { defaultValue: "Please describe your issue" }),
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const res = await createSupportTicket({
      body: trimmed,
      client_trace_id: crypto.randomUUID(),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast({
        title: t("portal.support.errors.submitFailed", { defaultValue: "Could not send your message" }),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: t("portal.support.submit.success", { defaultValue: "Message sent — we'll reply shortly" }),
    });
    setValue("");
    onSubmitted();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(value);
    }
  };

  const Arrow = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-card/40">
        <button
          type="button"
          onClick={onBack}
          className="h-8 px-2 inline-flex items-center gap-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-[12px]"
        >
          <Arrow className="h-3.5 w-3.5" />
          {t("portal.support.panel.back", { defaultValue: "Back" })}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 [scrollbar-width:thin]">
        <div className="text-center space-y-1.5">
          <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <h3 className="text-[15px] font-semibold text-foreground">
            {t("portal.support.panel.getSupport.title", { defaultValue: "Tell us what's wrong" })}
          </h3>
          <p className="text-[12px] text-muted-foreground max-w-xs mx-auto">
            {t("portal.support.panel.getSupport.subtitle", {
              defaultValue: "Our team will help you resolve it right away",
            })}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {t("portal.support.panel.getSupport.suggestionsLabel", { defaultValue: "You may want to ask:" })}
          </p>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={submitting}
                onClick={() => setValue(s)}
                className={cn(
                  "w-full text-start px-3 py-2 rounded-lg text-[12.5px] text-foreground/90",
                  "bg-muted/40 hover:bg-muted/70 border border-border/40 transition-colors",
                  "disabled:opacity-50",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto shrink-0 bg-card flex items-end gap-2 px-3 py-3 border-t border-border/40">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={submitting}
          placeholder={t("portal.support.panel.getSupport.placeholder", {
            defaultValue: "Describe your issue…",
          })}
          className="min-h-[40px] max-h-32 resize-none text-sm flex-1 bg-muted/40 border-0 rounded-2xl px-4 py-2 focus-visible:ring-1 focus-visible:ring-ring/40"
          rows={1}
          maxLength={5000}
        />
        <Button
          type="button"
          size="icon"
          onClick={() => submit(value)}
          disabled={submitting || value.trim().length < 4}
          className="h-9 w-9 rounded-full flex-shrink-0"
          aria-label={t("portal.support.submit.send", { defaultValue: "Send" })}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
