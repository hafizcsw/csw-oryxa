/**
 * ProgramInsightSheet — Centered modal for ORX + AI intelligence
 * Opens from program card via a small Brain icon.
 * Reads from local cache (program_ai_snapshots + program_orx_signals).
 * "Ask Oryxa" button hands off all intelligence to floating chat.
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, TrendingUp, TrendingDown, Minus, Briefcase, Star, Target, Zap, BookOpen, Users, Building2, Cpu, GraduationCap, RefreshCw, Sparkles, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMalakChat } from '@/contexts/MalakChatContext';
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
  const { openChat, addMessage } = useMalakChat();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<AiSnapshot | null>(null);
  const [orx, setOrx] = useState<OrxSignals | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  function handleAskOryxa() {
    const parts: string[] = [];
    parts.push(`📋 ${programName}`);
    if (orx?.overall_execution_score != null) {
      parts.push(`ORX Score: ${orx.overall_execution_score.toFixed(1)}/10`);
    }
    if (snapshot?.summary) parts.push(snapshot.summary);
    if (snapshot?.strengths?.length) parts.push(`✅ ${snapshot.strengths.join(' • ')}`);
    if (snapshot?.weaknesses?.length) parts.push(`⚠️ ${snapshot.weaknesses.join(' • ')}`);
    if (snapshot?.career_paths?.length) parts.push(`🎯 ${snapshot.career_paths.map(c => c.title).join(', ')}`);
    if (snapshot?.future_outlook) parts.push(`📈 ${snapshot.future_outlook}`);

    const fullMessage = parts.join('\n\n');
    setOpen(false);
    addMessage({ from: 'user', type: 'text', content: fullMessage });
    openChat();
  }

  const scoreColor = (score: number | null) => {
    if (score == null) return 'text-muted-foreground';
    if (score >= 7) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 4) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getOutlookIcon = (outlook: string) => {
    if (!outlook) return <Minus className="w-4 h-4 text-muted-foreground" />;
    const lower = outlook.toLowerCase();
    if (lower.includes('grow') || lower.includes('strong') || lower.includes('positive'))
      return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (lower.includes('declin') || lower.includes('weak') || lower.includes('negative'))
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const orxSignals = orx ? [
    { key: 'labs', score: orx.labs_score, icon: <Cpu className="w-3.5 h-3.5" /> },
    { key: 'internship', score: orx.internship_score, icon: <Briefcase className="w-3.5 h-3.5" /> },
    { key: 'capstone', score: orx.capstone_score, icon: <GraduationCap className="w-3.5 h-3.5" /> },
    { key: 'tooling', score: orx.tooling_score, icon: <Zap className="w-3.5 h-3.5" /> },
    { key: 'industry', score: orx.industry_links_score, icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: 'curriculum', score: orx.curriculum_modernity, icon: <BookOpen className="w-3.5 h-3.5" /> },
    { key: 'practical', score: orx.practical_intensity, icon: <Target className="w-3.5 h-3.5" /> },
    { key: 'employ', score: orx.employability_relevance, icon: <Users className="w-3.5 h-3.5" /> },
  ] : [];

  const hasData = snapshot || orx;

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {children}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-2xl border-border/40 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)]">

          {/* — Header — */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-semibold">{t('insight.orxAnalysis')}</p>
                <DialogTitle className="text-[13px] font-bold truncate leading-tight">{programName}</DialogTitle>
              </div>
            </div>
          </div>

          {/* — Body — */}
          <div className="px-5 py-4">

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-14 gap-2.5">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-[11px] text-muted-foreground">{t('insight.loading')}</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="py-8 text-center space-y-2.5">
                <p className="text-xs text-destructive">{error}</p>
                <Button size="sm" variant="outline" onClick={fetchCachedData} className="gap-1.5 text-xs h-8">
                  <RefreshCw className="w-3 h-3" />
                  {t('insight.retry')}
                </Button>
              </div>
            )}

            {/* No Data */}
            {!loading && !hasData && !error && (
              <div className="py-10 text-center space-y-3">
                <Sparkles className="w-6 h-6 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-xs font-medium">{t('insight.noData')}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t('insight.noDataDesc')}</p>
                </div>
                <Button size="sm" onClick={requestGeneration} disabled={!universityId} className="gap-1.5 text-xs h-8">
                  <RefreshCw className="w-3 h-3" />
                  {t('insight.generate')}
                </Button>
              </div>
            )}

            {/* — Main Content — */}
            {!loading && hasData && (
              <div className="space-y-5">

                {/* ORX Scores */}
                {orx && (
                  <div className="space-y-3">
                    {/* Overall score pill */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground/80">
                        {t('insight.executionQuality')}
                      </h3>
                      {orx.overall_execution_score != null && (
                        <span className={cn(
                          "text-lg font-extrabold tabular-nums",
                          scoreColor(orx.overall_execution_score)
                        )}>
                          {orx.overall_execution_score.toFixed(1)}
                          <span className="text-xs font-normal text-muted-foreground">/10</span>
                        </span>
                      )}
                    </div>

                    {/* 4×2 sub-score grid */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {orxSignals.map(s => (
                        <div
                          key={s.key}
                          className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-card px-2 py-2.5 text-center"
                        >
                          <span className="text-muted-foreground/60">{s.icon}</span>
                          <span className="text-[9px] text-muted-foreground leading-tight line-clamp-1">{t(`insight.orx.${s.key}`)}</span>
                          <span className={cn("text-[13px] font-bold tabular-nums", scoreColor(s.score))}>
                            {s.score != null ? s.score.toFixed(1) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Discipline future strength */}
                    {orx.discipline_future_strength != null && (
                      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card px-3 py-2">
                        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="text-[11px] text-muted-foreground flex-1">{t('insight.disciplineFuture')}</span>
                        <span className={cn("text-[13px] font-bold tabular-nums", scoreColor(orx.discipline_future_strength))}>
                          {orx.discipline_future_strength.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {snapshot && (
                  <>
                    {/* Summary */}
                    {snapshot.summary && (
                      <div className="space-y-1.5">
                        <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground/80">{t('insight.summary')}</h3>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">{snapshot.summary}</p>
                      </div>
                    )}

                    {/* Future Outlook */}
                    {snapshot.future_outlook && (
                      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card px-3 py-2.5">
                        {getOutlookIcon(snapshot.future_outlook)}
                        <span className="text-[11px] font-medium flex-1">{t('insight.futureOutlook')}</span>
                        <span className="text-[11px] text-muted-foreground capitalize">{snapshot.future_outlook}</span>
                      </div>
                    )}

                    {/* Strengths & Weaknesses */}
                    {(snapshot.strengths?.length > 0 || snapshot.weaknesses?.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {snapshot.strengths?.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Star className="w-3 h-3" /> {t('insight.strengths')}
                            </h4>
                            <ul className="space-y-1">
                              {snapshot.strengths.map((s, i) => (
                                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500 mt-[6px] shrink-0" />
                                  <span className="leading-relaxed">{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {snapshot.weaknesses?.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" /> {t('insight.weaknesses')}
                            </h4>
                            <ul className="space-y-1">
                              {snapshot.weaknesses.map((w, i) => (
                                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-amber-500 mt-[6px] shrink-0" />
                                  <span className="leading-relaxed">{w}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Career Paths */}
                    {snapshot.career_paths?.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground/80 flex items-center gap-1">
                          <Briefcase className="w-3 h-3 text-muted-foreground/60" /> {t('insight.careerPaths')}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {snapshot.career_paths.map((c, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px] px-2.5 py-1 rounded-md font-normal border-border/60"
                            >
                              {c.title}
                              {c.demand_level && (
                                <span className="text-muted-foreground/50 ms-1">· {c.demand_level}</span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Best Fit */}
                    {snapshot.best_fit_profile && (
                      <div className="space-y-1.5">
                        <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground/80 flex items-center gap-1">
                          <Users className="w-3 h-3 text-muted-foreground/60" /> {t('insight.bestFit')}
                        </h3>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{snapshot.best_fit_profile}</p>
                      </div>
                    )}

                    {/* Meta footer */}
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground/40 pt-2 border-t border-border/20">
                      <span>{t('insight.confidence')}: {Math.round((snapshot.confidence || 0) * 100)}%</span>
                      <span>{snapshot.generated_at ? new Date(snapshot.generated_at).toLocaleDateString(language === 'ar' ? 'ar' : 'en') : ''}</span>
                    </div>
                  </>
                )}

                {/* Ask Oryxa CTA */}
                <Button
                  onClick={handleAskOryxa}
                  className="w-full gap-2 rounded-xl h-10 font-bold text-[13px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t('insight.askOryxa')}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
