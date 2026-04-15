import { RUSSIAN_PLACEMENT_META_QUESTIONS, RUSSIAN_PLACEMENT_QUESTION_BANK } from '@/lib/russianPlacementQuestionBank';
import type {
  RussianMetaAnswer,
  RussianPlacementBand,
  RussianPlacementBlockCode,
  RussianPlacementMetaResponse,
  RussianPlacementQuestion,
  RussianPlacementResult,
  RussianPlacementScoreBreakdown,
  RussianPlacementSessionPlan,
  RussianPlacementWeakAreaCode,
} from '@/lib/russianPlacementTypes';

const BLOCK_WEIGHTS: Record<'A_SCRIPT' | 'B_GENERAL' | 'C_COMPREHENSION' | 'D_ACADEMIC' | 'E_TRACK', number> = {
  A_SCRIPT: 0.15,
  B_GENERAL: 0.3,
  C_COMPREHENSION: 0.2,
  D_ACADEMIC: 0.25,
  E_TRACK: 0.1,
};

function sampleQuestions(block: RussianPlacementBlockCode, count: number, offset = 0) {
  const pool = RUSSIAN_PLACEMENT_QUESTION_BANK.filter((question) => question.block_code === block);
  return pool.slice(offset, offset + count);
}

function scoreBlock(questions: RussianPlacementQuestion[], answers: Record<string, RussianMetaAnswer>): RussianPlacementScoreBreakdown {
  const totalWeight = questions.reduce((sum, question) => sum + question.scoring_weight, 0);
  const correctWeight = questions.reduce((sum, question) => sum + (answers[question.id] === question.correctAnswer ? question.scoring_weight : 0), 0);
  const answered = questions.filter((question) => typeof answers[question.id] === 'string').length;
  const percent = totalWeight > 0 ? Math.round((correctWeight / totalWeight) * 100) : 0;
  return { answered, correctWeight, totalWeight, percent };
}

export function buildRussianPlacementSessionPlan(seedAnswers: Record<string, RussianMetaAnswer> = {}): RussianPlacementSessionPlan {
  const initialScript = sampleQuestions('A_SCRIPT', 6);
  const initialGeneral = sampleQuestions('B_GENERAL', 8);
  const initialComprehension = sampleQuestions('C_COMPREHENSION', 6);
  const initialAcademic = sampleQuestions('D_ACADEMIC', 6);
  const initialTrack = sampleQuestions('E_TRACK', 4);

  const earlyQuestions = [...initialScript, ...initialGeneral];
  const earlyAnsweredCount = earlyQuestions.filter((question) => typeof seedAnswers[question.id] === 'string').length;
  const hasEarlyEvidence = earlyAnsweredCount === earlyQuestions.length;
  const earlySignals = hasEarlyEvidence ? scoreBlock(earlyQuestions, seedAnswers).percent : 58;
  const shortRoute = hasEarlyEvidence && earlySignals < 45;
  const strongerRoute = hasEarlyEvidence && earlySignals >= 72;

  const questionsByBlock = {
    A_SCRIPT: initialScript,
    B_GENERAL: shortRoute ? sampleQuestions('B_GENERAL', 8, 4) : initialGeneral,
    C_COMPREHENSION: shortRoute ? sampleQuestions('C_COMPREHENSION', 4) : strongerRoute ? sampleQuestions('C_COMPREHENSION', 8) : initialComprehension,
    D_ACADEMIC: shortRoute ? sampleQuestions('D_ACADEMIC', 4) : strongerRoute ? sampleQuestions('D_ACADEMIC', 8) : initialAcademic,
    E_TRACK: strongerRoute ? sampleQuestions('E_TRACK', 6) : initialTrack,
  } satisfies RussianPlacementSessionPlan['questionsByBlock'];

  const totalScoredQuestions = Object.values(questionsByBlock).reduce((sum, questions) => sum + (questions?.length ?? 0), 0);

  return {
    metaQuestions: RUSSIAN_PLACEMENT_META_QUESTIONS,
    blockOrder: ['A_SCRIPT', 'B_GENERAL', 'C_COMPREHENSION', 'D_ACADEMIC', 'E_TRACK'],
    questionsByBlock,
    totalScoredQuestions,
  };
}

