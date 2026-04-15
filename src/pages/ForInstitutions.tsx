import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Building2, Handshake, Globe, Users, GraduationCap,
  CheckCircle, ArrowRight, Send, Star, TrendingUp, Shield,
  MessageSquareQuote, BarChart3, Award, HelpCircle, ChevronDown,
  Search, MapPin, Loader2, ExternalLink, FileEdit, Inbox,
  ShieldCheck, Brain, Bell, Eye, ImagePlus, Filter,
  ClipboardCheck, PieChart, LineChart
} from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { supabase } from "@/integrations/supabase/client";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

const whyPartnerIcons = [Globe, Users, TrendingUp, Shield];
const partnershipTypeIcons = [GraduationCap, Building2, Handshake];
const stepIcons = [Search, ShieldCheck, FileEdit, Inbox];

const postVerificationConfig = [
  {
    icon: ShieldCheck,
    color: "bg-emerald-500/10 dark:bg-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    featureIcons: [FileEdit, ImagePlus, Eye],
    key: "feature1",
  },
  {
    icon: Brain,
    color: "bg-primary/10 dark:bg-primary/20",
    iconColor: "text-primary",
    featureIcons: [Filter, ClipboardCheck, Bell],
    key: "feature2",
  },
  {
    icon: PieChart,
    color: "bg-amber-500/10 dark:bg-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    featureIcons: [LineChart, Globe, BarChart3],
    key: "feature3",
  },
];

interface ClaimResult {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  country_code: string | null;
  logo_url: string | null;
}

