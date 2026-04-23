import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PILLARS = [
  { key: "country" as const, weight: 20 },
  { key: "university" as const, weight: 35 },
  { key: "program" as const, weight: 45 },
] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function OrxRankSection() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = ["ar", "he", "fa", "ur"].includes(language);

  return (
    <section className="relative py-28 md:py-36 px-6 bg-transparent overflow-hidden">
      <div className="max-w-[1280px] mx-auto">
        {/* Eyebrow */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          custom={0}
          variants={fadeUp}
          className="flex items-center gap-3 mb-10"
        >
          <span className="h-px w-10 bg-[var(--ag-border)]" />
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--ag-muted)]">
            {t("home.orx.badge")}
          </span>
        </motion.div>

        {/* Editorial headline split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end mb-20">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            variants={fadeUp}
            className="lg:col-span-8 text-[clamp(2.6rem,7vw,6rem)] font-semibold tracking-[-0.03em] leading-[0.92] text-[var(--ag-fg)]"
          >
            ORX RANK
          </motion.h2>

          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
            variants={fadeUp}
            className="lg:col-span-4 text-base md:text-lg text-[var(--ag-muted)] leading-[1.7]"
          >
            {t("home.orx.subtitle")}
          </motion.p>
        </div>

        {/* Three pillars — editorial weighted bars */}
        <div className="border-t border-[var(--ag-border)]">
          {PILLARS.map(({ key, weight }, i) => (
            <motion.div
              key={key}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              custom={i}
              variants={fadeUp}
              className="group grid grid-cols-12 gap-6 md:gap-10 items-start py-10 md:py-14 border-b border-[var(--ag-border)]"
            >
              {/* Number */}
              <div className="col-span-2 md:col-span-1">
                <span className="text-xs font-mono text-[var(--ag-muted)] tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>

              {/* Title */}
              <div className="col-span-10 md:col-span-4">
                <h3 className="text-2xl md:text-3xl font-semibold tracking-[-0.015em] text-[var(--ag-fg)]">
                  {t(`home.orx.pillars.${key}.title`)}
                </h3>
              </div>

              {/* Description */}
              <div className="col-span-12 md:col-span-5">
                <p className="text-[15px] text-[var(--ag-muted)] leading-[1.7]">
                  {t(`home.orx.pillars.${key}.desc`)}
                </p>
              </div>

              {/* Weight + bar */}
              <div className="col-span-12 md:col-span-2">
                <div className="flex md:flex-col md:items-end items-center gap-3 md:gap-2">
                  <div className="text-3xl md:text-4xl font-semibold tracking-tight text-[var(--ag-fg)] tabular-nums">
                    {weight}
                    <span className="text-[var(--ag-muted)] text-xl">%</span>
                  </div>
                  <div className="flex-1 md:w-full h-px bg-[var(--ag-border)] relative overflow-hidden">
                    <motion.span
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: weight / 100 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                      style={{ transformOrigin: isRTL ? "right" : "left" }}
                      className="absolute inset-0 bg-[var(--ag-fg)]"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={0}
          variants={fadeUp}
          className="mt-16 flex justify-center"
        >
          <button
            onClick={() => navigate("/orx-rank")}
            className={cn(
              "group inline-flex items-center gap-3 px-8 py-4 rounded-full",
              "bg-[var(--ag-fg)] text-[var(--ag-bg)] text-sm font-medium tracking-wide",
              "hover:opacity-90 transition-opacity"
            )}
          >
            {t("home.orx.cta")}
            <ArrowRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-1", isRTL && "rotate-180 group-hover:-translate-x-1")} />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