function weakAreaRank(questions: RussianPlacementQuestion[], answers: Record<string, RussianMetaAnswer>) {
  const bucket = new Map<RussianPlacementWeakAreaCode, { correct: number; total: number }>();
  for (const question of questions) {
    const entry = bucket.get(question.weak_area_code) ?? { correct: 0, total: 0 };
    entry.total += question.scoring_weight;
    if (answers[question.id] === question.correctAnswer) entry.correct += question.scoring_weight;
    bucket.set(question.weak_area_code, entry);
  }
  return [...bucket.entries()]
    .map(([code, values]) => ({ code, percent: values.total ? Math.round((values.correct / values.total) * 100) : 0 }))
    .sort((a, b) => a.percent - b.percent);
}

function computeTrackSignal(trackQuestions: RussianPlacementQuestion[], answers: Record<string, RussianMetaAnswer>, meta: RussianPlacementMetaResponse) {
  const signals = { medicine: 0, engineering: 0, humanities_social: 0 };
  const totals = { medicine: 0, engineering: 0, humanities_social: 0 };
  for (const question of trackQuestions) {
    if (question.track_tag === 'general') continue;
    totals[question.track_tag] += question.scoring_weight;
    if (answers[question.id] === question.correctAnswer) signals[question.track_tag] += question.scoring_weight;
  }
  const result = {
    medicine: totals.medicine ? Math.round((signals.medicine / totals.medicine) * 100) : 0,
    engineering: totals.engineering ? Math.round((signals.engineering / totals.engineering) * 100) : 0,
    humanities_social: totals.humanities_social ? Math.round((signals.humanities_social / totals.humanities_social) * 100) : 0,
  };
  if (meta.intendedTrack && meta.intendedTrack in result) {
    const top = Math.max(...Object.values(result));
    if ((result as Record<string, number>)[meta.intendedTrack] >= top - 6) {
      (result as Record<string, number>)[meta.intendedTrack] = Math.min(100, (result as Record<string, number>)[meta.intendedTrack] + 4);
    }
  }
  return result;
}

function computeConfidence(weightedScore: number, blockScores: RussianPlacementResult['block_scores'], trackSignal: RussianPlacementResult['track_signal']) {
  const thresholds = [20, 38, 55, 70, 84];
  const nearestThresholdDistance = Math.min(...thresholds.map((threshold) => Math.abs(weightedScore - threshold)));
  const contradiction = Math.max(blockScores.B_GENERAL.percent, blockScores.D_ACADEMIC.percent) - Math.min(blockScores.A_SCRIPT.percent, blockScores.C_COMPREHENSION.percent);
  const advancedEvidence = Math.min(blockScores.C_COMPREHENSION.answered, blockScores.D_ACADEMIC.answered) >= 5 ? 100 : 45;
  const trackSpread = [...Object.values(trackSignal)].sort((a, b) => b - a);
  const topGap = (trackSpread[0] ?? 0) - (trackSpread[1] ?? 0);
  const score = Math.max(0, Math.min(100,
    82
    - Math.max(0, 16 - nearestThresholdDistance)
    - Math.max(0, contradiction - 25) * 0.8
    - (advancedEvidence < 100 ? 12 : 0)
    + Math.min(10, topGap / 2)
  ));
  const confidence = score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low';
  return { score: Math.round(score), confidence } as const;
}

