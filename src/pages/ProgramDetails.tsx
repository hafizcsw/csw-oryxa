import { useParams, Link, useNavigate } from "react-router-dom";
import { trackPageView, trackEntityView } from "@/lib/decisionTracking";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { DSButton } from "@/components/design-system/DSButton";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentDocuments } from "@/hooks/useStudentDocuments";
import { useQualificationGates } from "@/hooks/useQualificationGates";
import { useIntakeApi } from "@/hooks/useIntakeApi";
import { useFileQuality } from "@/hooks/useFileQuality";
import { QualificationGateGuard } from "@/components/qualification/QualificationGateGuard";
import { AdmissionTruthBlock } from "@/components/readiness/AdmissionTruthBlock";
import { DecisionBlocks } from "@/components/readiness/DecisionBlocks";
import { buildProgramTruthData, buildProgramDecisionData, buildProgramRequirementContext } from "@/features/readiness/truthHelpers";
import { SEOHead } from "@/components/seo/SEOHead";
import { generateProgramSchema, generateBreadcrumbSchema } from "@/utils/seo/schemas";
import { HeartButton } from "@/components/shortlist/HeartButton";
import { ProgramCard } from "@/components/ProgramCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  MapPin, GraduationCap, Calendar, Loader2, Globe, DollarSign, BookOpen, Award,
  Clock, Send, MessageCircle, ChevronRight, ChevronDown, Briefcase, Shield, Star, Home
} from "lucide-react";
import { UniversityLocationMap } from "@/components/university/UniversityLocationMap";
import { SocialShareBar } from "@/components/SocialShareBar";
import { OrxEnrichmentSection } from "@/components/orx/OrxEnrichmentSection";
import { OrxRankCard } from "@/components/orx/OrxRankCard";
import { OrxExplainPanel } from "@/components/orx/OrxExplainPanel";
import { OrxAdminStrip } from "@/components/orx/OrxAdminStrip";
import { useOrxScore } from "@/hooks/useOrxScore";
import "@/styles/university-hero.css";

// money function is now inside the component to use currency context

