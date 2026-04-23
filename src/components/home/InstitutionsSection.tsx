import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Users, BarChart3, ShieldCheck, Globe, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Building2, key: "manage" },
  { icon: Users, key: "students" },
  { icon: BarChart3, key: "analytics" },
  { icon: ShieldCheck, key: "verified" },
  { icon: Globe, key: "visibility" },
  { icon: Handshake, key: "partnership" },
] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function InstitutionsSection() {
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
            {t("home.institutions.badge")}
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
            className="lg:col-span-8 text-[clamp(2.4rem,6vw,5.25rem)] font-semibold tracking-[-0.025em] leading-[0.98] text-[var(--ag-fg)]"
          >
            {t("home.institutions.title")}
          </motion.h2>

          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
            variants={fadeUp}
            className="lg:col-span-4 text-base md:text-lg text-[var(--ag-muted)] leading-[1.7]"
          >
            {t("home.institutions.subtitle")}
          </motion.p>
        </div>

        {/* Features — editorial grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-[var(--ag-border)]">
          {FEATURES.map(({ icon: Icon, key }, i) => (
            <motion.div
              key={key}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              custom={i}
              variants={fadeUp}
              className={cn(
                "group p-8 transition-colors duration-300",
                "border-b border-[var(--ag-border)]",
                "md:[&:nth-child(odd)]:border-r lg:[&:nth-child(odd)]:border-r-0",
                "lg:[&:not(:nth-child(3n))]:border-r border-[var(--ag-border)]",
                "hover:bg-[color-mix(in_srgb,var(--ag-fg)_4%,transparent)]"
              )}
            >
              <div className="flex items-baseline gap-4 mb-5">
                <span className="text-xs font-mono text-[var(--ag-muted)] tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Icon className="w-5 h-5 text-[var(--ag-fg)]" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.01em] text-[var(--ag-fg)] mb-3">
                {t(`home.institutions.features.${key}.title`)}
              </h3>
              <p className="text-[15px] text-[var(--ag-muted)] leading-[1.65]">
                {t(`home.institutions.features.${key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA pair */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={0}
          variants={fadeUp}
          className="mt-16 flex flex-wrap justify-center items-center gap-4"
        >
          <button
            onClick={() => navigate("/auth")}
            className={cn(
              "group inline-flex items-center gap-3 px-8 py-4 rounded-full",
              "bg-[var(--ag-fg)] text-[var(--ag-bg)] text-sm font-medium tracking-wide",
              "hover:opacity-90 transition-opacity"
            )}
          >
            {t("home.institutions.cta")}
            <ArrowRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-1", isRTL && "rotate-180 group-hover:-translate-x-1")} />
          </button>
          <button
            onClick={() => navigate("/explore-map")}
            className={cn(
              "group inline-flex items-center gap-3 px-8 py-4 rounded-full",
              "border border-[var(--ag-border)] bg-transparent",
              "text-[var(--ag-fg)] text-sm font-medium tracking-wide",
              "hover:bg-[var(--ag-fg)] hover:text-[var(--ag-bg)]",
              "transition-colors duration-300"
            )}
          >
            <Globe className="w-4 h-4" strokeWidth={1.5} />
            {t("home.institutions.exploreMap")}
          </button>
        </motion.div>
      </div>
    </section>
  );
}
