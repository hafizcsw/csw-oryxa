// @ts-nocheck
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/seo/SEOHead";
import { generateBreadcrumbSchema } from "@/utils/seo/schemas";
import { generateFAQSchema, countryFAQs } from "@/utils/seo/faqSchema";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, GraduationCap, Star, Building2, Users, TrendingUp, 
  Globe, Award, Briefcase, Heart, Home, Plane, FileText,
  CheckCircle2, BookOpen, Clock, DollarSign, ChevronDown
} from "lucide-react";
import { track } from "@/lib/telemetry";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SEARCH_TABS, type TabKey, DEFAULT_TAB } from "@/config/searchTabs";
import { useShortlist } from "@/hooks/useShortlist";
import { useGuestAwareShortlist } from "@/hooks/useGuestShortlist";
import { useChat } from "@/contexts/ChatContext";
import logo from "@/assets/logo-connect-study-world.png";
import "@/styles/universities-hero.css";
import HeroStudyDestination from "@/components/HeroStudyDestination";
import { StickyNavigation } from "@/components/country/StickyNavigation";

export default function StudyInCountry() {
  const { countrySlug } = useParams<{ countrySlug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { shortlist } = useShortlist();
  const shortlistCount = shortlist.length;
  const { open: openChat } = useChat();
  const [shortlistIds, setShortlistIds] = useState<string[]>([]);
  
  // All state hooks first
  const [country, setCountry] = useState<any>(null);
  const [universities, setUniversities] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("overview");
  const [heroFilters, setHeroFilters] = useState<Record<string, any>>({});
  
  // Then refs
  const sectionsRef = useRef<{ [key: string]: HTMLElement | null }>({});
  
  // Computed values after hooks
  const currentTab = (searchParams.get("tab") as TabKey) || DEFAULT_TAB;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5 }
    );

    Object.values(sectionsRef.current).forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  // Define all callbacks BEFORE any early returns
  const handleHeroFiltersChange = useCallback((newFilters: Record<string, any>) => {
    setHeroFilters(newFilters);
  }, []);

  const handleHeroSearch = useCallback(() => {
    const params = new URLSearchParams();
    params.set('tab', currentTab);
    
    // Pre-fill country filter
    if (countrySlug) {
      params.set('country', countrySlug);
    }
    
    Object.entries(heroFilters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });
    
    navigate(`/search?${params.toString()}`);
  }, [currentTab, heroFilters, navigate, countrySlug]);

  // Guest-aware shortlist (no hard redirect)
  const guestShortlist = useGuestAwareShortlist();

  useEffect(() => {
    loadCountryData();
  }, [countrySlug]);

  // Sync shortlistIds from guest-aware hook
  useEffect(() => {
    const ids = guestShortlist.items.map((i: any) => i.program_id);
    setShortlistIds(ids);
  }, [guestShortlist.items]);

  const handleToggleShortlist = async (universityId: string) => {
    try {
      if (guestShortlist.isInShortlist(universityId)) {
        await guestShortlist.remove(universityId);
      } else {
        await guestShortlist.add(universityId);
      }
    } catch (error) {
      console.error('Error toggling shortlist:', error);
    }
  };

  const loadCountryData = async () => {
    if (!countrySlug) return;
    
    setLoading(true);
    try {
      const { data: countryData, error: countryError } = await supabase
        .from('countries')
        .select('*')
        .eq('slug', countrySlug)
        .single();

      if (countryError || !countryData) {
        console.error('Country not found:', countrySlug, countryError);
        setLoading(false);
        return;
      }

      setCountry(countryData);
      track('country_page_viewed', { country: countryData.name, slug: countrySlug });

      const { data: uniData, error: uniError } = await supabase.functions.invoke('get-country-universities', {
        body: { slug: countrySlug, limit: 100 }
      });
      
      console.log('Universities response:', { uniData, uniError });
      if (!uniError && uniData?.ok && uniData?.data) {
        setUniversities(uniData.data);
        console.log('Universities loaded:', uniData.data.length);
      } else {
        console.error('Failed to load universities:', uniError || uniData);
      }

      const { data: progData, error: progError } = await supabase.functions.invoke('get-country-programs', {
        body: { slug: countrySlug, limit: 12 }
      });
      
      console.log('Programs response:', { progData, progError });
      if (!progError && progData?.ok && progData?.data) {
        setPrograms(progData.data);
      } else {
        console.error('Failed to load programs:', progError || progData);
      }

      const { data: scholData, error: scholError } = await supabase.functions.invoke('get-country-scholarships', {
        body: { slug: countrySlug, limit: 6 }
      });
      
      console.log('Scholarships response:', { scholData, scholError });
      if (!scholError && scholData?.ok && scholData?.data) {
        setScholarships(scholData.data);
      } else {
        console.error('Failed to load scholarships:', scholError || scholData);
      }

    } catch (error) {
      console.error("Error loading country data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-6 w-full mb-8" />
      </div>
    );
  }

  if (!country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">الدولة غير موجودة</h1>
      </div>
    );
  }

  const siteUrl = window.location.origin;
  const canonicalUrl = country.seo_canonical_url || `${siteUrl}/study-in/${countrySlug}`;
  const breadcrumbs = [
    { name: "الرئيسية", url: siteUrl },
    { name: "الدراسة بالخارج", url: `${siteUrl}/universities?tab=programs` },
    { name: country.name, url: canonicalUrl }
  ];

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navItems = [
    { id: "overview", label: "نظرة عامة", icon: Globe },
    { id: "why-study", label: "لماذا الدراسة هنا", icon: Star },
    { id: "universities", label: "الجامعات", icon: Building2 },
    { id: "programs", label: "البرامج", icon: BookOpen },
    { id: "scholarships", label: "المنح الدراسية", icon: Award },
    { id: "living", label: "الحياة والمعيشة", icon: Home },
    { id: "process", label: "عملية التقديم", icon: FileText },
    { id: "faq", label: "الأسئلة الشائعة", icon: CheckCircle2 }
  ];

  return (
    <>
      <SEOHead
        title={country.seo_title || `الدراسة في ${country.name} 2026`}
        description={country.seo_description || `دليل شامل للدراسة في ${country.name}. أفضل الجامعات والبرامج والمنح الدراسية.`}
        canonical={canonicalUrl}
        index={country.seo_index !== false}
        jsonLd={[generateBreadcrumbSchema(breadcrumbs)]}
      />

      <div className="min-h-screen bg-background">
        {/* Top Navigation Bar */}
        <div className="bg-[#2C3E50] text-white py-2">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1 hover:text-gray-300">
                  <Globe className="w-4 h-4" />
                  English
                </button>
                <a href="#" className="hover:text-gray-300">Find us</a>
                <a href="#" className="hover:text-gray-300">Events</a>
                <a href="#" className="hover:text-gray-300">News and articles</a>
                <a href="#" className="hover:text-gray-300">Community</a>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-b shadow-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Left: Avatar & Admin & Personal Help */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-semibold">
                  H
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="text-sm">
                  Admin
                </Button>
                <Button variant="outline" size="sm" className="rounded-full text-sm gap-2">
                  <Users className="w-4 h-4" />
                  المساعدة الشخصية
                </Button>
                <Button variant="ghost" size="icon" onClick={() => navigate("/shortlist")} className="relative">
                  <Heart className="w-5 h-5" />
                  {shortlistCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs bg-red-500">{shortlistCount}</Badge>
                  )}
                </Button>
                <Button variant="ghost" size="icon">
                  <GraduationCap className="w-5 h-5" />
                </Button>
              </div>

              {/* Center: Main Nav */}
              <nav className="hidden lg:flex items-center gap-6 text-sm">
                <Button
                  onClick={() => { openChat(); track("ai_chat_opened", { source: "country_page" }); }}
                  className="bg-[#00a99d] hover:bg-[#008d84] text-white rounded-full px-6"
                >
                  Help me study abroad
                </Button>
                <button onClick={() => navigate("/essentials")} className="hover:text-primary">Student Essentials</button>
                <button onClick={() => navigate("/languages")} className="hover:text-primary">Languages</button>
                <button onClick={() => navigate("/universities?tab=universities")} className="hover:text-primary">Find a university</button>
                <button onClick={() => navigate("/#destinations")} className="hover:text-primary">Study destinations</button>
                <button onClick={() => navigate("/study-steps")} className="hover:text-primary">Study abroad steps</button>
              </nav>

              {/* Right: Logo */}
              <img src={logo} alt="Connect Study World" className="h-8 w-auto cursor-pointer" onClick={() => navigate("/")} />
            </div>
          </div>
        </div>

        {/* Hero Section - IDP Style */}
        <HeroStudyDestination
          country={country.name}
          fromCountry="UAE"
          onPrimary={() => navigate("/apply")}
        />

        {/* Sticky Navigation */}
        <StickyNavigation activeSection={activeSection} />

        {/* Overview Section */}
        <section 
          id="overview" 
          ref={(el) => (sectionsRef.current.overview = el)}
          className="py-20 bg-background"
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4">اكتشف {country.name}</h2>
                <p className="text-lg text-muted-foreground">وجهة دراسية متميزة تجمع بين التعليم الرفيع والتجربة الحياتية الاستثنائية</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-[#1e3a8a] text-white rounded-2xl p-10 hover-lift">
                  <div className="flex justify-center mb-6">
                    <div className="bg-white/20 p-4 rounded-full">
                      <Award className="w-12 h-12" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-center">التميز التعليمي وضمان الجودة</h3>
                  <p className="leading-relaxed text-center text-sm opacity-90">
                    عندما تختار {country.name} كوجهة دراسية، فأنت تختار مؤسسات تعليمية تلتزم بأعلى المعايير. تلتزم جامعات 
                    الدولة بالمعايير العالمية، وتخضع لتقييم حكومي منتظم، مما يضمن جودة ثابتة في جميع المجالات.
                  </p>
                </div>

                <div className="bg-[#dc2626] text-white rounded-2xl p-10 hover-lift">
                  <div className="flex justify-center mb-6">
                    <div className="bg-white/20 p-4 rounded-full">
                      <Globe className="w-12 h-12" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-center">الجمال الطبيعي والتميز الأكاديمي</h3>
                  <p className="leading-relaxed text-center text-sm opacity-90">
                    الدراسة في {country.name} ليست مجرد رحلة أكاديمية؛ إنها تجربة غامرة في أرض مشهورة بمناظرها الطبيعية الخلابة. 
                    مع تصنيفها كواحدة من أفضل الوجهات التعليمية في العالم، تقدم {country.name} مزيجاً فريداً من التعليم العالمي 
                    والطبيعة الساحرة.
                  </p>
                </div>

                <div className="bg-[#fbbf24] text-slate-900 rounded-2xl p-10 hover-lift">
                  <div className="flex justify-center mb-6">
                    <div className="bg-slate-900/10 p-4 rounded-full">
                      <TrendingUp className="w-12 h-12" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-center">التعلم المدفوع بالابتكار</h3>
                  <p className="leading-relaxed text-center text-sm opacity-90">
                    يربط نظام التعليم في {country.name} بين التقاليد والابتكار. فهو يجمع بين مبادئ التدريس التي أثبتت جدواها 
                    مع التكنولوجيا والأساليب المتطورة. ينتج عن هذا النهج الفريد مؤهلات معترف بها دولياً وفرص عمل عالمية.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Study Section */}
        <section 
          id="why-study"
          ref={(el) => (sectionsRef.current["why-study"] = el)}
          className="py-20 bg-muted/30"
        >
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">لماذا الدراسة في {country.name}؟</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                اكتشف الأسباب التي تجعل آلاف الطلاب يختارون {country.name} كوجهة دراسية مفضلة
              </p>
            </div>

            <div className="flex justify-center items-stretch gap-3 max-w-7xl mx-auto flex-wrap">
              <div className="flex-1 min-w-[180px] max-w-[240px]">
                <Card className="text-center hover-lift border-0 shadow-lg bg-primary text-primary-foreground h-full">
                  <CardContent className="p-6">
                    <div className="inline-flex p-3 bg-white/20 rounded-full mb-3">
                      <Award className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">جامعات مرموقة عالمياً</h3>
                    <p className="text-xs opacity-90 mb-2">
                      {universities.length}+ جامعة ضمن أفضل 500 جامعة عالمياً
                    </p>
                    <div className="text-2xl font-bold">{universities.length}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex-1 min-w-[180px] max-w-[240px]">
                <Card className="text-center hover-lift border-0 shadow-lg bg-secondary text-secondary-foreground h-full">
                  <CardContent className="p-6">
                    <div className="inline-flex p-3 bg-white/20 rounded-full mb-3">
                      <Briefcase className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">فرص عمل ممتازة</h3>
                    <p className="text-xs opacity-90 mb-2">
                      معدل توظيف عالٍ للخريجين
                    </p>
                    <div className="text-2xl font-bold">90%+</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex-1 min-w-[180px] max-w-[240px]">
                <Card className="text-center hover-lift border-0 shadow-lg bg-info text-info-foreground h-full">
                  <CardContent className="p-6">
                    <div className="inline-flex p-3 bg-white/20 rounded-full mb-3">
                      <Users className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">مجتمع دولي متنوع</h3>
                    <p className="text-xs opacity-90 mb-2">
                      طلاب من أكثر من 150 دولة
                    </p>
                    <div className="text-2xl font-bold">150+</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex-1 min-w-[180px] max-w-[240px]">
                <Card className="text-center hover-lift border-0 shadow-lg bg-accent text-accent-foreground h-full">
                  <CardContent className="p-6">
                    <div className="inline-flex p-3 bg-foreground/10 rounded-full mb-3">
                      <Heart className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">جودة حياة عالية</h3>
                    <p className="text-xs opacity-90 mb-2">
                      بيئة آمنة ومرحبة للطلاب الدوليين
                    </p>
                    <div className="text-2xl font-bold">Top 5</div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex-1 min-w-[180px] max-w-[240px]">
                <Card className="text-center hover-lift border-0 shadow-lg bg-gradient-to-br from-purple-600 to-purple-800 text-white h-full">
                  <CardContent className="p-6">
                    <div className="inline-flex p-3 bg-white/20 rounded-full mb-3">
                      <TrendingUp className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">التعلم المدفوع بالابتكار</h3>
                    <p className="text-xs opacity-90 mb-2">
                      بيئة تعليمية حديثة ومبتكرة
                    </p>
                    <div className="text-2xl font-bold">R&D</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Universities Section */}
        {universities.length > 0 && (
          <section 
            id="universities"
            ref={(el) => (sectionsRef.current.universities = el)}
            className="py-20 bg-background"
          >
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4">أفضل الجامعات في {country.name}</h2>
                <p className="text-lg text-muted-foreground">
                  اختر من بين {universities.length} مؤسسة تعليمية معترف بها عالمياً
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {universities.slice(0, 6).map((uni, index) => {
                  // Use generated university images as fallback
                  const universityImages = [
                    '/universities/tum-munich.jpg',
                    '/universities/lmu-munich.jpg',
                    '/universities/heidelberg.jpg',
                    '/universities/humboldt-berlin.jpg',
                    '/universities/fu-berlin.jpg',
                    '/universities/rwth-aachen.jpg',
                  ];
                  const fallbackImage = universityImages[index % universityImages.length];

                  return (
                    <Card key={uni.id} className="hover-lift group overflow-hidden border-2 relative">
                      {/* Heart Icon for Shortlist */}
                      <button 
                        onClick={() => handleToggleShortlist(uni.id)}
                        className="absolute top-4 left-4 z-10 bg-white rounded-full p-2 shadow-md hover:scale-110 transition-transform"
                      >
                        <Heart 
                          className={`w-5 h-5 ${shortlistIds.includes(uni.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                        />
                      </button>

                      {/* University Image Header - 20% of card height */}
                      <div className="relative h-32 bg-gradient-to-br from-primary/5 to-accent/5 overflow-hidden">
                        <img 
                          src={uni.image_url || fallbackImage}
                          alt={uni.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          onError={(e) => {
                            e.currentTarget.src = fallbackImage;
                          }}
                        />
                      </div>

                      <CardHeader className="pb-3 pt-4">
                        <div className="flex items-start gap-3">
                          {/* Logo as small circular icon on the right */}
                          {uni.logo_url && (
                            <div className="w-12 h-12 rounded-full bg-white flex-shrink-0 overflow-hidden border-2 border-border shadow-sm">
                              <img 
                                src={uni.logo_url}
                                alt={uni.name}
                                className="w-full h-full object-contain p-1.5"
                              />
                            </div>
                          )}
                          
                          {/* Title and Location */}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors font-bold mb-1">
                              {uni.name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                              {uni.city || country.name}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Divider */}
                        <div className="border-t border-border" />
                        
                        {/* University Info Grid */}
                        <div className="space-y-2.5 text-sm">
                          {uni.ranking && (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground">THE World Ranking:</span>
                              <span className="font-semibold ml-auto">{uni.ranking}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">نوع المؤسسة:</span>
                            <span className="font-semibold ml-auto">جامعة عامة</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">مكان الدراسة:</span>
                            <span className="font-semibold ml-auto">{uni.city || 'Campus'}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">موعد التقديم:</span>
                            <span className="font-semibold ml-auto">متاح الآن</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">IELTS:</span>
                            <span className="font-semibold ml-auto">6.0 - 6.5</span>
                          </div>

                          {uni.annual_fees && (
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground">الرسوم السنوية:</span>
                              <span className="font-bold ml-auto text-primary">
                                £{(uni.annual_fees/1000).toFixed(0)}k
                              </span>
                            </div>
                          )}
                        </div>

                        <Button className="w-full mt-4" variant="outline" size="sm" asChild>
                          <a href={`/university/${uni.id}`}>
                            عرض التفاصيل
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {universities.length > 6 && (
                <div className="text-center mt-12">
                  <Button 
                    size="lg" 
                    className="px-10 gap-3 shadow-lg hover:shadow-xl" 
                    asChild
                  >
                    <a href={`/universities?tab=universities&country_slug=${country.slug}`} className="flex items-center gap-3">
                      <Building2 className="w-5 h-5" />
                      <span className="font-bold">عرض جميع الجامعات</span>
                      <Badge className="bg-white/20 text-white border-0 text-base px-3 py-1">
                        {universities.length}
                      </Badge>
                      <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Programs Section */}
        {programs.length > 0 && (
          <section 
            id="programs"
            ref={(el) => (sectionsRef.current.programs = el)}
            className="py-20 bg-muted/30"
          >
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4">البرامج الدراسية المتاحة</h2>
                <p className="text-lg text-muted-foreground">
                  استكشف {programs.length} برنامج دراسي في مختلف التخصصات والمستويات الأكاديمية
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {programs.slice(0, 9).map((prog) => (
                  <Card key={prog.id} className="hover-lift group">
                    <CardHeader className="pb-3">
                      {prog.degrees && (
                        <Badge className="bg-primary text-primary-foreground mb-2">{prog.degrees.name}</Badge>
                      )}
                      <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
                        {prog.title}
                      </CardTitle>
                      {prog.universities && (
                        <CardDescription className="flex items-center gap-1 text-sm">
                          <Building2 className="w-3 h-3" />
                          {prog.universities.name}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {prog.duration_months && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{prog.duration_months} شهر</span>
                          </div>
                        )}
                        {prog.delivery_mode && (
                          <Badge variant="outline" className="text-xs">{prog.delivery_mode}</Badge>
                        )}
                      </div>
                      <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all" size="sm" asChild>
                        <a href={`/program/${prog.id}`}>
                          عرض التفاصيل
                          <ChevronDown className="w-4 h-4 mr-2 rotate-[-90deg]" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {programs.length > 9 && (
                <div className="text-center mt-12">
                  <Button size="lg" className="px-8" asChild>
                    <a href={`/programs?country=${country.slug}`}>
                      استكشف جميع البرامج ({programs.length})
                      <ChevronDown className="w-4 h-4 mr-2 rotate-[-90deg]" />
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Scholarships Section */}
        {scholarships.length > 0 && (
          <section 
            id="scholarships"
            ref={(el) => (sectionsRef.current.scholarships = el)}
            className="py-20 bg-background"
          >
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4">المنح الدراسية المتاحة</h2>
                <p className="text-lg text-muted-foreground">
                  اكتشف {scholarships.length} منحة دراسية لتحقيق حلمك الأكاديمي بتكلفة أقل
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                {scholarships.slice(0, 6).map((schol) => (
                  <Card key={schol.id} className="hover-lift group border-2">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <Badge className="bg-accent text-accent-foreground">
                          <Award className="w-3 h-3 mr-1" />
                          منحة دراسية
                        </Badge>
                        {schol.amount && (
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              ${schol.amount.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">قيمة المنحة</div>
                          </div>
                        )}
                      </div>
                      <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                        {schol.title}
                      </CardTitle>
                      {schol.universities && (
                        <CardDescription className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          {schol.universities.name}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2 text-sm">
                        {schol.degree && (
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-muted-foreground" />
                            <span>{schol.degree}</span>
                          </div>
                        )}
                        {schol.deadline && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span>آخر موعد: {new Date(schol.deadline).toLocaleDateString('ar')}</span>
                          </div>
                        )}
                      </div>
                      <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all" asChild>
                        <a href={schol.url || '#'} target="_blank" rel="noopener noreferrer">
                          تفاصيل المنحة
                          <ChevronDown className="w-4 h-4 mr-2 rotate-[-90deg]" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {scholarships.length > 6 && (
                <div className="text-center mt-12">
                  <Button size="lg" variant="outline" className="px-8" asChild>
                    <a href={`/scholarships?country=${country.slug}`}>
                      عرض جميع المنح ({scholarships.length})
                      <ChevronDown className="w-4 h-4 mr-2 rotate-[-90deg]" />
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Living Costs - Enhanced with Icons */}
        <section 
          id="living"
          ref={(el) => (sectionsRef.current.living = el)}
          className="py-20 bg-background"
        >
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4">الحياة والمعيشة في {country.name}</h2>
                <p className="text-lg text-muted-foreground">
                  تكاليف معقولة وجودة حياة عالية للطلاب الدوليين
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8 mb-12">
                <Card className="hover-lift">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <Home className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="font-bold text-xl">السكن</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">سكن جامعي</span>
                      <span className="font-bold text-primary">$500-800</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">شقة مشتركة</span>
                      <span className="font-bold text-primary">$600-1000</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">استوديو خاص</span>
                      <span className="font-bold text-primary">$1000-1500</span>
                    </div>
                    <div className="text-xs text-muted-foreground text-center pt-2">شهرياً</div>
                  </CardContent>
                </Card>

                <Card className="hover-lift">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-success/10 p-3 rounded-lg">
                        <DollarSign className="w-6 h-6 text-success" />
                      </div>
                      <h3 className="font-bold text-xl">المصروفات اليومية</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">الطعام</span>
                      <span className="font-bold text-success">$300-500</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">المواصلات</span>
                      <span className="font-bold text-success">$80-150</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">الترفيه</span>
                      <span className="font-bold text-success">$100-200</span>
                    </div>
                    <div className="text-xs text-muted-foreground text-center pt-2">شهرياً</div>
                  </CardContent>
                </Card>

                <Card className="hover-lift">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-warning/10 p-3 rounded-lg">
                        <FileText className="w-6 h-6 text-warning" />
                      </div>
                      <h3 className="font-bold text-xl">نفقات إضافية</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">تأمين صحي</span>
                      <span className="font-bold text-warning">$500-800</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">كتب ومواد</span>
                      <span className="font-bold text-warning">$500-1000</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm text-muted-foreground">رسوم التأشيرة</span>
                      <span className="font-bold text-warning">$300-500</span>
                    </div>
                    <div className="text-xs text-muted-foreground text-center pt-2">سنوياً</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gradient-primary text-primary-foreground">
                <CardContent className="p-8">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-3">إجمالي تكلفة المعيشة التقديرية</h3>
                    <div className="text-5xl font-bold mb-2">$1,500 - $2,500</div>
                    <p className="text-primary-foreground/80 mb-6">شهرياً (بدون الرسوم الدراسية)</p>
                    <Button size="lg" variant="secondary" className="px-8 font-semibold">
                      <a href="/apply">احسب تكاليفك الشخصية</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Application Process Section */}
        <section 
          id="process"
          ref={(el) => (sectionsRef.current.process = el)}
          className="py-20 bg-muted/30"
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4">عملية التقديم خطوة بخطوة</h2>
                <p className="text-lg text-muted-foreground">
                  رحلتك نحو الدراسة في {country.name} تبدأ من هنا
                </p>
              </div>

              <div className="space-y-6">
                {[
                  {
                    step: 1,
                    icon: BookOpen,
                    title: "اختر برنامجك الدراسي",
                    description: "تصفح البرامج المتاحة واختر التخصص والجامعة المناسبة لأهدافك الأكاديمية والمهنية",
                    color: "primary"
                  },
                  {
                    step: 2,
                    icon: FileText,
                    title: "جهز المستندات المطلوبة",
                    description: "الشهادات الأكاديمية، نتائج اختبار اللغة (IELTS/TOEFL)، خطاب الدافع، والسيرة الذاتية",
                    color: "success"
                  },
                  {
                    step: 3,
                    icon: CheckCircle2,
                    title: "قدم طلبك",
                    description: "املأ نموذج التقديم وأرفق جميع المستندات المطلوبة. نحن هنا لمساعدتك في كل خطوة",
                    color: "info"
                  },
                  {
                    step: 4,
                    icon: Plane,
                    title: "احصل على القبول وتأشيرتك",
                    description: "بعد القبول، سنساعدك في إجراءات التأشيرة وحجز السكن والاستعداد للسفر",
                    color: "warning"
                  }
                ].map(({ step, icon: Icon, title, description, color }) => (
                  <Card key={step} className="hover-lift group">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-6">
                        <div className={`flex-shrink-0 bg-${color}/10 p-4 rounded-xl`}>
                          <Icon className={`w-8 h-8 text-${color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={`bg-${color} text-${color}-foreground`}>الخطوة {step}</Badge>
                            <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{title}</h3>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="text-center mt-12">
                <Button size="lg" className="px-10 bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg font-semibold">
                  <a href="/apply">ابدأ التقديم الآن</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section 
          id="faq"
          ref={(el) => (sectionsRef.current.faq = el)}
          className="py-20 bg-background"
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4">الأسئلة الشائعة</h2>
                <p className="text-lg text-muted-foreground">
                  إجابات على أكثر الأسئلة شيوعاً حول الدراسة في {country.name}
                </p>
              </div>

              <Accordion type="single" collapsible className="space-y-4">
                {[
                  {
                    q: `ما هي متطلبات القبول للدراسة في ${country.name}؟`,
                    a: `تتطلب معظم الجامعات شهادة الثانوية العامة أو ما يعادلها، ونتيجة اختبار اللغة الإنجليزية (IELTS 6.0+ أو TOEFL 80+)، بالإضافة إلى المستندات الأكاديمية ذات الصلة. قد تختلف المتطلبات حسب البرنامج والمستوى الدراسي.`
                  },
                  {
                    q: "كم تبلغ تكلفة الدراسة والمعيشة؟",
                    a: `تتراوح الرسوم الدراسية السنوية بين $15,000 و$35,000 حسب الجامعة والبرنامج. أما تكاليف المعيشة فتتراوح بين $1,500 و$2,500 شهرياً، شاملة السكن والطعام والمواصلات.`
                  },
                  {
                    q: "هل يمكنني العمل أثناء الدراسة؟",
                    a: `نعم، يُسمح للطلاب الدوليين بالعمل بدوام جزئي (20 ساعة أسبوعياً) خلال الفصل الدراسي وبدوام كامل خلال العطل. هذا يساعدك على تغطية جزء من تكاليف المعيشة واكتساب خبرة عملية.`
                  },
                  {
                    q: "ما هي فرص العمل بعد التخرج؟",
                    a: `توفر ${country.name} تأشيرة عمل بعد التخرج تسمح لك بالبقاء والعمل لمدة تصل إلى 3 سنوات. معدل التوظيف للخريجين مرتفع جداً، خاصة في مجالات التكنولوجيا، الهندسة، والرعاية الصحية.`
                  },
                  {
                    q: "كم تستغرق عملية التقديم؟",
                    a: `عادةً ما تستغرق عملية التقديم من 4 إلى 8 أسابيع من تاريخ إرسال الطلب الكامل. يُنصح بالبدء بالتقديم قبل 6 أشهر على الأقل من تاريخ بدء الدراسة المطلوب.`
                  },
                  {
                    q: "هل هناك منح دراسية متاحة؟",
                    a: `نعم، تقدم العديد من الجامعات منح دراسية للطلاب الدوليين بناءً على التميز الأكاديمي أو الحاجة المالية. يمكن أن تغطي المنح من 20% إلى 100% من الرسوم الدراسية.`
                  }
                ].map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg px-6 bg-card hover:shadow-md transition-shadow">
                    <AccordionTrigger className="text-right hover:no-underline py-5">
                      <span className="font-semibold text-lg">{item.q}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* Enhanced CTA */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-primary" />
          <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto text-center text-primary-foreground">
              <GraduationCap className="w-16 h-16 mx-auto mb-6 opacity-90" />
              <h2 className="text-5xl font-bold mb-6">ابدأ رحلتك التعليمية في {country.name}</h2>
              <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto leading-relaxed">
                انضم إلى آلاف الطلاب الدوليين الذين حققوا أحلامهم الأكاديمية والمهنية. 
                نحن هنا لدعمك في كل خطوة من رحلتك.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-10 text-lg h-14 shadow-xl font-semibold">
                  <a href="/apply" className="flex items-center gap-2">
                    <Plane className="w-5 h-5" />
                    ابدأ التقديم الآن
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-foreground px-10 text-lg h-14 font-semibold">
                  <a href="/contact" className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    احجز استشارة مجانية
                  </a>
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto">
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-90" />
                  <div className="font-semibold">استشارة مجانية</div>
                  <div className="text-sm opacity-75">من خبراء التعليم</div>
                </div>
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-90" />
                  <div className="font-semibold">دعم كامل</div>
                  <div className="text-sm opacity-75">من التقديم للسفر</div>
                </div>
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-90" />
                  <div className="font-semibold">قبول مضمون</div>
                  <div className="text-sm opacity-75">في أفضل الجامعات</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
