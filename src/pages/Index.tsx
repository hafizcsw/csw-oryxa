import { useEffect, useMemo, useState, useRef, useCallback, lazy, Suspense } from "react";
import { AutoPlayVideoCard } from "@/components/AutoPlayVideoCard";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DSButton } from "@/components/design-system/DSButton";
import { DSIconGridItem } from "@/components/design-system/DSIconGridItem";
import { useChat, ChatProvider } from "@/contexts/ChatContext";
// RecommendedPrograms import removed - was unused and causing side effects
import { CarouselIndicators } from "@/components/ui/carousel-indicators";
import UniversitiesHero from "@/sections/UniversitiesHero";
// HeroSection stays static (above-the-fold).
import { HeroSection } from "@/components/home/HeroSection";

import { LazyMount } from "@/components/perf/LazyMount";
// Below-the-fold: lazy-load to keep initial bundle small.
const WorldMapSection = lazy(() => import("@/components/home/WorldMapSection").then(m => ({ default: m.WorldMapSection })));
const CSWCoinSection = lazy(() => import("@/components/home/CSWCoinSection").then(m => ({ default: m.CSWCoinSection })));
const MoneyTransferSection = lazy(() => import("@/components/home/MoneyTransferSection").then(m => ({ default: m.MoneyTransferSection })));
const WhyChooseUsSection = lazy(() => import("@/components/home/WhyChooseUsSection").then(m => ({ default: m.WhyChooseUsSection })));
const OrxRankSection = lazy(() => import("@/components/home/OrxRankSection").then(m => ({ default: m.OrxRankSection })));
const AboutOryxaSection = lazy(() => import("@/components/home/AboutOryxaSection").then(m => ({ default: m.AboutOryxaSection })));
const InstitutionsSection = lazy(() => import("@/components/home/InstitutionsSection").then(m => ({ default: m.InstitutionsSection })));
const UniversityCommunitySection = lazy(() => import("@/components/home/UniversityCommunitySection").then(m => ({ default: m.UniversityCommunitySection })));
const PartnersMarquee = lazy(() => import("@/components/home/PartnersMarquee").then(m => ({ default: m.PartnersMarquee })));
import heroImage from "@/assets/hero-students.jpg";
import { Search, Heart, Globe, ChevronDown, Home, Plane, Banknote, GraduationCap, HeartPulse, Smartphone, Coins, FileText, LucideIcon, MapPin, ChevronRight, ArrowRight, Play, TrendingUp, Award, Users, Bitcoin } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { getSettings, getHomeIcons, getCountries, getTestimonials, getPosts, getFooterLinks, getDegrees, getCertificateTypes, type Settings, type HomeIcon, type Country, type Testimonial, type Post, type FooterLink, type Degree, type CertificateType } from "@/lib/data.home";
import { track } from "@/lib/analytics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCountryName } from "@/hooks/useCountryName";
import { cn } from "@/lib/utils";
import { SEARCH_TABS, type TabKey, DEFAULT_TAB } from "@/config/searchTabs";
type Filters = {
  q: string;
  fees_max: number;
  living_max: number;
  country: string;
  degree: string;
  certificate: string;
  subject: string;
  language: string;
};

