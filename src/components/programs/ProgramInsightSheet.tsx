/**
 * ProgramInsightSheet — Centered modal for ORX + AI intelligence
 * Opens from program card via a small Brain icon.
 * Reads from local cache (program_ai_snapshots + program_orx_signals).
 * "Ask Oryxa" button hands off all intelligence to floating chat via ChatContext.
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, TrendingUp, TrendingDown, Minus, Briefcase, Star, Target, Zap, BookOpen, Users, Building2, Cpu, GraduationCap, RefreshCw, Sparkles, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useChat } from '@/contexts/ChatContext';
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
  const { open: openChatWithMessage } = useChat();
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
        supabase.from('program_ai_snapshots').select('*').eq('program_id', programId).eq('is_current', true).maybeSingle(),
        supabase.from('program_orx_signals').select('*').eq('program_id', programId).eq('is_current', true).maybeSingle(),
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
      if (orxRes.data) setOrx(orxRes.data as any);
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
      const { data, error: fnErr } = await supabase.functions.invoke('university-page-manage', {
        body: { action: 'intelligence.generate', university_id: universityId, program_id: programId, force: true },
      });
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
    if (orx?.overall_execution_score != null) parts.push(`ORX Score: ${orx.overall_execution_score.toFixed(1)}/10`);
    if (snapshot?.summary) parts.push(snapshot.summary);
    if (snapshot?.strengths?.length) parts.push(`✅ ${snapshot.strengths.join(' • ')}`);
    if (snapshot?.weaknesses?.length) parts.push(`⚠️ ${snapshot.weaknesses.join(' • ')}`);
    if (snapshot?.career_paths?.length) parts.push(`🎯 ${snapshot.career_paths.map(c => c.title).join(', ')}`);
    if (snapshot?.future_outlook) parts.push(`📈 ${snapshot.future_outlook}`);

    setOpen(false);
    // Use ChatContext.open(message) to trigger actual send via MalakChatInterface
    openChatWithMessage(parts.join('\n\n'));
  }

  const scoreColor = (score: number | null) => {
    if (score == null) return 'text-muted-foreground';
    if (score >= 7) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 4) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getOutlookIcon = (outlook: string) => {
    if (!outlook) return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
    const lower = outlook.toLowerCase();
    if (lower.includes('grow') || lower.includes('strong') || lower.includes('positive'))
      return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
    if (lower.includes('declin') || lower.includes('weak') || lower.includes('negative'))
      return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const signals = orx ? [
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
      <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[420px] max-h-[80vh] overflow-y-auto p-0 gap-0 rounded-2xl border-border/50 shadow-2xl [&>button:last-child]:hidden">

          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-4 py-3 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Brain className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase tracking-widest text-primary/60 font-semibold leading-none mb-0.5">{t('insight.orxAnalysis')}</p>
              <DialogTitle className="text-xs font-bold truncate leading-tight">{programName}</DialogTitle>
            </div>
            <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground">
              <span className="text-sm leading-none">✕</span>
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            {loading && (
              <div className="flex flex-col items-center py-10 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p className="text-[10px] text-muted-foreground">{t('insight.loading')}</p>
              </div>
            )}

            {error && (
              <div className="py-6 text-center space-y-2">
                <p className="text-[11px] text-destructive">{error}</p>
                <Button size="sm" variant="outline" onClick={fetchCachedData} className="gap-1 text-[10px] h-7 px-3">
                  <RefreshCw className="w-3 h-3" /> {t('insight.retry')}
                </Button>
              </div>
            )}

            {!loading && !hasData && !error && (
              <div className="py-8 text-center space-y-2.5">
                <Sparkles className="w-5 h-5 text-muted-foreground mx-auto" />
                <p className="text-[11px] font-medium">{t('insight.noData')}</p>
                <p className="text-[10px] text-muted-foreground">{t('insight.noDataDesc')}</p>
                <Button size="sm" onClick={requestGeneration} disabled={!universityId} className="gap-1 text-[10px] h-7 px-3">
                  <RefreshCw className="w-3 h-3" /> {t('insight.generate')}
                </Button>
              </div>
            )}

            {!loading && hasData && (
              <div className="space-y-3.5">

                {/* ORX Scores */}
                {orx && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">{t('insight.executionQuality')}</span>
                      {orx.overall_execution_score != null && (
                        <span className={cn("text-base font-extrabold tabular-nums leading-none", scoreColor(orx.overall_execution_score))}>
                          {orx.overall_execution_score.toFixed(1)}<span className="text-[10px] font-normal text-muted-foreground/60">/10</span>
                        </span>
                      )}
                    </div>

                    {/* Sub-scores — compact 4-col */}
                    <div className="grid grid-cols-4 gap-1">
                      {signals.map(s => (
                        <div key={s.key} className="flex flex-col items-center gap-0.5 rounded-md border border-border/30 bg-muted/20 py-1.5 px-1">
                          <span className="text-muted-foreground/50">{s.icon}</span>
                          <span className="text-[8px] text-muted-foreground/70 leading-tight text-center line-clamp-1">{t(`insight.orx.${s.key}`)}</span>
                          <span className={cn("text-[11px] font-bold tabular-nums leading-none", scoreColor(s.score))}>
                            {s.score != null ? s.score.toFixed(1) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {orx.discipline_future_strength != null && (
                      <div className="flex items-center gap-1.5 rounded-md border border-border/30 bg-muted/20 px-2.5 py-1.5">
                        <TrendingUp className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                        <span className="text-[10px] text-muted-foreground/70 flex-1">{t('insight.disciplineFuture')}</span>
                        <span className={cn("text-[11px] font-bold tabular-nums", scoreColor(orx.discipline_future_strength))}>
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
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70 mb-1">{t('insight.summary')}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{snapshot.summary}</p>
                      </div>
                    )}

                    {/* Future Outlook */}
                    {snapshot.future_outlook && (
                      <div className="flex items-center gap-1.5 rounded-md border border-border/30 bg-muted/20 px-2.5 py-1.5">
                        {getOutlookIcon(snapshot.future_outlook)}
                        <span className="text-[10px] font-medium flex-1">{t('insight.futureOutlook')}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{snapshot.future_outlook}</span>
                      </div>
                    )}

                    {/* Strengths & Weaknesses */}
                    {(snapshot.strengths?.length > 0 || snapshot.weaknesses?.length > 0) && (
                      <div className="grid grid-cols-2 gap-3">
                        {snapshot.strengths?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-1">
                              <Star className="w-2.5 h-2.5" /> {t('insight.strengths')}
                            </p>
                            <ul className="space-y-0.5">
                              {snapshot.strengths.map((s, i) => (
                                <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500 mt-[5px] shrink-0" />
                                  <span className="leading-snug">{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {snapshot.weaknesses?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1">
                              <TrendingDown className="w-2.5 h-2.5" /> {t('insight.weaknesses')}
                            </p>
                            <ul className="space-y-0.5">
                              {snapshot.weaknesses.map((w, i) => (
                                <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                                  <span className="w-1 h-1 rounded-full bg-amber-500 mt-[5px] shrink-0" />
                                  <span className="leading-snug">{w}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Career Paths */}
                    {snapshot.career_paths?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70 flex items-center gap-1 mb-1">
                          <Briefcase className="w-2.5 h-2.5 text-muted-foreground/50" /> {t('insight.careerPaths')}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {snapshot.career_paths.map((c, i) => (
                            <Badge key={i} variant="outline" className="text-[9px] px-2 py-0.5 rounded font-normal border-border/50">
                              {c.title}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Best Fit */}
                    {snapshot.best_fit_profile && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70 flex items-center gap-1 mb-1">
                          <Users className="w-2.5 h-2.5 text-muted-foreground/50" /> {t('insight.bestFit')}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{snapshot.best_fit_profile}</p>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center justify-between text-[8px] text-muted-foreground/30 pt-1.5 border-t border-border/15">
                      <span>{t('insight.confidence')}: {Math.round((snapshot.confidence || 0) * 100)}%</span>
                      <span>{snapshot.generated_at ? new Date(snapshot.generated_at).toLocaleDateString(language === 'ar' ? 'ar' : 'en') : ''}</span>
                    </div>
                  </>
                )}

                {/* Ask Oryxa CTA */}
                <Button onClick={handleAskOryxa} size="sm" className="w-full gap-1.5 rounded-lg h-9 font-bold text-[12px]">
                  <MessageCircle className="w-3.5 h-3.5" />
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
