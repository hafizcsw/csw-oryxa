import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { AutoPlayVideoCard } from "@/components/AutoPlayVideoCard";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DSButton } from "@/components/design-system/DSButton";
import { DSIconGridItem } from "@/components/design-system/DSIconGridItem";
import { useChat, ChatProvider } from "@/contexts/ChatContext";
import { MalakChatInterface } from "@/components/chat/MalakChatInterface";
// RecommendedPrograms import removed - was unused and causing side effects
import { CarouselIndicators } from "@/components/ui/carousel-indicators";
import UniversitiesHero from "@/sections/UniversitiesHero";
import AiAdvisor from "@/components/AiAdvisor";
import { HeroSection } from "@/components/home/HeroSection";
import { WorldMapSection } from "@/components/home/WorldMapSection";
import { CSWCoinSection } from "@/components/home/CSWCoinSection";
import { MoneyTransferSection } from "@/components/home/MoneyTransferSection";
import { WhyChooseUsSection } from "@/components/home/WhyChooseUsSection";
import { OrxRankSection } from "@/components/home/OrxRankSection";
import { AboutOryxaSection } from "@/components/home/AboutOryxaSection";
import { InstitutionsSection } from "@/components/home/InstitutionsSection";
import { PartnersMarquee } from "@/components/home/PartnersMarquee";
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
          {/* Hero Section with Integrated Chat */}
          <HeroSection />

          {/* About ORYXA */}
          <AboutOryxaSection />

          {/* Enhanced Services Section */}
          <section className="py-20 px-6 bg-gradient-to-b from-background to-muted/30">
            <div className="max-w-7xl mx-auto">
              <div className="text-center space-y-3 mb-16">
                <h2 className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  {t("home.services.heading")}
                </h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  {t("home.services.subheading")}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {visibleIcons.map((icon, index) => {
                  const iconData = getIconComponent(icon.icon_key);
                  const serviceCopy = getServiceCopy(t, icon.icon_key, icon.title);
                  return (
                    <DSIconGridItem
                      key={icon.id}
                      icon={iconData?.icon}
                      iconKey={icon.icon_key}
                      iconColor={iconData?.color}
                      title={serviceCopy.title}
                      description={serviceCopy.description}
                      comingSoon={icon.action_type === 'coming_soon'}
                      onClick={() => onIconClick(icon)}
                    />
                  );
                })}
              </div>
            </div>
          </section>

          {/* Institutions Section */}
          <InstitutionsSection />

          {/* ORX RANK Section */}
          <OrxRankSection />

          {/* Interactive World Map */}
          <WorldMapSection />

          {/* Enhanced Study Destinations Section */}
          <section id="destinations" className="py-20 px-6 bg-background">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col items-center text-center mb-12 gap-6">
                <div className="space-y-2">
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {t("home.destinations.title")}
                  </h2>
                  <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    {t("home.destinations.subtitle")}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/universities?tab=programs')}
                  className="group inline-flex items-center justify-center gap-2 text-purple-600 hover:text-purple-700 font-semibold transition-all duration-300 hover:gap-3"
                >
                  {t("home.destinations.viewAll")}
                  <ChevronRight className="group-hover:translate-x-[-4px] transition-transform" />
                </button>
              </div>
              
              <Carousel key={`destinations-${language}`} plugins={[plugin.current]} setApi={setCarouselApi} className="w-full" opts={{ direction: "ltr" }} dir="ltr">
                <CarouselContent>
                  {countries.map((country, index) => (
                    <CarouselItem key={country.id} className="md:basis-1/2 lg:basis-1/3">
                      <div
                        className="group cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${index * 80}ms` }}
                        onClick={() => handleCountryClick(country.slug)}
                      >
                        <div className="overflow-hidden border-2 border-border/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] rounded-xl bg-card">
                          <div className="relative overflow-hidden">
                            <img 
                              src={country.image_url || '/placeholder.svg'} 
                              alt={getCountryName(country.slug, country.name_en || country.name_ar)} 
                              loading={index < 3 ? "eager" : "lazy"}
                              decoding="async"
                              className="w-full h-56 object-cover group-hover:scale-110 transition-transform duration-500" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </div>
                          <div className="p-6 space-y-2">
                            <h3 className="font-bold text-xl group-hover:text-purple-600 transition-colors">
                              {getCountryName(country.slug, country.name_en || country.name_ar)}
                            </h3>
                            <p className="text-muted-foreground flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              {t("home.destinations.explore")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-2 hover:bg-purple-100 dark:hover:bg-purple-900/30" />
                <CarouselNext className="right-2 hover:bg-purple-100 dark:hover:bg-purple-900/30" />
              </Carousel>
              
              <div className="mt-8">
                <CarouselIndicators 
                  count={countries.length} 
                  activeIndex={currentSlide}
                  onIndicatorClick={(index) => carouselApi?.scrollTo(index)}
                />
              </div>
            </div>
          </section>


          {/* Enhanced Testimonials Section */}
          {testimonials.length > 0 && (
            <section className="py-20 px-6 bg-gradient-to-b from-muted/30 to-background">
              <div className="max-w-7xl mx-auto">
                <div className="text-center space-y-3 mb-16">
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                    {t("home.testimonials.title")}
                  </h2>
                  <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    {t("home.testimonials.subtitle")}
                  </p>
                </div>
                
                <Carousel key={`testimonials-${language}`} className="w-full" opts={{ direction: "ltr", align: "start", loop: true }} dir="ltr">
                  <CarouselContent>
                    {testimonials.map((testimonial, index) => (
                      <CarouselItem key={testimonial.id} className="md:basis-1/2 lg:basis-1/3">
                        <AutoPlayVideoCard testimonial={testimonial} index={index} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious />
                  <CarouselNext />
                </Carousel>
              </div>
            </section>
          )}

          {/* Enhanced Blog Posts Section */}
          {posts.length > 0 && (
            <section className="py-20 px-6 bg-background">
              <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-12">
                  <div>
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent mb-2">
                      {t("home.blog.title")}
                    </h2>
                    <p className="text-muted-foreground text-lg">
                      {t("home.blog.subtitle")}
                    </p>
                  </div>
                  <button 
                    onClick={() => navigate('/blog')} 
                    className="group flex items-center gap-2 text-violet-600 hover:text-violet-700 font-semibold transition-all duration-300 hover:gap-3"
                  >
                    {t("home.blog.viewAll")}
                    <ChevronRight className="group-hover:translate-x-[-4px] transition-transform" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {posts.slice(0, 6).map((post, index) => (
                    <div
                      key={post.id}
                      className="group cursor-pointer animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                      onClick={() => {
                        handlePostClick(post.id, post.slug);
                        navigate(`/blog/${post.slug}`);
                      }}
                    >
                      <div className="h-full overflow-hidden border-2 border-border/50 hover:border-violet-500/50 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] rounded-xl bg-card">
                        {post.image_url && (
                          <div className="relative overflow-hidden h-52">
                            <img 
                              src={post.image_url} 
                              alt={post.title} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </div>
                        )}
                        <div className="p-6 flex-1 flex flex-col space-y-3">
                          <h3 className="font-bold text-xl group-hover:text-violet-600 transition-colors line-clamp-2">
                            {post.title}
                          </h3>
                          {post.excerpt && (
                            <p className="text-muted-foreground text-sm line-clamp-3 flex-1 leading-relaxed">
                              {post.excerpt}
                            </p>
                          )}
                          <div className="flex items-center justify-between pt-3 border-t border-border/50">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {new Date(post.published_at).toLocaleDateString(uiDateLocale)}
                            </span>
                            <ArrowRight className="w-4 h-4 text-violet-600 group-hover:translate-x-[-4px] transition-transform" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}


        </Layout>
      </ChatProvider>
  );
};
export default Index;
