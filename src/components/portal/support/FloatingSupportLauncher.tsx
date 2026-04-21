import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Headset, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { FloatingSupportPanel } from "./FloatingSupportPanel";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };

export function FloatingSupportLauncher() {
  const { t } = useLanguage();
  const { tickets } = useSupportTickets();
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

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
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("portal.support.launcher.ariaClose") : t("portal.support.launcher.ariaOpen")}
        title={openItems > 0 ? t("portal.support.launcher.openItemsTooltip", { count: openItems }) : undefined}
        initial={reduced ? { opacity: 1 } : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { ...SPRING, delay: 0.2 }}
        whileHover={reduced ? undefined : { scale: 1.06 }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        className={cn(
          "fixed bottom-4 end-4 sm:bottom-6 sm:end-6 z-[60]",
          "h-14 w-14 rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.45)]",
          "flex items-center justify-center",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={reduced ? { opacity: 0 } : { rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex"
            >
              <X className="h-6 w-6" strokeWidth={2.25} />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={reduced ? { opacity: 0 } : { rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex"
            >
              <Headset className="h-6 w-6" strokeWidth={2.25} />
            </motion.span>
          )}
        </AnimatePresence>

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
                "ring-2 ring-background",
              )}
              aria-hidden="true"
            >
              {badgeText}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && <FloatingSupportPanel onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
