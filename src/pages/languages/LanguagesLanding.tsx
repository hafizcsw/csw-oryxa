import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import {
  Globe, BookOpen, GraduationCap, ArrowLeft, ArrowRight, Sparkles,
  Users, Bot, ClipboardCheck, BarChart3, Brain, Target, CheckCircle,
  Headphones, Zap, Star, MessageCircle, Award, ChevronDown, Shield
} from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { translateLanguageCourseValue } from "@/lib/languageCourseI18n";
import heroStudentImg from "@/assets/languages-hero-student.jpg";
import { TeacherCard } from "@/components/languages/TeacherCard";
import { TeacherFilters } from "@/components/languages/TeacherFilters";
import { MOCK_TEACHERS } from "@/components/languages/teacherData";
import { useRealTeacherAvatars } from "@/hooks/useRealTeacherAvatars";
import { LazyMount } from "@/components/perf/LazyMount";

interface LanguageCard {
  id: string;
  nameKey: string;
  descKey: string;
  flag: string;
  route: string;
  active: boolean;
}

const LANGUAGES: LanguageCard[] = [
  { id: "russian", nameKey: "languages.catalog.russian.name", descKey: "languages.catalog.russian.desc", flag: "🇷🇺", route: "/languages/russian", active: true },
  { id: "english", nameKey: "languages.catalog.english.name", descKey: "languages.catalog.english.desc", flag: "🇬🇧", route: "/languages/english", active: false },
  { id: "turkish", nameKey: "languages.catalog.turkish.name", descKey: "languages.catalog.turkish.desc", flag: "🇹🇷", route: "/languages/turkish", active: false },
  { id: "french", nameKey: "languages.catalog.french.name", descKey: "languages.catalog.french.desc", flag: "🇫🇷", route: "/languages/french", active: false },
  { id: "german", nameKey: "languages.catalog.german.name", descKey: "languages.catalog.german.desc", flag: "🇩🇪", route: "/languages/german", active: false },
  { id: "chinese", nameKey: "languages.catalog.chinese.name", descKey: "languages.catalog.chinese.desc", flag: "🇨🇳", route: "/languages/chinese", active: false },
];

const STEPS_ICONS = [ClipboardCheck, BookOpen, GraduationCap];

