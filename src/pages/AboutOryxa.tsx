import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import {
  Sparkles,
  Layers,
  TrendingUp,
  Award,
  Brain,
  Eye,
  Target,
  Compass,
  Shield,
  ArrowRight,
  GraduationCap,
  DollarSign,
  Briefcase,
  Globe,
  Heart,
  Lightbulb,
  BarChart3,
  Users,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AnomalyOrb from "@/components/orb/AnomalyOrb";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

export default function AboutOryxa() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const flowSteps = [
    { icon: Layers, key: "country" },
    { icon: TrendingUp, key: "university" },
    { icon: Award, key: "program" },
    { icon: Brain, key: "student" },
    { icon: Target, key: "match" },
  ];

  const dimensionGroups = [
    {
      key: "academic",
      icon: GraduationCap,
      dims: ["gpa", "curriculum", "language", "certificates"],
    },
    {
      key: "career",
      icon: Briefcase,
      dims: ["direction", "market", "transferability", "aiReadiness"],
    },
    {
      key: "financial",
      icon: DollarSign,
      dims: ["tuition", "living", "workDuringStudy", "scholarships"],
    },
    {
      key: "environment",
      icon: Globe,
      dims: ["safety", "climate", "culture", "postGrad"],
    },
    {
      key: "personal",
      icon: Heart,
      dims: ["lifestyle", "community", "support", "flexibility"],
    },
    {
      key: "future",
      icon: Lightbulb,
      dims: ["programAge", "industryLink", "innovation", "globalMobility"],
    },
  ];

  const contrasts = [
    { key: "search", icon: Compass },
    { key: "reputation", icon: BarChart3 },
    { key: "noise", icon: Users },
  ];

  return (
    <Layout>

      {/* ====== HERO ====== */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 start-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute top-20 start-1/4 w-[500px] h-[500px] bg-primary/[0.04] rounded-full blur-[150px]" />
          <div className="absolute bottom-10 end-1/4 w-[400px] h-[400px] bg-primary/[0.03] rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-start">
              <motion.div
                initial="hidden"
                animate="visible"
                custom={0}
                variants={fadeUp}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold mb-6"
              >
                <Sparkles className="h-4 w-4" />
                {t("aboutOryxa.hero.badge")}
              </motion.div>

              <motion.h1
                initial="hidden"
                animate="visible"
                custom={1}
                variants={fadeUp}
                className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground tracking-tight mb-6 leading-tight"
              >
                {t("aboutOryxa.hero.headline")}
              </motion.h1>

              <motion.p
                initial="hidden"
                animate="visible"
                custom={2}
                variants={fadeUp}
                className="text-lg text-muted-foreground max-w-xl leading-relaxed"
              >
                {t("aboutOryxa.hero.subheadline")}
              </motion.p>
            </div>

            <motion.div
              initial="hidden"
              animate="visible"
              custom={1}
              variants={fadeUp}
              className="flex-shrink-0"
            >
              <AnomalyOrb size={300} distortion={0.5} pulseSpeed={0.5} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ====== HOW ORYXA WORKS ====== */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-4">
              {t("aboutOryxa.flow.headline")}
            </h2>
            <p className="text-muted-foreground text-base max-w-2xl mx-auto">
              {t("aboutOryxa.flow.subheadline")}
            </p>
          </motion.div>

          <div className="space-y-4">
            {flowSteps.map(({ icon: Icon, key }, i) => (
              <motion.div
                key={key}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="flex items-center gap-5 p-5 rounded-xl border border-border/50 bg-card/60 hover:border-primary/20 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-primary/60 uppercase tracking-wider">
                    {t(`aboutOryxa.flow.step.${key}.label`)}
                  </span>
                  <h3 className="text-base font-bold text-foreground">
                    {t(`aboutOryxa.flow.step.${key}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`aboutOryxa.flow.step.${key}.desc`)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== 56 DIMENSIONS ====== */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold mb-5">
              <Shield className="h-4 w-4" />
              {t("aboutOryxa.dimensions.badge")}
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-4">
              {t("aboutOryxa.dimensions.headline")}
            </h2>
            <p className="text-muted-foreground text-base max-w-2xl mx-auto">
              {t("aboutOryxa.dimensions.subheadline")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dimensionGroups.map(({ key, icon: Icon, dims }, i) => (
              <motion.div
                key={key}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="rounded-2xl border border-border/50 bg-card/80 p-6 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {t(`aboutOryxa.dimensions.group.${key}.title`)}
                  </h3>
                </div>
                <ul className="space-y-2">
                  {dims.map((dim) => (
                    <li key={dim} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                      {t(`aboutOryxa.dimensions.group.${key}.dim.${dim}`)}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== WHY DIFFERENT ====== */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-4">
              {t("aboutOryxa.different.headline")}
            </h2>
            <p className="text-muted-foreground text-base max-w-2xl mx-auto">
              {t("aboutOryxa.different.subheadline")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {contrasts.map(({ key, icon: Icon }, i) => (
              <motion.div
                key={key}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="rounded-2xl border border-border/50 bg-card/60 p-7"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">
                  {t(`aboutOryxa.different.point.${key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`aboutOryxa.different.point.${key}.desc`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== AI ERA ====== */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            variants={fadeUp}
            className="rounded-2xl border border-border/50 bg-card p-10 md:p-14 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Zap className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mb-4">
              {t("aboutOryxa.aiEra.headline")}
            </h2>
            <p className="text-muted-foreground text-base max-w-2xl mx-auto leading-relaxed mb-8">
              {t("aboutOryxa.aiEra.body")}
            </p>
            <button
              onClick={() => navigate("/universities")}
              className={cn(
                "inline-flex items-center gap-2 px-8 py-3.5 rounded-full",
                "bg-primary text-primary-foreground font-bold text-sm",
                "hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
              )}
            >
              {t("aboutOryxa.cta")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

    </Layout>
  );
}
