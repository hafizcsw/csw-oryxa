import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Headset } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { useNewMessageNotifier } from "@/hooks/useNewMessageNotifier";
import { FloatingSupportPanel } from "./FloatingSupportPanel";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };

export function FloatingSupportLauncher() {
  const { t } = useLanguage();
  const { tickets } = useSupportTickets();
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const reduced = useReducedMotion();
  const fabRef = useRef<HTMLButtonElement>(null);

  const { hasNew, lastNativeId, lastSource, clearNew } = useNewMessageNotifier(!open);
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);

  const openItems = tickets.filter((t) => t.ui_state !== "resolved").length;
  const totalBadge = openItems + (hasNew && lastSource !== "support" ? 1 : 0);
  const badgeText = totalBadge > 99 ? "99+" : String(totalBadge);
  const showBadge = totalBadge > 0 || hasNew;

  // ESC closes panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <AnimatePresence>
        {!open && (
      <motion.button
        key="oryxa-fab"
        ref={fabRef}
        type="button"
        data-floating-launcher
        aria-label={
          open
            ? t("portal.support.launcher.ariaClose")
            : t("portal.support.launcher.ariaOpen")
        }
        title={
          openItems > 0
            ? t("portal.support.launcher.openItemsTooltip", { count: openItems })
            : undefined
        }
        drag="x"
        dragConstraints={{
          left: 0,
          right: (typeof window !== "undefined" ? window.innerWidth - 96 : 0),
        }}
        dragElastic={0.1}
        whileDrag={reduced ? undefined : { scale: 1.08 }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setTimeout(() => setIsDragging(false), 100)}
        onClick={() => {
          if (isDragging) return;
          if (hasNew && lastNativeId) {
            setPendingThreadId(lastNativeId);
            clearNew();
          }
          setOpen((v) => !v);
        }}
        initial={reduced ? { opacity: 1 } : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { scale: 0, opacity: 0, transition: { duration: 0.18 } }}
        transition={reduced ? { duration: 0 } : { ...SPRING, delay: 0.05 }}
        whileHover={reduced ? undefined : { scale: 1.06 }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        className={cn(
          "fixed bottom-5 start-5 sm:bottom-6 sm:start-6 z-[60]",
          "h-14 w-14 rounded-full border border-border",
          "bg-primary text-primary-foreground",
          "shadow-[0_14px_36px_hsl(0_0%_0%/0.18)] dark:shadow-[0_14px_36px_hsl(0_0%_0%/0.34)]",
          "flex items-center justify-center cursor-grab active:cursor-grabbing",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <span className="relative flex items-center justify-center h-14 w-14">
          {!reduced && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-primary-foreground/10"
              animate={{ scale: [1, 1.05, 1], opacity: [0.22, 0.08, 0.22] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <span className="absolute inset-[6px] rounded-full bg-primary" aria-hidden="true" />
          <Headset className="relative h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </span>

        <AnimatePresence>
          {!open && showBadge && (
            <motion.span
              key="badge"
              initial={reduced ? { opacity: 0 } : { scale: 0, opacity: 0 }}
              animate={
                reduced
                  ? { opacity: 1 }
                  : hasNew
                    ? { scale: [1, 1.18, 1], opacity: 1 }
                    : { scale: 1, opacity: 1 }
              }
              exit={reduced ? { opacity: 0 } : { scale: 0, opacity: 0 }}
              transition={
                hasNew && !reduced
                  ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                  : SPRING
              }
              className={cn(
                "absolute -top-1 -start-1",
                "min-w-[20px] h-5 px-1.5 rounded-full",
                "bg-destructive text-destructive-foreground",
                "text-[11px] font-semibold leading-none",
                "flex items-center justify-center",
                "ring-2 ring-background pointer-events-none",
              )}
              aria-hidden="true"
            >
              {badgeText}
            </motion.span>
          )}
        </AnimatePresence>

        {!open && hasNew && !reduced && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full ring-2 ring-destructive pointer-events-none"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <FloatingSupportPanel
            onClose={() => {
              setOpen(false);
              setPendingThreadId(null);
            }}
            initialView="messages"
            initialThreadId={pendingThreadId}
          />
        )}
      </AnimatePresence>
    </>
  );
}
