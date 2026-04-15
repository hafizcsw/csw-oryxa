/**
 * ORX Methodology — Deep-dive into how ORX RANK scores and ranks entities.
 * Covers: evidence → signals → layers → composite → confidence → ranking.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, ArrowLeft, Sparkles, Database, Brain, BarChart3, Shield,
  CheckCircle, Layers, Globe, GraduationCap, BookOpen, Scale, TrendingUp,
  AlertTriangle, Award, Search, Timer, FileCheck, Fingerprint, GitBranch
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OrxMethodology() {
  const { t } = useTranslation();

  /* ── Section: Core Principles ── */
  const principles = [
    { icon: Database, key: 'evidenceBased' },
    { icon: Layers, key: 'multiLayer' },
    { icon: TrendingUp, key: 'forwardLooking' },
    { icon: Shield, key: 'transparent' },
    { icon: Scale, key: 'deterministic' },
  ];

  /* ── Section: 7-Step Pipeline ── */
  const pipelineSteps = [
    { icon: Search, key: 'evidenceCollection' },
    { icon: Fingerprint, key: 'evidenceScoring' },
    { icon: GitBranch, key: 'signalAggregation' },
    { icon: Layers, key: 'layerScoring' },
    { icon: BarChart3, key: 'compositeScore' },
    { icon: Shield, key: 'confidenceCalc' },
    { icon: Award, key: 'ranking' },
  ];

  /* ── Section: Evidence Properties ── */
  const evidenceProps = [
    'sourceType', 'trustLevel', 'sourceDomain', 'signalFamily',
    'freshnessDate', 'extractionConfidence', 'evidenceStatus',
  ];

  /* ── Section: Trust Weights ── */
  const trustWeights = [
    { level: 'high', weight: '1.0' },
    { level: 'medium', weight: '0.7' },
    { level: 'low', weight: '0.4' },
  ];

  /* ── Section: Decay ── */
  const decayRanges = [
    { range: '0–6', multiplier: '1.0' },
    { range: '6–12', multiplier: '0.9' },
    { range: '12–18', multiplier: '0.75' },
    { range: '18–24', multiplier: '0.6' },
    { range: '24–36', multiplier: '0.4' },
    { range: '36+', multiplier: '0.0' },
  ];

  /* ── Section: Layer Signal Families ── */
  const countrySignals = [
    { key: 'aiEcosystem', weight: '25%' },
    { key: 'govAiReadiness', weight: '20%' },
    { key: 'digitalInfra', weight: '20%' },
    { key: 'talentSkills', weight: '20%' },
    { key: 'policyMaturity', weight: '15%' },
  ];

  const universitySignals = [
    { key: 'curriculumVelocity', weight: '20%' },
    { key: 'aiIntegration', weight: '20%' },
    { key: 'appliedLearning', weight: '18%' },
    { key: 'flexibleLearning', weight: '12%' },
    { key: 'transparency', weight: '10%' },
    { key: 'studentSignal', weight: '10%', capped: true },
    { key: 'researchCompute', weight: '10%' },
  ];

  const programSignals = [
    { key: 'futureSkillAlignment', weight: '25%' },
    { key: 'curriculumFreshness', weight: '20%' },
    { key: 'aiWorkflowExposure', weight: '18%' },
    { key: 'transferability', weight: '15%' },
    { key: 'appliedIndustry', weight: '12%' },
    { key: 'studentValue', weight: '10%', capped: true },
  ];

  /* ── Section: Confidence Factors ── */
  const confidenceFactors = [
    'evidenceCount', 'evidenceDiversity', 'sourceIndependence',
    'evidenceFreshness', 'signalCompleteness', 'conflictRate',
  ];

  return (
    <Layout>
      <SEOHead
        title={t('orx.methodology.seo.title')}
        description={t('orx.methodology.seo.description')}
        canonical="/orx-rank/methodology"
      />

      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">{t('orx.breadcrumb.home')}</Link>
          <span>/</span>
          <Link to="/orx-rank" className="hover:text-foreground transition-colors">{t('orx.brandName')}</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{t('orx.methodology.breadcrumb')}</span>
        </div>
      </div>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground">
        <div className="absolute inset-0 opacity-20" style={{ background: 'var(--gradient-mesh)' }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{t('orx.brandName')}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-6">
            {t('orx.methodology.hero.title')}
          </h1>
          <p className="text-lg text-secondary-foreground/70 leading-relaxed max-w-3xl mb-4">
            {t('orx.methodology.hero.subtitle')}
          </p>
          <p className="text-base text-secondary-foreground/50 leading-relaxed max-w-3xl">
            {t('orx.methodology.hero.keyPoint')}
          </p>
        </div>
      </section>

      {/* ═══ CORE PRINCIPLES ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mb-10">
            {t('orx.methodology.principles.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {principles.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border/50">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{t(`orx.methodology.principles.${key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(`orx.methodology.principles.${key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7-STEP PIPELINE ═══ */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <span className="text-xs font-bold uppercase tracking-widest text-primary mb-3 block">
            {t('orx.methodology.pipeline.label')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mb-4">
            {t('orx.methodology.pipeline.title')}
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-10 max-w-3xl">
            {t('orx.methodology.pipeline.subtitle')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pipelineSteps.map(({ icon: Icon, key }, i) => (
              <div key={key} className={cn(
                "relative p-6 rounded-2xl border border-border/50 bg-card shadow-[var(--shadow-card)]",
                i === pipelineSteps.length - 1 && "lg:col-span-1"
              )}>
                <span className="absolute top-3 end-3 text-xs font-black text-muted-foreground/30">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Icon className="w-7 h-7 text-primary mb-3" />
                <h3 className="font-bold text-foreground mb-2">{t(`orx.methodology.pipeline.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(`orx.methodology.pipeline.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STEP 1: EVIDENCE ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">01</div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {t('orx.methodology.evidence.title')}
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">
            {t('orx.methodology.evidence.description')}
          </p>

          {/* Evidence Properties */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-10">
            {evidenceProps.map(key => (
              <div key={key} className="p-3 rounded-lg bg-muted/50 border border-border/40 text-center">
                <p className="text-xs font-mono font-semibold text-primary">{t(`orx.methodology.evidence.props.${key}.code`)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{t(`orx.methodology.evidence.props.${key}.label`)}</p>
              </div>
            ))}
          </div>

          {/* Contribution Formula */}
          <div className="p-6 rounded-2xl bg-secondary text-secondary-foreground border border-border/30 mb-8">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              {t('orx.methodology.evidence.formula.title')}
            </h3>
            <code className="block text-sm font-mono text-primary bg-secondary-foreground/5 p-4 rounded-lg mb-4">
              contribution = trust_weight × decay_multiplier × extraction_confidence
            </code>
            
            {/* Trust Weights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
              <div>
                <h4 className="text-sm font-bold mb-3">{t('orx.methodology.evidence.trustWeights.title')}</h4>
                <div className="space-y-2">
                  {trustWeights.map(({ level, weight }) => (
                    <div key={level} className="flex items-center justify-between p-2 rounded-lg bg-secondary-foreground/5">
                      <span className="text-sm">{t(`orx.methodology.evidence.trustWeights.${level}`)}</span>
                      <span className="font-mono font-bold text-primary text-sm">{weight}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold mb-3">{t('orx.methodology.evidence.decay.title')}</h4>
                <div className="space-y-1.5">
                  {decayRanges.map(({ range, multiplier }) => (
                    <div key={range} className="flex items-center justify-between p-2 rounded-lg bg-secondary-foreground/5">
                      <span className="text-xs">{range} {t('orx.methodology.evidence.decay.months')}</span>
                      <span className="font-mono font-bold text-primary text-sm">{multiplier}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Domain Cap */}
          <div className="flex items-start gap-3 p-5 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-foreground mb-1">{t('orx.methodology.evidence.domainCap.title')}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('orx.methodology.evidence.domainCap.desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STEP 2: LAYER SCORING ═══ */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">02</div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {t('orx.methodology.layers.title')}
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-10 max-w-3xl">
            {t('orx.methodology.layers.description')}
          </p>

          <div className="space-y-8">
            {/* Country Layer */}
            <LayerCard
              icon={Globe}
              title={t('orx.methodology.layers.country.title')}
              subtitle={t('orx.methodology.layers.country.subtitle')}
              weight="20%"
              signals={countrySignals}
              t={t}
              prefix="orx.methodology.layers.country.signals"
            />
            {/* University Layer */}
            <LayerCard
              icon={GraduationCap}
              title={t('orx.methodology.layers.university.title')}
              subtitle={t('orx.methodology.layers.university.subtitle')}
              weight="35%"
              signals={universitySignals}
              t={t}
              prefix="orx.methodology.layers.university.signals"
            />
            {/* Program Layer */}
            <LayerCard
              icon={BookOpen}
              title={t('orx.methodology.layers.program.title')}
              subtitle={t('orx.methodology.layers.program.subtitle')}
              weight="45%"
              signals={programSignals}
              t={t}
              prefix="orx.methodology.layers.program.signals"
            />
          </div>
        </div>
      </section>

      {/* ═══ STEP 3: COMPOSITE SCORE ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">03</div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {t('orx.methodology.composite.title')}
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">
            {t('orx.methodology.composite.description')}
          </p>

          <div className="p-6 rounded-2xl bg-secondary text-secondary-foreground border border-border/30 mb-8">
            <code className="block text-lg sm:text-xl font-mono text-primary text-center py-4">
              ORX = (C × 0.20) + (U × 0.35) + (P × 0.45)
            </code>
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { code: 'C', label: t('orx.methodology.composite.layers.country'), w: '20%' },
                { code: 'U', label: t('orx.methodology.composite.layers.university'), w: '35%' },
                { code: 'P', label: t('orx.methodology.composite.layers.program'), w: '45%' },
              ].map(l => (
                <div key={l.code} className="text-center p-3 rounded-xl bg-secondary-foreground/5">
                  <p className="text-2xl font-black text-primary">{l.w}</p>
                  <p className="text-xs text-secondary-foreground/60 mt-1">{l.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Missing Layer Penalties */}
          <div className="p-5 rounded-xl bg-muted/50 border border-border/50 mb-8">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {t('orx.methodology.composite.missingLayers.title')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{t('orx.methodology.composite.missingLayers.desc')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['country', 'university', 'program'] as const).map(layer => (
                <div key={layer} className="p-3 rounded-lg bg-card border border-border/40">
                  <p className="font-semibold text-sm text-foreground">{t(`orx.methodology.composite.missingLayers.${layer}.label`)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t(`orx.methodology.composite.missingLayers.${layer}.rule`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STEP 4: CONFIDENCE ═══ */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">04</div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {t('orx.methodology.confidence.title')}
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-4 max-w-3xl">
            {t('orx.methodology.confidence.description')}
          </p>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">
            {t('orx.methodology.confidence.example')}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {confidenceFactors.map(key => (
              <div key={key} className="p-4 rounded-xl bg-card border border-border/50 text-center">
                <CheckCircle className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">{t(`orx.methodology.confidence.factors.${key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STEP 5: RANKING RULES ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">05</div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {t('orx.methodology.ranking.title')}
            </h2>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">
            {t('orx.methodology.ranking.description')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {['eligibility', 'sortOrder', 'tieBreaker', 'denseRank'].map(key => (
              <div key={key} className="p-5 rounded-xl bg-card border border-border/50">
                <h4 className="font-bold text-foreground mb-1">{t(`orx.methodology.ranking.rules.${key}.title`)}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(`orx.methodology.ranking.rules.${key}.desc`)}</p>
              </div>
            ))}
          </div>

          {/* Worked Example */}
          <div className="p-6 rounded-2xl bg-secondary text-secondary-foreground border border-border/30">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              {t('orx.methodology.ranking.example.title')}
            </h3>
            <div className="space-y-3">
              {['uniA', 'uniB', 'uniC'].map((uni, i) => (
                <div key={uni} className="flex items-center gap-4 p-4 rounded-xl bg-secondary-foreground/5">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{t(`orx.methodology.ranking.example.${uni}.name`)}</p>
                    <p className="text-xs text-secondary-foreground/60">{t(`orx.methodology.ranking.example.${uni}.detail`)}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-lg font-black text-primary">{t(`orx.methodology.ranking.example.${uni}.score`)}</p>
                    <p className="text-[10px] text-secondary-foreground/50">{t(`orx.methodology.ranking.example.${uni}.confidence`)}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-secondary-foreground/50 mt-4">
              {t('orx.methodology.ranking.example.note')}
            </p>
          </div>
        </div>
      </section>

      {/* ═══ WHY LESS FAMOUS CAN RANK HIGHER ═══ */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mb-6">
            {t('orx.methodology.whyDifferent.title')}
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            {t('orx.methodology.whyDifferent.description')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['curriculumUpdated', 'futureAligned', 'aiExposure', 'appliedLearning', 'freshEvidence', 'transparent'].map(key => (
              <div key={key} className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border/50">
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground">{t(`orx.methodology.whyDifferent.factors.${key}`)}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 p-5 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-sm text-foreground font-medium leading-relaxed">
              {t('orx.methodology.whyDifferent.conclusion')}
            </p>
          </div>
        </div>
      </section>

      {/* ═══ WHAT STILL IMPROVES ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mb-6">
            {t('orx.methodology.improvements.title')}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">{t('orx.methodology.improvements.intro')}</p>
          <div className="space-y-3">
            {['calibration', 'semanticExtraction', 'disciplineSpecific'].map(key => (
              <div key={key} className="p-5 rounded-xl bg-card border border-border/50">
                <h4 className="font-bold text-foreground mb-1">{t(`orx.methodology.improvements.${key}.title`)}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(`orx.methodology.improvements.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="py-16 sm:py-20 bg-secondary text-secondary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-4">{t('orx.methodology.cta.title')}</h2>
          <p className="text-secondary-foreground/70 mb-6 max-w-xl mx-auto">{t('orx.methodology.cta.description')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/universities?tab=universities">{t('orx.methodology.cta.explore')} <ArrowRight className="w-4 h-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2 border-secondary-foreground/20 text-secondary-foreground hover:bg-secondary-foreground/10">
              <Link to="/orx-rank">{t('orx.methodology.cta.backToHub')} <ArrowLeft className="w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

/* ── LayerCard component ── */
interface LayerCardProps {
  icon: typeof Globe;
  title: string;
  subtitle: string;
  weight: string;
  signals: { key: string; weight: string; capped?: boolean }[];
  t: (key: string) => string;
  prefix: string;
}

function LayerCard({ icon: Icon, title, subtitle, weight, signals, t, prefix }: LayerCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border/50 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="px-3 py-1 rounded-full bg-primary/10 text-primary font-black text-sm">{weight}</div>
      </div>
      <div className="space-y-2">
        {signals.map(({ key, weight: w, capped }) => (
          <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
            <span className="text-sm text-foreground">{t(`${prefix}.${key}`)}</span>
            <div className="flex items-center gap-2">
              {capped && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                  {t('orx.methodology.layers.capped')}
                </span>
              )}
              <span className="font-mono font-bold text-sm text-primary">{w}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