function deriveBand(args: {
  weightedScore: number;
  script: number;
  general: number;
  comprehension: number;
  academic: number;
  prep: number;
  confidence: 'low' | 'medium' | 'high';
}) {
  const { weightedScore, script, general, comprehension, academic, prep, confidence } = args;
  const scriptGatePass = script >= 55;
  const academicGatePass = academic >= 60 && comprehension >= 55;
  const prepGatePass = academic >= 75 && prep >= 72;

  let placementBand: RussianPlacementBand = 'PB0_SCRIPT_FOUNDATION';
  if (scriptGatePass && general >= 38) placementBand = 'PB1_GENERAL_FOUNDATION';
  if (scriptGatePass && general >= 55 && comprehension >= 48) placementBand = 'PB2_GENERAL_CORE';
  if (scriptGatePass && academicGatePass && weightedScore >= 58) placementBand = 'PB3_ACADEMIC_ENTRY';
  if (scriptGatePass && academicGatePass && weightedScore >= 72 && academic >= 70) placementBand = 'PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL';
  if (scriptGatePass && prepGatePass && weightedScore >= 84) placementBand = 'PB5_PREP_ACCELERATED_ENTRY';

  if (confidence === 'low') {
    const conservativeMap: Record<RussianPlacementBand, RussianPlacementBand> = {
      PB0_SCRIPT_FOUNDATION: 'PB0_SCRIPT_FOUNDATION',
      PB1_GENERAL_FOUNDATION: 'PB1_GENERAL_FOUNDATION',
      PB2_GENERAL_CORE: 'PB1_GENERAL_FOUNDATION',
      PB3_ACADEMIC_ENTRY: 'PB2_GENERAL_CORE',
      PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL: 'PB3_ACADEMIC_ENTRY',
      PB5_PREP_ACCELERATED_ENTRY: 'PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL',
    };
    placementBand = conservativeMap[placementBand];
  }

  return { placementBand, scriptGatePass, academicGatePass, prepGatePass };
}

function getCompatibility(placementBand: RussianPlacementBand, meta: RussianPlacementMetaResponse, trackRecommendation: RussianPlacementResult['track_recommendation'], trackSignal: RussianPlacementResult['track_signal'], gates: { scriptGatePass: boolean }) {
  const leadTrack = Object.entries(trackSignal).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'humanities_social';
  const chosenTrack = trackRecommendation === 'unclear' ? (meta.intendedTrack || 'humanities_social') : leadTrack;
  const goal = !gates.scriptGatePass || placementBand === 'PB0_SCRIPT_FOUNDATION' || placementBand === 'PB1_GENERAL_FOUNDATION' ? 'general' : meta.goal === 'daily_life' ? 'general' : meta.goal === 'prep_exam' ? 'prep' : 'academic';
  const recommended_path = goal === 'general' ? 'russian_general' : `russian_${goal}_${chosenTrack}`.replace('humanities_social', 'general');
  const startMap: Record<RussianPlacementBand, { stage: string; module: string; lessonBand?: string; legacy: RussianPlacementResult['legacy_result_category'] }> = {
    PB0_SCRIPT_FOUNDATION: { stage: 'script_foundation', module: 'foundations_01_script_sounds', lessonBand: 'alphabet_bridge', legacy: 'start_from_zero' },
    PB1_GENERAL_FOUNDATION: { stage: 'general_foundation', module: 'foundations_02_core_interaction', lessonBand: 'core_survival', legacy: 'basics_refresh' },
    PB2_GENERAL_CORE: { stage: 'general_core', module: 'foundations_03_survival_navigation', lessonBand: 'general_core', legacy: 'basics_refresh' },
    PB3_ACADEMIC_ENTRY: { stage: 'academic_entry', module: 'academic_01_classroom_basics', lessonBand: 'academic_entry', legacy: 'early_academic' },
    PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL: { stage: 'academic_ready', module: 'academic_02_reading_patterns', lessonBand: 'track_preview', legacy: 'early_academic' },
    PB5_PREP_ACCELERATED_ENTRY: { stage: 'prep_accelerated', module: 'academic_03_note_taking_response', lessonBand: 'prep_accelerated', legacy: 'early_academic' },
  };
  return { recommended_path, ...startMap[placementBand] };
}

