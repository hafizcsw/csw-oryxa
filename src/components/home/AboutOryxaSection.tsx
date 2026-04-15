import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Compass, BarChart3, Target, Brain, Zap, Shield, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import AnomalyOrb from "@/components/orb/AnomalyOrb";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

export function AboutOryxaSection() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const capabilities = [
    { icon: Brain, key: "discovery", color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: BarChart3, key: "comparison", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: Target, key: "decision", color: "text-amber-400", bg: "bg-amber-500/10" },
    { icon: Zap, key: "automation", color: "text-purple-400", bg: "bg-purple-500/10" },
    { icon: Shield, key: "trust", color: "text-rose-400", bg: "bg-rose-500/10" },
    { icon: Globe, key: "global", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  ];

  return (
    <section className="relative py-24 px-6 overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            custom={0}
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold tracking-wide mb-5"
          >
            <Sparkles className="h-4 w-4" />
            {t("home.aboutOryxa.badge")}
          </motion.div>

          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            variants={fadeUp}
            className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight mb-5"
          >
            {t("home.aboutOryxa.headline")}
          </motion.h2>

          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={2}
            variants={fadeUp}
            className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            {t("home.aboutOryxa.subheadline")}
          </motion.p>
        </div>

        {/* Orb centered + Capabilities grid below */}
        <div className="flex flex-col items-center gap-14">
          {/* Orb */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
            className="relative"
          >
            <AnomalyOrb size={220} distortion={0.6} pulseSpeed={0.6} />
          </motion.div>

          {/* Capabilities Grid - 3x2 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
            {capabilities.map(({ icon: Icon, key, color, bg }, i) => (
              <motion.div
                key={key}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i + 1}
                variants={fadeUp}
                className="group relative p-4 rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:bg-card/80 transition-all duration-300"
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", bg)}>
                  <Icon className={cn("w-4 h-4", color)} />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-2">
                  {t(`home.aboutOryxa.capability.${key}.title`)}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
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
          className="text-center mt-12"
        >
          <button
            onClick={() => navigate("/about-oryxa")}
            className={cn(
              "inline-flex items-center gap-2 px-7 py-3 rounded-full",
              "bg-primary text-primary-foreground font-bold text-sm",
              "hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
            )}
          >
            {t("home.aboutOryxa.cta")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
