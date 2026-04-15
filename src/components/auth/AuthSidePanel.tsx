import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Building2, Brain, Eye, Check, Sparkles, ArrowUpRight } from "lucide-react";
import OryxaLogo from '@/assets/oryxa-logo-trimmed.png';
import { lazy, Suspense } from 'react';
const AnomalyOrb = lazy(() => import('@/components/orb/AnomalyOrb'));

interface AuthSidePanelProps {
  accountType: "student" | "institution";
}

function InsightCard({ accountType }: { accountType: "student" | "institution" }) {
  const { t } = useLanguage();
  const isStudent = accountType === "student";

  const insights = [
    t(isStudent ? "authSide.student.insight1" : "authSide.institution.insight1"),
    t(isStudent ? "authSide.student.insight2" : "authSide.institution.insight2"),
    t(isStudent ? "authSide.student.insight3" : "authSide.institution.insight3"),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-2xl bg-background/60 dark:bg-white/[0.06] backdrop-blur-xl border border-border dark:border-white/[0.1] p-6 relative overflow-hidden shadow-sm dark:shadow-none"
    >
      <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shadow-sm">
            {isStudent
              ? <Brain className="w-[18px] h-[18px] text-primary" />
              : <Eye className="w-[18px] h-[18px] text-primary" />
            }
          </div>
          <span className="text-sm font-bold text-foreground tracking-wide">
            {t(isStudent ? "authSide.student.cardTitle" : "authSide.institution.cardTitle")}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 dark:bg-emerald-500/15 px-2.5 py-1 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Live</span>
        </div>
      </div>

      {/* Insight rows */}
      <div className="space-y-4 relative z-10">
        {insights.map((text, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
            className="flex items-center gap-3 group"
          >
            <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground/70 dark:text-foreground/65 group-hover:text-foreground transition-colors">
              {text}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-primary/40 ms-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function AuthSidePanel({ accountType }: AuthSidePanelProps) {
  const { t } = useLanguage();
  const isStudent = accountType === "student";

  const features = [
    t(isStudent ? "authSide.student.f1" : "authSide.institution.f1"),
    t(isStudent ? "authSide.student.f2" : "authSide.institution.f2"),
    t(isStudent ? "authSide.student.f3" : "authSide.institution.f3"),
  ];

  return (
    <div className="relative h-full min-h-[600px] rounded-3xl overflow-hidden bg-muted dark:bg-[hsl(220,20%,8%)]">

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full p-8 xl:p-10">
        {/* Logo */}
        <div>
          <img src={OryxaLogo} alt="ORYXA" className="h-14 w-auto object-contain dark:brightness-125 dark:contrast-110" />
        </div>

        {/* 3D Orb */}
        <div className="flex justify-center mt-4 mb-2 overflow-visible">
          <Suspense fallback={<div className="w-[220px] h-[220px] rounded-full bg-primary/5 animate-pulse" />}>
            <AnomalyOrb size={220} distortion={0.8} pulseSpeed={0.8} />
          </Suspense>
        </div>

        {/* Main — vertically centered */}
        <div className="flex-1 flex flex-col justify-center gap-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={accountType}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-7"
            >
              {/* Intelligence card */}
              <InsightCard accountType={accountType} />

              {/* Headline + sub */}
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    {isStudent
                      ? <GraduationCap className="w-5 h-5 text-primary" />
                      : <Building2 className="w-5 h-5 text-primary" />
                    }
                  </div>
                  <span className="text-xs font-bold text-primary tracking-widest uppercase">
                    {t(isStudent ? "authSide.student.badge" : "authSide.institution.badge")}
                  </span>
                </div>

                <h2 className="text-[1.75rem] xl:text-[2.1rem] font-extrabold leading-[1.15] tracking-tight text-foreground mb-3">
                  {t(isStudent ? "authSide.student.headline" : "authSide.institution.headline")}
                </h2>
                <p className="text-sm leading-[1.7] text-foreground/50 dark:text-foreground/45 max-w-[380px]">
                  {t(isStudent ? "authSide.student.subheadline" : "authSide.institution.subheadline")}
                </p>
              </div>

              {/* Features list */}
              <div className="space-y-3.5">
                {features.map((text, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.35 + i * 0.08 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-primary" strokeWidth={3} />
                    </div>
                    <span className="text-sm font-semibold text-foreground/70 dark:text-foreground/65">{text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Trust footer */}
        <div className="border-t border-border/50 dark:border-white/[0.08] pt-5">
          <p className="text-xs text-foreground/40 dark:text-foreground/30 leading-relaxed">
            {t(isStudent ? "authSide.student.trust" : "authSide.institution.trust")}
          </p>
        </div>
      </div>
    </div>
  );
}
