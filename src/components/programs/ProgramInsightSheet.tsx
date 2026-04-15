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
    openChatWithMessage(parts.join('\n\n'));
  }

  const scoreColor = (score: number | null) => {
    if (score == null) return 'text-muted-foreground';
    if (score >= 7) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 4) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const scoreBorderColor = (score: number | null) => {
    if (score == null) return 'border-muted-foreground/30';
    if (score >= 7) return 'border-emerald-500/40';
    if (score >= 4) return 'border-amber-500/40';
    return 'border-red-500/40';
  };

  const scoreBarColor = (score: number | null) => {
    if (score == null) return 'bg-muted-foreground/20';
    if (score >= 7) return 'bg-emerald-500/60';
    if (score >= 4) return 'bg-amber-500/60';
    return 'bg-red-500/60';
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

  const signals = orx ? [
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
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] p-0 gap-0 rounded-2xl border-border/40 shadow-2xl overflow-hidden [&>button:last-child]:hidden">

          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-b from-background to-background/95 backdrop-blur-sm border-b border-border/30 px-5 py-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 animate-scale-in">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-primary font-bold leading-none mb-1">{t('insight.orxAnalysis')}</p>
              <DialogTitle className="text-sm font-bold truncate leading-tight">{programName}</DialogTitle>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg hover:bg-muted/80 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground">
              <span className="text-base leading-none font-light">✕</span>
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="overflow-y-auto flex-1 scroll-smooth" style={{ maxHeight: 'calc(85vh - 130px)' }}>
            <div className="px-5 py-4">
              {loading && (
                <div className="flex flex-col items-center py-14 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">{t('insight.loading')}</p>
                </div>
              )}

              {error && (
                <div className="py-8 text-center space-y-3">
                  <p className="text-xs text-destructive">{error}</p>
                  <Button size="sm" variant="outline" onClick={fetchCachedData} className="gap-1.5 text-xs h-8 px-4">
                    <RefreshCw className="w-3.5 h-3.5" /> {t('insight.retry')}
                  </Button>
                </div>
              )}

              {!loading && !hasData && !error && (
                <div className="py-12 text-center space-y-3">
                  <Sparkles className="w-6 h-6 text-muted-foreground mx-auto" />
                  <p className="text-xs font-medium">{t('insight.noData')}</p>
                  <p className="text-[11px] text-muted-foreground">{t('insight.noDataDesc')}</p>
                  <Button size="sm" onClick={requestGeneration} disabled={!universityId} className="gap-1.5 text-xs h-8 px-4">
                    <RefreshCw className="w-3.5 h-3.5" /> {t('insight.generate')}
                  </Button>
                </div>
              )}

              {!loading && hasData && (
                <div className="space-y-5">

                  {/* ── Main Score Circle ── */}
                  {orx?.overall_execution_score != null && (
                    <div className="flex flex-col items-center gap-2 animate-fade-in">
                      <div className={cn(
                        "w-[72px] h-[72px] rounded-full border-[3px] flex flex-col items-center justify-center",
                        scoreBorderColor(orx.overall_execution_score),
                        "bg-muted/30"
                      )}>
                        <span className={cn("text-2xl font-black tabular-nums leading-none", scoreColor(orx.overall_execution_score))}>
                          {orx.overall_execution_score.toFixed(1)}
                        </span>
                        <span className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">/10</span>
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">{t('insight.executionQuality')}</span>
                    </div>
                  )}

                  {/* ── Sub-scores as rows ── */}
                  {signals.length > 0 && (
                    <div className="space-y-1.5">
                      {signals.map((s, idx) => (
                        <div
                          key={s.key}
                          className="flex items-center gap-3 rounded-lg border border-border/25 bg-muted/15 px-3 py-2 animate-fade-in"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <span className="text-muted-foreground/50 shrink-0">{s.icon}</span>
                          <span className="text-[11px] text-foreground/80 flex-1 font-medium">{t(`insight.orx.${s.key}`)}</span>
                          {/* Mini progress bar */}
                          <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden shrink-0">
                            <div
                              className={cn("h-full rounded-full transition-all duration-700", scoreBarColor(s.score))}
                              style={{ width: s.score != null ? `${(s.score / 10) * 100}%` : '0%' }}
                            />
                          </div>
                          <span className={cn("text-xs font-bold tabular-nums w-7 text-end", scoreColor(s.score))}>
                            {s.score != null ? s.score.toFixed(1) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Discipline Future Strength */}
                  {orx?.discipline_future_strength != null && (
                    <div className="flex items-center gap-3 rounded-lg border border-border/25 bg-muted/15 px-3 py-2.5 animate-fade-in">
                      <TrendingUp className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                      <span className="text-[11px] text-foreground/80 flex-1 font-medium">{t('insight.disciplineFuture')}</span>
                      <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden shrink-0">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700", scoreBarColor(orx.discipline_future_strength))}
                          style={{ width: `${((orx.discipline_future_strength ?? 0) / 10) * 100}%` }}
                        />
                      </div>
                      <span className={cn("text-xs font-bold tabular-nums w-7 text-end", scoreColor(orx.discipline_future_strength))}>
                        {orx.discipline_future_strength.toFixed(1)}
                      </span>
                    </div>
                  )}

                  {snapshot && (
                    <>
                      {/* ── Summary ── */}
                      {snapshot.summary && (
                        <div className="border-t border-border/20 pt-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/60 mb-2">{t('insight.summary')}</p>
                          <p className="text-[12px] text-muted-foreground leading-relaxed">{snapshot.summary}</p>
                        </div>
                      )}

                      {/* ── Future Outlook ── */}
                      {snapshot.future_outlook && (
                        <div className="flex items-center gap-3 rounded-lg border border-border/25 bg-muted/15 px-3 py-2.5">
                          {getOutlookIcon(snapshot.future_outlook)}
                          <span className="text-[11px] font-bold flex-1">{t('insight.futureOutlook')}</span>
                          <span className="text-[11px] text-muted-foreground capitalize">{snapshot.future_outlook}</span>
                        </div>
                      )}

                      {/* ── Strengths & Weaknesses ── */}
                      {(snapshot.strengths?.length > 0 || snapshot.weaknesses?.length > 0) && (
                        <div className="grid grid-cols-2 gap-4 border-t border-border/20 pt-4">
                          {snapshot.strengths?.length > 0 && (
                            <div className="animate-fade-in" style={{ animationDelay: '250ms' }}>
                              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                                <Star className="w-3.5 h-3.5" /> {t('insight.strengths')}
                              </p>
                              <ul className="space-y-1.5">
                                {snapshot.strengths.map((s, i) => (
                                  <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 mt-[5px] shrink-0" />
                                    <span className="leading-snug">{s}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {snapshot.weaknesses?.length > 0 && (
                            <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
                              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                                <TrendingDown className="w-3.5 h-3.5" /> {t('insight.weaknesses')}
                              </p>
                              <ul className="space-y-1.5">
                                {snapshot.weaknesses.map((w, i) => (
                                  <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 mt-[5px] shrink-0" />
                                    <span className="leading-snug">{w}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Career Paths ── */}
                      {snapshot.career_paths?.length > 0 && (
                        <div className="border-t border-border/20 pt-4 animate-fade-in" style={{ animationDelay: '350ms' }}>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/60 flex items-center gap-1.5 mb-2">
                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground/50" /> {t('insight.careerPaths')}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {snapshot.career_paths.map((c, i) => (
                              <Badge key={i} variant="outline" className="text-[11px] px-2.5 py-1 rounded-md font-normal border-border/40 bg-muted/20">
                                {c.title}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Best Fit ── */}
                      {snapshot.best_fit_profile && (
                        <div className="border-t border-border/20 pt-4 animate-fade-in" style={{ animationDelay: '400ms' }}>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/60 flex items-center gap-1.5 mb-2">
                            <Users className="w-3.5 h-3.5 text-muted-foreground/50" /> {t('insight.bestFit')}
                          </p>
                          <p className="text-[12px] text-muted-foreground leading-relaxed">{snapshot.best_fit_profile}</p>
                        </div>
                      )}

                      {/* ── Meta ── */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/40 pt-2 border-t border-border/15">
                        <span>{t('insight.confidence')}: {Math.round((snapshot.confidence || 0) * 100)}%</span>
                        <span>{snapshot.generated_at ? new Date(snapshot.generated_at).toLocaleDateString(language === 'ar' ? 'ar' : 'en') : ''}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Sticky Ask Oryxa CTA ── */}
          {!loading && hasData && (
            <div className="sticky bottom-0 z-10 border-t border-border/30 bg-gradient-to-t from-background via-background to-background/80 backdrop-blur-sm px-5 py-3">
              <Button onClick={handleAskOryxa} className="w-full gap-2 rounded-xl h-10 font-bold text-[13px]">
                <MessageCircle className="w-4 h-4" />
                {t('insight.askOryxa')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
