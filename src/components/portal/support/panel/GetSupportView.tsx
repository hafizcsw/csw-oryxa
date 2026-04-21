import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Send, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { cn } from "@/lib/utils";

interface GetSupportViewProps {
  onBack: () => void;
  onSubmitted: () => void;
}

export function GetSupportView({ onBack, onSubmitted }: GetSupportViewProps) {
  const { t, language } = useLanguage();
  const { addMessage } = useMalakChat();
  const isRtl = language === "ar";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");

  const suggestions = [
    t("portal.support.panel.getSupport.s1", { defaultValue: "How do I verify my identity?" }),
    t("portal.support.panel.getSupport.s2", { defaultValue: "Payment issue" }),
    t("portal.support.panel.getSupport.s3", { defaultValue: "Question about a university" }),
    t("portal.support.panel.getSupport.s4", { defaultValue: "Update my account info" }),
  ];

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addMessage({ from: "user", type: "text", content: trimmed });
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
            {t("portal.support.panel.getSupport.title", {
              defaultValue: "Tell us what's wrong",
            })}
          </h3>
          <p className="text-[12px] text-muted-foreground max-w-xs mx-auto">
            {t("portal.support.panel.getSupport.subtitle", {
              defaultValue: "Our team will help you resolve it right away",
            })}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {t("portal.support.panel.getSupport.suggestionsLabel", {
              defaultValue: "You may want to ask:",
            })}
          </p>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className={cn(
                  "w-full text-start px-3 py-2 rounded-lg text-[12.5px] text-foreground/90",
                  "bg-muted/40 hover:bg-muted/70 border border-border/40 transition-colors",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-border/40 bg-card/80 backdrop-blur-sm sticky bottom-0">
        <div className={cn(
          "relative flex items-end gap-1 rounded-2xl border border-border/60 bg-background",
          "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all",
          "px-1 py-1"
        )}>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("portal.support.panel.getSupport.placeholder", {
              defaultValue: "Describe your problem here…",
            })}
            className="min-h-[40px] max-h-32 resize-none text-sm border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-3 py-2 flex-1"
            rows={1}
          />
          <Button
            onClick={() => submit(value)}
            disabled={!value.trim()}
            size="icon"
            className="h-9 w-9 flex-shrink-0 rounded-xl"
            aria-label={t("portal.support.panel.getSupport.send", { defaultValue: "Send" })}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
