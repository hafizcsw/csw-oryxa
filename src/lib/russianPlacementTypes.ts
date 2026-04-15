export type RussianPlacementBlockCode = 'A_SCRIPT' | 'B_GENERAL' | 'C_COMPREHENSION' | 'D_ACADEMIC' | 'E_TRACK' | 'F_META';
export type RussianPlacementDifficulty = 1 | 2 | 3 | 4 | 5;
export type RussianPlacementFormat = 'mcq' | 'cloze' | 'ordering' | 'matching';
export type RussianPlacementTrackTag = 'medicine' | 'engineering' | 'humanities_social' | 'general';
export type RussianPlacementWeakAreaCode =
  | 'script_recognition'
  | 'script_decoding'
  | 'general_vocabulary'
  | 'general_grammar'
  | 'comprehension_structure'
  | 'academic_instructions'
  | 'academic_reading'
  | 'prep_readiness'
  | 'track_medicine'
  | 'track_engineering'
  | 'track_humanities_social';

export type RussianPlacementBand =
  | 'PB0_SCRIPT_FOUNDATION'
  | 'PB1_GENERAL_FOUNDATION'
  | 'PB2_GENERAL_CORE'
  | 'PB3_ACADEMIC_ENTRY'
  | 'PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL'
  | 'PB5_PREP_ACCELERATED_ENTRY';

export type RussianPlacementConfidence = 'low' | 'medium' | 'high';
export type RussianTrackRecommendation = 'stable' | 'soft' | 'unclear';
export type RussianMetaAnswer = string;

export interface RussianPlacementOption {
  id: string;
  labelKey: string;
}

export interface RussianPlacementQuestion {
  id: string;
  block_code: RussianPlacementBlockCode;
  subskill: string;
  difficulty: RussianPlacementDifficulty;
  format: RussianPlacementFormat;
  track_tag: RussianPlacementTrackTag;
  gate_item: boolean;
  weak_area_code: RussianPlacementWeakAreaCode;
  scoring_weight: number;
  promptKey: string;
  instructionKey?: string;
  contentKey?: string;
  options: RussianPlacementOption[];
  correctAnswer: string;
}

export interface RussianPlacementMetaQuestion {
  id: string;
  promptKey: string;
  options: RussianPlacementOption[];
}

export interface RussianPlacementMetaResponse {
  goal?: string;
  urgency?: string;
  intendedTrack?: string;
  priorStudy?: string;
}

export interface RussianPlacementSessionPlan {
  metaQuestions: RussianPlacementMetaQuestion[];
  blockOrder: RussianPlacementBlockCode[];
  questionsByBlock: Partial<Record<RussianPlacementBlockCode, RussianPlacementQuestion[]>>;
  totalScoredQuestions: number;
}

export interface RussianPlacementScoreBreakdown {
  answered: number;
  correctWeight: number;
  totalWeight: number;
  percent: number;
}

export interface RussianPlacementResult {
  placement_version: 'russian_placement_v2';
  placement_band: RussianPlacementBand;
  legacy_result_category: 'start_from_zero' | 'basics_refresh' | 'early_academic';
  confidence: RussianPlacementConfidence;
  confidence_score: number;
  script_readiness: number;
  general_readiness: number;
  academic_readiness: number;
  prep_readiness: number;
  track_signal: {
    medicine: number;
    engineering: number;
    humanities_social: number;
  };
  gates: {
    script_gate_pass: boolean;
    academic_gate_pass: boolean;
    prep_gate_pass: boolean;
  };
  recommended_path: string;
  start_stage: string;
  start_module: string;
  start_lesson_band?: string;
  track_recommendation: RussianTrackRecommendation;
  strongest_area: RussianPlacementWeakAreaCode;
  weakest_area: RussianPlacementWeakAreaCode;
  weak_areas: RussianPlacementWeakAreaCode[];
  recommended_review_focus: RussianPlacementWeakAreaCode[];
  dashboard_flags: string[];
  weighted_score: number;
  block_scores: Record<'A_SCRIPT' | 'B_GENERAL' | 'C_COMPREHENSION' | 'D_ACADEMIC' | 'E_TRACK', RussianPlacementScoreBreakdown>;
  meta: RussianPlacementMetaResponse;
  asked_question_ids: string[];
  completed_at: string;
}