// Icon mapping from icon_key to Lucide icons with colors
const getIconComponent = (iconKey: string): {
  icon: LucideIcon;
  color: string;
} | undefined => {
  const iconMap: Record<string, {
    icon: LucideIcon;
    color: string;
  }> = {
    'home': {
      icon: Home,
      color: 'text-green-600'
    },
    'house': {
      icon: Home,
      color: 'text-green-600'
    },
    'accommodation': {
      icon: Home,
      color: 'text-green-600'
    },
    'plane': {
      icon: Plane,
      color: 'text-blue-600'
    },
    'airport': {
      icon: Plane,
      color: 'text-blue-600'
    },
    'flight': {
      icon: Plane,
      color: 'text-blue-600'
    },
    'banknote': {
      icon: Banknote,
      color: 'text-purple-600'
    },
    'bank': {
      icon: Banknote,
      color: 'text-purple-600'
    },
    'money': {
      icon: Coins,
      color: 'text-yellow-600'
    },
    'graduation': {
      icon: GraduationCap,
      color: 'text-indigo-600'
    },
    'course': {
      icon: GraduationCap,
      color: 'text-indigo-600'
    },
    'education': {
      icon: GraduationCap,
      color: 'text-indigo-600'
    },
    'heart': {
      icon: HeartPulse,
      color: 'text-blue-500'
    },
    'health': {
      icon: HeartPulse,
      color: 'text-blue-500'
    },
    'medical': {
      icon: HeartPulse,
      color: 'text-blue-500'
    },
    'sim': {
      icon: Smartphone,
      color: 'text-blue-600'
    },
    'phone': {
      icon: Smartphone,
      color: 'text-blue-600'
    },
    'mobile': {
      icon: Smartphone,
      color: 'text-blue-600'
    },
    'coins': {
      icon: Coins,
      color: 'text-yellow-600'
    },
    'transfer': {
      icon: Coins,
      color: 'text-yellow-600'
    },
    'passport': {
      icon: FileText,
      color: 'text-indigo-600'
    },
    'visa': {
      icon: FileText,
      color: 'text-indigo-600'
    },
    'document': {
      icon: FileText,
      color: 'text-indigo-600'
    },
    'translation': {
      icon: FileText,
      color: 'text-teal-600'
    },
    'translation_russia': {
      icon: FileText,
      color: 'text-teal-600'
    },
    'bitcoin': {
      icon: Bitcoin,
      color: 'text-amber-500'
    },
    'crypto': {
      icon: Bitcoin,
      color: 'text-amber-500'
    },
    'csw-coin': {
      icon: Bitcoin,
      color: 'text-amber-500'
    }
  };
  const mapped = iconMap[iconKey.toLowerCase()];
  return mapped;
};

// Service copy mapping (translated)
type ServiceCopyConfig = { titleKey: string; descriptionKey: string };

const SERVICE_COPY: Record<string, ServiceCopyConfig> = {
  accommodation: { titleKey: "services.accommodation.title", descriptionKey: "services.accommodation.desc" },
  home: { titleKey: "services.accommodation.title", descriptionKey: "services.accommodation.desc" },
  airport: { titleKey: "services.airport.title", descriptionKey: "services.airport.desc" },
  plane: { titleKey: "services.airport.title", descriptionKey: "services.airport.desc" },
  flight: { titleKey: "services.airport.title", descriptionKey: "services.airport.desc" },
  bank: { titleKey: "services.bank.title", descriptionKey: "services.bank.desc" },
  banknote: { titleKey: "services.bank.title", descriptionKey: "services.bank.desc" },
  money: { titleKey: "services.transfer.title", descriptionKey: "services.transfer.desc" },
  transfer: { titleKey: "services.transfer.title", descriptionKey: "services.transfer.desc" },
  coins: { titleKey: "services.transfer.title", descriptionKey: "services.transfer.desc" },
  course: { titleKey: "services.course.title", descriptionKey: "services.course.desc" },
  education: { titleKey: "services.course.title", descriptionKey: "services.course.desc" },
  graduation: { titleKey: "services.course.title", descriptionKey: "services.course.desc" },
  "graduation-cap": { titleKey: "services.course.title", descriptionKey: "services.course.desc" },
  health: { titleKey: "services.health.title", descriptionKey: "services.health.desc" },
  heart: { titleKey: "services.health.title", descriptionKey: "services.health.desc" },
  medical: { titleKey: "services.health.title", descriptionKey: "services.health.desc" },
  sim: { titleKey: "services.sim.title", descriptionKey: "services.sim.desc" },
  phone: { titleKey: "services.sim.title", descriptionKey: "services.sim.desc" },
  mobile: { titleKey: "services.sim.title", descriptionKey: "services.sim.desc" },
  visa: { titleKey: "services.visa.title", descriptionKey: "services.visa.desc" },
  passport: { titleKey: "services.visa.title", descriptionKey: "services.visa.desc" },
  translation: { titleKey: "services.translation_russia.title", descriptionKey: "services.translation_russia.desc" },
  translation_russia: { titleKey: "services.translation_russia.title", descriptionKey: "services.translation_russia.desc" },
  document: { titleKey: "services.translation_russia.title", descriptionKey: "services.translation_russia.desc" },
  "csw-coin": { titleKey: "services.csw.title", descriptionKey: "services.csw.desc" },
  bitcoin: { titleKey: "services.csw.title", descriptionKey: "services.csw.desc" },
  crypto: { titleKey: "services.csw.title", descriptionKey: "services.csw.desc" },
};

