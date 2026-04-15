import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UniversityCard } from "@/components/UniversityCard";
import { CountryHero } from "@/components/country/CountryHero";
import { CountryStatsBar } from "@/components/country/CountryStatsBar";
import { DollarSign, TrendingUp, Building2, BookOpen, Briefcase, FileCheck, GraduationCap } from "lucide-react";
import { Helmet } from "react-helmet";
import { track } from "@/lib/analytics";
import type { CountryExtended, CountryTopUniversity, ScholarshipExtended } from "@/types/database-extensions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChat } from "@/contexts/ChatContext";

export default function Country() {
  const { t } = useLanguage();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { open: openChat } = useChat();
  const [visitorId, setVisitorId] = useState<string>("");
  const [universitiesLimit, setUniversitiesLimit] = useState(8);

  // Track country page view
  useEffect(() => {
    if (slug) {
      track('country_page_view', { slug });
    }
    
    // Get visitor_id
    let vid = localStorage.getItem("visitor_id");
    if (!vid) {
      vid = crypto.randomUUID();
      localStorage.setItem("visitor_id", vid);
    }
    setVisitorId(vid);
  }, [slug]);

  const { data: country, isLoading } = useQuery<CountryExtended>({
    queryKey: ['country', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('slug', slug)
        .single();
      
      if (error) throw error;
      return data as CountryExtended;
    },
  });

  const { data: topUniversities, isFetching: isFetchingUniversities } = useQuery<CountryTopUniversity[]>({
    queryKey: ['country-universities', slug, universitiesLimit],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_country_top_universities', { p_country_slug: slug })
        .limit(universitiesLimit);
      
      if (error) throw error;
      return data as CountryTopUniversity[];
    },
    enabled: !!slug,
    placeholderData: (previousData) => previousData,
  });

  // Fetch country statistics (universities and programs count)
  const { data: countryStats } = useQuery({
    queryKey: ['country-stats', country?.id] as const,
    queryFn: async (): Promise<{ universitiesCount: number; programsCount: number }> => {
      const countryId = country?.id;
      if (!countryId) return { universitiesCount: 0, programsCount: 0 };
      
      // Get universities count
      const { count: uniCount } = await supabase
        .from('universities')
        .select('id', { count: 'exact', head: true })
        .eq('country_id', countryId);
      
      // Get programs count via universities (programs are linked to universities, not countries directly)
      const { data: universityIds } = await supabase
        .from('universities')
        .select('id')
        .eq('country_id', countryId);
      
      let programsCount = 0;
      if (universityIds && universityIds.length > 0) {
        const { count: progCount } = await supabase
          .from('programs')
          .select('id', { count: 'exact', head: true })
          .in('university_id', universityIds.map(u => u.id));
        programsCount = progCount ?? 0;
      }
      
      return {
        universitiesCount: uniCount ?? 0,
        programsCount,
      };
    },
    enabled: !!country?.id,
  });

  const { data: scholarships } = useQuery<ScholarshipExtended[]>({
    queryKey: ['country-scholarships', country?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scholarships')
        .select('*')
        .eq('country_id', country?.id)
        .eq('status', 'published')
        .order('deadline', { ascending: true })
        .limit(3);
      
      if (error) throw error;
      return data as ScholarshipExtended[];
    },
    enabled: !!country?.id,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse">{t("common.loading")}</div>
        </div>
      </Layout>
    );
  }

  if (!country) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">{t("country.notFound")}</h1>
          <Button onClick={() => navigate('/universities?tab=programs')}>
            {t("country.browsePrograms")}
          </Button>
        </div>
      </Layout>
    );
  }

  const facts = country.country_facts;

  return (
    <Layout>
      <Helmet>
        <title>{country.seo_title || `${t("country.studyIn")} ${country.name_en || country.name_ar}`}</title>
        <meta name="description" content={country.seo_description || `${t("country.discover")} ${country.name_en || country.name_ar}`} />
      </Helmet>

      {/* Hero Section - Clean design with image focus */}
      <CountryHero 
        country={country} 
        slug={slug || ''} 
        universitiesCount={countryStats?.universitiesCount || 0}
        programsCount={countryStats?.programsCount || 0}
      />

      {/* Unified Action Bar - All interactive elements */}
      <section className="py-6 bg-muted/50 border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-4">
            {/* CTA Buttons */}
            <Button 
              size="lg" 
              className="font-bold shadow-lg px-8 rounded-full transition-all duration-300 hover:scale-105"
              onClick={() => navigate(`/universities?tab=programs&country_slug=${slug}`)}
            >
              {t("country.browsePrograms")}
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="font-semibold px-8 rounded-full transition-all duration-300 hover:scale-105"
              onClick={() => openChat()}
            >
              {t("country.talkToAI")}
            </Button>
            
            {/* Divider */}
            <div className="w-px h-8 bg-border hidden sm:block mx-2" />
            
            {/* Stats */}
            {countryStats?.universitiesCount && countryStats.universitiesCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-md">
                <Building2 className="w-4 h-4" />
                <span className="font-bold">{countryStats.universitiesCount}</span>
                <span>{t("country.universities")}</span>
              </div>
            )}
            {countryStats?.programsCount && countryStats.programsCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-md">
                <BookOpen className="w-4 h-4" />
                <span className="font-bold">{countryStats.programsCount}</span>
                <span>{t("country.programs")}</span>
              </div>
            )}
            
            {/* Divider */}
            <div className="w-px h-8 bg-border hidden sm:block mx-2" />
            
            {/* Features */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold">
              <Briefcase className="w-4 h-4 text-primary" />
              <span>{t("country.feature.workOpportunities")}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>{t("country.feature.easyVisa")}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span>{t("country.feature.scholarships")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Facts Section */}
      {facts && (
        <section className="py-12 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6 text-center">{t("country.quickFacts")}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {facts.cost_of_living && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      {t("country.costOfLiving")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">{facts.cost_of_living}</p>
                  </CardContent>
                </Card>
              )}
              {facts.visa_type && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{t("country.visaType")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">{facts.visa_type}</p>
                  </CardContent>
                </Card>
              )}
              {facts.work_hours && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{t("country.workHours")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">{facts.work_hours}</p>
                  </CardContent>
                </Card>
              )}
              {facts.post_study_work && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      {t("country.postStudyWork")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">{facts.post_study_work}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Top Universities */}
      {topUniversities && topUniversities.length > 0 && (
        <section className="py-12">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">{t("country.topUniversities")}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topUniversities.map((uni) => (
                <UniversityCard
                  key={uni.university_id}
                  university={{
                    id: uni.university_id,
                    name: uni.university_name,
                    city: uni.city,
                    logo_url: uni.logo_url,
                    annual_fees: uni.annual_fees,
                    monthly_living: uni.monthly_living,
                    world_rank: uni.ranking,
                    country_id: country.id,
                    country_slug: slug || '',
                    country_name: country.name_en || country.name_ar,
                    currency_code: country.currency_code,
                  }}
                />
              ))}
            </div>
            
            {/* Show More Universities Button */}
            {countryStats && countryStats.universitiesCount > universitiesLimit && (
              <div className="mt-8 text-center">
                <Button 
                  size="lg"
                  variant="outline"
                  className="rounded-full px-8 font-semibold"
                  onClick={() => setUniversitiesLimit(prev => prev + 50)}
                  disabled={isFetchingUniversities}
                >
                  {isFetchingUniversities ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      {t("common.loading")}
                    </span>
                  ) : (
                    <>
                      {t("country.showMoreUniversities")} ({Math.min(50, countryStats.universitiesCount - universitiesLimit)} {t("country.more")})
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {/* Show count of displayed universities */}
            {topUniversities && topUniversities.length > 0 && (
              <p className="text-center text-muted-foreground mt-4 text-sm">
                {t("country.showing")} {topUniversities.length} {t("country.of")} {countryStats?.universitiesCount || topUniversities.length} {t("country.universities")}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Scholarships */}
      {scholarships && scholarships.length > 0 && (
        <section className="py-12 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">{t("country.availableScholarships")}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {scholarships.map((scholarship) => (
                <Card key={scholarship.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{scholarship.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {scholarship.amount && (
                      <p className="text-2xl font-bold text-primary mb-2">
                        {scholarship.currency} {scholarship.amount.toLocaleString()}
                      </p>
                    )}
                    {scholarship.deadline && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("country.deadline")} {new Date(scholarship.deadline).toLocaleDateString()}
                      </p>
                    )}
                    {scholarship.url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={scholarship.url} target="_blank" rel="noopener noreferrer">
                          {t("country.learnMore")}
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">{t("country.readyToStart")}</h2>
          <p className="text-lg mb-8 opacity-90">
            {t("country.getGuidance")}
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary" onClick={() => openChat()}>
              {t("country.talkToAI")}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate(`/universities?tab=programs&country_slug=${slug}`)}>
              {t("country.viewAllPrograms")}
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
