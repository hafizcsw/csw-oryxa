import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { IdentityStatusReadback } from "@/api/identitySupportInvoke";
import { Button } from "@/components/ui/button";
import { IDENTITY_VARIANTS, TONE_CLASSES } from "../identity/identityStatusVariants";
import { cn } from "@/lib/utils";

interface IdentityStatusCardProps {
  status: IdentityStatusReadback;
  onAction: () => void;
}

export function IdentityStatusCard({ status, onAction }: IdentityStatusCardProps) {
  const { t, language } = useLanguage();
  const reduced = useReducedMotion();
  const isRtl = language === "ar";

  const variant = IDENTITY_VARIANTS[status.identity_status];
  const tone = TONE_CLASSES[variant.tone];
  const Icon = variant.icon;

  // Reason text via locale (never raw code)
  const reasonText = status.decision_reason_code
    ? t(`portal.support.reasons.${status.decision_reason_code}`, {
        defaultValue: t("portal.support.identity.reasonFallback"),
      })
    : null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status.identity_status}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "relative rounded-2xl border border-border/60 bg-card p-4",
          "ring-1",
          tone.ring,
          "border-s-4",
          tone.border,
        )}
      >
        <div className="flex items-start gap-3">
          <motion.span
            className={cn(
              "shrink-0 h-10 w-10 rounded-full flex items-center justify-center",
              tone.iconWrap,
              tone.iconColor,
            )}
            animate={
              variant.iconSpinSlow && !reduced
                ? { rotate: isRtl ? -360 : 360 }
                : undefined
            }
            transition={
              variant.iconSpinSlow && !reduced
                ? { duration: 8, repeat: Infinity, ease: "linear" }
                : undefined
            }
          >
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </motion.span>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground leading-tight">
              {t(variant.titleKey)}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t(variant.bodyKey)}
            </p>

            {reasonText && (
              <div className="mt-3 rounded-lg bg-muted/50 border border-border/40 p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  {t("portal.support.identity.reasonLabel")}
                </div>
                <div className="text-xs text-foreground">{reasonText}</div>

                {status.reupload_required_fields && status.reupload_required_fields.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/40">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      {t("portal.support.identity.fieldsLabel")}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {status.reupload_required_fields.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-background border border-border/60 text-[10px] font-medium text-foreground"
                        >
                          {t(`portal.support.reasons.${f}`, { defaultValue: f })}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {variant.showCta && variant.ctaKey && (
              <Button
                onClick={onAction}
                size="sm"
                className={cn("mt-3 h-8 rounded-lg text-xs font-medium gap-1.5", tone.ctaClass)}
              >
                {t(variant.ctaKey)}
                <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} strokeWidth={2.5} />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
