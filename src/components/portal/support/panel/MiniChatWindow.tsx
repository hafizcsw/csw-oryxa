/**
 * MiniChatWindow — Floating thread popup that routes to the correct native
 * surface based on item.source:
 *   • support → SupportThread (CRM bridge: support_message_send / mark_read / close)
 *   • everything else → CommThreadView (comm-api: thread.messages / message.send)
 *
 * No data unification, no fake thread shells — opens the real backend thread.
 */
import { motion } from "framer-motion";
import { X, Minus } from "lucide-react";
import { CommThreadView } from "@/components/comm/CommThreadView";
import { SupportThread } from "@/features/support/SupportThread";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UnifiedInboxItem } from "@/hooks/useUnifiedInbox";

interface MiniChatWindowProps {
  item: UnifiedInboxItem;
  onClose: () => void;
  onMinimize?: () => void;
}

export function MiniChatWindow({ item, onClose, onMinimize }: MiniChatWindowProps) {
  const { t, language } = useLanguage();
  const isRtl = language === "ar";
  const initial = (item.title || "?").charAt(0).toUpperCase();
  const title = item.title || t("portal.support.panel.title");

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{
        ...(isRtl ? { left: "440px" } : { right: "440px" }),
      }}
      className="fixed bottom-6 z-[59] w-[340px] h-[480px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden max-sm:inset-x-2 max-sm:bottom-2 max-sm:w-auto max-sm:h-[60vh]"
      role="dialog"
      aria-label={title}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[12px] font-semibold text-primary flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{title}</p>
          <p className="text-[10px] text-muted-foreground truncate capitalize">
            {t(`portal.support.panel.messages.source.${item.source}`, { defaultValue: item.source })}
            {item.isClosed && ` · ${t("portal.support.panel.messages.closed", { defaultValue: "closed" })}`}
          </p>
        </div>
        {onMinimize && (
          <button
            type="button"
            onClick={onMinimize}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label={t("portal.support.panel.messages.minimize", { defaultValue: "Minimize" })}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label={t("portal.support.panel.messages.close", { defaultValue: "Close" })}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body — routes to the real native surface */}
      <div className="flex-1 min-h-0 overflow-hidden bg-background">
        {item.raw.kind === "support" ? (
          <SupportThread caseId={item.nativeId} embedded />
        ) : (
          <CommThreadView
            threadId={item.nativeId}
            threadType={item.raw.thread.thread_type}
            subject={item.raw.thread.subject || undefined}
            className="h-full"
          />
        )}
      </div>
    </motion.div>
  );
}
