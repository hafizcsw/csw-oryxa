import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import AnomalyOrb from "@/components/orb/AnomalyOrb";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const CAPABILITIES = ["discovery", "comparison", "decision", "automation", "trust", "global"] as const;

export function AboutOryxaSection() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = ["ar", "he", "fa", "ur"].includes(language);

  return (
    <section className="relative py-28 md:py-36 px-6 overflow-hidden bg-transparent">
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
            {t("home.aboutOryxa.badge")}
          </span>
        </motion.div>

        {/* Headline + Orb split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center mb-24">
          <div className="lg:col-span-7 order-2 lg:order-1">
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={1}
              variants={fadeUp}
              className="text-[clamp(2.4rem,6vw,5.25rem)] font-semibold tracking-[-0.025em] leading-[0.98] text-[var(--ag-fg)] mb-8"
            >
              {t("home.aboutOryxa.headline")}
            </motion.h2>

            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={2}
              variants={fadeUp}
              className="text-lg md:text-xl text-[var(--ag-muted)] max-w-xl leading-[1.6]"
            >
              {t("home.aboutOryxa.subheadline")}
            </motion.p>
          </div>

          {/* Orb */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
            variants={fadeUp}
            className="lg:col-span-5 order-1 lg:order-2 flex items-center justify-center"
          >
            <AnomalyOrb size={300} distortion={0.6} pulseSpeed={0.6} />
          </motion.div>
        </div>

        {/* Capabilities — editorial numbered list */}
        <div className="border-t border-[var(--ag-border)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((key, i) => (
              <motion.div
                key={key}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                custom={i}
                variants={fadeUp}
                className={cn(
                  "group relative py-10 px-2 md:px-6",
                  "border-b border-[var(--ag-border)]",
                  "md:[&:nth-child(odd)]:border-r lg:[&:nth-child(odd)]:border-r-0",
                  "lg:[&:not(:nth-child(3n))]:border-r border-[var(--ag-border)]"
                )}
              >
                <div className="flex items-baseline gap-4 mb-4">
                  <span className="text-xs font-mono text-[var(--ag-muted)] tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.01em] text-[var(--ag-fg)]">
                    {t(`home.aboutOryxa.capability.${key}.title`)}
                  </h3>
                </div>
                <p className="text-[15px] text-[var(--ag-muted)] leading-[1.65] pl-9">
                  {t(`home.aboutOryxa.capability.${key}.desc`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={0}
          variants={fadeUp}
          className="mt-20 flex justify-center"
        >
          <button
            onClick={() => navigate("/about-oryxa")}
            className={cn(
              "group inline-flex items-center gap-3 px-8 py-4 rounded-full",
              "border border-[var(--ag-border)] bg-transparent",
              "text-[var(--ag-fg)] text-sm font-medium tracking-wide",
              "hover:bg-[var(--ag-fg)] hover:text-[var(--ag-bg)]",
              "transition-colors duration-300"
            )}
          >
            {t("home.aboutOryxa.cta")}
            <ArrowRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-1", isRTL && "rotate-180 group-hover:-translate-x-1")} />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
