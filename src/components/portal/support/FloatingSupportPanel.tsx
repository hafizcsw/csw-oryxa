import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIdentityStatus } from "@/hooks/useIdentityStatus";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { supabase } from "@/integrations/supabase/client";
import { SupportSubmitDialog } from "./SupportSubmitDialog";
import { IdentityActivationDialog } from "@/components/portal/identity/IdentityActivationDialog";
import { PanelHeader } from "./panel/PanelHeader";
import { PanelGreeting } from "./panel/PanelGreeting";
import { IdentityStatusCard } from "./panel/IdentityStatusCard";
import { SupportQuickCategories } from "./panel/SupportQuickCategories";
import { RecentTicketsList } from "./panel/RecentTicketsList";
import { PanelLinksRow } from "./panel/PanelLinksRow";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };

interface FloatingSupportPanelProps {
  onClose: () => void;
}

export function FloatingSupportPanel({ onClose }: FloatingSupportPanelProps) {
  const { t, language } = useLanguage();
  const { status, refetch: refetchIdentity } = useIdentityStatus();
  const { tickets, refetch: refetchTickets } = useSupportTickets();
  const reduced = useReducedMotion();
  const isRtl = language === "ar";
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitSubject, setSubmitSubject] = useState<string | undefined>();
  const [identityOpen, setIdentityOpen] = useState(false);
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

  // focus close on open
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  const openNewTicket = (subjectKey?: string) => {
    setSubmitSubject(subjectKey);
    setSubmitOpen(true);
  };

  const handleSubmitChange = (open: boolean) => {
    setSubmitOpen(open);
    if (!open) {
      setSubmitSubject(undefined);
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
    show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
  };

  return (
    <>
      {/* Mobile backdrop */}
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0 }}
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
          // Mobile: bottom sheet
          "fixed inset-x-0 bottom-0 z-[58] w-full h-[88vh] rounded-t-3xl rounded-b-none",
          // Desktop: floating panel
          "sm:inset-x-auto sm:bottom-24 sm:end-6 sm:w-[400px] sm:h-auto sm:max-h-[calc(100vh-8rem)] sm:rounded-3xl",
          "bg-card/95 backdrop-blur-xl",
          "border border-border/50",
          "shadow-2xl",
          "flex flex-col overflow-hidden",
        )}
      >
        <PanelHeader onClose={onClose} closeRef={closeBtnRef} />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5 [scrollbar-width:thin]"
        >
          <motion.div variants={sectionVariants}>
            <PanelGreeting name={userName} />
          </motion.div>

          <motion.section variants={sectionVariants} aria-labelledby="support-identity-heading">
            <h3
              id="support-identity-heading"
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5"
            >
              {t("portal.support.panel.identitySectionTitle")}
            </h3>
            <IdentityStatusCard
              status={status}
              onAction={() => setIdentityOpen(true)}
            />
          </motion.section>

          <motion.section variants={sectionVariants} aria-labelledby="support-quick-heading">
            <h3
              id="support-quick-heading"
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5"
            >
              {t("portal.support.panel.supportSectionTitle")}
            </h3>
            <SupportQuickCategories onPick={openNewTicket} />
          </motion.section>

          <motion.section variants={sectionVariants} aria-labelledby="support-recent-heading">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <h3
                id="support-recent-heading"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {t("portal.support.panel.recentTicketsTitle")}
              </h3>
            </div>
            <RecentTicketsList tickets={tickets.slice(0, 4)} />
          </motion.section>

          <motion.section variants={sectionVariants}>
            <PanelLinksRow />
          </motion.section>
        </motion.div>

        <div className="border-t border-border/50 bg-card/80 backdrop-blur-sm px-5 py-3">
          <Button
            onClick={() => openNewTicket()}
            className="w-full h-11 rounded-xl font-medium"
            size="lg"
          >
            <Plus className="h-4 w-4 me-2" strokeWidth={2.5} />
            {t("portal.support.panel.newRequest")}
          </Button>
        </div>
      </motion.div>

      <SupportSubmitDialog
        open={submitOpen}
        onOpenChange={handleSubmitChange}
        defaultSubjectKey={submitSubject}
      />
      <IdentityActivationDialog
        open={identityOpen}
        onOpenChange={handleIdentityChange}
      />
    </>
  );
}
