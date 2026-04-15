import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView, trackEntityView } from "@/lib/decisionTracking";
import { useTranslation } from "react-i18next";
import { useLocalizedField } from "@/hooks/useLocalizedField";
import { useLocalizedContent } from "@/hooks/useLocalizedContent";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { generateUniversitySchema, generateBreadcrumbSchema, generateWebsiteSchema } from "@/utils/seo/schemas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  MapPin, GraduationCap, Calendar, Loader2, Globe, DollarSign, BookOpen, Award,
  CheckCircle, Users, Building2, TrendingUp, Home, ChevronRight, Star, Briefcase,
  Info, ChevronLeft, Send, MessageCircle, Search, X, Heart, Share2, ImageIcon,
  ExternalLink, ChevronDown, Copy, Mail, Clock, Landmark, BookMarked, Shield,
  GitCompare, ArrowRight, Settings
} from "lucide-react";
import { ScholarshipCard } from "@/components/ScholarshipCard";
import { ProgramCard, ProgramCardData } from "@/components/ProgramCard";
import { SocialShareBar } from "@/components/SocialShareBar";
import { HeartButton } from "@/components/shortlist/HeartButton";
import { useCompare } from "@/hooks/useCompare";
import { useToast } from "@/hooks/use-toast";
import "@/styles/university-hero.css";
import "@/styles/dashboard-panel.css";
import { UniversityLocationMap } from "@/components/university/UniversityLocationMap";
import { UniversityRankingBadges } from "@/components/university/UniversityRankingBadges";
import { OrxEnrichmentSection } from "@/components/orx/OrxEnrichmentSection";
import { OrxExplainPanel } from "@/components/orx/OrxExplainPanel";
import { OrxAdminStrip } from "@/components/orx/OrxAdminStrip";
import { useOrxScore } from "@/hooks/useOrxScore";
import { useChat } from "@/contexts/ChatContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { AdmissionTruthBlock } from "@/components/readiness/AdmissionTruthBlock";
import { buildUniversityTruthData, buildUniversityRequirementContext } from "@/features/readiness/truthHelpers";
import { useInstitutionPageControl } from "@/hooks/useInstitutionPageControl";
import { usePageStaffRole } from "@/hooks/usePageStaffRole";
import { InstitutionPageToolbar, CoverEditButton, LogoEditButton } from "@/components/institution/InstitutionPageToolbar";
import { CoverLogoEditor } from "@/components/institution/editors/CoverLogoEditor";
import { UniversityIntroSidebar } from "@/components/institution/UniversityIntroSidebar";
import { PublicPostFeed } from "@/components/institution/page-os/PublicPostFeed";
import { PageManageSidebar, type OperatorTab } from "@/components/institution/PageManageSidebar";
import { PagePostFeed } from "@/components/institution/page-os/PagePostFeed";
import { PagePostComposer } from "@/components/institution/page-os/PagePostComposer";
import { PageStaffManager } from "@/components/institution/page-os/PageStaffManager";
import { UniversityCommWorkspace } from "@/components/comm/UniversityCommWorkspace";
import { PageSettingsPanel } from "@/components/institution/page-os/PageSettingsPanel";
import { PageModerationPanel } from "@/components/institution/page-os/PageModerationPanel";
import { UniversityIntelligencePanel } from "@/components/institution/page-os/UniversityIntelligencePanel";
import { ProgramIngestionPanel } from "@/components/institution/page-os/ProgramIngestionPanel";
import { PageActivityLog } from "@/components/institution/page-os/PageActivityLog";
import { PageEditsReview } from "@/components/institution/page-os/PageEditsReview";
import { PageOperatorShell } from "@/components/institution/PageOperatorShell";
import { PageDashboardPanel } from "@/components/institution/page-os/PageDashboardPanel";
import { PageProgramsPanel } from "@/components/institution/page-os/PageProgramsPanel";
import { PageScholarshipsPanel } from "@/components/institution/page-os/PageScholarshipsPanel";
import { PageGovernedEditsPanel } from "@/components/institution/page-os/PageGovernedEditsPanel";
import { IntakeWorkspace } from "@/components/intake/IntakeWorkspace";

// money helper is now inside the component (uses CurrencyContext)
const SECTIONS = [
  { id: "posts", labelKey: "pageOS.posts.sectionTitle" },
  { id: "programs", labelKey: "universityDetails.tabs.programs" },
  { id: "university-info", labelKey: "universityDetails.universityInfo" },
  { id: "scholarships", labelKey: "universityDetails.scholarshipsAvailable" },
  
  { id: "dormitory", labelKey: "universityDetails.tabs.dormitory" },
  { id: "campus-locations", labelKey: "universityDetails.campusLocations" },
  { id: "gallery", labelKey: "universityDetails.gallery" },
  
] as const;

