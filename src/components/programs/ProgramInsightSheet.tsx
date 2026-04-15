/**
 * ProgramInsightSheet — Cached ORX + AI intelligence sheet
 * Opens from program card. Reads from local cache (program_ai_snapshots + program_orx_signals).
 * No live AI call on every click. Generation is gated behind ownership via edge function.
 */
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, TrendingUp, TrendingDown, Minus, Briefcase, Star, Target, Zap, BookOpen, Users, Building2, Cpu, GraduationCap, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';


interface ProgramInsightSheetProps {
  programId: string;
  programName: string;
  universityId?: string | null;
  children: React.ReactNode;
}

interface AiSnapshot {
  summary: string;
  future_outlook: string;
  strengths: string[];
  weaknesses: string[];
  practical_assessment: string;
  career_paths: Array<{ title: string; demand_level?: string; avg_salary_range?: string }>;
  best_fit_profile: string;
  confidence: number;
  generated_at: string;
}

interface OrxSignals {
  labs_score: number | null;
  internship_score: number | null;
  capstone_score: number | null;
  tooling_score: number | null;
  industry_links_score: number | null;
  curriculum_modernity: number | null;
  practical_intensity: number | null;
  employability_relevance: number | null;
  overall_execution_score: number | null;
  discipline_future_strength: number | null;
}