export default function ProgramDetails() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [applyDialog, setApplyDialog] = useState(false);
  const [inquiryDialog, setInquiryDialog] = useState(false);
  const [phone, setPhone] = useState("");
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [stickyVisible, setStickyVisible] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [inquiryLoading, setInquiryLoading] = useState(false);

  // File quality gates
  const { crmProfile } = useStudentProfile();
  const { documents: studentDocs } = useStudentDocuments();
  const fileQuality = useFileQuality(crmProfile, studentDocs);
  const gates = useQualificationGates(crmProfile, studentDocs);
  const intakeApi = useIntakeApi();
  const uiLocale = language || "en";
  const { formatPrice } = useCurrency();
  const money = (v?: number | null, c?: string | null) => {
    if (v == null) return "—";
    return formatPrice(v, c) || "—";
  };
  const localePrefix = language === "ar" ? "ar" : "en";
  const localizePath = (path: string) => `/${localePrefix}${path.startsWith('/') ? path : `/${path}`}`;

  const { data, isLoading } = useQuery({
    queryKey: ["program", id, language],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-program-details`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ id, locale: language }),
        }
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load program");
      return json;
    },
  });

  const program = data?.item;
  const related = data?.related || [];
  const geo = data?.geo || null;
  const housingLocations = data?.housingLocations || [];

  // Decision tracking: page_view + entity_view
  useEffect(() => {
    if (!program) return;
    trackPageView();
    trackEntityView("program", program.program_id || program.id || id || "", id || "", {
      name_ar: program.program_name || program.title_ar,
      university_id: program.university_id,
    });
  }, [program, id]);


  useEffect(() => {
    if (!program) return;
    try {
      localStorage.setItem('csw_readiness_target_requirements', JSON.stringify(buildProgramRequirementContext(program)));
    } catch {
      // noop: storage can be blocked in strict browser modes
    }
  }, [program]);

  // ORX score for program-level beta gating
  const programEntityId = program?.program_id || program?.id || id || null;
  const { data: orxData } = useOrxScore({ entityType: 'program', entityId: programEntityId });

  // Sticky bar on scroll
  useEffect(() => {
    const h = () => setStickyVisible(window.scrollY > 350);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const handleApply = async () => {
    if (!program) return;
    try {
      setApplyLoading(true);
      const universityId = program.university_id;
      const programId = program.program_id || program.id || id;

      // Submit via canonical intake-api
      await intakeApi.submit({
        programId,
        universityId,
        fileQuality,
      });

      // Also emit legacy bridge event for CRM compatibility
      const visitorId = localStorage.getItem("visitor_id");
      if (phone.trim()) {
        await supabase.functions.invoke("bridge-emit", {
          body: {
            event_name: "lead.created",
            payload: {
              phone: phone.trim(),
              program_id: id,
              program_title: program?.program_name,
              university_name: program?.university_name,
              channel: "web",
              source: "program_details",
              visitor_id: visitorId,
            },
            idempotency_key: `lead:${phone.trim()}:${new Date().toISOString().slice(0, 10)}`,
          },
        });
      }

      toast({ title: t("intake.submit_success") });
      setApplyDialog(false);
      setPhone("");
    } catch (error: any) {
      if (error?.message === 'already_applied') {
        toast({ title: t("intake.already_applied"), variant: "destructive" });
      } else {
        toast({ title: t("intake.submit_error"), variant: "destructive" });
      }
    } finally {
      setApplyLoading(false);
    }
  };

  const handleInquiry = async () => {
    if (!program || !inquiryMessage.trim()) return;
    try {
      setInquiryLoading(true);
      await intakeApi.inquire({
        universityId: program.university_id,
        programId: program.program_id || program.id || id,
        subject: programName,
        message: inquiryMessage.trim(),
      });
      toast({ title: t("inquiry.submit_success") });
      setInquiryDialog(false);
      setInquiryMessage("");
    } catch {
      toast({ title: t("inquiry.submit_error"), variant: "destructive" });
    } finally {
      setInquiryLoading(false);
    }
  };

  if (isLoading) {
    return <Layout><div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div></Layout>;
  }

  if (!program) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-bold">{t("program.notFound")}</h1>
          <Link to={localizePath("/search")}>
            <DSButton>{t("program.backToSearch")}</DSButton>
          </Link>
        </div>
      </Layout>
    );
  }

  const display = program.locale?.display || {};
  const programName = display.program_name || program.program_name;
  const uniName = display.university_name || program.university_name;
  const countryName = display.country_name || program.country_name;
  const degreeName = display.degree_name || program.degree_name;
  const description = program.description || "";
  const aboutTruncated = description.length > 300;

  const siteUrl = window.location.origin;
  const canonicalUrl = `${siteUrl}/${localePrefix}/program/${id}`;
  const title = `${programName} - ${uniName}`;
  const durationInYears = program.duration_months ? Math.round((program.duration_months / 12) * 10) / 10 : null;
  const seoDescription = `${programName} - ${uniName}${durationInYears ? ` - ${durationInYears} ${t("programDetails.years")}` : ''}`;

  const breadcrumbs = [
    { name: t("universityDetails.home"), url: siteUrl },
    { name: t("search.title"), url: `${siteUrl}${localizePath('/search')}` },
    { name: uniName, url: `${siteUrl}${localizePath(`/university/${program.university_id}`)}` },
    { name: programName, url: canonicalUrl },
  ];

  // Quick facts
  const quickFacts = [];
  if (degreeName) quickFacts.push({ icon: GraduationCap, label: t("program.degree"), value: degreeName, color: "qs-qf--blue" });
  if (program.duration_months) {
    const dur = program.duration_months >= 12
      ? `${Math.round(program.duration_months / 12 * 10) / 10} ${t("programDetails.years")}`
      : `${program.duration_months} ${t("universityDetails.months")}`;
    quickFacts.push({ icon: Clock, label: t("programDetails.duration"), value: dur, color: "qs-qf--purple" });
  }
  if (program.languages?.length) quickFacts.push({ icon: Globe, label: t("program.languages"), value: program.languages.join(", "), color: "qs-qf--green" });
  if (program.fees_yearly != null) quickFacts.push({ icon: DollarSign, label: t("program.annualFees"), value: money(program.fees_yearly, program.currency_code), color: "qs-qf--rose" });
  if (program.monthly_living != null) quickFacts.push({ icon: DollarSign, label: t("program.monthlyLiving"), value: money(program.monthly_living, program.currency_code), color: "qs-qf--amber" });
  if (program.ielts_required) quickFacts.push({ icon: Award, label: t("programDetails.ieltsRequired"), value: `${program.ielts_required}+`, color: "qs-qf--teal" });
  if (program.ranking) quickFacts.push({ icon: Star, label: t("program.ranking"), value: `#${program.ranking}`, color: "qs-qf--indigo" });
  if (program.next_intake_date || program.next_intake) {
    const intakeVal = program.next_intake_date
      ? new Date(program.next_intake_date).toLocaleDateString(uiLocale)
      : program.next_intake;
    quickFacts.push({ icon: Calendar, label: t("program.nextIntake"), value: intakeVal, color: "qs-qf--blue" });
  }

  return (
    <Layout>
      <SEOHead
        title={title}
        description={seoDescription}
        canonical={canonicalUrl}
        index={true}
        ogType="article"
        hreflang={[
          { lang: "ar", url: `${siteUrl}/ar/program/${id}` },
          { lang: "en", url: `${siteUrl}/en/program/${id}` },
          { lang: "x-default", url: `${siteUrl}/en/program/${id}` },
        ]}
        jsonLd={[
          generateProgramSchema({
            id: program.id || id,
            title: programName,
            description,
            degree_level: degreeName,
            duration_months: program.duration_months,
            language: program.languages?.[0],
            tuition_fee: program.fees_yearly,
            currency: program.currency_code,
            university: { name: uniName, website: null },
            start_date: program.next_intake_date,
          }, canonicalUrl),
          generateBreadcrumbSchema(breadcrumbs),
        ]}
      />

      {/* ===== STICKY BAR ===== */}
      <div className={`qs-sticky ${stickyVisible ? "qs-sticky--visible" : ""}`}>
        <div className="qs-sticky__wrap">
          <div className="qs-sticky__left">
            {program.logo_url && <Avatar className="h-8 w-8 border"><img src={program.logo_url} alt={uniName} /></Avatar>}
            <span className="qs-sticky__name">{programName}</span>
            {degreeName && <Badge variant="secondary" className="text-xs font-bold">{degreeName}</Badge>}
          </div>
           <div className="qs-sticky__actions">
            <button className="qs-sticky__link" onClick={() => setInquiryDialog(true)}>
              <MessageCircle className="h-4 w-4" />{t("program.inquire")}
            </button>
            <QualificationGateGuard gate={gates.canApply}>
              <button className="qs-sticky__link" onClick={() => setApplyDialog(true)}>
                <Send className="h-4 w-4" />{t("program.apply")}
              </button>
            </QualificationGateGuard>
            <HeartButton programId={program.program_id || id!} variant="button" size="sm" />
          </div>
        </div>
      </div>

      {/* ===== BREADCRUMB ===== */}
      <nav aria-label="Breadcrumb" className="qs-breadcrumb qs-breadcrumb--program">
        <div className="qs-breadcrumb__wrap">
          <Link to={localizePath("/")} className="qs-breadcrumb__link">
            <Home className="h-4 w-4 shrink-0" />
            <span>{t("universityDetails.home")}</span>
          </Link>
          <ChevronRight className="qs-breadcrumb__sep" />
          <Link to={localizePath("/search")} className="qs-breadcrumb__link">
            <span>{t("search.title")}</span>
          </Link>
          <ChevronRight className="qs-breadcrumb__sep" />
          <Link to={localizePath(`/university/${program.university_id}`)} className="qs-breadcrumb__link qs-breadcrumb__link--uni">
            {program.logo_url && (
              <img src={program.logo_url} alt="" className="qs-breadcrumb__uni-logo" />
            )}
            <span>{uniName}</span>
          </Link>
          <ChevronRight className="qs-breadcrumb__sep" />
          <span className="qs-breadcrumb__current">{programName}</span>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="qs-hero">
        <div className="qs-hero__bg" style={program.hero_image_url ? { backgroundImage: `url(${program.hero_image_url})` } : undefined} />
        <div className="qs-hero__overlay" />
        <div className="qs-hero__content">
          <div className="qs-hero__main">
            {program.logo_url && <img src={program.logo_url} alt={uniName} className="qs-hero__logo" />}
            <div>
              <h1 className="qs-hero__title">{programName}</h1>
              <div className="qs-hero__location">
                <MapPin className="h-4 w-4" />
                <span>{[uniName, program.city, countryName].filter(Boolean).join(" · ")}</span>
              </div>
              {degreeName && (
                <div className="mt-2">
                  <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">{degreeName}</Badge>
                </div>
              )}
            </div>
          </div>

          <div className="qs-hero__actions">
            <button className="qs-hero__action-btn" onClick={() => setInquiryDialog(true)}>
              <MessageCircle className="h-4 w-4" />{t("program.inquire")}
            </button>
            <QualificationGateGuard gate={gates.canApply}>
              <button className="qs-hero__action-btn qs-hero__action-btn--primary" onClick={() => setApplyDialog(true)}>
                <Send className="h-4 w-4" />{t("program.apply")}
              </button>
            </QualificationGateGuard>
            <HeartButton
              programId={program.program_id || id!}
              variant="button"
              className="qs-hero__action-btn"
            />
            <SocialShareBar uniName={programName} />
          </div>
        </div>
      </section>

      {/* ===== STATS BANNER (only if we have data) ===== */}
      {(program.fees_yearly != null || program.duration_months || program.ielts_required) && (
        <div className="qs-stats-banner">
          <div className="qs-stats-banner__wrap">
            {program.fees_yearly != null && (
              <div className="qs-stats-banner__card">
                <span className="qs-stats-banner__value">{money(program.fees_yearly, program.currency_code)}</span>
                <span className="qs-stats-banner__label">{t("program.annualFees")}</span>
              </div>
            )}
            {program.duration_months && (
              <div className="qs-stats-banner__card">
                <span className="qs-stats-banner__value">
                  {program.duration_months >= 12
                    ? `${Math.round(program.duration_months / 12 * 10) / 10} ${t("programDetails.years")}`
                    : `${program.duration_months} ${t("universityDetails.months")}`}
                </span>
                <span className="qs-stats-banner__label">{t("programDetails.duration")}</span>
              </div>
            )}
            {program.ielts_required && (
              <div className="qs-stats-banner__card">
                <span className="qs-stats-banner__value">{program.ielts_required}+</span>
                <span className="qs-stats-banner__label">IELTS</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div className="qs-layout">
        {/* Sidebar */}
        <aside className="qs-sidebar">
          <div className="qs-sidebar__card">
            <h3 className="qs-sidebar__heading">{t("universityDetails.tableOfContents")}</h3>
            <nav className="qs-sidebar__nav">
              <button className="qs-sidebar__link qs-sidebar__link--active" onClick={() => document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" })}>
                {t("universityDetails.tabs.about")}
              </button>
              {(program.accepted_certificates?.length > 0 || program.ielts_required) && (
                <button className="qs-sidebar__link" onClick={() => document.getElementById("requirements")?.scrollIntoView({ behavior: "smooth" })}>
                  {t("program.acceptedCerts")}
                </button>
              )}
              {(geo?.geo_lat || program.city) && (
                <button className="qs-sidebar__link" onClick={() => document.getElementById("campus-map")?.scrollIntoView({ behavior: "smooth" })}>
                  {t("universityDetails.campusLocations")}
                </button>
              )}
              {related.length > 0 && (
                <button className="qs-sidebar__link" onClick={() => document.getElementById("related")?.scrollIntoView({ behavior: "smooth" })}>
                  {t("universityDetails.similarTitle")}
                </button>
              )}
            </nav>
          </div>
          <div className="qs-sidebar__cta">
            <p className="qs-sidebar__cta-text">{t("universityDetails.sidebarCta")}</p>
            <button className="qs-sidebar__cta-btn" onClick={() => setInquiryDialog(true)}>
              <MessageCircle className="h-4 w-4" />{t("program.inquire")}
            </button>
            <QualificationGateGuard gate={gates.canApply}>
              <button className="qs-sidebar__cta-btn" onClick={() => setApplyDialog(true)}>
                <Send className="h-4 w-4" />{t("program.apply")}
              </button>
            </QualificationGateGuard>
          </div>
        </aside>

        {/* Content */}
        <div className="qs-content">

          {/* ── OVERVIEW ── */}
          <section id="overview" className="qs-section">
            <h2 className="qs-section__title">{t("program.about")}</h2>

            {description && (
              <div className="qs-about">
                <p className={`qs-about__text ${!aboutExpanded && aboutTruncated ? "qs-about__text--truncated" : ""}`}>
                  {description}
                </p>
                {aboutTruncated && (
                  <button className="qs-about__toggle" onClick={() => setAboutExpanded(!aboutExpanded)}>
                    {aboutExpanded ? t("universityDetails.readLess") : t("universityDetails.readMore")}
                  </button>
                )}
              </div>
            )}

            {/* Quick Facts */}
            {quickFacts.length > 0 && (
              <div className="qs-qf-grid mt-6">
                {quickFacts.map((f, i) => {
                  const Icon = f.icon;
                  return (
                    <div key={i} className={`qs-qf ${f.color}`}>
                      <Icon className="qs-qf__icon" />
                      <div>
                        <span className="qs-qf__label">{f.label}</span>
                        <span className="qs-qf__value">{f.value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── ORX RANK + EXPLAIN + ENRICHMENT (beta-approved only) ── */}
          <div className="space-y-4 mb-2">
            <OrxRankCard orxData={orxData} compact />
            <OrxExplainPanel
              orxScore={orxData ?? { orx_status: 'evaluating', orx_score: null, orx_rank_global: null, orx_rank_country: null, orx_confidence: null, orx_last_evaluated_at: null, orx_country_score: null, orx_university_score: null, orx_program_score: null, orx_badges: [], orx_summary: null, orx_methodology_version: null }}
              exposureStatus={orxData?.exposure_status ?? 'internal_only'}
              isBetaApproved={orxData?.isBetaApproved ?? false}
              entityType="program"
            />
            <OrxEnrichmentSection
              entityType="program"
              entityId={programEntityId}
              isBetaApproved={orxData?.isBetaApproved ?? false}
            />
            <OrxAdminStrip
              entityId={programEntityId}
              entityType="program"
              orxScore={orxData ?? { orx_status: 'evaluating', orx_score: null, orx_rank_global: null, orx_rank_country: null, orx_confidence: null, orx_last_evaluated_at: null, orx_country_score: null, orx_university_score: null, orx_program_score: null, orx_badges: [], orx_summary: null, orx_methodology_version: null }}
              exposureStatus={orxData?.exposure_status ?? 'internal_only'}
            />
          </div>

          {/* ── ADMISSION TRUTH BLOCK ── */}
          <section className="qs-section">
            <AdmissionTruthBlock
              data={buildProgramTruthData(program)}
              entityType="program"
            />
          </section>

          {/* ── DECISION BLOCKS (Cost / Deadlines / Scholarships) ── */}
          <section className="qs-section">
            <DecisionBlocks data={buildProgramDecisionData(program)} />
          </section>

          {/* ── REQUIREMENTS ── */}
          {(program.accepted_certificates?.length > 0 || program.ielts_required) && (
            <section id="requirements" className="qs-section">
              <h2 className="qs-section__title">{t("program.acceptedCerts")}</h2>

              {program.ielts_required && (
                <div className="mb-4 p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <Award className="h-5 w-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("programDetails.ieltsRequired")}</p>
                      <p className="text-lg font-bold text-foreground">{program.ielts_required}+</p>
                    </div>
                  </div>
                </div>
              )}

              {program.accepted_certificates && program.accepted_certificates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {program.accepted_certificates.map((cert: string, i: number) => (
                    <Badge key={i} variant="secondary" className="px-4 py-2 text-sm font-medium">
                      {cert}
                    </Badge>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── University Info ── */}
          <section className="qs-section">
            <h2 className="qs-section__title">{t("universityDetails.universityInfo")}</h2>
            <Link
              to={localizePath(`/university/${program.university_id}`)}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all group"
            >
              {program.logo_url && (
                <img src={program.logo_url} alt={uniName} className="w-14 h-14 rounded-lg object-contain bg-white p-1 border" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate">{uniName}</p>
                <p className="text-sm text-muted-foreground">{[program.city, countryName].filter(Boolean).join(", ")}</p>
                {program.ranking && (
                  <Badge variant="outline" className="mt-1 text-xs">#{program.ranking} QS</Badge>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </Link>
          </section>

          {/* ── CAMPUS MAP ── */}
          {(geo?.geo_lat || program.city) && (
            <section id="campus-map" className="qs-section">
              <UniversityLocationMap
                universityName={uniName}
                universityLogo={program.logo_url}
                geo_lat={geo?.geo_lat}
                geo_lon={geo?.geo_lon}
                geo_source={geo?.geo_source}
                city={program.city}
                countryName={countryName}
                housingLocations={housingLocations}
                alwaysExpanded
              />
            </section>
          )}

          {/* ── CTA ── */}
          <section className="qs-section">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">{t("program.interested")}</h3>
              <p className="text-muted-foreground mb-4 text-sm">{t("universityDetails.sidebarCta")}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <DSButton variant="outline" size="lg" onClick={() => setInquiryDialog(true)}>
                  <MessageCircle className="h-4 w-4 me-2" />{t("program.inquire")}
                </DSButton>
                <QualificationGateGuard gate={gates.canApply}>
                  <DSButton onClick={() => setApplyDialog(true)} size="lg">
                    <Send className="h-4 w-4 me-2" />{t("program.apply")}
                  </DSButton>
                </QualificationGateGuard>
              </div>
            </div>
          </section>

          {/* ── RELATED PROGRAMS ── */}
          {related.length > 0 && (
            <section id="related" className="qs-section">
              <h2 className="qs-section__title">{t("universityDetails.similarTitle")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {related.map((rp: any) => (
                  <ProgramCard
                    key={rp.program_id || rp.id}
                    p={{
                      program_id: rp.program_id || rp.id,
                      program_name: rp.program_name || rp.title || '',
                      program_name_ar: rp.program_name_ar,
                      program_name_en: rp.program_name_en,
                      university_name: rp.university_name || '',
                      university_name_ar: rp.university_name_ar,
                      university_name_en: rp.university_name_en,
                      university_id: rp.university_id,
                      country_name: rp.country_name || '',
                      country_name_ar: rp.country_name_ar,
                      country_name_en: rp.country_name_en,
                      logo_url: rp.logo_url,
                      degree_name: rp.degree_name,
                      degree_name_ar: rp.degree_name_ar,
                      degree_name_en: rp.degree_name_en,
                      fees_yearly: rp.fees_yearly,
                      currency_code: rp.currency_code,
                      duration_months: rp.duration_months,
                      city: rp.city,
                      study_mode: rp.study_mode,
                      instruction_languages: rp.instruction_languages || rp.languages,
                      scholarship_available: rp.scholarship_available,
                      has_dorm: rp.has_dorm,
                    }}
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      </div>

      {/* ===== INQUIRY DIALOG (open to all) ===== */}
      <Dialog open={inquiryDialog} onOpenChange={setInquiryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inquiry.title")} {programName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("inquiry.hint")}</p>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t("inquiry.placeholder")}
              value={inquiryMessage}
              onChange={(e) => setInquiryMessage(e.target.value)}
            />
            <DSButton onClick={handleInquiry} disabled={inquiryLoading || !inquiryMessage.trim()} className="w-full">
              {inquiryLoading ? t("inquiry.sending") : t("inquiry.send")}
            </DSButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== APPLY DIALOG (gated) ===== */}
      <Dialog open={applyDialog} onOpenChange={setApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apply.title")} {programName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("apply.phoneHint")}</p>
            <Input
              type="tel"
              placeholder={t("apply.phonePlaceholder")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <DSButton onClick={handleApply} disabled={applyLoading} className="w-full">
              {applyLoading ? t("apply.submitting") : t("apply.submit")}
            </DSButton>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
