import { describe, expect, it } from 'vitest';
import { buildRussianPlacementSessionPlan, scoreRussianPlacementSession } from '@/lib/russianPlacementEngine';

function answerPlan(mode: 'all_correct' | 'all_wrong' | 'script_only' | 'academic_strong' | 'medicine' | 'borderline') {
  const seed = {} as Record<string, string>;
  const plan = buildRussianPlacementSessionPlan(seed);
  const answers: Record<string, string> = {};
  for (const question of Object.values(plan.questionsByBlock).flatMap((items) => items ?? [])) {
    if (mode === 'all_correct') answers[question.id] = question.correctAnswer;
    else if (mode === 'all_wrong') answers[question.id] = 'z';
    else if (mode === 'script_only') answers[question.id] = question.block_code === 'A_SCRIPT' ? question.correctAnswer : 'z';
    else if (mode === 'academic_strong') answers[question.id] = ['A_SCRIPT', 'B_GENERAL', 'C_COMPREHENSION', 'D_ACADEMIC'].includes(question.block_code) ? question.correctAnswer : 'z';
    else if (mode === 'medicine') {
      answers[question.id] = question.block_code === 'E_TRACK' ? (question.track_tag === 'medicine' ? question.correctAnswer : 'z') : question.correctAnswer;
    } else if (mode === 'borderline') {
      answers[question.id] = ['A_SCRIPT', 'B_GENERAL'].includes(question.block_code) ? question.correctAnswer : (question.difficulty <= 2 ? question.correctAnswer : 'z');
    }
  }
  return { plan, answers };
}

describe('russian placement engine', () => {
  it('places script-weak learners conservatively', () => {
    const { plan, answers } = answerPlan('all_wrong');
    const result = scoreRussianPlacementSession(plan, answers, { goal: 'prep_exam', intendedTrack: 'engineering' });
    expect(result.placement_band).toBe('PB0_SCRIPT_FOUNDATION');
    expect(result.gates.script_gate_pass).toBe(false);
  });

  it('places general learners with weak academic signal into core/general foundation', () => {
    const { plan, answers } = answerPlan('script_only');
    const result = scoreRussianPlacementSession(plan, answers, { goal: 'daily_life', intendedTrack: 'humanities_social' });
    expect(['PB1_GENERAL_FOUNDATION', 'PB0_SCRIPT_FOUNDATION']).toContain(result.placement_band);
    expect(result.academic_readiness).toBeLessThan(50);
  });

  it('supports academically stronger learners', () => {
    const { plan, answers } = answerPlan('academic_strong');
    const result = scoreRussianPlacementSession(plan, answers, { goal: 'university_study', intendedTrack: 'engineering' });
    expect(['PB3_ACADEMIC_ENTRY', 'PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL']).toContain(result.placement_band);
    expect(result.gates.academic_gate_pass).toBe(true);
  });

  it('surfaces medicine leaning track signal', () => {
    const { plan, answers } = answerPlan('medicine');
    const result = scoreRussianPlacementSession(plan, answers, { goal: 'prep_exam', intendedTrack: 'medicine' });
    expect(result.track_signal.medicine).toBeGreaterThan(result.track_signal.engineering);
    expect(result.recommended_path).toContain('medicine');
  });

  it('marks contradictory borderline learners with conservative confidence', () => {
    const { plan, answers } = answerPlan('borderline');
    const result = scoreRussianPlacementSession(plan, answers, { goal: 'university_study', intendedTrack: 'humanities_social' });
    expect(['low', 'medium']).toContain(result.confidence);
    expect(result.weighted_score).toBeGreaterThan(0);
  });
});