export function ProgramInsightSheet({ programId, programName, universityId, children }: ProgramInsightSheetProps) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<AiSnapshot | null>(null);
  const [orx, setOrx] = useState<OrxSignals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isRtl = language === 'ar';

  useEffect(() => {
    if (!open) return;
    fetchCachedData();
  }, [open, programId]);

  async function fetchCachedData() {
    setLoading(true);
    setError(null);
    try {
      const [snapRes, orxRes] = await Promise.all([
        supabase
          .from('program_ai_snapshots')
          .select('*')
          .eq('program_id', programId)
          .eq('is_current', true)
          .maybeSingle(),
        supabase
          .from('program_orx_signals')
          .select('*')
          .eq('program_id', programId)
          .eq('is_current', true)
          .maybeSingle(),
      ]);

      if (snapRes.data) {
        setSnapshot({
          summary: snapRes.data.summary,
          future_outlook: snapRes.data.future_outlook,
          strengths: (snapRes.data.strengths as any) || [],
          weaknesses: (snapRes.data.weaknesses as any) || [],
          practical_assessment: snapRes.data.practical_assessment,
          career_paths: (snapRes.data.career_paths as any) || [],
          best_fit_profile: snapRes.data.best_fit_profile,
          confidence: snapRes.data.confidence || 0,
          generated_at: snapRes.data.generated_at,
        });
      }

      if (orxRes.data) {
        setOrx(orxRes.data as any);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function requestGeneration() {
    if (!universityId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('university-page-manage', { body: { action: 'intelligence.generate', university_id: universityId, program_id: programId, force: true } });
      if (fnErr || !data?.ok) {
        setError(fnErr?.message || data?.error || t('insight.generationFailed'));
        setLoading(false);
        return;
      }
      await fetchCachedData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const getOutlookIcon = (outlook: string) => {
    if (!outlook) return <Minus className="w-4 h-4" />;
    const lower = outlook.toLowerCase();
    if (lower.includes('grow') || lower.includes('strong') || lower.includes('positive'))
      return <TrendingUp className="w-5 h-5 text-emerald-500" />;
    if (lower.includes('declin') || lower.includes('weak') || lower.includes('negative'))
      return <TrendingDown className="w-5 h-5 text-destructive" />;
    return <Minus className="w-5 h-5 text-muted-foreground" />;
  };

  const scoreColor = (score: number | null) => {
    if (score == null) return 'text-muted-foreground';
    if (score >= 7) return 'text-emerald-600';
    if (score >= 4) return 'text-amber-600';
    return 'text-destructive';
  };

  const scoreBg = (score: number | null) => {
    if (score == null) return 'bg-muted/30';
    if (score >= 7) return 'bg-emerald-50 dark:bg-emerald-950/30';
    if (score >= 4) return 'bg-amber-50 dark:bg-amber-950/30';
    return 'bg-red-50 dark:bg-red-950/30';
  };

  const orxSignals = orx ? [
    { key: 'labs', score: orx.labs_score, icon: <Cpu className="w-4 h-4" /> },
    { key: 'internship', score: orx.internship_score, icon: <Briefcase className="w-4 h-4" /> },
    { key: 'capstone', score: orx.capstone_score, icon: <GraduationCap className="w-4 h-4" /> },
    { key: 'tooling', score: orx.tooling_score, icon: <Zap className="w-4 h-4" /> },
    { key: 'industry', score: orx.industry_links_score, icon: <Building2 className="w-4 h-4" /> },
    { key: 'curriculum', score: orx.curriculum_modernity, icon: <BookOpen className="w-4 h-4" /> },
    { key: 'practical', score: orx.practical_intensity, icon: <Target className="w-4 h-4" /> },
    { key: 'employ', score: orx.employability_relevance, icon: <Users className="w-4 h-4" /> },
  ] : [];

  const hasData = snapshot || orx;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side={isRtl ? "left" : "right"}
        className="w-full sm:max-w-lg overflow-y-auto p-0"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-primary/10 to-background border-b border-border px-6 py-5">
          <SheetHeader className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">{t('insight.orxAnalysis')}</p>
                <SheetTitle className="text-sm font-bold truncate">{programName}</SheetTitle>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="px-6 py-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">{t('insight.loading')}</p>
            </div>
          )}

          {error && (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                <Brain className="w-6 h-6 text-destructive" />
              </div>
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchCachedData} className="mt-3 gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                {t('insight.retry')}
              </Button>
            </div>
          )}

          {!loading && !hasData && !error && (
            <div className="py-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('insight.noData')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('insight.noDataDesc')}</p>
              </div>
              <Button size="sm" onClick={requestGeneration} disabled={!universityId} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                {t('insight.generate')}
              </Button>
            </div>
          )}

          {!loading && hasData && (
            <div className="space-y-6">

              {/* ORX Execution Quality */}
              {orx && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      {t('insight.executionQuality')}
                    </h3>
                    {orx.overall_execution_score != null && (
                      <div className={cn(
                        "px-3 py-1 rounded-full text-sm font-bold",
                        scoreBg(orx.overall_execution_score),
                        scoreColor(orx.overall_execution_score)
                      )}>
                        {orx.overall_execution_score.toFixed(1)}/10
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {orxSignals.map(s => (
                      <div
                        key={s.key}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-border/50",
                          scoreBg(s.score)
                        )}
                      >
                        <span className="text-primary/70">{s.icon}</span>
                        <span className="text-xs text-muted-foreground flex-1 truncate">{t(`insight.orx.${s.key}`)}</span>
                        <span className={cn("text-sm font-bold tabular-nums", scoreColor(s.score))}>
                          {s.score != null ? s.score.toFixed(1) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {orx.discipline_future_strength != null && (
                    <div className={cn(
                      "mt-3 flex items-center gap-2.5 rounded-xl px-3 py-3 border border-primary/20",
                      scoreBg(orx.discipline_future_strength)
                    )}>
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium flex-1">{t('insight.disciplineFuture')}</span>
                      <span className={cn("text-sm font-bold tabular-nums", scoreColor(orx.discipline_future_strength))}>
                        {orx.discipline_future_strength.toFixed(1)}/10
                      </span>
                    </div>
                  )}
                </section>
              )}

              {snapshot && (
                <>
                  {/* Summary */}
                  {snapshot.summary && (
                    <section>
                      <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        {t('insight.summary')}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-xl p-3.5">
                        {snapshot.summary}
                      </p>
                    </section>
                  )}

                  {/* Future Outlook */}
                  {snapshot.future_outlook && (
                    <section className="flex items-center gap-3 bg-gradient-to-r from-primary/5 to-transparent rounded-xl p-4 border border-primary/10">
                      {getOutlookIcon(snapshot.future_outlook)}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold">{t('insight.futureOutlook')}</h4>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{snapshot.future_outlook}</p>
                      </div>
                    </section>
                  )}

                  {/* Strengths & Weaknesses */}
                  {(snapshot.strengths?.length > 0 || snapshot.weaknesses?.length > 0) && (
                    <div className="space-y-4">
                      {snapshot.strengths?.length > 0 && (
                        <section>
                          <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2.5 flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5" /> {t('insight.strengths')}
                          </h3>
                          <ul className="space-y-1.5">
                            {snapshot.strengths.map((s, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                <span className="leading-relaxed">{s}</span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                      {snapshot.weaknesses?.length > 0 && (
                        <section>
                          <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2.5 flex items-center gap-1.5">
                            <TrendingDown className="w-3.5 h-3.5" /> {t('insight.weaknesses')}
                          </h3>
                          <ul className="space-y-1.5">
                            {snapshot.weaknesses.map((w, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                <span className="leading-relaxed">{w}</span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </div>
                  )}

                  {/* Career Paths */}
                  {snapshot.career_paths?.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold mb-2.5 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-primary" /> {t('insight.careerPaths')}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {snapshot.career_paths.map((c, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-xs px-3 py-1.5 rounded-lg bg-muted/30"
                          >
                            {c.title}
                            {c.demand_level && (
                              <span className="text-muted-foreground/60 ms-1">· {c.demand_level}</span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Best Fit */}
                  {snapshot.best_fit_profile && (
                    <section className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                      <h3 className="text-xs font-bold mb-1.5 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" /> {t('insight.bestFit')}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{snapshot.best_fit_profile}</p>
                    </section>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 pt-3 border-t border-border/30">
                    <span>{t('insight.confidence')}: {Math.round((snapshot.confidence || 0) * 100)}%</span>
                    <span>{snapshot.generated_at ? new Date(snapshot.generated_at).toLocaleDateString(isRtl ? 'ar' : 'en') : ''}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
