/**
 * MiniChatWindow — Facebook Messenger-style floating mini chat popup,
 * anchored bottom-end inside the floating support panel.
 */
import { motion } from "framer-motion";
import { X, Minus, Phone, Video } from "lucide-react";
import { CommThreadView } from "@/components/comm/CommThreadView";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CommThread } from "@/hooks/useCommApi";

interface MiniChatWindowProps {
  thread: CommThread;
  onClose: () => void;
  onMinimize?: () => void;
}

export function MiniChatWindow({ thread, onClose, onMinimize }: MiniChatWindowProps) {
  const { t } = useLanguage();
  const initial = (thread.display_name || thread.subject || "?").charAt(0).toUpperCase();
  const title = thread.display_name || thread.subject || t("portal.support.panel.title");

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="absolute bottom-2 end-2 z-30 w-[320px] h-[420px] max-w-[calc(100%-1rem)] sm:max-w-[320px] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
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
          <p className="text-[10px] text-muted-foreground truncate">
            {t("portal.support.panel.messages.activeNow", { defaultValue: "Active now" })}
          </p>
        </div>
        <button
          type="button"
          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label={t("portal.support.panel.messages.call", { defaultValue: "Call" })}
        >
          <Phone className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label={t("portal.support.panel.messages.video", { defaultValue: "Video" })}
        >
          <Video className="h-3.5 w-3.5" />
        </button>
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

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden bg-background">
        <CommThreadView
          threadId={thread.id}
          threadType={thread.thread_type}
          subject={thread.subject || undefined}
          className="h-full"
        />
      </div>
    </motion.div>
  );
}
