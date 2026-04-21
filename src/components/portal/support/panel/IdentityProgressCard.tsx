import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { IdentityStatusReadback, IdentityStatus } from "@/api/identitySupportInvoke";
import { IDENTITY_VARIANTS, TONE_CLASSES } from "../identity/identityStatusVariants";

interface IdentityProgressCardProps {
  status: IdentityStatusReadback;
  onAction: () => void;
}

const STEP_BY_STATE: Record<IdentityStatus, { current: number; total: number }> = {
  none: { current: 0, total: 3 },
  pending: { current: 1, total: 3 },
  reupload_required: { current: 2, total: 3 },
  approved: { current: 3, total: 3 },
  rejected: { current: 1, total: 3 },
};

export function IdentityProgressCard({ status, onAction }: IdentityProgressCardProps) {
  const { t, language } = useLanguage();
  const reduced = useReducedMotion();
  const isRtl = language === "ar";
  const variant = IDENTITY_VARIANTS[status.identity_status];
  const tone = TONE_CLASSES[variant.tone];
  const { current, total } = STEP_BY_STATE[status.identity_status];
  const pct = (current / total) * 100;

  const showReason =
    (status.identity_status === "rejected" || status.identity_status === "reupload_required") &&
    !!status.decision_reason_code;

  return (
    <button
      type="button"
      onClick={onAction}
      className={cn(
        "w-full text-start rounded-2xl bg-card border border-border/50 p-4",
        "hover:bg-muted/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {t("portal.support.panel.kycTitle")}
        </span>
        <ChevronRight
          className={cn("h-4 w-4 text-muted-foreground", isRtl && "rotate-180")}
          strokeWidth={2.25}
        />
      </div>

      {/* Progress + step counter */}
      <div className="mt-3 flex items-center gap-2.5">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={reduced ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
            className={cn("h-full rounded-full", tone.dot)}
          />
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0">
          {t("portal.support.panel.kycStep", { current, total })}
        </span>
      </div>

      {/* Status title + reason chip */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className={cn("text-xs font-medium truncate", tone.iconColor)}>
          {t(variant.titleKey)}
        </span>
        {showReason && (
          <span
            className={cn(
              "shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium",
              "bg-warning/15 text-warning",
            )}
          >
            {t("portal.support.panel.kycReasonChip")}
          </span>
        )}
      </div>

      {/* Carousel dots (decorative) */}
      <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i < current ? cn("w-4", tone.dot) : "w-1.5 bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
    </button>
  );
}
