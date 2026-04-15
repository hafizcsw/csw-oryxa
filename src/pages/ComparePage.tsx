/**
 * #7.3 Compare Page
 * Displays shortlisted programs in a comparison table
 * SOFT-GATED: Guests see their draft shortlist items, with login nudge for persistence
 */
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useGuestAwareShortlist } from '@/hooks/useGuestShortlist';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft, 
  GraduationCap, 
  MapPin, 
  DollarSign, 
  Clock, 
  Home, 
  Award,
  Globe,
  Loader2,
  Heart,
  BarChart3,
  LogIn
} from 'lucide-react';
import { AICompareAnalysis } from '@/components/compare/AICompareAnalysis';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { useLocalizedField } from '@/hooks/useLocalizedField';

export default function ComparePage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { getField } = useLocalizedField();
  const guestShortlist = useGuestAwareShortlist();
  const [session, setSession] = useState<any>(null);
  const [programDetails, setProgramDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const isAuthenticated = !!session?.access_token;

  // For authenticated users, use portal shortlist data (already has details)
  // For guests, fetch program details from DB
  const guestProgramIds = guestShortlist.items.map((i: any) => i.program_id);
  
  useEffect(() => {
    if (isAuthenticated) return; // authenticated users get data from portal hook
    if (guestProgramIds.length === 0) { setProgramDetails([]); return; }
    
    setLoadingDetails(true);
    supabase
      .from('vw_program_search_api_v3_final' as any)
      .select('program_id, program_name_ar, program_name_en, university_name_ar, university_name_en, country_name_ar, country_name_en, degree_name, duration_months, tuition_usd_year_max, city, scholarship_available, has_dorm, ranking, instruction_languages, monthly_living_usd')
      .in('program_id', guestProgramIds)
      .then(({ data }) => {
        setProgramDetails((data as any[]) || []);
        setLoadingDetails(false);
      });
  }, [isAuthenticated, guestProgramIds.join(',')]);

  // Merge data sources
  const items = isAuthenticated 
    ? guestShortlist.items  // portal items have snapshot data
    : programDetails;
  
  const count = items.length;
  const loading = isAuthenticated ? guestShortlist.isLoading : loadingDetails;

  const getName = (item: any, field: string) => getField(item, field);

  const formatTuition = (amount?: number) => {
    if (!amount) return '—';
    return `$${amount.toLocaleString()}`;
  };

  const formatDuration = (months?: number) => {
    if (!months) return '—';
    const years = Math.round(months / 12 * 10) / 10;
    return t('comparePage.durationYears', { years });
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (count < 2) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="max-w-md text-center p-8">
            <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {t('comparePage.addMoreTitle')}
            </h2>
            <p className="text-muted-foreground mb-4">
              {t('comparePage.addMoreDescription', { count })}
            </p>
            <Button onClick={() => navigate('/universities')}>
              {t('comparePage.browsePrograms')}
            </Button>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <div className="bg-background border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="mb-4 gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('compare.back')}
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">
                  {t('comparePage.title')}
                </h1>
                <p className="text-muted-foreground">
                  {t('comparePage.programsToCompare', { count })}
                </p>
              </div>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {t('comparePage.inFavorites', { count, max: 10 })}
              </Badge>
            </div>
          </div>
        </div>

        {/* Guest nudge banner */}
        {!isAuthenticated && (
          <div className="max-w-7xl mx-auto px-4 pt-4">
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl px-4 py-3">
              <LogIn className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm text-muted-foreground flex-1">{t('comparePage.guestNudge')}</p>
              <Button size="sm" variant="outline" onClick={() => { sessionStorage.setItem('post_auth_return_to', '/compare'); navigate('/auth'); }} className="shrink-0">
                {t('comparePage.loginCta')}
              </Button>
            </div>
          </div>
        )}

        {/* Compare Cards */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="overflow-x-auto">
            <div className="inline-flex gap-4 pb-4" style={{ minWidth: 'max-content' }}>
              {items.map((item: any) => {
                const programId = item.program_id || item.program_ref_id;
                const programName = item.program_name || getName(item, 'program_name') || getName(item?.snapshot, 'program_name');
                const universityName = item.university_name || getName(item, 'university_name') || getName(item?.snapshot, 'university_name');
                const tuition = item.fees_yearly || item.tuition_usd_year_max;
                const duration = item.duration_months;
                const livingCost = item.monthly_living_usd;
                const languages = item.instruction_languages || item.languages;
                const hasDorm = item.has_dorm;
                const scholarship = item.scholarship_available;
                const ranking = item.ranking;
                const city = item.city;
                const degreeName = item.degree_name;

                return (
                  <Card 
                    key={programId} 
                    className="w-72 flex-shrink-0 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => programId && navigate(`/program/${programId}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                        <GraduationCap className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-base line-clamp-2 h-12">
                        {programName || t('comparePage.unknownProgram')}
                      </CardTitle>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">
                          {universityName || '—'}
                          {city ? ` • ${city}` : ''}
                        </span>
                      </div>
                      {degreeName && (
                        <Badge variant="outline" className="text-xs mt-1 w-fit">
                          {degreeName}
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <DollarSign className="w-4 h-4" />
                          <span>{t('comparePage.tuitionPerYear')}</span>
                        </div>
                        <span className="font-medium">
                          {formatTuition(tuition)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{t('comparePage.duration')}</span>
                        </div>
                        <span className="font-medium">
                          {formatDuration(duration)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Home className="w-4 h-4" />
                          <span>{t('comparePage.livingPerMonth')}</span>
                        </div>
                        <span className="font-medium">
                          {livingCost ? `$${livingCost}` : '—'}
                        </span>
                      </div>
                      {languages && languages.length > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Globe className="w-4 h-4" />
                            <span>{t('comparePage.language')}</span>
                          </div>
                          <span className="font-medium text-sm">
                            {languages.join(' • ')}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {hasDorm && (
                          <Badge variant="secondary" className="text-xs">
                            <Home className="w-3 h-3 mr-1" />
                            {t('comparePage.dorm')}
                          </Badge>
                        )}
                        {scholarship && (
                          <Badge variant="default" className="text-xs bg-success">
                            <Award className="w-3 h-3 mr-1" />
                            {t('comparePage.scholarship')}
                          </Badge>
                        )}
                        {ranking && ranking <= 500 && (
                          <Badge variant="outline" className="text-xs">
                            #{ranking}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* AI Analysis Section — gated to authenticated */}
          <div className="mt-8">
            <AICompareAnalysis programs={items} isAuthenticated={isAuthenticated} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
