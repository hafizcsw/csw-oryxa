/**
 * ProgramInsightSheet — Centered modal for ORX + AI intelligence
 * Shows condensed insights. "Ask Oryxa" sends ALL data to chat.
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
    // Send ALL generated data to chat
    const parts: string[] = [];
    parts.push(`📋 **${programName}**`);

    if (orx) {
      if (orx.overall_execution_score != null) parts.push(`🏆 ORX Score: **${orx.overall_execution_score.toFixed(1)}/10**`);
      const scoreLines: string[] = [];
      if (orx.labs_score != null) scoreLines.push(`Labs: ${orx.labs_score.toFixed(1)}`);
      if (orx.internship_score != null) scoreLines.push(`Internship: ${orx.internship_score.toFixed(1)}`);
      if (orx.capstone_score != null) scoreLines.push(`Capstone: ${orx.capstone_score.toFixed(1)}`);
      if (orx.tooling_score != null) scoreLines.push(`Tooling: ${orx.tooling_score.toFixed(1)}`);
      if (orx.industry_links_score != null) scoreLines.push(`Industry: ${orx.industry_links_score.toFixed(1)}`);
      if (orx.curriculum_modernity != null) scoreLines.push(`Curriculum: ${orx.curriculum_modernity.toFixed(1)}`);
      if (orx.practical_intensity != null) scoreLines.push(`Practical: ${orx.practical_intensity.toFixed(1)}`);
      if (orx.employability_relevance != null) scoreLines.push(`Employability: ${orx.employability_relevance.toFixed(1)}`);
      if (scoreLines.length) parts.push(`📊 Sub-scores: ${scoreLines.join(' | ')}`);
      if (orx.discipline_future_strength != null) parts.push(`📈 Discipline Future: ${orx.discipline_future_strength.toFixed(1)}/10`);
    }

    if (snapshot) {
      if (snapshot.summary) parts.push(`📝 ${snapshot.summary}`);
      if (snapshot.future_outlook) parts.push(`🔮 Future Outlook: ${snapshot.future_outlook}`);
      if (snapshot.strengths?.length) parts.push(`✅ Strengths:\n${snapshot.strengths.map(s => `• ${s}`).join('\n')}`);
      if (snapshot.weaknesses?.length) parts.push(`⚠️ Weaknesses:\n${snapshot.weaknesses.map(w => `• ${w}`).join('\n')}`);
      if (snapshot.career_paths?.length) {
        const careerLines = snapshot.career_paths.map(c => {
          let line = `• ${c.title}`;
          if (c.demand_level) line += ` (${c.demand_level})`;
          if (c.avg_salary_range) line += ` — ${c.avg_salary_range}`;
          return line;
        });
        parts.push(`🎯 Career Paths:\n${careerLines.join('\n')}`);
      }
      if (snapshot.best_fit_profile) parts.push(`👤 Best Fit: ${snapshot.best_fit_profile}`);
      if (snapshot.practical_assessment) parts.push(`🔧 Practical Assessment: ${snapshot.practical_assessment}`);
    }

    setOpen(false);
    openChatWithMessage(parts.join('\n\n'));
  }

  const scoreColor = (score: number | null) => {
    if (score == null) return 'text-muted-foreground';
    if (score >= 7) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 4) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const scoreBg = (score: number | null) => {
    if (score == null) return 'bg-muted/30';
    if (score >= 7) return 'bg-emerald-500/8';
    if (score >= 4) return 'bg-amber-500/8';
    return 'bg-red-500/8';
  };

  const scoreBorder = (score: number | null) => {
    if (score == null) return 'border-border/30';
    if (score >= 7) return 'border-emerald-500/25';
    if (score >= 4) return 'border-amber-500/25';
    return 'border-red-500/25';
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

  // Truncate summary to ~120 chars for modal display
  const shortSummary = snapshot?.summary
    ? snapshot.summary.length > 140
      ? snapshot.summary.slice(0, 140) + '…'
      : snapshot.summary
    : null;

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={cn(
          "max-w-[440px] p-0 gap-0 rounded-2xl border-border/40 shadow-2xl",
          "[&>button:last-child]:hidden"
        )}>

          {/* ─── Header ─── */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Brain className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-primary font-bold leading-none mb-0.5">{t('insight.orxAnalysis')}</p>
              <DialogTitle className="text-[13px] font-bold truncate leading-tight">{programName}</DialogTitle>
            </div>
            <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground">
              <span className="text-sm leading-none">✕</span>
            </button>
          </div>

          {/* ─── Body ─── */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>

            {loading && (
              <div className="flex flex-col items-center py-12 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p className="text-[11px] text-muted-foreground">{t('insight.loading')}</p>
              </div>
            )}

            {error && (
              <div className="py-8 text-center space-y-2 px-4">
                <p className="text-[11px] text-destructive">{error}</p>
                <Button size="sm" variant="outline" onClick={fetchCachedData} className="gap-1 text-[11px] h-8 px-3">
                  <RefreshCw className="w-3 h-3" /> {t('insight.retry')}
                </Button>
              </div>
            )}

            {!loading && !hasData && !error && (
              <div className="py-10 text-center space-y-2.5 px-4">
                <Sparkles className="w-5 h-5 text-muted-foreground mx-auto" />
                <p className="text-[11px] font-medium">{t('insight.noData')}</p>
                <p className="text-[11px] text-muted-foreground">{t('insight.noDataDesc')}</p>
                <Button size="sm" onClick={requestGeneration} disabled={!universityId} className="gap-1 text-[11px] h-8 px-3">
                  <RefreshCw className="w-3 h-3" /> {t('insight.generate')}
                </Button>
              </div>
            )}

            {!loading && hasData && (
              <div className="px-4 py-3 space-y-3">

                {/* ── Main Score + Sub-scores ── */}
                {orx && (
                  <>
                    {/* Main score badge */}
                    {orx.overall_execution_score != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">{t('insight.executionQuality')}</span>
                        <div className={cn(
                          "px-3 py-1 rounded-full border-2 font-black text-lg tabular-nums",
                          scoreBorder(orx.overall_execution_score),
                          scoreBg(orx.overall_execution_score),
                          scoreColor(orx.overall_execution_score)
                        )}>
                          {orx.overall_execution_score.toFixed(1)}<span className="text-[10px] font-normal text-muted-foreground/50">/10</span>
                        </div>
                      </div>
                    )}

                    {/* Sub-scores grid — 4 cols, compact */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {signals.map(s => (
                        <div key={s.key} className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border py-2 px-1",
                          scoreBorder(s.score), scoreBg(s.score)
                        )}>
                          <span className="text-muted-foreground/50">{s.icon}</span>
                          <span className="text-[9px] text-muted-foreground/70 text-center leading-tight line-clamp-1">{t(`insight.orx.${s.key}`)}</span>
                          <span className={cn("text-[13px] font-bold tabular-nums leading-none", scoreColor(s.score))}>
                            {s.score != null ? s.score.toFixed(1) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Discipline Future */}
                    {orx.discipline_future_strength != null && (
                      <div className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2",
                        scoreBorder(orx.discipline_future_strength), scoreBg(orx.discipline_future_strength)
                      )}>
                        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                        <span className="text-[11px] text-foreground/70 flex-1">{t('insight.disciplineFuture')}</span>
                        <span className={cn("text-[13px] font-bold tabular-nums", scoreColor(orx.discipline_future_strength))}>
                          {orx.discipline_future_strength.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {snapshot && (
                  <>
                    {/* ── Summary (truncated) ── */}
                    {shortSummary && (
                      <div className="border-t border-border/20 pt-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/60 mb-1">{t('insight.summary')}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{shortSummary}</p>
                      </div>
                    )}

                    {/* ── Future Outlook ── */}
                    {snapshot.future_outlook && (
                      <div className="flex items-center gap-2 rounded-lg border border-border/25 bg-muted/15 px-3 py-2">
                        {getOutlookIcon(snapshot.future_outlook)}
                        <span className="text-[11px] font-semibold flex-1">{t('insight.futureOutlook')}</span>
                        <span className="text-[11px] text-muted-foreground capitalize">{snapshot.future_outlook}</span>
                      </div>
                    )}

                    {/* ── Strengths & Weaknesses (max 3 each) ── */}
                    {(snapshot.strengths?.length > 0 || snapshot.weaknesses?.length > 0) && (
                      <div className="grid grid-cols-2 gap-3 border-t border-border/20 pt-3">
                        {snapshot.strengths?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-1.5">
                              <Star className="w-3 h-3" /> {t('insight.strengths')}
                            </p>
                            <ul className="space-y-1">
                              {snapshot.strengths.slice(0, 3).map((s, i) => (
                                <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500/60 mt-[5px] shrink-0" />
                                  <span className="leading-snug line-clamp-2">{s}</span>
                                </li>
                              ))}
                              {snapshot.strengths.length > 3 && (
                                <li className="text-[9px] text-muted-foreground/50">+{snapshot.strengths.length - 3} more…</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {snapshot.weaknesses?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1.5">
                              <TrendingDown className="w-3 h-3" /> {t('insight.weaknesses')}
                            </p>
                            <ul className="space-y-1">
                              {snapshot.weaknesses.slice(0, 3).map((w, i) => (
                                <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-amber-500/60 mt-[5px] shrink-0" />
                                  <span className="leading-snug line-clamp-2">{w}</span>
                                </li>
                              ))}
                              {snapshot.weaknesses.length > 3 && (
                                <li className="text-[9px] text-muted-foreground/50">+{snapshot.weaknesses.length - 3} more…</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Career Paths (badges) ── */}
                    {snapshot.career_paths?.length > 0 && (
                      <div className="border-t border-border/20 pt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/60 flex items-center gap-1 mb-1.5">
                          <Briefcase className="w-3 h-3 text-muted-foreground/50" /> {t('insight.careerPaths')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {snapshot.career_paths.map((c, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-2 py-0.5 rounded-md font-normal border-border/40">
                              {c.title}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Meta ── */}
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground/30 pt-2 border-t border-border/15">
                      <span>{t('insight.confidence')}: {Math.round((snapshot.confidence || 0) * 100)}%</span>
                      <span>{snapshot.generated_at ? new Date(snapshot.generated_at).toLocaleDateString(language === 'ar' ? 'ar' : 'en') : ''}</span>
                    </div>
                  </>
                )}

                {/* ── Ask Oryxa CTA ── */}
                <Button onClick={handleAskOryxa} className="w-full gap-2 rounded-xl h-10 font-bold text-[12px]">
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
