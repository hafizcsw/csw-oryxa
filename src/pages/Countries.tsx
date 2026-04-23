import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/seo/SEOHead";
import { CountryStatCard } from "@/components/cards/CountryStatCard";
import { CountriesHero } from "@/components/countries/CountriesHero";
import { useCountriesWithStats, CountryWithStats } from "@/hooks/useCountriesWithStats";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLookups } from "@/hooks/useLookups";
import { useCountryName } from "@/hooks/useCountryName";
import { LANGUAGES_OPTIONS } from "@/config/searchTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Search, SortAsc, Loader2, MapPin, GraduationCap, X } from "lucide-react";
import { LazyMount } from "@/components/perf/LazyMount";

type SortOption = "universities" | "programs" | "rank" | "alphabetical";

export default function Countries() {
  const { language, t } = useLanguage();
  const isArabic = language === "ar";
  const navigate = useNavigate();
  
  const { data: countries, isLoading, error } = useCountriesWithStats();
  const { countries: countryOptions, degrees, loading: lookupsLoading } = useLookups();
  const { getCountryName } = useCountryName();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("universities");
  
  // Search filters state
  const [filters, setFilters] = useState({
    country_slug: null as string | null,
    degree_slug: null as string | null,
    language: null as string | null,
  });
  
  const handleFilterChange = useCallback((key: string, value: string | null) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? null : value
    }));
  }, []);
  
  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    params.set('tab', 'programs');
    
    if (filters.country_slug) params.set('country_slug', filters.country_slug);
    if (filters.degree_slug) params.set('degree_slug', filters.degree_slug);
    if (filters.language) params.set('language', filters.language);
    
    navigate(`/universities?${params.toString()}`);
  }, [filters, navigate]);
  
  const handleReset = useCallback(() => {
    setFilters({
      country_slug: null,
      degree_slug: null,
      language: null,
    });
  }, []);
  
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(v => v !== null);
  }, [filters]);
  
  // Filter and sort countries
  const filteredCountries = useMemo(() => {
    if (!countries) return [];
    
    let result = [...countries];
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name_ar.toLowerCase().includes(query) ||
        (c.name_en && c.name_en.toLowerCase().includes(query)) ||
        c.country_code.toLowerCase().includes(query)
      );
    }
    
    // Sort
    switch (sortBy) {
      case "universities":
        result.sort((a, b) => b.universities_count - a.universities_count);
        break;
      case "programs":
        result.sort((a, b) => b.programs_count - a.programs_count);
        break;
      case "rank":
        result.sort((a, b) => {
          if (a.education_rank_global == null) return 1;
          if (b.education_rank_global == null) return -1;
          return a.education_rank_global - b.education_rank_global;
        });
        break;
      case "alphabetical":
        result.sort((a, b) => {
          const nameA = isArabic ? a.name_ar : (a.name_en || a.name_ar);
          const nameB = isArabic ? b.name_ar : (b.name_en || b.name_ar);
          return nameA.localeCompare(nameB, language || 'en');
        });
        break;
    }
    
    return result;
  }, [countries, searchQuery, sortBy, isArabic, language]);
  
  // Calculate total stats
  const totalStats = useMemo(() => {
    if (!countries) return { countries: 0, universities: 0, programs: 0 };
    return {
      countries: countries.length,
      universities: countries.reduce((sum, c) => sum + c.universities_count, 0),
      programs: countries.reduce((sum, c) => sum + c.programs_count, 0),
    };
  }, [countries]);
  
  const sortOptions = [
    { value: "universities", label: t('countriesPage.sort.universities') },
    { value: "programs", label: t('countriesPage.sort.programs') },
    { value: "rank", label: t('countriesPage.sort.rank') },
    { value: "alphabetical", label: t('countriesPage.sort.alphabetical') },
  ];
  
  const pageTitle = t('countriesPage.seo.title');
  
  const pageDescription = t('countriesPage.seo.description');

  return (
    <Layout>
      <SEOHead 
        title={pageTitle}
        description={pageDescription}
        canonical={`${window.location.origin}/countries`}
      />
      
      {/* New Hero Section with Animated Background & Filters */}
      <CountriesHero totalStats={totalStats} />
      
      {/* Program Search Filters */}
      <section className="bg-gradient-to-b from-muted/50 to-background border-b py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-card rounded-2xl border shadow-sm p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              {t("countriesPage.filters.title")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Country Select */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  {t("tabs.filters.destination")}
                </label>
                <Select
                  value={filters.country_slug || ''}
                  onValueChange={(val) => handleFilterChange('country_slug', val)}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder={t("tabs.filters.allCountries")} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50 rounded-xl">
                    <SelectItem value="all">{t("filter.all")}</SelectItem>
                    {countryOptions.map(c => (
                      <SelectItem key={c.id} value={c.slug}>{getCountryName(c.slug, c.name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Degree Select */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-primary" />
                  {t("tabs.filters.studyLevel")}
                </label>
                <Select
                  value={filters.degree_slug || ''}
                  onValueChange={(val) => handleFilterChange('degree_slug', val)}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder={t("tabs.filters.allLevels")} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50 rounded-xl">
                    <SelectItem value="all">{t("filter.all")}</SelectItem>
                    {degrees.map((d: any) => (
                      <SelectItem key={d.id} value={d.slug || d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Language Select */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  {t("tabs.filters.language")}
                </label>
                <Select
                  value={filters.language || ''}
                  onValueChange={(val) => handleFilterChange('language', val)}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder={t("tabs.filters.allLanguages")} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50 rounded-xl">
                    <SelectItem value="all">{t("filter.all")}</SelectItem>
                    {LANGUAGES_OPTIONS.map(lang => (
                      <SelectItem key={lang.id} value={lang.code}>{t(lang.nameKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-end gap-2">
                <Button
                  onClick={handleSearch}
                  className="flex-1 h-11 rounded-xl font-semibold gap-2"
                >
                  <Search className="w-4 h-4" />
                  {t("filter.search")}
                </Button>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleReset}
                    className="h-11 w-11 rounded-xl"
                    title={t("filter.reset")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Countries Grid */}
      <section className="py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">{t('countriesPage.states.loading')}</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-destructive">{t('countriesPage.states.error')}</p>
            </div>
          ) : filteredCountries.length === 0 ? (
            <div className="text-center py-20">
              <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {t('countriesPage.states.noResults')}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                {t('countriesPage.states.showingCount', { count: filteredCountries.length })}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredCountries.map((country, idx) => {
                  const card = (
                    <CountryStatCard
                      slug={country.slug}
                      nameAr={country.name_ar}
                      nameEn={country.name_en}
                      imageUrl={country.image_url}
                      countryCode={country.country_code}
                      stats={{
                        universitiesCount: country.universities_count,
                        programsCount: country.programs_count,
                        rankedUniversitiesCount: country.ranked_universities_count,
                        educationRankGlobal: country.education_rank_global,
                        internationalStudents: country.international_students,
                      }}
                    />
                  );
                  // Render first 8 immediately; lazy-mount the rest as user scrolls
                  return idx < 8 ? (
                    <div key={country.id}>{card}</div>
                  ) : (
                    <LazyMount key={country.id} minHeight={340} rootMargin="600px 0px">
                      {card}
                    </LazyMount>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            {t('countriesPage.cta.title')}
          </h2>
          <p className="text-muted-foreground mb-8">
            {t('countriesPage.cta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="gap-2">
              {t('countriesPage.cta.talkToAdvisor')}
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/universities">
                {t('countriesPage.cta.browseUniversities')}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
