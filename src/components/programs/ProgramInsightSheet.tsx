/**
 * ProgramInsightSheet — Cached ORX + AI intelligence popover
 * Opens from program card ORX icon. Reads from local cache (program_ai_snapshots + program_orx_signals).
 * No live AI call on every click. Generation is gated behind ownership via edge function.
 */
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, TrendingUp, TrendingDown, Minus, Briefcase, Star, Target, Zap, BookOpen, Users, Building2, Cpu, GraduationCap, RefreshCw } from 'lucide-react';
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
  const { t } = useLanguage();
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
      // Read from local cache tables — no AI call
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

  // Generation is NOT exposed to public users — this button is only shown
  // but the edge function gates behind university_page_staff ownership
  async function requestGeneration() {
    if (!universityId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('university-page-manage', { body: { action: 'intelligence.generate', university_id: universityId, program_id: programId, force: true } });
      if (fnErr || !data?.ok) {
        setError(fnErr?.message || data?.error || 'Generation failed — you may not have permission.');
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
      return <TrendingUp className="w-4 h-4 text-success" />;
    if (lower.includes('declin') || lower.includes('weak') || lower.includes('negative'))
      return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const scoreColor = (score: number | null) => {
    if (score == null) return 'text-muted-foreground';
    if (score >= 7) return 'text-success';
    if (score >= 4) return 'text-amber-600';
    return 'text-destructive';
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <SheetTitle className="text-base">{programName}</SheetTitle>
          </div>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-sm text-destructive">{error}</div>
        )}

        {!loading && !hasData && (
          <div className="py-8 text-center space-y-3">
            <Brain className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">{t('insight.noData')}</p>
            <Button size="sm" onClick={requestGeneration} disabled={!universityId} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              {t('insight.generate')}
            </Button>
          </div>
        )}

        {!loading && hasData && (
          <div className="space-y-5 pt-4">
            {orx && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-primary" />
                    {t('insight.executionQuality')}
                  </h4>
                  {orx.overall_execution_score != null && (
                    <Badge className={cn("font-bold", scoreColor(orx.overall_execution_score))}>
                      {orx.overall_execution_score.toFixed(1)}/10
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {orxSignals.map(s => (
                    <div key={s.key} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                      <span className="text-primary">{s.icon}</span>
                      <span className="text-xs text-muted-foreground flex-1">{t(`insight.orx.${s.key}`)}</span>
                      <span className={cn("text-sm font-bold", scoreColor(s.score))}>
                        {s.score != null ? s.score.toFixed(1) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                {orx.discipline_future_strength != null && (
                  <div className="mt-2 flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium flex-1">{t('insight.disciplineFuture')}</span>
                    <span className={cn("text-sm font-bold", scoreColor(orx.discipline_future_strength))}>
                      {orx.discipline_future_strength.toFixed(1)}/10
                    </span>
                  </div>
                )}
              </div>
            )}

            {snapshot && (
              <>
                {snapshot.summary && (
                  <div>
                    <h4 className="text-sm font-bold mb-1.5">{t('insight.summary')}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{snapshot.summary}</p>
                  </div>
                )}

                {snapshot.future_outlook && (
                  <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3">
                    {getOutlookIcon(snapshot.future_outlook)}
                    <div>
                      <h4 className="text-xs font-bold mb-0.5">{t('insight.futureOutlook')}</h4>
                      <p className="text-xs text-muted-foreground">{snapshot.future_outlook}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {snapshot.strengths?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-success mb-1.5 flex items-center gap-1">
                        <Star className="w-3 h-3" /> {t('insight.strengths')}
                      </h4>
                      <ul className="space-y-1">
                        {snapshot.strengths.map((s, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground">• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {snapshot.weaknesses?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-destructive mb-1.5 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> {t('insight.weaknesses')}
                      </h4>
                      <ul className="space-y-1">
                        {snapshot.weaknesses.map((w, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground">• {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {snapshot.career_paths?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold mb-1.5 flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-primary" /> {t('insight.careerPaths')}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {snapshot.career_paths.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {c.title}
                          {c.demand_level && ` · ${c.demand_level}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {snapshot.best_fit_profile && (
                  <div className="bg-primary/5 rounded-lg p-3">
                    <h4 className="text-xs font-bold mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3 text-primary" /> {t('insight.bestFit')}
                    </h4>
                    <p className="text-xs text-muted-foreground">{snapshot.best_fit_profile}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 pt-2 border-t border-border/50">
                  <span>{t('insight.confidence')}: {Math.round((snapshot.confidence || 0) * 100)}%</span>
                  <span>{snapshot.generated_at ? new Date(snapshot.generated_at).toLocaleDateString() : ''}</span>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
