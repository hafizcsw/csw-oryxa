import type {
  RussianAssessmentContentBlock,
  RussianAssessmentItem,
  RussianAssessmentSection,
  RussianAssessmentScoringResult,
  RussianAssessmentSectionScore,
} from '@/types/russianAssessmentExecution';

const PASS_FALLBACK = 70;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function scoreKeywordMatch(answer: string, acceptedAnswers: string[]) {
  const normalizedAnswer = normalizeText(answer);
  if (!normalizedAnswer) return { earned: 0, matchedAnswer: null as string | null };

  for (const acceptedAnswer of acceptedAnswers) {
    const normalizedAccepted = normalizeText(acceptedAnswer);
    if (normalizedAnswer === normalizedAccepted) {
      return { earned: 1, matchedAnswer: acceptedAnswer };
    }
  }

  return { earned: 0, matchedAnswer: null as string | null };
}

function scoreConceptCoverage(answer: string, groups: string[][], maxPoints: number) {
  const normalizedAnswer = normalizeText(answer);
  if (!normalizedAnswer) return { earned: 0, matchedConcepts: [] as string[] };

  const matchedConcepts: string[] = [];
  let earned = 0;

  for (const group of groups) {
    if (group.some((keyword) => normalizedAnswer.includes(normalizeText(keyword)))) {
      matchedConcepts.push(group[0]);
      earned += 1;
    }
  }

  return {
    earned: Math.min(maxPoints, earned),
    matchedConcepts,
  };
}

function sectionPromptBlocks(section: RussianAssessmentSection) {
  return (section.contentBlocks ?? []) as RussianAssessmentContentBlock[];
}

function scoreItem(item: RussianAssessmentItem, answer: string) {
  const scoring = item.scoring;
  const trimmedAnswer = answer.trim();
  const maxPoints = Number(scoring.maxPoints ?? 1);

  if (!trimmedAnswer) {
    return {
      itemKey: item.itemKey,
      earnedPoints: 0,
      maxPoints,
      isCorrect: false,
      answer: '',
      feedback: scoring.emptyFeedback ?? 'No answer submitted.',
      scoreSource: scoring.mode,
    };
  }

  if (scoring.mode === 'exact_match') {
    const result = scoreKeywordMatch(trimmedAnswer, scoring.acceptedAnswers ?? []);
    const isCorrect = result.earned >= maxPoints;
    return {
      itemKey: item.itemKey,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      isCorrect,
      answer: trimmedAnswer,
      feedback: isCorrect
        ? (scoring.correctFeedback ?? 'Correct.')
        : (scoring.incorrectFeedback ?? `Expected: ${(scoring.acceptedAnswers ?? []).slice(0, 2).join(' / ')}`),
      scoreSource: scoring.mode,
      matchedAnswer: result.matchedAnswer,
    };
  }

  const concepts = Array.isArray(scoring.requiredConceptGroups) ? scoring.requiredConceptGroups : [];
  const result = scoreConceptCoverage(trimmedAnswer, concepts, maxPoints);
  const isCorrect = result.earned >= Math.max(1, Math.ceil(maxPoints * 0.75));

  return {
    itemKey: item.itemKey,
    earnedPoints: result.earned,
    maxPoints,
    isCorrect,
    answer: trimmedAnswer,
    feedback: isCorrect
      ? (scoring.correctFeedback ?? 'Response met the scoring criteria.')
      : (scoring.incorrectFeedback ?? 'Response is missing one or more required content points.'),
    scoreSource: scoring.mode,
    matchedConcepts: result.matchedConcepts,
    conceptTargets: unique(concepts.flat()),
  };
}

export function scoreRussianAssessmentAttempt(args: {
  assessmentKind: 'checkpoint' | 'exam';
  title: string;
  sections: RussianAssessmentSection[];
  answersJson: Record<string, string>;
  passingScore: number | null;
}) : RussianAssessmentScoringResult {
  const passingScore = Number(args.passingScore ?? PASS_FALLBACK);
  const sectionScores: RussianAssessmentSectionScore[] = args.sections.map((section) => {
    const itemResults = section.items.map((item) => scoreItem(item, args.answersJson[item.itemKey] ?? ''));
    const earnedPoints = itemResults.reduce((sum, item) => sum + item.earnedPoints, 0);
    const maxPoints = itemResults.reduce((sum, item) => sum + item.maxPoints, 0);
    const percentScore = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 10000) / 100 : 0;

    return {
      sectionKey: section.key,
      title: section.title,
      contentBlockCount: sectionPromptBlocks(section).length,
      earnedPoints,
      maxPoints,
      percentScore,
      passed: percentScore >= passingScore,
      answeredItems: itemResults.filter((item) => item.answer.length > 0).length,
      totalItems: section.items.length,
      itemResults,
    };
  });

  const earnedPoints = sectionScores.reduce((sum, section) => sum + section.earnedPoints, 0);
  const maxPoints = sectionScores.reduce((sum, section) => sum + section.maxPoints, 0);
  const percentScore = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 10000) / 100 : 0;
  const passed = percentScore >= passingScore;

  const weakestSection = [...sectionScores].sort((a, b) => a.percentScore - b.percentScore)[0] ?? null;
  const strongestSection = [...sectionScores].sort((a, b) => b.percentScore - a.percentScore)[0] ?? null;
  const incorrectItems = sectionScores.flatMap((section) => section.itemResults.filter((item) => !item.isCorrect));

  return {
    percentScore,
    passed,
    earnedPoints,
    maxPoints,
    sectionScores,
    feedback: {
      assessmentKind: args.assessmentKind,
      assessmentTitle: args.title,
      scoringMode: 'answer_key_v1',
      passingScore,
      earnedPoints,
      maxPoints,
      percentScore,
      passed,
      strongestSection: strongestSection ? {
        sectionKey: strongestSection.sectionKey,
        percentScore: strongestSection.percentScore,
      } : null,
      weakestSection: weakestSection ? {
        sectionKey: weakestSection.sectionKey,
        percentScore: weakestSection.percentScore,
      } : null,
      nextSteps: passed
        ? ['Maintain accuracy on current section mix.', 'Review any missed items before the next checkpoint or exam set.']
        : ['Review the weakest section first.', 'Retry after correcting missed content blocks and answer forms.'],
      incorrectItemCount: incorrectItems.length,
      itemFeedback: incorrectItems.slice(0, 8).map((item) => ({
        itemKey: item.itemKey,
        feedback: item.feedback,
      })),
    },
  };
}
