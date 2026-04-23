import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSupportTickets } from "@/hooks/useSupportTickets";
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

  const openItems = tickets.filter((t) => t.ui_state !== "resolved").length;
  const badgeText = openItems > 99 ? "99+" : String(openItems);

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
          setOpen((v) => !v);
        }}
        initial={reduced ? { opacity: 1 } : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { scale: 0, opacity: 0, transition: { duration: 0.18 } }}
        transition={reduced ? { duration: 0 } : { ...SPRING, delay: 0.05 }}
        whileHover={reduced ? undefined : { scale: 1.06 }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        className={cn(
          "fixed bottom-4 start-4 sm:bottom-6 sm:start-6 z-[60]",
          "h-14 w-14 rounded-full",
          "bg-background/40 backdrop-blur-md",
          "shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.45)]",
          "ring-1 ring-border/40",
          "flex items-center justify-center cursor-grab active:cursor-grabbing",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {/* Animated gradient orb (Gemini-style) */}
        <span className="relative flex items-center justify-center h-10 w-10">
          <motion.span
            aria-hidden="true"
            animate={
              reduced
                ? undefined
                : { rotate: 360 }
            }
            transition={
              reduced
                ? undefined
                : { duration: 14, repeat: Infinity, ease: "linear" }
            }
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, hsl(220 90% 60%), hsl(270 85% 65%), hsl(330 85% 62%), hsl(30 95% 58%), hsl(220 90% 60%))",
              filter: "blur(2px)",
            }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-[3px] rounded-full bg-background/85 backdrop-blur-sm"
          />
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            role="img"
            aria-hidden="true"
            className="relative"
          >
            <defs>
              <linearGradient id="oryxa-fab-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(220 90% 60%)" />
                <stop offset="33%" stopColor="hsl(270 85% 65%)" />
                <stop offset="66%" stopColor="hsl(330 85% 62%)" />
                <stop offset="100%" stopColor="hsl(30 95% 58%)" />
              </linearGradient>
            </defs>
            <path
              fill="url(#oryxa-fab-gradient)"
              d="M12 2L15.5 8.5L22 12L15.5 15.5L12 22L8.5 15.5L2 12L8.5 8.5L12 2Z"
            />
          </svg>
        </span>

        <AnimatePresence>
          {!open && openItems > 0 && (
            <motion.span
              key="badge"
              initial={reduced ? { opacity: 0 } : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { scale: 0, opacity: 0 }}
              transition={SPRING}
              className={cn(
                "absolute -top-1 -end-1",
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
      </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && <FloatingSupportPanel onClose={() => setOpen(false)} initialView="messages" />}
      </AnimatePresence>
    </>
  );
}