export function scoreRussianPlacementSession(plan: RussianPlacementSessionPlan, answers: Record<string, RussianMetaAnswer>, meta: RussianPlacementMetaResponse): RussianPlacementResult {
  const blockScores = {
    A_SCRIPT: scoreBlock(plan.questionsByBlock.A_SCRIPT ?? [], answers),
    B_GENERAL: scoreBlock(plan.questionsByBlock.B_GENERAL ?? [], answers),
    C_COMPREHENSION: scoreBlock(plan.questionsByBlock.C_COMPREHENSION ?? [], answers),
    D_ACADEMIC: scoreBlock(plan.questionsByBlock.D_ACADEMIC ?? [], answers),
    E_TRACK: scoreBlock(plan.questionsByBlock.E_TRACK ?? [], answers),
  };

  const script_readiness = blockScores.A_SCRIPT.percent;
  const general_readiness = Math.round(blockScores.B_GENERAL.percent * 0.7 + blockScores.C_COMPREHENSION.percent * 0.3);
  const academic_readiness = Math.round(blockScores.D_ACADEMIC.percent * 0.65 + blockScores.C_COMPREHENSION.percent * 0.35);
  const prep_readiness = Math.round(blockScores.D_ACADEMIC.percent * 0.5 + blockScores.C_COMPREHENSION.percent * 0.3 + blockScores.B_GENERAL.percent * 0.2);
  const weighted_score = Math.round(
    blockScores.A_SCRIPT.percent * BLOCK_WEIGHTS.A_SCRIPT +
    blockScores.B_GENERAL.percent * BLOCK_WEIGHTS.B_GENERAL +
    blockScores.C_COMPREHENSION.percent * BLOCK_WEIGHTS.C_COMPREHENSION +
    blockScores.D_ACADEMIC.percent * BLOCK_WEIGHTS.D_ACADEMIC +
    blockScores.E_TRACK.percent * BLOCK_WEIGHTS.E_TRACK
  );

  const track_signal = computeTrackSignal(plan.questionsByBlock.E_TRACK ?? [], answers, meta);
  const { score: confidence_score, confidence } = computeConfidence(weighted_score, blockScores, track_signal);
  const { placementBand, scriptGatePass, academicGatePass, prepGatePass } = deriveBand({
    weightedScore: weighted_score,
    script: script_readiness,
    general: general_readiness,
    comprehension: blockScores.C_COMPREHENSION.percent,
    academic: academic_readiness,
    prep: prep_readiness,
    confidence,
  });

  const allQuestions = Object.values(plan.questionsByBlock).flatMap((block) => block ?? []);
  const weakAreasRanked = weakAreaRank(allQuestions, answers);
  const strongest_area = weakAreasRanked[weakAreasRanked.length - 1]?.code ?? 'general_vocabulary';
  const weakest_area = weakAreasRanked[0]?.code ?? 'script_recognition';
  const weak_areas = weakAreasRanked.slice(0, 3).map((entry) => entry.code);
  const recommended_review_focus = weakAreasRanked.slice(0, 4).map((entry) => entry.code);
  const orderedTrack = Object.entries(track_signal).sort((a, b) => b[1] - a[1]);
  const trackGap = (orderedTrack[0]?.[1] ?? 0) - (orderedTrack[1]?.[1] ?? 0);
  const track_recommendation = orderedTrack[0]?.[1] < 45 ? 'unclear' : trackGap >= 15 ? 'stable' : trackGap >= 7 ? 'soft' : 'unclear';
  const compatibility = getCompatibility(placementBand, meta, track_recommendation, track_signal, { scriptGatePass });

  const dashboard_flags = [
    ...(scriptGatePass ? [] : ['needs_script_support']),
    ...(general_readiness >= 50 ? [] : ['needs_general_foundation']),
    ...(academicGatePass ? [] : ['needs_academic_scaffolding']),
    ...(confidence === 'low' ? ['monitor_confidence'] : []),
    ...(track_recommendation !== 'unclear' ? [`track_signal_${orderedTrack[0]?.[0]}`] : []),
  ];

  return {
    placement_version: 'russian_placement_v2',
    placement_band: placementBand,
    legacy_result_category: compatibility.legacy,
    confidence,
    confidence_score,
    script_readiness,
    general_readiness,
    academic_readiness,
    prep_readiness,
    track_signal,
    gates: {
      script_gate_pass: scriptGatePass,
      academic_gate_pass: academicGatePass,
      prep_gate_pass: prepGatePass,
    },
    recommended_path: compatibility.recommended_path,
    start_stage: compatibility.stage,
    start_module: compatibility.module,
    start_lesson_band: compatibility.lessonBand,
    track_recommendation,
    strongest_area,
    weakest_area,
    weak_areas,
    recommended_review_focus,
    dashboard_flags,
    weighted_score,
    block_scores: blockScores,
    meta,
    asked_question_ids: allQuestions.map((question) => question.id),
    completed_at: new Date().toISOString(),
  };
}
