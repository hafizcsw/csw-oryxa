import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIdentityStatus } from "@/hooks/useIdentityStatus";
import { useExtractedIdentity } from "@/hooks/useExtractedIdentity";
import { useCommUnreadCount } from "@/hooks/useCommApi";
import { supabase } from "@/integrations/supabase/client";
import { IdentityActivationDialog } from "@/components/portal/identity/IdentityActivationDialog";
import { PanelTopBar } from "./panel/PanelTopBar";
import { type PanelView } from "./panel/PanelCategoriesGrid";
import { DefaultHomeView } from "./panel/DefaultHomeView";
import { OryxaTab } from "./panel/OryxaTab";
import { MessagesTab } from "./panel/MessagesTab";
import { GetSupportView } from "./panel/GetSupportView";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };

interface FloatingSupportPanelProps {
  onClose: () => void;
  initialView?: PanelView;
}

export function FloatingSupportPanel({ onClose, initialView = "default" }: FloatingSupportPanelProps) {
  const { t, language } = useLanguage();
  const { status, refetch: refetchIdentity } = useIdentityStatus();
  const { fields: extracted } = useExtractedIdentity();
  const { count: unreadCount } = useCommUnreadCount();
  const reduced = useReducedMotion();
  const isRtl = language === "ar";

  const [identityOpen, setIdentityOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeView, setActiveView] = useState<PanelView>(initialView);
  const [authed, setAuthed] = useState(false);
  const [fallbackName, setFallbackName] = useState<string | null>(null);

  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const buildShortName = (raw?: string | null): string | null => {
    if (!raw) return null;
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    const cased = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    if (parts.length === 1) return cased(parts[0]);
    return `${cased(parts[0])} ${cased(parts[parts.length - 1])}`;
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setAuthed(!!user);
      const meta = user?.user_metadata as Record<string, unknown> | undefined;
      const metaName =
        (meta?.full_name as string) ||
        (meta?.name as string) ||
        [meta?.first_name as string, meta?.last_name as string].filter(Boolean).join(" ") ||
        null;
      setFallbackName(buildShortName(metaName));
    });
  }, []);

  const userName =
    buildShortName(extracted.full_name) ||
    [extracted.first_name, extracted.last_name].filter(Boolean).join(" ").trim() ||
    fallbackName;

  const firstName = userName?.split(/\s+/)[0] || null;

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  const handleIdentityChange = (open: boolean) => {
    setIdentityOpen(open);
    if (!open) refetchIdentity();
  };

  const identityApproved = status?.identity_status === "approved";
  const bottomDockedView = activeView === "getSupport";

  // Guests get Oryxa-only experience (no grid, no messages)
  const showGrid = authed;

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
          "fixed inset-x-0 bottom-0 z-[58] w-full h-[100vh] rounded-t-3xl rounded-b-none",
          bottomDockedView
            ? "sm:inset-x-auto sm:inset-y-0 sm:end-6 sm:h-[100vh] sm:max-h-[100vh] sm:rounded-none"
            : "sm:inset-x-auto sm:inset-y-0 sm:end-6 sm:h-[100vh] sm:max-h-[100vh] sm:rounded-none",
          expanded ? "sm:w-[520px]" : "sm:w-[400px]",
          "bg-card/95 backdrop-blur-xl",
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

        {/* Greeting */}
        <div className="px-4 pt-1 pb-2 flex items-center gap-1.5">
          <p className="text-[15px] font-semibold text-foreground truncate flex-1">
            {firstName
              ? t("portal.support.panel.greeting", { name: firstName })
              : t("portal.support.panel.greeting.guest", {
                  defaultValue: "Welcome",
                })}
          </p>
          {authed && identityApproved && (
            <span
              className="inline-flex items-center gap-1 text-success text-[11px] font-medium"
              title={t("portal.support.panel.identityVerified", { defaultValue: "Verified" })}
            >
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span className="hidden sm:inline">
                {t("portal.support.panel.identityVerified", { defaultValue: "Verified" })}
              </span>
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {!showGrid ? (
            <OryxaTab />
          ) : activeView === "default" ? (
            <DefaultHomeView
              identityStatus={status?.identity_status ?? null}
              unreadCount={unreadCount}
              onSwitchView={setActiveView}
              onClose={onClose}
              onOpenGetSupport={() => setActiveView("getSupport")}
            />
          ) : activeView === "oryxa" ? (
            <OryxaTab onBack={() => setActiveView("default")} />
          ) : activeView === "messages" ? (
            <MessagesTab
              identityApproved={identityApproved}
              onOpenIdentity={() => setIdentityOpen(true)}
              onBack={() => setActiveView("default")}
            />
          ) : activeView === "getSupport" ? (
            <GetSupportView
              onBack={() => setActiveView("default")}
              onSubmitted={() => setActiveView("oryxa")}
            />
          ) : null}
        </div>
      </motion.div>

      <IdentityActivationDialog
        open={identityOpen}
        onOpenChange={handleIdentityChange}
      />
    </>
  );
}