const getServiceCopy = (
  t: (key: string) => string,
  iconKey: string,
  fallbackTitle: string
): { title: string; description: string } => {
  const normalized = (iconKey || "").toLowerCase();
  const cfg = SERVICE_COPY[normalized];

  return {
    title: cfg ? t(cfg.titleKey) : fallbackTitle,
    description: cfg ? t(cfg.descriptionKey) : t("services.default.desc"),
  };
};
const Index = () => {
  const { t, language } = useLanguage();
  const { getCountryName } = useCountryName();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { open: openOldChat } = useChat(); // For old FloatingChat component
  const plugin = useRef(
    Autoplay({
      delay: 5000,
      stopOnInteraction: true,
    })
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [icons, setIcons] = useState<HomeIcon[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [footer, setFooter] = useState<FooterLink[]>([]);
  const [degrees, setDegrees] = useState<Degree[]>([]);
  const [certs, setCerts] = useState<CertificateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselApi, setCarouselApi] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [countriesPage, setCountriesPage] = useState(1);
  const visibleIcons = useMemo(() => {
    const seen = new Set<string>();
    const hiddenKeys = new Set(["csw-coin", "bitcoin", "crypto"]);

    return icons.filter((icon) => {
      const normalizedKey = (icon.icon_key || "").toLowerCase();
      if (hiddenKeys.has(normalizedKey)) return false;

      const serviceCopy = getServiceCopy(t, icon.icon_key, icon.title);
      const dedupeKey = [
        icon.route_path || "",
        serviceCopy.title.trim().toLowerCase(),
        serviceCopy.description.trim().toLowerCase(),
      ].join("::");

      if (seen.has(dedupeKey)) {
        return false;
      }

      seen.add(dedupeKey);
      return true;
    });
  }, [icons, t]);
  // Get current tab from URL or default
  const currentTab = searchParams.get("tab") as TabKey || DEFAULT_TAB;

  // Hero filters state
  const [heroFilters, setHeroFilters] = useState<Record<string, any>>({});
  useEffect(() => {
    async function load() {
      const [s, ic, cs, ts, ps, fl, dg, ct] = await Promise.all([getSettings(), getHomeIcons(), getCountries(), getTestimonials(), getPosts(), getFooterLinks(), getDegrees(), getCertificateTypes()]);
      setSettings(s);
      setIcons(ic);
      setCountries(cs);
      setTestimonials(ts);
      setPosts(ps);
      setFooter(fl);
      setDegrees(dg);
      setCerts(ct);
      setLoading(false);
    }
    load();
  }, []);
  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);
  const uiDateLocale = useMemo(() => {
    const localeByLanguage: Record<string, string> = {
      en: "en-US",
      ar: "ar-EG",
      bn: "bn-BD",
      de: "de-DE",
      es: "es-ES",
      fr: "fr-FR",
      hi: "hi-IN",
      ja: "ja-JP",
      ko: "ko-KR",
      pt: "pt-PT",
      ru: "ru-RU",
      zh: "zh-CN",
    };

    return localeByLanguage[language] || "en-US";
  }, [language]);
  const groupedFooter = useMemo(() => {
    const m: Record<string, FooterLink[]> = {};
    footer.forEach(l => {
      if (!m[l.group]) m[l.group] = [];
      m[l.group].push(l);
    });
    return m;
  }, [footer]);
  // ✅ Use unified shortlist from context (via useMalakChat)
  const shortlistCount = useMemo(() => {
    try {
      // Read from guest_shortlist (context source)
      const list = JSON.parse(localStorage.getItem("guest_shortlist") || "[]");
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return 0;
    }
  }, []);
  const goSearch = useCallback(() => {
    const params = new URLSearchParams();
    params.set('tab', currentTab);

    // Add hero filters
    Object.entries(heroFilters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });

    // Unified telemetry
    track("button_clicked", {
      button_id: 'hero_get_started',
      location: 'hero',
      tab: currentTab,
      filters: Object.fromEntries(params.entries())
    });
    navigate(`/search?${params.toString()}`);
  }, [currentTab, heroFilters, navigate]);
  const handleHeroFiltersChange = useCallback((newFilters: Record<string, any>) => {
    setHeroFilters(newFilters);

    // Update URL with new filters
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', currentTab);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        newParams.set(key, String(value));
      } else {
        newParams.delete(key);
      }
    });
    navigate(`/?${newParams.toString()}`, {
      replace: true
    });
  }, [currentTab, navigate, searchParams]);
  const handleChipClick = useCallback((id: string, path: string) => {
    track("nav_aux_click", {
      id
    });
    navigate(path);
  }, [navigate]);
  const onIconClick = useCallback((icon: HomeIcon) => {
    track("service_icon_clicked", {
      id: icon.id,
      title: icon.title
    });
    if (icon.action_type === "coming_soon") {
      alert(t("common.comingSoon"));
      return;
    }
    navigate(icon.route_path);
  }, [navigate, t]);
  const handleCountryClick = useCallback((slug: string) => {
    track("country_card_click", {
      slug
    });
    navigate(`/country/${slug}`);
  }, [navigate]);
  const handlePostClick = useCallback((id: string, slug: string) => {
    track("post_click", {
      id,
      slug
    });
  }, []);

  // ✅ visitorId must be before early return to follow Rules of Hooks
  const visitorId = useMemo(() => {
    return localStorage.getItem("visitor_id") || crypto.randomUUID();
  }, []);

  if (loading) {
    return <Layout>
        <div className="min-h-[70vh] flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
          <div className="space-y-4 text-center">
            <div className="relative inline-block">
              <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
            </div>
            <p className="text-muted-foreground text-lg font-medium">{t("common.loading")}</p>
          </div>
        </div>
      </Layout>;
  }

  return (
    <ChatProvider>
      <Layout>
          {/* Hero — untouched */}
          <HeroSection />

          <Suspense fallback={<div className="min-h-[400px]" />}>
            {/* 1. Mission statement */}
            <AGSection eyebrow={t("home.ag.eyebrow.mission")}>
              <AGStatement
                headline={t("home.ag.statement1.headline")}
                description={t("home.ag.statement1.desc")}
              />
            </AGSection>

            {/* 2. Student journey triptych */}
            <AGSection eyebrow={t("home.ag.eyebrow.journey")}>
              <AGTriptych>
                {(["discover", "decide", "depart"] as const).map((k, i) => (
                  <AGCard key={k} index={i}>
                    <h3 className="text-2xl md:text-[28px] font-semibold tracking-[-0.01em] mb-3">
                      {t(`home.ag.triptych1.${k}.title`)}
                    </h3>
                    <p className="text-[var(--ag-muted)] leading-relaxed text-[15px]">
                      {t(`home.ag.triptych1.${k}.desc`)}
                    </p>
                  </AGCard>
                ))}
              </AGTriptych>
            </AGSection>

            {/* 3. World map (kept, restyled wrapper) */}
            <AGSection eyebrow={t("home.ag.eyebrow.global")} innerClassName="!max-w-[1400px]">
              <LazyMount minHeight={400}><WorldMapSection /></LazyMount>
            </AGSection>

            {/* 4. Built-for global students statement */}
            <AGSection>
              <AGStatement
                headline={t("home.ag.statement2.headline")}
                description={t("home.ag.statement2.desc")}
              />
            </AGSection>

            {/* 5. Use-case triptych */}
            <AGSection eyebrow={t("home.ag.eyebrow.platform")}>
              <AGTriptych>
                {(["undergrad", "postgrad", "scholarship"] as const).map((k, i) => (
                  <AGCard key={k} index={i}>
                    <h3 className="text-2xl md:text-[28px] font-semibold tracking-[-0.01em] mb-3">
                      {t(`home.ag.triptych2.${k}.title`)}
                    </h3>
                    <p className="text-[var(--ag-muted)] leading-relaxed text-[15px]">
                      {t(`home.ag.triptych2.${k}.desc`)}
                    </p>
                  </AGCard>
                ))}
              </AGTriptych>
            </AGSection>

            {/* 6. About ORYXA (kept) */}
            <AGSection>
              <LazyMount minHeight={400}><AboutOryxaSection /></LazyMount>
            </AGSection>

            {/* 7. Partners marquee (kept) */}
            <LazyMount minHeight={300}><PartnersMarquee /></LazyMount>

            {/* 8. Dark anchor band with particles */}
            <AGAnchorBand
              headline={t("home.ag.anchor.headline")}
              primaryCta={{
                label: t("home.ag.anchor.primary"),
                onClick: goSearch,
              }}
              secondaryCta={{
                label: t("home.ag.anchor.secondary"),
                onClick: openOldChat,
              }}
            />

            {/* 9. Footer-anchor display word */}
            <AGDisplayAnchor word={t("home.ag.display")} />
          </Suspense>
        </Layout>
      </ChatProvider>
  );
};
export default Index;
