import { useEffect, useState, useMemo, useCallback } from "react";
import { trackPageView, trackSearchPerformed, trackSearchResultClick } from "@/lib/decisionTracking";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Layout } from "@/components/layout/Layout";
import { UniversityCard } from "@/components/UniversityCard";
import { ProgramCard } from "@/components/ProgramCard";
import { ScholarshipCard } from "@/components/ScholarshipCard";
import { EventCard } from "@/components/EventCard";
import UniversitiesHero from "@/sections/UniversitiesHero";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import { Button } from "@/components/ui/button";
import { ApplyNowBar } from "@/components/ApplyNowBar";
import { CompareFloatingBar } from "@/components/compare/CompareFloatingBar";
import { CompareDrawer } from "@/components/compare/CompareDrawer";
import { fetchUniversities, SearchFilters } from "@/lib/search-api";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useUnifiedShortlist } from "@/hooks/useUnifiedShortlist";
import { useProgramSearch } from "@/hooks/useProgramSearch";
import { programToShortlistSnapshot } from "@/lib/programToShortlistSnapshot";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { SEARCH_TABS, type TabKey, DEFAULT_TAB } from "@/config/searchTabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { LazyMount } from "@/components/perf/LazyMount";
import "@/styles/universities-hero.css";
export default function Universities() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const telemetry = useTelemetry();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  
  // ✅ Unified shortlist with V3 snapshots
  const { shortlist, toggleWithSnapshot, isFavorite } = useUnifiedShortlist();
  
  const [user, setUser] = useState<User | null>(null);
  const [universities, setUniversities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [compareDrawerOpen, setCompareDrawerOpen] = useState(false);

  // Get current tab from URL
  const currentTab = (searchParams.get("tab") as TabKey) || DEFAULT_TAB;
  const tabConfig = SEARCH_TABS[currentTab];

  // Initialize filters from URL params
  const getInitialFilters = (): Record<string, any> => {
    const filtersObj: Record<string, any> = {};
    
    // Read all query params
    searchParams.forEach((value, key) => {
      if (key !== 'tab') {
        // Try to parse numbers
        const numValue = Number(value);
        filtersObj[key] = !isNaN(numValue) && value !== '' ? numValue : value;
      }
    });

    return filtersObj;
  };

  const [filters, setFilters] = useState<Record<string, any>>(getInitialFilters());

  // Sync filters state when URL params change (e.g. tab switch clears irrelevant params)
  useEffect(() => {
    setFilters(getInitialFilters());
    setCurrentOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);
  
  // ✅ Programs tab: keep UI params as-is, and let normalizeProgramFilters() output V2 canonical keys.
  // IMPORTANT: do NOT mislabel slugs/ids as canonical keys (e.g. country_slug !== country_code).
  const programFilters = useMemo(
    () => ({
      country_slug: filters.country_slug,
      degree_id: filters.degree_id,
      discipline_slug: filters.discipline_slug,
      subject: filters.subject,
      language: filters.language,
      fees_max: filters.fees_max,
      has_dorm: filters.has_dorm,
      limit: 20,
      offset: currentOffset,
    }),
    [filters.country_slug, filters.degree_id, filters.discipline_slug, filters.subject, filters.language, filters.fees_max, filters.has_dorm, currentOffset]
  );
  
  const { 
    data: programsData, 
    isLoading: programsLoading,
  } = useProgramSearch(programFilters, currentTab === 'programs');

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);


  // Track page_view on mount
  useEffect(() => { trackPageView(); }, []);

  // Search based on current tab
  useEffect(() => {
    const doSearch = async () => {
      // Only search if tab is ready
      if (!tabConfig.isReady) {
        setLoading(false);
        setUniversities([]);
        setTotalCount(0);
        return;
      }

      // Programs tab uses useProgramSearch hook - no manual fetch needed
      if (currentTab === 'programs') {
        setLoading(false);
        return;
      }

      setLoading(true);
      setCurrentOffset(0);
      const t0 = performance.now();
      
      try {
        if (currentTab === 'universities') {
          const searchFilters: SearchFilters = {
            q_name: filters.q_name || "",
            country_slug: filters.country_slug || "",
            fees_min: filters.fees_min,
            fees_max: filters.fees_max,
            living_min: filters.living_min,
            living_max: filters.living_max,
            degree_id: filters.degree_id,
            has_dorm: filters.has_dorm,
            university_type: filters.university_type,
            rank_max: filters.rank_max,
            sort: filters.sort || "popularity",
            limit: 20,
            offset: 0,
          };
          
          const response = await fetchUniversities(searchFilters);
          setUniversities(response.items || []);
          setTotalCount(response.count || 0);
          
           const latency = Math.round(performance.now() - t0);
          telemetry.logResultsLoaded(response.count || 0, latency);
          trackSearchPerformed(searchFilters, response.count || 0);
        } else if (currentTab === 'scholarships') {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-scholarships`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              country_slug: filters.country_slug,
              degree_id: filters.degree_id,
              amount_min: filters.amount_min,
              limit: 20,
              offset: 0
            })
          });
          const data = await res.json();
          setUniversities(data.items || []);
          setTotalCount(data.count || 0);
        } else if (currentTab === 'events') {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              country_slug: filters.country_slug,
              type: filters.type,
              date_from: filters.date_from,
              date_to: filters.date_to,
              limit: 20,
              offset: 0
            })
          });
          const data = await res.json();
          setUniversities(data.items || []);
          setTotalCount(data.count || 0);
        } else {
          setUniversities([]);
          setTotalCount(0);
        }
        
        // Track telemetry for all tabs
        if (currentTab !== 'universities') {
          const latency = Math.round(performance.now() - t0);
          telemetry.logResultsLoaded(universities.length, latency);
        }
      } catch (error: any) {
        console.error("Search failed:", error);
        toast({
          variant: "destructive",
          title: t("search.errors.searchFailedTitle"),
          description: error.message || t("search.errors.searchFailedDescription"),
        });
      } finally {
        setLoading(false);
      }
    };

    doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentTab]);
  
  // ✅ Sync programs data from hook to local state (with de-dup for load more)
  useEffect(() => {
    if (currentTab !== 'programs' || !programsData?.items) return;

    setUniversities(prev => {
      // If offset = 0, replace entirely (new search)
      if (currentOffset === 0) return programsData.items;

      // Merge with de-dup by program_id
      const map = new Map(prev.map((x: any) => [x.program_id, x]));
      programsData.items.forEach((x: any) => map.set(x.program_id, x));
      return Array.from(map.values());
    });

    setTotalCount(programsData.total ?? programsData.items.length);
    setLoadingMore(false); // Reset loading state after data arrives
  }, [currentTab, programsData, currentOffset]);

  const handleFiltersChange = (newFilters: Record<string, any>) => {
    setFilters(newFilters);
    
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
    
    navigate(`${localizePath('/universities')}?${newParams.toString()}`, { replace: true });
    telemetry.logFilterChanged({ tab: currentTab, ...newFilters });
  };

  const handleSearch = () => {
    // Trigger re-search with current filters
    setFilters((prev) => ({ ...prev }));
  };

  const handleViewDetails = (universityId: string) => {
    trackSearchResultClick("university", universityId, 0);
    navigate(`/universities?tab=programs&country_slug=${filters.country_slug || ""}`);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const newOffset = currentOffset + 20;
    
    try {
      if (currentTab === 'universities') {
        const searchFilters: SearchFilters = {
            q_name: filters.q_name || "",
            country_slug: filters.country_slug || "",
            fees_min: filters.fees_min,
            fees_max: filters.fees_max,
            living_min: filters.living_min,
            living_max: filters.living_max,
            degree_id: filters.degree_id,
            has_dorm: filters.has_dorm,
            university_type: filters.university_type,
            rank_max: filters.rank_max,
            sort: filters.sort || "popularity",
            limit: 20,
            offset: newOffset,
          };
        
        const response = await fetchUniversities(searchFilters);
        setUniversities(prev => [...prev, ...(response.items || [])]);
        setCurrentOffset(newOffset);
      } else if (currentTab === 'programs') {
        // ✅ Programs: Just update offset, useEffect handles merging
        setCurrentOffset(newOffset);
        // loadingMore will be set to false when data arrives in useEffect
        return;
      } else if (currentTab === 'scholarships') {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-scholarships`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country_slug: filters.country_slug,
            degree_id: filters.degree_id,
            amount_min: filters.amount_min,
            limit: 20,
            offset: newOffset
          })
        });
        const data = await res.json();
        setUniversities(prev => [...prev, ...(data.items || [])]);
        setCurrentOffset(newOffset);
      } else if (currentTab === 'events') {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country_slug: filters.country_slug,
            type: filters.type,
            date_from: filters.date_from,
            date_to: filters.date_to,
            limit: 20,
            offset: newOffset
          })
        });
        const data = await res.json();
        setUniversities(prev => [...prev, ...(data.items || [])]);
        setCurrentOffset(newOffset);
      }
    } catch (error: any) {
      console.error("Load more failed:", error);
      toast({
        variant: "destructive",
        title: t("search.errors.loadMoreFailedTitle"),
        description: error.message || t("search.errors.loadMoreFailedDescription"),
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const siteUrl = window.location.origin;
  const rolloutLocales = ['en', 'ar'] as const;
  const languageBase = (language || 'en').toLowerCase().split('-')[0];
  const localePrefix = rolloutLocales.includes(languageBase as typeof rolloutLocales[number]) ? languageBase : 'en';
  const canonicalPath = `/${localePrefix}/universities`;
  const localizePath = (path: string) => `/${localePrefix}${path.startsWith('/') ? path : `/${path}`}`;
  const seoTitle = t('search.seo.title');
  const seoDescription = t('search.seo.description');

  return (
    <Layout>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={`${siteUrl}${canonicalPath}`} />
        {rolloutLocales.map((locale) => (
          <link key={locale} rel="alternate" hrefLang={locale} href={`${siteUrl}/${locale}/universities`} />
        ))}
        <link rel="alternate" hrefLang="x-default" href={`${siteUrl}/en/universities`} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
        {/* Hero with integrated filters and tabs */}
        <UniversitiesHero
          currentTab={currentTab}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onSearch={handleSearch}
        />


        {/* Main Content */}
        <div className="container mx-auto px-6 py-12">
        {!tabConfig.isReady ? (
            <div className="text-center py-20 space-y-6">
              <div className="mx-auto w-24 h-24 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center">
                <span className="text-5xl">⏳</span>
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-foreground">{t("common.comingSoon")}</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {tabConfig.label} - {t("common.comingSoon")}
                </p>
              </div>
            </div>
          ) : (currentTab === 'programs' ? programsLoading : loading) ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-muted-foreground text-lg">{t("common.loading")}</p>
            </div>
          ) : universities.length === 0 ? (
            <div className="text-center py-20 space-y-6">
              <div className="mx-auto w-24 h-24 bg-gradient-to-br from-muted to-muted/50 rounded-full flex items-center justify-center">
                <span className="text-5xl">🔍</span>
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-foreground">{t("no_results")}</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {t("no_results_desc")}
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleFiltersChange({})}
                  className="border-2 hover:border-primary hover:bg-primary/5"
                >
                  {t("btn.reset")}
                </Button>
                <Button
                  size="lg"
                  onClick={() => navigate(localizePath('/apply-now'))}
                  className="bg-primary hover:bg-primary/90"
                >
                  {t("need_help")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Results Count */}
              <div className="mb-8 flex items-center justify-between">
                <p className="text-lg font-semibold text-foreground">
                  {t("country.showing")} <span className="text-primary">{universities.length}</span> {t("country.of")}{" "}
                  <span className="text-primary">{totalCount}</span>
                </p>
              </div>

              {/* Universities Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in"
                onClick={(e) => {
                  // Track search result clicks via event delegation
                  const card = (e.target as HTMLElement).closest('[data-fly-card]');
                  if (card) {
                    const uniLogo = card.querySelector('[data-uni-logo]');
                    if (uniLogo) {
                      const id = uniLogo.getAttribute('data-uni-logo') || '';
                      trackSearchResultClick("university", id, 0);
                    }
                  }
                }}
              >
                {currentTab === "universities" && universities.map((university, idx) => {
                  const node = (
                    <UniversityCard
                      university={university}
                      onViewDetails={handleViewDetails}
                    />
                  );
                  return idx < 6 ? (
                    <div key={university.id}>{node}</div>
                  ) : (
                    <LazyMount key={university.id} minHeight={360} rootMargin="600px 0px">{node}</LazyMount>
                  );
                })}
                {currentTab === "programs" && universities.map((p: any, idx: number) => {
                  const programId = p.program_id || p.id;
                  const node = (
                    <ProgramCard
                      p={{
                        program_id: programId,
                        program_name: p.program_name || p.title,
                        program_name_ar: p.program_name_ar,
                        program_name_en: p.program_name_en,
                        university_id: p.university_id || '',
                        university_name: p.university_name || '',
                        university_name_ar: p.university_name_ar,
                        university_name_en: p.university_name_en,
                        city: p.city,
                        logo_url: p.logo_url || p.university_logo,
                        country_name: p.country_name || '',
                        country_name_ar: p.country_name_ar,
                        country_name_en: p.country_name_en,
                        country_slug: p.country_slug || '',
                        currency_code: p.currency_code || undefined,
                        degree_name: p.degree_name,
                        degree_name_ar: p.degree_name_ar,
                        degree_name_en: p.degree_name_en,
                        fees_yearly: p.fees_yearly || p.tuition_yearly || p.tuition_usd_min,
                        duration_months: p.duration_months,
                        language: p.language,
                        languages: p.languages,
                        instruction_languages: p.instruction_languages,
                        study_mode: p.study_mode,
                        delivery_mode: p.delivery_mode,
                        has_dorm: p.has_dorm,
                        dorm_price_monthly_usd: p.dorm_price_monthly_usd,
                        monthly_living_usd: p.monthly_living_usd || p.monthly_living,
                        scholarship_available: p.scholarship_available,
                        scholarship_type: p.scholarship_type,
                        has_scholarship: p.has_scholarship || p.scholarship_available,
                        intake_months: p.intake_months,
                        next_intake_date: p.next_intake_date,
                        ielts_required: p.ielts_required,
                        required_documents: p.required_documents,
                        entrance_exam_required: p.entrance_exam_required,
                        employment_rate: p.employment_rate,
                        enrolled_students: p.enrolled_students,
                        discipline_name_ar: p.discipline_name_ar,
                        discipline_name_en: p.discipline_name_en,
                      }}
                    />
                  );
                  return idx < 6 ? (
                    <div key={programId}>{node}</div>
                  ) : (
                    <LazyMount key={programId} minHeight={360} rootMargin="600px 0px">{node}</LazyMount>
                  );
                })}
                {currentTab === "scholarships" && universities.map((s: any) => (
                  <ScholarshipCard
                    key={s.id}
                    s={{
                      id: s.id,
                      title: s.title,
                      amount: s.amount,
                      currency_code: s.currency_code,
                      deadline_date: s.deadline,
                      url: s.url,
                      provider_name: s.provider_name,
                      university_name: s.university_name,
                      country_name: s.country_name,
                      country_slug: s.country_slug,
                      degree_name: s.degree_name,
                      description: s.description,
                    }}
                  />
                ))}
                {currentTab === "events" && universities.map((e: any) => (
                  <EventCard
                    key={e.id}
                    e={{
                      id: e.id,
                      title: e.title,
                      event_type: e.event_type,
                      start_at: e.start_at,
                      end_at: e.end_at,
                      organizer: e.organizer,
                      url: e.url,
                      city: e.city,
                      is_online: e.is_online,
                      venue_name: e.venue_name,
                      country_name: e.country_name,
                    }}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {universities.length < totalCount && (
                <div className="flex justify-center mt-12">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-8 py-6 text-lg font-semibold border-2 hover:border-primary hover:bg-primary/5"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                        {t("common.loading")}
                      </>
                    ) : (
                      <>
                        {t("common.more")} ({totalCount - universities.length})
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Auth Required Modal */}
      {showAuthModal && <AuthRequiredModal onClose={() => setShowAuthModal(false)} />}
      
      {/* Apply Now Bar - Sticky bottom */}
      <ApplyNowBar />
      
      {/* Compare Floating Bar - يظهر عند count >= 2 */}
      <CompareFloatingBar 
        onCompareClick={() => setCompareDrawerOpen(true)} 
        position="bottom"
      />
      
      {/* Compare Drawer */}
      <CompareDrawer 
        open={compareDrawerOpen} 
        onOpenChange={setCompareDrawerOpen} 
      />
    </Layout>
  );
}
