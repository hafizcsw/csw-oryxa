import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
          "h-14 w-14 rounded-full",
          "bg-transparent",
          "shadow-[0_18px_50px_-12px_hsl(270_85%_60%/0.65),0_6px_18px_-4px_hsl(220_90%_60%/0.45),0_0_0_1px_hsl(0_0%_100%/0.06)]",
          "flex items-center justify-center cursor-grab active:cursor-grabbing",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {/* Animated gradient orb (Gemini-style) */}
        <span className="relative flex items-center justify-center h-14 w-14">
          {/* Soft outer halo */}
          {!reduced && (
            <motion.span
              aria-hidden="true"
              className="absolute -inset-2 rounded-full blur-xl"
              style={{
                background:
                  "radial-gradient(circle, hsl(270 85% 65% / 0.55) 0%, hsl(220 90% 60% / 0.35) 40%, transparent 70%)",
              }}
              animate={{ opacity: [0.55, 0.85, 0.55], scale: [1, 1.08, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {/* Rotating conic ring */}
          <motion.span
            aria-hidden="true"
            animate={reduced ? undefined : { rotate: 360 }}
            transition={
              reduced ? undefined : { duration: 8, repeat: Infinity, ease: "linear" }
            }
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, hsl(220 90% 60%), hsl(270 85% 65%), hsl(330 85% 62%), hsl(30 95% 58%), hsl(220 90% 60%))",
            }}
          />
          {/* Inner gradient core (not just blank bg) */}
          <span
            aria-hidden="true"
            className="absolute inset-[2px] rounded-full"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, hsl(0 0% 100% / 0.18), hsl(240 20% 8%) 70%)",
            }}
          />
          {/* Subtle inner highlight */}
          <span
            aria-hidden="true"
            className="absolute inset-[2px] rounded-full"
            style={{
              background:
                "radial-gradient(circle at 70% 75%, hsl(330 85% 62% / 0.35), transparent 55%)",
            }}
          />
          {/* Counter-rotating sparkle */}
          <motion.svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            role="img"
            aria-hidden="true"
            className="relative drop-shadow-[0_2px_6px_hsl(270_85%_60%/0.6)]"
            animate={reduced ? undefined : { rotate: -360 }}
            transition={
              reduced ? undefined : { duration: 18, repeat: Infinity, ease: "linear" }
            }
          >
            <defs>
              <linearGradient id="oryxa-fab-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(220 95% 70%)" />
                <stop offset="33%" stopColor="hsl(270 90% 75%)" />
                <stop offset="66%" stopColor="hsl(330 90% 70%)" />
                <stop offset="100%" stopColor="hsl(30 100% 65%)" />
              </linearGradient>
            </defs>
            <path
              fill="url(#oryxa-fab-gradient)"
              d="M12 2L15.5 8.5L22 12L15.5 15.5L12 22L8.5 15.5L2 12L8.5 8.5L12 2Z"
            />
          </motion.svg>
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