/* ========== LIGHTBOX ========== */
function Lightbox({ images, index, onClose, onNav }: { images: string[]; index: number; onClose: () => void; onNav: (i: number) => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNav((index - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") onNav((index + 1) % images.length);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [index, images.length, onClose, onNav]);

  return (
    <div className="qs-lightbox" onClick={onClose}>
      <button className="qs-lightbox__close" onClick={onClose}><X className="h-5 w-5" /></button>
      {images.length > 1 && (
        <>
          <button className="qs-lightbox__nav qs-lightbox__nav--prev" onClick={e => { e.stopPropagation(); onNav((index - 1 + images.length) % images.length); }}><ChevronLeft className="h-5 w-5" /></button>
          <button className="qs-lightbox__nav qs-lightbox__nav--next" onClick={e => { e.stopPropagation(); onNav((index + 1) % images.length); }}><ChevronRight className="h-5 w-5" /></button>
        </>
      )}
      <img src={images[index]} alt="" onClick={e => e.stopPropagation()} />
    </div>
  );
}

/* ========== STAT BAR (QS-Style) ========== */
function StatBar({ label, value, percent, color = "hsl(var(--primary))" }: { label: string; value: string; percent: number; color?: string }) {
  return (
    <div className="qs-stat-bar">
      <div className="qs-stat-bar__header">
        <span className="qs-stat-bar__label">{label}</span>
        <span className="qs-stat-bar__value">{value}</span>
      </div>
      <div className="qs-stat-bar__track">
        <div className="qs-stat-bar__fill" style={{ width: `${Math.min(percent, 100)}%`, background: color }} />
      </div>
    </div>
  );
}
// QSProgramRow removed — now using ProgramCard component

/* ========== MAIN COMPONENT ========== */
export default function UniversityDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getField, language } = useLocalizedField();
  const { locale, getDisplay } = useLocalizedContent();
  const { toast } = useToast();
  const { addToCompare, isInCompare, maxReached } = useCompare();
  const { open: openFloatingChat } = useChat();
  const { formatPrice } = useCurrency();
  const money = useCallback((v?: number | null, c?: string | null, _uiLocale?: string) => {
    if (v == null) return "—";
    return formatPrice(v, c) || "—";
  }, [formatPrice]);



  const [item, setItem] = useState<any>(null);
  const [localeData, setLocaleData] = useState<any>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [housing, setHousing] = useState<any[]>([]);
  const [housingLocations, setHousingLocations] = useState<any[]>([]);
  const [dormImages, setDormImages] = useState<string[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [similarUnis, setSimilarUnis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || undefined));
  }, []);


  useEffect(() => {
    if (!item) return;
    try {
      localStorage.setItem('csw_readiness_target_requirements', JSON.stringify(buildUniversityRequirementContext(admissions)));
    } catch {
      // noop
    }
  }, [item, admissions]);


  // ORX score from real DB table — uses UUID from loaded item, not slug from params
  const orxEntityId = item?.university_id || item?.id || null;
  const { data: orxData } = useOrxScore({ entityType: 'university', entityId: orxEntityId });

  // Institution page control — uses resolved granted-access state only (not raw claims)
  const { canControl, role: institutionRole, isPreviewMode } = useInstitutionPageControl(orxEntityId);
  // Page staff role for granular permission gating
  const { role: pageStaffRole, isSuperAdmin: isStaffSuperAdmin } = usePageStaffRole(orxEntityId);
  const [heroEditMode, setHeroEditMode] = useState<'cover' | 'logo' | null>(null);

  const [operatorTab, setOperatorTab] = useState<OperatorTab>(null);
  const [manageSidebarOpen, setManageSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("posts");
  const [programSearch, setProgramSearch] = useState("");
  const [openDegrees, setOpenDegrees] = useState<Record<string, boolean>>({});
  const [pageSettings, setPageSettings] = useState<Record<string, boolean>>({ posts_visible: true, programs_visible: true, scholarships_visible: true, contact_visible: true });
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [openInfoSections, setOpenInfoSections] = useState<Record<string, boolean>>({});

  const toggleInfoSection = useCallback((key: string) => {
    setOpenInfoSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // sectionRefs removed — Facebook-style view switching, no scroll-spy

  // Fetch data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-university-details`,
          { method: "POST", headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: JSON.stringify({ id, locale }) }
        );
        const data = await res.json();
        if (data.ok) {
          setItem(data.item);
          setLocaleData(data.locale || null);
          setPrograms(data.programs || []);
          setScholarships(data.scholarships || []);
          setAdmissions(data.admissions || []);
          setHousing(data.housing || []);
          setHousingLocations(data.housingLocations || []);
          setDormImages(data.dormImages || []);
          setSimilarUnis(data.similarUniversities || []);
          if (data.pageSettings) setPageSettings(data.pageSettings);
        }
      } catch (e) { console.error("Failed to load university:", e); }
      finally { setLoading(false); }
    })();
  }, [id, locale]);

  // Decision tracking: page_view + entity_view
  useEffect(() => {
    if (!item) return;
    trackPageView();
    trackEntityView("university", item.university_id || item.id || id || "", id || "", { name_ar: item.name_ar });
  }, [item, id]);

  // Section refs no longer needed for scroll-spy (Facebook-style view switching)

  // Sticky bar
  useEffect(() => {
    const h = () => setStickyVisible(window.scrollY > 450);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const switchTab = useCallback((sectionId: string) => {
    setOperatorTab(null);
    setActiveSection(sectionId);
    // Scroll to the tab bar area, not the very top (which hides content behind the cover)
    const tabBar = document.getElementById('university-tab-bar');
    if (tabBar) {
      const offset = tabBar.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    }
  }, []);

  // Listen for deep-link navigation from Settings panel
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail as OperatorTab;
      if (tab) setOperatorTab(tab);
    };
    window.addEventListener('page-os:navigate-tab', handler);
    return () => window.removeEventListener('page-os:navigate-tab', handler);
  }, []);

  // Programs grouped by degree
  const filteredPrograms = useMemo(() => {
    if (!programSearch.trim()) return programs;
    const q = programSearch.toLowerCase();
    return programs.filter((p: any) => (p.title || "").toLowerCase().includes(q) || (p.degree_level || "").toLowerCase().includes(q));
  }, [programs, programSearch]);

  const programsByDegree = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const p of filteredPrograms) {
      const deg = p.degree_level || "Other";
      (groups[deg] = groups[deg] || []).push(p);
    }
    return groups;
  }, [filteredPrograms]);

  // Gallery images
  const galleryImages = useMemo(() => {
    const imgs = [item?.hero_image_url, item?.main_image_url, ...(item?.galleryImages || [])].filter(Boolean);
    return [...new Set(imgs)] as string[];
  }, [item]);

  const localePrefix = language === "ar" ? "ar" : "en";
  const localizePath = (path: string) => `/${localePrefix}${path.startsWith('/') ? path : `/${path}`}`;
  const uiLocale = language || "en";

  // Quick Facts
  const quickFacts = useMemo(() => {
    if (!item) return [];
    const facts: { icon: any; label: string; value: string; color: string }[] = [];
    if (item.founded_year) facts.push({ icon: Clock, label: t("universityDetails.founded"), value: String(item.founded_year), color: "qs-qf--blue" });
    if (item.university_type) facts.push({ icon: Landmark, label: t("universityDetails.stat.type"), value: item.university_type === "public" ? t("universityDetails.stat.public") : t("universityDetails.stat.private"), color: "qs-qf--purple" });
    if (item.enrolled_students) facts.push({ icon: Users, label: t("universityDetails.totalStudents"), value: Number(item.enrolled_students).toLocaleString(uiLocale), color: "qs-qf--green" });
    if (item.international_students) facts.push({ icon: Globe, label: t("universityDetails.internationalStudents"), value: Number(item.international_students).toLocaleString(uiLocale), color: "qs-qf--teal" });
    if (item.acceptance_rate) facts.push({ icon: Shield, label: t("universityDetails.acceptanceRate"), value: `${item.acceptance_rate}%`, color: "qs-qf--amber" });
    if (item.annual_fees) facts.push({ icon: DollarSign, label: t("universityDetails.stat.annualFees"), value: money(item.annual_fees, item.currency_code, uiLocale), color: "qs-qf--rose" });
    if (programs.length > 0) facts.push({ icon: BookMarked, label: t("universityDetails.availablePrograms"), value: String(programs.length), color: "qs-qf--indigo" });
    return facts;
  }, [item, programs.length, t, uiLocale]);

  // Visible sections — respect pageSettings for public viewers
  // NOTE: must be computed before early returns to keep hook order stable
  const visibleSections = useMemo(() => SECTIONS.filter(s => {
    if (!item) return s.id === "university-info"; // minimal fallback when loading
    
    if (s.id === "dormitory") return item?.has_dorm || housing.length > 0 || dormImages.length > 0;
    if (s.id === "gallery") return galleryImages.length > 0;
    
    // Hide tabs based on page settings (operators always see them)
    if (!canControl) {
      if (s.id === "posts" && !pageSettings.posts_visible) return false;
      if (s.id === "programs" && !pageSettings.programs_visible) return false;
      if (s.id === "scholarships" && !pageSettings.scholarships_visible) return false;
    }
    return true;
  }), [item, housing.length, dormImages.length, galleryImages.length, similarUnis.length, canControl, pageSettings]);

  // Fallback active section when current tab is hidden
  useEffect(() => {
    if (canControl) return;
    if (visibleSections.some(section => section.id === activeSection)) return;
    const fallbackSection = visibleSections[0]?.id || "university-info";
    if (fallbackSection !== activeSection) setActiveSection(fallbackSection);
  }, [activeSection, canControl, visibleSections]);

  if (loading) {
    return <Layout><div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div></Layout>;
  }
  if (!item) {
    return <Layout><div className="min-h-screen flex flex-col items-center justify-center gap-4"><h1 className="text-2xl font-bold">{t("universityDetails.notFound")}</h1><Link to={`${localizePath("/universities")}?tab=universities`}><Button>{t("universityDetails.backToSearch")}</Button></Link></div></Layout>;
  }

  // Prefer resolver-backed display.name, fallback to old getField
  const uniName = getDisplay(localeData, 'name', getField(item, "university_name"));
  // Unified country_name: resolver-backed → raw API field
  const countryName = getDisplay(localeData, 'country_name', item.country_name);
  const siteUrl = window.location.origin;
  const canonicalUrl = `${siteUrl}/${localePrefix}/university/${id}`;
  const seoTitle = item.seo_title || `${uniName} - ${item.city}, ${countryName}`;
  const seoDescription = item.seo_description || `${uniName} - ${item.city}. ${programs.length} ${t("universityDetails.availablePrograms")}.`;
  const heroImg = item?.hero_image_url || item?.main_image_url || galleryImages[0];

  const universitySchema = generateUniversitySchema({ id: item.id, name: uniName, logo_url: item.logo_url, city: item.city, country_name: countryName, country_code: item.country_slug?.toUpperCase(), website_url: item.website_url, founded_year: item.founded_year }, canonicalUrl);
  const breadcrumbSchema = generateBreadcrumbSchema([{ name: t("universityDetails.home"), url: `${siteUrl}${localizePath('/')}` }, { name: t("universityDetails.universities"), url: `${siteUrl}${localizePath('/universities')}?tab=universities` }, { name: uniName, url: canonicalUrl }]);

  // Prefer resolver-backed display.description or about_text, fallback to old field
  const aboutText = getDisplay(localeData, 'about_text', '') || getDisplay(localeData, 'description', getField(item, "description") || item?.about_text || "");
  const aboutTruncated = aboutText.length > 300;

  // Students breakdown
  const totalStudents = item?.enrolled_students ? Number(item.enrolled_students) : 0;
  const intlStudents = item?.international_students ? Number(item.international_students) : 0;
  const intlPercent = totalStudents > 0 ? Math.round((intlStudents / totalStudents) * 100) : 0;

  const uniDisplayName = getField(item, 'name') || item?.name_en || item?.name_ar || '';
  const uniLogoUrl = item?.logo_url || '';

  const shellProps = canControl
    ? { universityName: uniDisplayName, logoUrl: uniLogoUrl, onMessagesClick: () => setOperatorTab('inbox') }
    : {};
  const ShellComponent = canControl ? PageOperatorShell : Layout;

  return (
    <ShellComponent {...shellProps}>
      <SEOHead title={seoTitle} description={seoDescription} canonical={canonicalUrl} index={item.seo_index !== false} ogType="article" ogImage={heroImg || item.logo_url} jsonLd={[universitySchema, breadcrumbSchema, generateWebsiteSchema(siteUrl)]} hreflang={[{ lang: "ar", url: `${siteUrl}/ar/university/${id}` }, { lang: "en", url: `${siteUrl}/en/university/${id}` }, { lang: "x-default", url: `${siteUrl}/en/university/${id}` }]} />

      {/* InstitutionPageToolbar removed — operator shell + sidebar replaces it */}

      {/* ===== STICKY BAR (student-only) ===== */}
      {!canControl && (
      <div className={`qs-sticky ${stickyVisible ? "qs-sticky--visible" : ""}`}>
        <div className="qs-sticky__wrap">
          <div className="qs-sticky__left">
            {item?.logo_url && <Avatar className="h-8 w-8 border"><img src={item.logo_url} alt={uniName} /></Avatar>}
            <span className="qs-sticky__name">{uniName}</span>
            {item?.qs_world_rank && <Badge variant="secondary" className="text-xs font-bold">#{item.qs_world_rank} QS</Badge>}
          </div>
          <div className="qs-sticky__actions">
            <button className="qs-sticky__link" onClick={() => navigate(`${localizePath("/apply")}?universities=${item.university_id}`)}>
              <Send className="h-4 w-4" />{t("universityDetails.applyNow")}
            </button>
            <HeartButton type="university" universityId={item.university_id || id} variant="button" size="sm" />
          </div>
        </div>
      </div>
      )}

      {/* ===== BREADCRUMB (student-only) ===== */}
      {!canControl && (
      <div className="qs-breadcrumb">
        <div className="qs-breadcrumb__wrap">
          <Link to={localizePath("/")} className="qs-breadcrumb__link">{t("universityDetails.home")}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={`${localizePath("/universities")}?tab=universities`} className="qs-breadcrumb__link">{t("universityDetails.universities")}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          {item?.country_name && (
            <>
              <Link to={`${localizePath("/universities")}?tab=universities&country=${item.country_slug}`} className="qs-breadcrumb__link">{countryName}</Link>
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          )}
          <span className="qs-breadcrumb__current">{uniName}</span>
        </div>
      </div>
      )}

      {/* ===== FULL-PAGE LAYOUT: SIDEBAR BESIDE COVER (Facebook model) ===== */}
      <div className={canControl ? `fb-full-layout ${manageSidebarOpen ? 'fb-full-layout--open' : 'fb-full-layout--closed'}` : ''}>
        
        {/* Facebook-style Manage Page sidebar — staff only, beside cover */}
        {canControl && (
          <div className={`fb-full-layout__sidebar ${manageSidebarOpen ? '' : 'fb-full-layout__sidebar--hidden'}`}>
            <PageManageSidebar
              uniName={uniName}
              logoUrl={item?.logo_url}
              activeTab={operatorTab}
              onTabChange={setOperatorTab}
              staffRole={pageStaffRole}
              isSuperAdmin={isStaffSuperAdmin}
            />
          </div>
        )}

        {/* Toggle button — Facebook circular on sidebar edge */}
        {canControl && (
          <button
            className="fb-sidebar-toggle"
            onClick={() => setManageSidebarOpen(o => !o)}
            aria-label={manageSidebarOpen ? t('institution.toolbar.hideSidebar') : t('institution.toolbar.showSidebar')}
          >
            {manageSidebarOpen ? <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" /> : <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />}
          </button>
        )}

        {/* Main content area (cover + page info + tabs + content) */}
        <div className="fb-full-layout__main">

      {/* ===== PUBLIC PAGE CHROME (always visible, like Facebook) ===== */}
      {/* ===== FACEBOOK-STYLE COVER ===== */}
      <section className="fb-cover">
        <div className="fb-cover__img" style={heroImg ? { backgroundImage: `url(${heroImg})` } : undefined} />
        <div className="fb-cover__gradient" />
        {canControl && <CoverEditButton onClick={() => setHeroEditMode('cover')} />}
      </section>

      {/* ===== PAGE INFO (below cover, Facebook-style) ===== */}
      <div className="fb-page-info">
        <div className="fb-page-info__wrap">
          {/* Logo overlapping cover */}
          <div className="fb-page-info__logo-area">
            <div className="fb-page-info__logo-wrap">
              {item?.logo_url ? (
                <img src={item.logo_url} alt={uniName} className="fb-page-info__logo" />
              ) : (
                <div className="fb-page-info__logo fb-page-info__logo--placeholder">
                  <Building2 className="w-10 h-10 text-muted-foreground/50" />
                </div>
              )}
              {canControl && <LogoEditButton onClick={() => setHeroEditMode('logo')} />}
            </div>
          </div>

          {/* Name + location + actions */}
          <div className="fb-page-info__content">
            <div className="fb-page-info__text">
              <h1 className="fb-page-info__name">{uniName}</h1>
              <div className="fb-page-info__location">
                <MapPin className="h-4 w-4" />
                <span>{[item?.city, countryName].filter(Boolean).join(", ")}</span>
              </div>
              {/* Inline Ranking Badges */}
              <UniversityRankingBadges
                orxData={orxData}
                qsWorldRank={item?.qs_world_rank}
                cwurWorldRank={item?.cwur_world_rank}
                uniranksRank={item?.uniranks_rank}
                universityName={uniName}
                className="mt-2"
              />
            </div>
            <div className="fb-page-info__actions">
              {canControl ? (
                <>
                  <button className="fb-action-btn fb-action-btn--primary" onClick={() => setOperatorTab('dashboard')}>
                    <Home className="h-4 w-4" />{t("pageOS.dashboard.title")}
                  </button>
                  {(isStaffSuperAdmin || pageStaffRole === 'full_control' || pageStaffRole === 'page_admin') && (
                    <button className="fb-action-btn" onClick={() => setOperatorTab('settings')}>
                      <Settings className="h-4 w-4" />{t("pageOS.toolbar.settings")}
                    </button>
                  )}
                  <SocialShareBar uniName={uniName} />
                </>
              ) : (
                <>
                  <button className="fb-action-btn fb-action-btn--primary" onClick={() => navigate(`/messages?university=${orxEntityId || item.university_id || id}`)}>
                    <MessageCircle className="h-4 w-4" />{t("messaging.sendMessageBtn")}
                  </button>
                  <HeartButton 
                    type="university" 
                    universityId={item.university_id || id} 
                    variant="button"
                    className="fb-action-btn"
                  />
                  <button className="fb-action-btn" onClick={() => {
                    if (!maxReached) {
                      addToCompare(item.university_id || id!);
                      toast({ title: t("compare.added") });
                    } else {
                      toast({ title: t("compare.max_reached"), variant: "destructive" });
                    }
                  }}>
                    <GitCompare className="h-4 w-4" />{t("program.compare")}
                  </button>
                  <SocialShareBar uniName={uniName} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Facebook-style cover/logo editor modal */}
      {heroEditMode && (
        <CoverLogoEditor
          universityId={orxEntityId!}
          mode={heroEditMode}
          currentUrl={heroEditMode === 'cover' ? item?.hero_image_url : item?.logo_url}
          onClose={() => setHeroEditMode(null)}
          onSubmitted={() => setHeroEditMode(null)}
        />
      )}

      {/* ===== HORIZONTAL TAB BAR (Facebook-style) ===== */}
      <div id="university-tab-bar" className="fb-tab-bar">
        <div className="fb-tab-bar__wrap">
          {visibleSections.map(s => (
            <button key={s.id} className={`fb-tab-bar__tab ${activeSection === s.id ? "fb-tab-bar__tab--active" : ""}`} onClick={() => switchTab(s.id)}>
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      </div>
      {/* end of public page chrome */}

      {/* ===== CONTENT AREA ===== */}
      <div>
          {/* Operator panel — renders above page content when a manage tab is active */}
          {canControl && operatorTab && (
            <div className="fb-operator-panel">
              {operatorTab === 'dashboard' && (
                <PageDashboardPanel
                  universityId={orxEntityId!}
                  universityName={uniDisplayName}
                  logoUrl={item?.logo_url}
                  coverUrl={item?.hero_image_url}
                  aboutText={aboutText}
                  programsCount={programs.length}
                  onNavigate={setOperatorTab}
                  staffRole={pageStaffRole}
                  isSuperAdmin={isStaffSuperAdmin}
                />
              )}
              {operatorTab === 'posts' && <PagePostFeed universityId={orxEntityId!} isStaff={true} />}
              {operatorTab === 'programs' && <PageProgramsPanel universityId={orxEntityId!} />}
              {operatorTab === 'scholarships' && <PageScholarshipsPanel universityId={orxEntityId!} />}
              {operatorTab === 'governed' && <PageGovernedEditsPanel universityId={orxEntityId!} isSuperAdmin={isStaffSuperAdmin} />}
              {operatorTab === 'intake' && <IntakeWorkspace universityId={orxEntityId!} />}
              {operatorTab === 'staff' && <PageStaffManager universityId={orxEntityId!} />}
              {operatorTab === 'inbox' && <UniversityCommWorkspace universityId={orxEntityId!} currentUserId={userId} />}
              {operatorTab === 'moderation' && <PageModerationPanel universityId={orxEntityId!} />}
              {operatorTab === 'analytics' && <UniversityIntelligencePanel universityId={orxEntityId!} />}
              {operatorTab === 'ingestion' && <ProgramIngestionPanel universityId={orxEntityId!} />}
              {operatorTab === 'activity' && <PageActivityLog universityId={orxEntityId!} />}
              {operatorTab === 'review' && <PageEditsReview universityId={orxEntityId!} />}
              {operatorTab === 'settings' && <PageSettingsPanel universityId={orxEntityId!} />}
            </div>
          )}

      {/* ===== TWO-COLUMN LAYOUT: SIDEBAR + CONTENT (hidden when operator panel active) ===== */}
      {!(canControl && operatorTab) && (
      <div className="fb-two-col">
        {/* Facebook-style Intro Sidebar */}
        <aside className="fb-two-col__sidebar">
          <UniversityIntroSidebar
            item={item}
            uniName={uniName}
            countryName={countryName}
            programsCount={programs.length}
            canControl={canControl}
            money={money}
            aboutText={aboutText}
            contactVisible={pageSettings.contact_visible}
          />
        </aside>

        {/* Content */}
        <div className="fb-two-col__main qs-content">

          {/* ── POSTS (default tab) ── */}
          {activeSection === "posts" && pageSettings.posts_visible && (
            <section className="qs-section">
              {canControl && (
                <PagePostComposer
                  universityId={orxEntityId!}
                  logoUrl={item?.logo_url}
                  universityName={uniDisplayName}
                  onPostCreated={() => window.dispatchEvent(new Event('posts-refresh'))}
                />
              )}
              <PublicPostFeed
                universityId={orxEntityId!}
                canRefresh={canControl}
                universityName={uniDisplayName}
                logoUrl={item?.logo_url}
              />
            </section>
          )}
          {activeSection === "posts" && !pageSettings.posts_visible && !canControl && (
            <section className="qs-section">
              <div className="qs-empty"><p>{t("universityDetails.sectionHidden")}</p></div>
            </section>
          )}

          {/* ── OVERVIEW / ABOUT ── */}
          {/* overview section removed — content merged into university-info */}

          {/* ── PROGRAMS ── */}
          {activeSection === "programs" && (canControl || pageSettings.programs_visible) && (
            <section className="qs-section">
              <h2 className="qs-section__title">{t("universityDetails.availablePrograms")} <span className="qs-section__count">({programs.length})</span></h2>
            {programs.length > 0 ? (
              <>
                <div className="qs-search">
                  <Search className="qs-search__icon" />
                  <input className="qs-search__input" placeholder={t("universityDetails.searchPrograms")} value={programSearch} onChange={e => setProgramSearch(e.target.value)} />
                  {programSearch && <button className="qs-search__clear" onClick={() => setProgramSearch("")}><X className="h-4 w-4" /></button>}
                </div>

                {Object.entries(programsByDegree).map(([degree, progs]) => (
                  <div key={degree} className="mb-6">
                    <button
                      className="flex items-center gap-2 mb-3 group/deg cursor-pointer"
                      onClick={() => setOpenDegrees(prev => ({ ...prev, [degree]: prev[degree] === false }))}
                    >
                      <GraduationCap className="h-5 w-5 text-primary" />
                      <span className="text-base font-bold text-foreground">
                        {degree === "Bachelor" ? t("universityDetails.degreeBachelor") : degree === "Master" ? t("universityDetails.degreeMaster") : degree === "PhD" ? t("universityDetails.degreePhd") : degree}
                      </span>
                      <span className="text-sm text-muted-foreground">({progs.length})</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openDegrees[degree] === false ? "" : "rotate-180"}`} />
                    </button>
                    {openDegrees[degree] !== false && (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {progs.map((program: any) => {
                          const cardData: ProgramCardData = {
                            program_id: program.id,
                            program_name: program.title || program.program_name || '',
                            program_name_ar: program.program_name_ar || program.title_ar,
                            program_name_en: program.program_name_en || program.title_en || program.title,
                            university_id: item?.university_id || id,
                            university_name: uniName,
                            university_name_ar: item?.university_name_ar,
                            university_name_en: item?.university_name_en,
                            country_name: item?.country_name || '',
                            country_name_ar: item?.country_name_ar,
                            country_name_en: item?.country_name_en,
                            country_slug: item?.country_slug,
                            city: program.city || item?.city,
                            currency_code: program.currency_code || item?.currency_code,
                            fees_yearly: program.tuition_yearly,
                            duration_months: program.duration_months,
                            language: program.language || (Array.isArray(program.languages) ? program.languages[0] : null),
                            languages: program.languages,
                            instruction_languages: program.instruction_languages,
                            logo_url: item?.logo_url,
                            degree_name: program.degree_level,
                            degree_name_ar: program.degree_name_ar,
                            degree_name_en: program.degree_name_en,
                            study_mode: program.study_mode,
                            delivery_mode: program.delivery_mode,
                            ielts_required: program.ielts_required || program.ielts_min_overall,
                            has_dorm: !!(item?.housing && item.housing.length > 0),
                            dorm_price_monthly_usd: item?.housing?.[0]?.price_monthly_local,
                            dorm_currency: item?.housing?.[0]?.currency_code,
                            monthly_living_usd: program.monthly_living_usd,
                            scholarship_available: program.has_scholarship,
                            scholarship_type: program.scholarship_type,
                            scholarship_percent_coverage: program.scholarship_percent_coverage,
                            scholarship_amount_usd: program.scholarship_amount_usd,
                            scholarship_monthly_stipend_usd: program.scholarship_monthly_stipend_usd,
                            scholarship_covers_housing: program.scholarship_covers_housing,
                            scholarship_covers_insurance: program.scholarship_covers_insurance,
                            intake_months: program.intake_months,
                            next_intake_date: program.next_intake_date,
                            entrance_exam_required: program.entrance_exam_required,
                            required_documents: program.required_documents,
                            employment_rate: program.employment_rate,
                            enrolled_students: program.enrolled_students,
                            has_scholarship: program.has_scholarship,
                            discipline_name_ar: program.discipline_name_ar,
                            discipline_name_en: program.discipline_name_en,
                            seats_status: program.seats_status,
                            seats_available: program.seats_available,
                            application_deadline: program.application_deadline,
                          };
                          return <ProgramCard key={program.id} p={cardData} compact />;
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {filteredPrograms.length === 0 && programSearch && (
                  <div className="qs-empty"><Search className="h-10 w-10" /><p>{t("universityDetails.noSearchResults")}</p></div>
                )}
              </>
            ) : (
              <div className="qs-empty"><GraduationCap className="h-12 w-12" /><h3>{t("universityDetails.noProgramsTitle")}</h3><p>{t("universityDetails.noProgramsSub")}</p></div>
            )}
            </section>
          )}

          {/* ── UNIVERSITY INFO ── */}
          {activeSection === "university-info" && (
            <section className="qs-section">
              <h2 className="qs-section__title">{t("universityDetails.universityInfo")}</h2>

              {/* About */}
              {aboutText && (
                <div className="qs-about" style={{ marginBottom: 24 }}>
                  <p className={`qs-about__text ${!aboutExpanded && aboutTruncated ? "qs-about__text--truncated" : ""}`}>{aboutText}</p>
                  {aboutTruncated && (
                    <button className="qs-about__toggle" onClick={() => setAboutExpanded(!aboutExpanded)}>
                      {aboutExpanded ? t("universityDetails.readLess") : t("universityDetails.readMore")}
                    </button>
                  )}
                </div>
              )}

              {/* Quick Facts */}
              {quickFacts.length > 0 && (
                <div className="qs-quick-facts" style={{ marginBottom: 24 }}>
                  <h3 className="qs-quick-facts__title">{t("universityDetails.quickFacts")}</h3>
                  <div className="qs-quick-facts__grid">
                    {quickFacts.map((fact, i) => {
                      const Icon = fact.icon;
                      return (
                        <div key={i} className={`qs-qf-card ${fact.color}`}>
                          <div className="qs-qf-card__icon-wrap"><Icon className="qs-qf-card__icon" /></div>
                          <div className="qs-qf-card__data">
                            <span className="qs-qf-card__value">{fact.value}</span>
                            <span className="qs-qf-card__label">{fact.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Admission Truth Block */}
              <AdmissionTruthBlock
                data={buildUniversityTruthData(item, admissions)}
                entityType="university"
              />
            
              {/* Admission Details */}
              {admissions.length > 0 && (
                <div className="qs-sub-accordion" style={{ marginTop: 24 }}>
                  <button className="qs-sub-accordion__trigger" onClick={() => toggleInfoSection("admission")}>
                    <span className="qs-sub-accordion__title">{t("universityDetails.admissionsTitle")}</span>
                    <ChevronDown className={`qs-sub-accordion__chevron ${openInfoSections.admission ? "qs-sub-accordion__chevron--open" : ""}`} />
                  </button>
                  {openInfoSections.admission && (
                    <div className="qs-sub-accordion__body">
                      {admissions.map((adm: any, i: number) => (
                        <div key={i} className="qs-admission-group">
                          <h4 className="qs-admission-group__degree">
                            {adm.degree_level === "Bachelor" ? t("universityDetails.degreeBachelor") : adm.degree_level === "Master" ? t("universityDetails.degreeMaster") : adm.degree_level === "PhD" ? t("universityDetails.degreePhd") : adm.degree_level}
                          </h4>
                          <div className="qs-admission-table">
                            {adm.consensus_min_gpa && (
                              <div className="qs-admission-table__row">
                                <span className="qs-admission-table__label">GPA</span>
                                <span className="qs-admission-table__value">{adm.consensus_min_gpa}+</span>
                              </div>
                            )}
                            {adm.consensus_min_ielts && (
                              <div className="qs-admission-table__row">
                                <span className="qs-admission-table__label">IELTS</span>
                                <span className="qs-admission-table__value">{adm.consensus_min_ielts}+</span>
                              </div>
                            )}
                            {adm.consensus_min_toefl && (
                              <div className="qs-admission-table__row">
                                <span className="qs-admission-table__label">TOEFL</span>
                                <span className="qs-admission-table__value">{adm.consensus_min_toefl}+</span>
                              </div>
                            )}
                          </div>
                          {adm.consensus_other_requirements?.length > 0 && (
                            <div className="qs-requirements-list">
                              {adm.consensus_other_requirements.map((req: any, ri: number) => (
                                <div key={ri} className="qs-requirement-item"><CheckCircle className="h-4 w-4" /><span>{req.requirement}</span></div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Students & Staff */}
              {totalStudents > 0 && (
                <div className="qs-sub-accordion" style={{ marginTop: 16 }}>
                  <button className="qs-sub-accordion__trigger" onClick={() => toggleInfoSection("students")}>
                    <span className="qs-sub-accordion__title">{t("universityDetails.studentsStaff")}</span>
                    <ChevronDown className={`qs-sub-accordion__chevron ${openInfoSections.students ? "qs-sub-accordion__chevron--open" : ""}`} />
                  </button>
                  {openInfoSections.students && (
                    <div className="qs-sub-accordion__body">
                      <div className="qs-students-visual">
                        <div className="qs-students-visual__row">
                          <div className="qs-students-visual__main">
                            <span className="qs-students-visual__label">{t("universityDetails.totalStudents")}</span>
                            <span className="qs-students-visual__big">{totalStudents.toLocaleString(uiLocale)}</span>
                          </div>
                        </div>
                        {intlStudents > 0 && (
                          <StatBar 
                            label={t("universityDetails.internationalStudents")} 
                            value={`${intlStudents.toLocaleString(uiLocale)} (${intlPercent}%)`}
                            percent={intlPercent}
                            color="hsl(var(--primary))"
                          />
                        )}
                        {item?.university_type && (
                          <div className="qs-students-visual__row">
                            <div className="qs-students-visual__main">
                              <span className="qs-students-visual__label">{t("universityDetails.stat.type")}</span>
                              <span className="qs-students-visual__big capitalize">{item.university_type === "public" ? t("universityDetails.stat.public") : t("universityDetails.stat.private")}</span>
                            </div>
                          </div>
                        )}
                        {item?.founded_year && (
                          <div className="qs-students-visual__row">
                            <div className="qs-students-visual__main">
                              <span className="qs-students-visual__label">{t("universityDetails.founded")}</span>
                              <span className="qs-students-visual__big">{item.founded_year}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {(item?.annual_fees || item?.monthly_living) && (
                        <div className="qs-costs-grid">
                          {item?.annual_fees && (
                            <div className="qs-cost-card">
                              <DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--accent))' }} />
                              <div>
                                <span className="qs-cost-card__label">{t("universityDetails.stat.annualFees")}</span>
                                <span className="qs-cost-card__value">{money(item.annual_fees, item.currency_code, uiLocale)}</span>
                              </div>
                            </div>
                          )}
                          {item?.monthly_living && (
                            <div className="qs-cost-card">
                              <Home className="h-5 w-5" style={{ color: 'hsl(var(--primary))' }} />
                              <div>
                                <span className="qs-cost-card__label">{t("universityDetails.stat.livingCost")}</span>
                                <span className="qs-cost-card__value">{money(item.monthly_living, item.currency_code, uiLocale)}/{t("universityDetails.perMonth")}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── SCHOLARSHIPS ── */}
          {activeSection === "scholarships" && (canControl || pageSettings.scholarships_visible) && (
            <section className="qs-section">
              <h2 className="qs-section__title">{t("universityDetails.scholarshipsAvailable")} <span className="qs-section__count">({scholarships.length})</span></h2>
              {scholarships.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scholarships.map((s: any) => <ScholarshipCard key={s.id} s={s} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Award className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">{t("universityDetails.noScholarships")}</p>
                </div>
              )}
            </section>
          )}


          {/* ── DORMITORY ── */}
          {activeSection === "dormitory" && (item?.has_dorm || housing.length > 0 || dormImages.length > 0) && (
            <section className="qs-section">
              <h2 className="qs-section__title">{t("universityDetails.dormTitle")}</h2>
              {dormImages.length > 0 && (
                <div className="qs-gallery-grid" style={{ marginBottom: 20 }}>
                  {dormImages.slice(0, 4).map((url, i) => (
                    <div key={i} className="qs-gallery-grid__item" onClick={() => setLightboxIdx(i)}>
                      <img src={url} alt={`${uniName} ${t("universityDetails.dormTitle")} ${i + 1}`} loading="lazy" />
                    </div>
                  ))}
                </div>
              )}
              <div className="qs-info-block">
                {item?.dorm_price_monthly_local && (
                  <div className="qs-cost-card" style={{ marginBottom: 16 }}>
                    <Home className="h-5 w-5" style={{ color: 'hsl(var(--primary))' }} />
                    <div>
                      <span className="qs-cost-card__label">{t("universityDetails.dormMonthlyCost")}</span>
                      <span className="qs-cost-card__value">{money(item.dorm_price_monthly_local, item.currency_code, uiLocale)}/{t("universityDetails.perMonth")}</span>
                    </div>
                  </div>
                )}
                {housing.map((h: any) => (
                  <div key={h.id}>
                    <div className="qs-students-grid">
                       {h.dormitories_count && <div className="qs-student-stat"><span className="qs-student-stat__label">{t("universityDetails.buildings")}</span><span className="qs-student-stat__value">{h.dormitories_count}</span></div>}
                       {h.capacity_total && <div className="qs-student-stat"><span className="qs-student-stat__label">{t("universityDetails.capacity")}</span><span className="qs-student-stat__value">{h.capacity_total.toLocaleString(uiLocale)}</span></div>}
                    </div>
                    {h.facilities?.length > 0 && (
                      <div className="qs-requirements-list" style={{ marginTop: 12 }}>
                        {h.facilities.map((f: string, fi: number) => (
                          <div key={fi} className="qs-requirement-item"><CheckCircle className="h-4 w-4" /><span>{f}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── CAMPUS LOCATIONS / MAP ── */}
          {activeSection === "campus-locations" && (
            <section className="qs-section">
              <UniversityLocationMap
                universityName={uniName}
                universityLogo={item?.logo_url}
                geo_lat={item?.geo_lat}
                geo_lon={item?.geo_lon}
                geo_source={item?.geo_source}
                city={item?.city}
                countryName={countryName}
                housingLocations={housingLocations}
                alwaysExpanded
              />
            </section>
          )}

          {/* ── GALLERY ── */}
          {activeSection === "gallery" && galleryImages.length > 0 && (
            <section className="qs-section">
              <h2 className="qs-section__title">{t("universityDetails.gallery")} <span className="qs-section__count">({galleryImages.length})</span></h2>
              <div className="qs-gallery-grid">
                {galleryImages.map((url, i) => (
                  <div key={i} className="qs-gallery-grid__item" onClick={() => setLightboxIdx(i)}>
                    <img src={url} alt={`${uniName} ${i + 1}`} loading="lazy" />
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
      )}
        </div>{/* content area div */}
        </div>{/* fb-full-layout__main */}
      </div>{/* fb-full-layout */}

      {/* ── SIMILAR UNIVERSITIES (always visible for students) ── */}
      {!canControl && similarUnis.length > 0 && (
        <section className="w-full max-w-7xl mx-auto px-4 py-10">
          <div className="qs-similar-header">
            <h2 className="qs-section__title">{t("universityDetails.similarTitle")}</h2>
            <div className="qs-similar-nav">
              <button className="qs-similar-nav__btn" onClick={() => { const el = document.querySelector('.qs-similar-scroll'); if (el) el.scrollBy({ left: -340, behavior: 'smooth' }); }}><ChevronRight className="h-5 w-5 rotate-180" /></button>
              <button className="qs-similar-nav__btn" onClick={() => { const el = document.querySelector('.qs-similar-scroll'); if (el) el.scrollBy({ left: 340, behavior: 'smooth' }); }}><ChevronRight className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="qs-similar-scroll">
            {similarUnis.map((u: any) => (
              <div key={u.id} className="qs-similar-card-v3">
                <Link to={`/university/${u.id}`} className="qs-similar-card-v3__hero">
                  {u.image_url ? (
                    <img src={u.image_url} alt={u.name} className="qs-similar-card-v3__hero-img" loading="lazy" />
                  ) : (
                    <div className="qs-similar-card-v3__hero-ph" />
                  )}
                  <div className="qs-similar-card-v3__hero-overlay" />
                  <div className="qs-similar-card-v3__hero-content">
                    {u.logo_url && <img src={u.logo_url} alt="" className="qs-similar-card-v3__logo" />}
                    <span className="qs-similar-card-v3__name">{getField(u, 'name') || u.name}</span>
                  </div>
                </Link>
                <div className="qs-similar-card-v3__loc">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{u.city ? `${u.city}, ` : ""}{language === 'ar' ? (u.country_name || countryName) : (u.country_name_en || u.country_name || countryName)}</span>
                </div>
                <div className="qs-similar-card-v3__stats">
                  <div className="qs-similar-card-v3__stat-box">
                    <Award className="h-5 w-5" />
                    <span className="qs-similar-card-v3__stat-value">{u.qs_rank ? `# ${u.qs_rank}` : "—"}</span>
                    <span className="qs-similar-card-v3__stat-label">{t("universityDetails.rankingLabel.qsWorld")}</span>
                  </div>
                  <div className="qs-similar-card-v3__stat-box">
                    <GraduationCap className="h-5 w-5" />
                    <span className="qs-similar-card-v3__stat-value">{u.programs_count ?? "—"}</span>
                    <span className="qs-similar-card-v3__stat-label">{t("universityDetails.availablePrograms")}</span>
                  </div>
                </div>
                <div className="qs-similar-card-v3__footer">
                  <Link to={`/university/${u.id}`} className="qs-similar-card-v3__view-btn">{t("universityDetails.viewDetails")}</Link>
                </div>
                <div className="qs-similar-card-v3__actions">
                  <button className="qs-similar-card-v3__action-btn" title={t("universityDetails.shortlist")}><Heart className="h-4 w-4" />{t("universityDetails.shortlist")}</button>
                  <button className="qs-similar-card-v3__action-btn" title={t("program.compare")} onClick={() => {
                    if (!maxReached) { addToCompare(u.id); toast({ title: t("compare.added") }); }
                    else { toast({ title: t("compare.max_reached"), variant: "destructive" }); }
                  }}><GitCompare className="h-4 w-4" />{t("program.compare")}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== CTA FOOTER (student-only) ===== */}
      {!canControl && (
      <div className="qs-cta-footer">
        <div className="qs-cta-footer__content">
          <h2 className="qs-cta-footer__title">{t("universityDetails.ctaTitle")}</h2>
          <p className="qs-cta-footer__desc">{t("universityDetails.ctaDesc", { name: uniName })}</p>
          <Button size="lg" className="qs-cta-footer__btn" onClick={() => navigate(`${localizePath("/apply")}?universities=${item.university_id}`)}>
            <GraduationCap className="ml-2 h-5 w-5" />{t("universityDetails.applyNow")}
          </Button>
        </div>
      </div>
      )}

      {/* LIGHTBOX */}
      {lightboxIdx !== null && (
        <Lightbox images={galleryImages} index={lightboxIdx} onClose={() => setLightboxIdx(null)} onNav={setLightboxIdx} />
      )}
    </ShellComponent>
  );
}
