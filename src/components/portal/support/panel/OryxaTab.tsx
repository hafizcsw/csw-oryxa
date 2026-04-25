import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2, RotateCcw, ArrowLeft, ArrowRight, Radio, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { UniversityResults } from "@/components/chat/UniversityResults";
import { AIIcon } from "@/components/icons/AIIcon";
import { LiveSessionPanel } from "@/components/chat/LiveSessionPanel";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSmartScroll } from "@/hooks/useSmartScroll";
import { cn } from "@/lib/utils";

interface OryxaTabProps {
  onBack?: () => void;
}

export function OryxaTab({ onBack }: OryxaTabProps = {}) {
  const { t, language } = useLanguage();
  const isRtl = language === "ar";
  const Arrow = isRtl ? ArrowRight : ArrowLeft;
  const {
    messages,
    universities,
    status,
    addMessage,
    clearHistory,
  } = useMalakChat();

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasNewMessage = useMemo(
    () => messages.some((m) => (m as any).isNew === true),
    [messages],
  );
  const { scrollRef, handleScroll } = useSmartScroll({
    messagesCount: messages.length,
    isTyping: status === "thinking" || status === "searching",
    hasNewMessage,
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!input.trim() || status === "thinking") return;
    addMessage({ from: "user", type: "text", content: input.trim() });
    setInput("");
    setTimeout(() => {
      addMessage({ from: "bot", type: "text", content: t("botUi.quickReply") });
    }, 800);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    t("bot.prompt.russia"),
    t("bot.prompt.medicine"),
    t("bot.prompt.scholarship"),
    t("bot.prompt.engineering"),
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {onBack && (
        <div className="flex items-center px-3 py-2 border-b border-border/40 bg-card/40">
          <button
            type="button"
            onClick={onBack}
            className="h-8 px-2 inline-flex items-center gap-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-[12px]"
          >
            <Arrow className="h-3.5 w-3.5" />
            {t("portal.support.panel.back", { defaultValue: "Back" })}
          </button>
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 [scrollbar-width:thin]"
      >
        {messages.length === 0 ? (
          <div className="space-y-4 py-6">
            <div className="text-center space-y-1.5">
              <div className="mx-auto w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <AIIcon className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("bot.welcome")}
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {t("bot.intro")}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {suggestedPrompts.map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInput(p);
                    textareaRef.current?.focus();
                  }}
                  className="text-[11px] h-7"
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
            {(status === "thinking" || status === "searching") && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {status === "searching" ? t("bot.searching") : t("bot.typing")}
                </span>
              </div>
            )}
            {universities.length > 0 && (
              <UniversityResults
                universities={universities}
                onLike={() => {}}
                onRequestAlternatives={() => {}}
              />
            )}
          </>
        )}
      </div>

      {messages.length > 0 && (
        <div className="px-4 pt-1.5 pb-1 flex justify-end">
          <button
            type="button"
            onClick={clearHistory}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            {t("portal.support.panel.oryxa.clear", {
              defaultValue: "Clear conversation",
            })}
          </button>
        </div>
      )}

      <div className="p-3 border-t border-border/40 bg-card/40">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("portal.support.panel.oryxa.placeholder", {
              defaultValue: "Ask Oryxa anything…",
            })}
            className="min-h-[44px] max-h-32 resize-none text-sm"
            disabled={status === "thinking"}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || status === "thinking"}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
          >
            {status === "thinking" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