export default function LanguagesLanding() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isRtl = language === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const formatProductLabel = (key: string) => translateLanguageCourseValue(t, `languages.product.${key}`, key);
  const teachers = useRealTeacherAvatars(MOCK_TEACHERS);

  return (
    <Layout>
      <div className="min-h-[80vh] bg-background">

        {/* ═══════════════════ HERO — Preply-style split ═══════════════════ */}
        <section className="relative bg-background py-12 lg:py-20">
          <div className="max-w-6xl mx-auto px-4">
            <div className={cn(
              "flex flex-col-reverse lg:flex-row items-center gap-10 lg:gap-16",
              isRtl && "lg:flex-row-reverse"
            )}>

              {/* ── Image side with floating tutor card ── */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="relative w-full lg:w-[48%] shrink-0"
              >
                <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[4/5] max-h-[560px]">
                  <img
                    src={heroStudentImg}
                    alt=""
                    className="w-full h-full object-cover"
                    width={1024}
                    height={1024}
                  />
                  {/* Student label badge */}
                  <div className="absolute bottom-28 end-4 bg-background/95 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-lg text-sm font-semibold text-foreground">
                    {t("languages.hero.studentLabel")}
                  </div>
                </div>

                {/* Floating tutor card — Preply style */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="absolute -bottom-6 start-4 bg-background rounded-2xl shadow-xl border border-border p-4 flex items-center gap-4 min-w-[260px]"
                >
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-2xl shrink-0">
                    🇷🇺
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-foreground text-sm">ORYXA</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                        {t("languages.hero.tutorBadge")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">200 {t("languages.hero.tutorLessons")}</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        4.9
                      </span>
                      <span>84 {t("languages.hero.tutorReviews")}</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* ── Text side ── */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex-1 text-start"
              >
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground mb-5 leading-[1.2]">
                  {t("languages.hero.title")}
                </h1>
                <p className="text-base text-muted-foreground mb-6 max-w-lg leading-relaxed">
                  {t("languages.hero.subtitle")}
                </p>

                {/* Match prompt */}
                <p className="text-sm text-foreground/70 mb-4">
                  {t("languages.hero.matchPrompt")}
                </p>

                {/* Language selector — Preply style */}
                <div className="relative mb-4 max-w-md">
                  <select
                    className="w-full appearance-none bg-background border-2 border-border rounded-xl px-5 py-3.5 text-base font-medium text-foreground focus:border-primary focus:outline-none transition-colors cursor-pointer"
                    defaultValue="russian"
                    onChange={(e) => navigate(`/languages/${e.target.value}`)}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id} disabled={!lang.active}>
                        {lang.flag} {t(lang.nameKey)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute end-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                </div>

                {/* CTA Button — pink like Preply */}
                <DSButton
                  size="lg"
                  onClick={() => navigate("/languages/russian")}
                  className="w-full max-w-md gap-2 text-base px-8 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white shadow-[0_4px_14px_-2px_rgba(236,72,153,0.4)] hover:shadow-[0_6px_20px_-2px_rgba(236,72,153,0.55)]"
                >
                  {t("languages.hero.ctaLabel")}
                  <Arrow className="w-5 h-5" />
                </DSButton>

                {/* Show count */}
                <p className="text-sm text-muted-foreground mt-3 text-center max-w-md">
                  {t("languages.hero.showTutors")}
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══ SOCIAL PROOF BAR ═══ */}
        <section className="border-y border-border bg-muted/20">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">{t("languages.socialProof.students")}</span>
              </span>
              <span className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <span className="font-semibold text-foreground">{t("languages.socialProof.rating")}</span>
              </span>
              <span className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">{t("languages.socialProof.certified")}</span>
              </span>
            </motion.div>
          </div>
        </section>

        {/* ═══ TEACHER LISTING — Preply-style ═══ */}
        <section className="max-w-6xl mx-auto px-4 py-12">
          {/* Filters */}
          <TeacherFilters />

          {/* Count header */}
          <h2 className="text-xl md:text-2xl font-bold text-foreground mt-8 mb-6">
            {t("languages.teachers.count", { count: teachers.length })}
          </h2>

          {/* Teacher cards */}
          <div className="space-y-4">
            {teachers.slice(0, 3).map((teacher, i) => (
              <TeacherCard key={teacher.id} teacher={teacher} index={i} />
            ))}
            {/* Reassurance banner — like Preply */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-4 bg-muted/40 border border-border rounded-2xl p-5"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground text-sm mb-0.5">
                  {t("languages.teachers.reassuranceTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("languages.teachers.reassurance")}
                </p>
              </div>
            </motion.div>

            {teachers.slice(3).map((teacher, i) => (
              <LazyMount key={teacher.id} minHeight={180} rootMargin="500px 0px">
                <TeacherCard teacher={teacher} index={i + 3} />
              </LazyMount>
            ))}
          </div>
        </section>


        <LazyMount minHeight={400} rootMargin="500px 0px">
        <section className="max-w-5xl mx-auto px-4 py-16">
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("languages.steps.subtitle")}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((step, i) => {
              const Icon = STEPS_ICONS[i];
              return (
                <motion.div key={step}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * i }}
                  className="relative bg-card border border-border rounded-2xl p-6 text-center"
                >
                  <div className="absolute -top-4 start-1/2 -translate-x-1/2">
                    <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold inline-flex items-center justify-center shadow-lg shadow-primary/20">
                      {step}
                    </span>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mt-4 mb-4">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-2">
                    {t(`languages.steps.step${step}Title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`languages.steps.step${step}Desc`)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ═══ FEATURED RUSSIAN ═══ */}
        <section className="max-w-5xl mx-auto px-4 mb-16 relative z-20">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            onClick={() => navigate("/languages/russian")}
            className="relative cursor-pointer group rounded-2xl border-2 border-primary/30 bg-card p-8 md:p-10 shadow-xl hover:shadow-2xl hover:border-primary/60 transition-all">
            <div className="absolute top-4 end-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-primary text-primary-foreground">
                <Sparkles className="w-3 h-3" />
                {t("languages.featured")}
              </span>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
              <div className="text-7xl md:text-8xl shrink-0">🇷🇺</div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                  {t("languages.catalog.russian.name")}
                </h2>
                <p className="text-muted-foreground mb-4 max-w-xl">
                  {t("languages.catalog.russian.desc")}
                </p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {["languages.russianTags.prep", "languages.russianTags.university", "languages.russianTags.life"].map((key, i) => (
                    <span key={i} className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {t(key)}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    {t("languages.product.freePlacement")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    {t("languages.product.humanTeachers")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-violet-500" />
                    {t("languages.product.aiSupport")}
                  </span>
                </div>
                <DSButton size="lg" className="gap-2 text-base px-8">
                  {t("languages.startLearning")}
                  <Arrow className="w-5 h-5" />
                </DSButton>
              </div>
            </div>
          </motion.div>
        </section>


        {/* ═══ WHAT YOU GET ═══ */}
        <section className="bg-muted/30 py-16 mb-16">
          <div className="max-w-5xl mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                {t("languages.product.includesTitle")}
              </h2>
            </motion.div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: BookOpen, key: "courseStructured" },
                { icon: Brain, key: "courseVocab" },
                { icon: ClipboardCheck, key: "courseAssignments" },
                { icon: BarChart3, key: "courseProgress" },
                { icon: Target, key: "courseExams" },
                { icon: Headphones, key: "courseListening" },
              ].map(({ icon: Icon, key }, i) => (
                <motion.div key={key} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: 0.04 * i }}
                  className="flex items-start gap-3 bg-card border border-border rounded-xl p-5">
                  <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{translateLanguageCourseValue(t, `languages.product.${key}Title`, key)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{translateLanguageCourseValue(t, `languages.product.${key}Desc`, key)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TESTIMONIAL ═══ */}
        <section className="max-w-3xl mx-auto px-4 mb-20">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl p-8 text-center relative">
            <div className="absolute -top-4 start-1/2 -translate-x-1/2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-base md:text-lg text-foreground italic leading-relaxed mb-4 mt-2">
              "{t("languages.testimonial.quote")}"
            </p>
            <div className="flex items-center justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />
              ))}
            </div>
            <p className="text-sm font-semibold text-foreground">{t("languages.testimonial.author")}</p>
            <p className="text-xs text-muted-foreground">{t("languages.testimonial.role")}</p>
          </motion.div>
        </section>

        {/* ═══ PRICING — 3 Tiers: $250 / $500 / $750 ═══ */}
        <section className="max-w-5xl mx-auto px-4 mb-20">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              {t("languages.product.pricingTitle")}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {(t("languages.product.tiers", { returnObjects: true }) as Array<{ name: string; price: string; period: string; badge: string; items: string[] }>).map((tier, i) => {
              const isPopular = i === 1;
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.06 * i }}
                  className={cn(
                    "bg-card rounded-2xl p-7 flex flex-col relative",
                    isPopular
                      ? "border-2 border-primary shadow-xl scale-[1.03]"
                      : "border border-border"
                  )}
                >
                  {tier.badge && (
                    <div className="absolute -top-3 start-1/2 -translate-x-1/2">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap",
                        isPopular
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground border border-border"
                      )}>
                        {tier.badge}
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-5 mt-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {tier.name}
                    </span>
                    <p className="text-4xl font-extrabold text-foreground mt-2">{tier.price}</p>
                    <p className="text-xs text-muted-foreground mt-1">{tier.period}</p>
                  </div>

                  <ul className="space-y-3 mb-6 flex-1">
                    {tier.items.map((item, j) => (
                      <li key={j} className="flex items-center gap-2.5 text-sm text-foreground">
                        <CheckCircle className={cn(
                          "w-4 h-4 shrink-0",
                          isPopular ? "text-primary" : "text-emerald-500"
                        )} />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <DSButton
                    variant={isPopular ? "primary" : "outline"}
                    className="w-full"
                    onClick={() => navigate("/languages/russian/onboarding")}
                  >
                    {t("languages.product.getStarted")}
                  </DSButton>
                </motion.div>
              );
            })}
          </div>
        </section>

      </div>
    </Layout>
  );
}