export default function ForInstitutions() {
  const { language } = useLanguage();
  const { t } = useTranslation("forInstitutions");
  const isRtl = language === "ar";

  // Claim search state
  const [claimQuery, setClaimQuery] = useState("");
  const [claimResults, setClaimResults] = useState<ClaimResult[]>([]);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimSearched, setClaimSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const searchInstitutions = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setClaimResults([]);
      setClaimSearched(false);
      return;
    }
    setClaimLoading(true);
    setClaimSearched(true);
    try {
      const { data } = await supabase
        .from("universities")
        .select("id, name, slug, city, country_code, logo_url")
        .ilike("name", `%${trimmed}%`)
        .order("name")
        .limit(5);
      setClaimResults(data || []);
    } catch {
      setClaimResults([]);
    } finally {
      setClaimLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (claimQuery.trim().length < 2) {
      setClaimResults([]);
      setClaimSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => searchInstitutions(claimQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [claimQuery, searchInstitutions]);

  return (
    <Layout>
      <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>

        {/* ── Hero ── */}
        <section className="relative py-24 md:py-32 bg-secondary text-secondary-foreground overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/30 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          </div>
          <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-semibold mb-6">
                <Building2 className="w-4 h-4" />
                {t("hero.badge")}
              </span>
            </motion.div>
            <motion.h1
              className="text-4xl md:text-6xl font-extrabold leading-tight mb-6"
              initial="hidden" animate="visible" variants={fadeUp} custom={1}
            >
              {t("hero.titlePrefix")}<span className="text-primary">{t("hero.titleHighlight")}</span>
            </motion.h1>
            <motion.p
              className="text-lg md:text-xl text-secondary-foreground/70 max-w-2xl mx-auto mb-10"
              initial="hidden" animate="visible" variants={fadeUp} custom={2}
            >
              {t("hero.subtitle")}
            </motion.p>
            <motion.div
              className="flex flex-wrap justify-center gap-4"
              initial="hidden" animate="visible" variants={fadeUp} custom={3}
            >
              <DSButton size="lg" onClick={() => window.open('mailto:partners@csworld.org?subject=Partnership Inquiry', '_blank')}>
                {t("hero.applyBtn")}
                <Send className={`w-5 h-5 ${isRtl ? 'mr-2' : 'ml-2'}`} />
              </DSButton>
              <DSButton variant="outline" size="lg" className="border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
                {t("hero.howItWorks")}
                <ArrowRight className={`w-5 h-5 ${isRtl ? 'rotate-180 mr-2' : 'ml-2'}`} />
              </DSButton>
            </motion.div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="bg-primary text-primary-foreground py-6">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-3 gap-6 text-center">
              {[
                { val: "36,000+", labelKey: "stats.universities" },
                { val: "215+", labelKey: "stats.countries" },
                { val: "38,000+", labelKey: "stats.programs" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-2xl md:text-3xl font-extrabold">{s.val}</div>
                  <div className="text-sm opacity-80">{t(s.labelKey)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Claim Your Institution ── */}
        <section className="py-20 md:py-28 bg-background">
          <div className="max-w-3xl mx-auto px-6">
            <motion.div className="text-center mb-10" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {t("claim.title")}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t("claim.subtitle")}
              </p>
            </motion.div>

            <motion.div
              className="relative"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            >
              <div className="relative flex items-center h-14 bg-card border-2 border-border rounded-2xl overflow-hidden focus-within:border-primary/50 transition-colors shadow-sm">
                <Search className="h-5 w-5 text-muted-foreground shrink-0 ms-4" />
                <input
                  type="text"
                  value={claimQuery}
                  onChange={(e) => setClaimQuery(e.target.value)}
                  placeholder={t("claim.placeholder")}
                  className="flex-1 h-full bg-transparent border-0 outline-none text-base text-foreground placeholder:text-muted-foreground px-3"
                  dir={isRtl ? "rtl" : "ltr"}
                />
                {claimLoading && <Loader2 className="h-5 w-5 text-muted-foreground animate-spin me-4 shrink-0" />}
              </div>

              {claimSearched && !claimLoading && claimResults.length > 0 && (
                <div className="mt-3 rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                  {claimResults.map((uni, idx) => (
                    <div
                      key={uni.id}
                      className={`flex items-center gap-4 px-5 py-4 ${idx !== 0 ? "border-t border-border/50" : ""} hover:bg-muted/50 transition-colors`}
                    >
                      {uni.logo_url ? (
                        <img src={uni.logo_url} alt="" className="w-10 h-10 rounded-xl object-contain bg-background border border-border shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{uni.name}</p>
                        {(uni.city || uni.country_code) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {[uni.city, uni.country_code].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <DSButton
                        size="sm"
                        onClick={() => {
                          const ref = uni.slug || uni.name.toLowerCase().replace(/\s+/g, '-');
                          window.open(
                            `mailto:partners@csworld.org?subject=${encodeURIComponent(`Claim Institution: ${uni.name}`)}&body=${encodeURIComponent(`Hello,\n\nI would like to claim management access for:\n\nInstitution: ${uni.name}\nProfile Reference: ${ref}\nCountry: ${uni.country_code || 'N/A'}\n\nI am an authorized representative of this institution. Please get in touch to verify my affiliation.\n\nBest regards.`)}`,
                            '_blank'
                          );
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                        {t("claim.claimBtn")}
                      </DSButton>
                    </div>
                  ))}
                </div>
              )}

              {claimSearched && !claimLoading && claimResults.length === 0 && claimQuery.trim().length >= 2 && (
                <div className="mt-3 rounded-2xl border border-border bg-card shadow-lg p-6 text-center">
                  <p className="text-muted-foreground mb-4">
                    {t("claim.noResults")}
                  </p>
                  <DSButton
                    variant="outline"
                    onClick={() => window.open(
                      `mailto:partners@csworld.org?subject=${encodeURIComponent(`Add New Institution: ${claimQuery}`)}&body=${encodeURIComponent(`Hello,\n\nI would like to add my institution to your platform:\n\nInstitution Name: ${claimQuery}\n\nPlease get in touch to discuss partnership opportunities.\n\nThank you.`)}`,
                      '_blank'
                    )}
                  >
                    <Send className="w-4 h-4" />
                    {t("claim.addBtn")}
                  </DSButton>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* ── Post-Verification Features ── */}
        <section className="py-20 md:py-28 bg-muted/30">
          <div className="max-w-6xl mx-auto px-6">
            <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                <ShieldCheck className="w-4 h-4" />
                {t("postVerification.badge")}
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {t("postVerification.title")}
              </h2>
              <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                {t("postVerification.subtitle")}
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-8">
              {postVerificationConfig.map((feature, i) => (
                <motion.div
                  key={i}
                  className="p-8 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-xl transition-all"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <div className={`w-16 h-16 rounded-2xl ${feature.color} flex items-center justify-center mb-6`}>
                    <feature.icon className={`w-8 h-8 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {t(`postVerification.${feature.key}.title`)}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    {t(`postVerification.${feature.key}.desc`)}
                  </p>
                  <ul className="space-y-3">
                    {feature.featureIcons.map((FIcon, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <FIcon className="w-4 h-4 text-foreground/70" />
                        </div>
                        <span className="text-sm text-foreground/80">{t(`postVerification.${feature.key}.f${j + 1}`)}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Partner With Us ── */}
        <section className="py-20 md:py-28 bg-background">
          <div className="max-w-6xl mx-auto px-6">
            <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {t("whyPartner.title")}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t("whyPartner.subtitle")}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6">
              {whyPartnerIcons.map((Icon, i) => (
                <motion.div
                  key={i}
                  className="flex gap-5 p-6 rounded-2xl border border-border bg-card hover:shadow-lg transition-shadow"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">{t(`whyPartner.item${i + 1}.title`)}</h3>
                    <p className="text-muted-foreground text-sm">{t(`whyPartner.item${i + 1}.desc`)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Partnership Types ── */}
        <section className="py-20 md:py-28 bg-muted/30">
          <div className="max-w-6xl mx-auto px-6">
            <motion.div className="text-center mb-14" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {t("partnershipTypes.title")}
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {partnershipTypeIcons.map((Icon, i) => (
                <motion.div
                  key={i}
                  className="p-8 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all text-center"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{t(`partnershipTypes.type${i + 1}.title`)}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{t(`partnershipTypes.type${i + 1}.desc`)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="py-20 md:py-28 bg-background">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {t("howItWorks.title")}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t("howItWorks.subtitle")}
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {stepIcons.map((StepIcon, i) => (
                <motion.div
                  key={i}
                  className="relative p-6 rounded-2xl border border-border bg-card text-center group hover:border-primary/30 hover:shadow-lg transition-all"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <div className="relative mx-auto mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                      <StepIcon className="w-7 h-7 text-primary" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{t(`howItWorks.step${i + 1}.title`)}</h3>
                  <p className="text-muted-foreground text-sm">{t(`howItWorks.step${i + 1}.desc`)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Success Metrics ── */}
        <section className="py-20 md:py-28 bg-muted/30">
          <div className="max-w-6xl mx-auto px-6">
            <motion.div className="text-center mb-14" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {t("metrics.title")}
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t("metrics.subtitle")}
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[Users, BarChart3, Award, Globe].map((StatIcon, i) => (
                <motion.div
                  key={i}
                  className="p-6 rounded-2xl border border-border bg-card text-center"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <StatIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-3xl font-extrabold text-primary mb-1">{t(`metrics.m${i + 1}.val`)}</div>
                  <div className="text-muted-foreground text-sm">{t(`metrics.m${i + 1}.label`)}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-20 md:py-28 bg-muted/30">
          <div className="max-w-4xl mx-auto px-6">
            <motion.div className="text-center mb-14" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                {t("faq.title")}
              </h2>
            </motion.div>

            <div className="space-y-4">
              {[1, 2, 3, 4].map((n, i) => (
                <motion.details
                  key={i}
                  className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer"
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                >
                  <summary className="flex items-center justify-between font-bold text-foreground list-none">
                    <span>{t(`faq.q${n}.q`)}</span>
                    <ChevronDown className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0" />
                  </summary>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    {t(`faq.q${n}.a`)}
                  </p>
                </motion.details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20 bg-secondary text-secondary-foreground">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <motion.h2
              className="text-3xl md:text-4xl font-extrabold mb-4"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            >
              {t("cta.title")}
            </motion.h2>
            <motion.p
              className="text-secondary-foreground/70 text-lg mb-8"
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
            >
              {t("cta.subtitle")}
            </motion.p>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}>
              <DSButton
                size="lg"
                onClick={() => window.open('mailto:partners@csworld.org?subject=Partnership Inquiry', '_blank')}
              >
                <Send className={`w-5 h-5 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                {t("cta.button")}
              </DSButton>
            </motion.div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
