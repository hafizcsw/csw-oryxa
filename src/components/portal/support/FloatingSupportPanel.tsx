import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIdentityStatus } from "@/hooks/useIdentityStatus";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { supabase } from "@/integrations/supabase/client";
import { SupportSubmitDialog } from "./SupportSubmitDialog";
import { IdentityActivationDialog } from "@/components/portal/identity/IdentityActivationDialog";
import { PanelTopBar } from "./panel/PanelTopBar";
import { PanelHero } from "./panel/PanelHero";
import { QuickCategoriesGrid } from "./panel/QuickCategoriesGrid";
import { IdentityProgressCard } from "./panel/IdentityProgressCard";
import { FAQSuggestionsList } from "./panel/FAQSuggestionsList";
import { PanelStickyFooter } from "./panel/PanelStickyFooter";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };

interface FloatingSupportPanelProps {
  onClose: () => void;
}

export function FloatingSupportPanel({ onClose }: FloatingSupportPanelProps) {
  const { t, language } = useLanguage();
  const { status, refetch: refetchIdentity } = useIdentityStatus();
  const { refetch: refetchTickets } = useSupportTickets();
  const reduced = useReducedMotion();
  const isRtl = language === "ar";
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitSubject, setSubmitSubject] = useState<string | undefined>();
  const [submitMessage, setSubmitMessage] = useState<string | undefined>();
  const [identityOpen, setIdentityOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
      const name =
        (meta?.full_name as string) ||
        (meta?.name as string) ||
        (meta?.first_name as string) ||
        (data.user?.email?.split("@")[0] ?? null);
      setUserName(name ?? null);
    });
  }, []);

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  const openNewTicket = (subjectKey?: string, message?: string) => {
    setSubmitSubject(subjectKey);
    setSubmitMessage(message);
    setSubmitOpen(true);
  };

  const handleSubmitChange = (open: boolean) => {
    setSubmitOpen(open);
    if (!open) {
      setSubmitSubject(undefined);
      setSubmitMessage(undefined);
      refetchTickets();
    }
  };

  const handleIdentityChange = (open: boolean) => {
    setIdentityOpen(open);
    if (!open) refetchIdentity();
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
  };
  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
  };

  return (
    <>
      {/* Mobile backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-0 sm:pointer-events-none"
        aria-hidden="true"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={t("portal.support.panel.title")}
        dir={isRtl ? "rtl" : "ltr"}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
        transition={reduced ? { duration: 0.15 } : SPRING}
        style={{ transformOrigin: isRtl ? "bottom left" : "bottom right" }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[58] w-full h-[88vh] rounded-t-3xl rounded-b-none",
          "sm:inset-x-auto sm:bottom-24 sm:end-6 sm:h-auto sm:max-h-[calc(100vh-8rem)] sm:rounded-3xl",
          expanded ? "sm:w-[520px]" : "sm:w-[400px]",
          "bg-muted/20 backdrop-blur-xl",
          "border border-border/50",
          "shadow-2xl",
          "flex flex-col overflow-hidden",
          "transition-[width] duration-300 ease-out",
        )}
      >
        <PanelTopBar
          onClose={onClose}
          closeRef={closeBtnRef}
          expanded={expanded}
          onToggleExpand={() => setExpanded((v) => !v)}
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex-1 overflow-y-auto px-4 pt-2 pb-4 space-y-3 [scrollbar-width:thin]"
        >
          <motion.div variants={sectionVariants} className="pt-2 pb-1">
            <PanelHero name={userName} />
          </motion.div>

          <motion.div variants={sectionVariants}>
            <QuickCategoriesGrid onPick={(k) => openNewTicket(k)} onClose={onClose} />
          </motion.div>

          <motion.div variants={sectionVariants}>
            <IdentityProgressCard status={status} onAction={() => setIdentityOpen(true)} />
          </motion.div>

          <motion.div variants={sectionVariants}>
            <FAQSuggestionsList onPick={(k, msg) => openNewTicket(k, msg)} />
          </motion.div>
        </motion.div>

        <PanelStickyFooter onClick={() => openNewTicket()} />
      </motion.div>

      <SupportSubmitDialog
        open={submitOpen}
        onOpenChange={handleSubmitChange}
        defaultSubjectKey={submitSubject}
        defaultMessage={submitMessage}
      />
      <IdentityActivationDialog
        open={identityOpen}
        onOpenChange={handleIdentityChange}
      />
    </>
  );
}
