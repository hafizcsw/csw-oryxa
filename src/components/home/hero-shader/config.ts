/**
 * GPGPU particle field — config & presets.
 * All visual knobs centralized here.
 */

export type HeroFieldVariant = 'quieter' | 'reactive';

export interface FieldPreset {
  /** sqrt of particle count (e.g. 96 → 9216 particles) */
  texSize: number;
  /** base point size in CSS px @ dpr=1 */
  pointSize: number;
  /** noise/curl amplitude */
  flowStrength: number;
  /** global time multiplier */
  speed: number;
  /** mouse repulsion radius (NDC units, 0..2) */
  mouseRadius: number;
  /** mouse force magnitude */
  mouseForce: number;
  /** click pulse radius growth (NDC units / sec) */
  pulseRadius: number;
  /** overall brightness */
  intensity: number;
}

export const PRESETS: Record<HeroFieldVariant, FieldPreset> = {
  quieter: {
    texSize: 80,
    pointSize: 3.0,
    flowStrength: 0.06,
    speed: 0.45,
    mouseRadius: 0.30,
    mouseForce: 0.45,
    pulseRadius: 1.4,
    intensity: 0.85,
  },
  reactive: {
    texSize: 112,
    pointSize: 3.4,
    flowStrength: 0.10,
    speed: 0.75,
    mouseRadius: 0.38,
    mouseForce: 0.75,
    pulseRadius: 1.8,
    intensity: 1.00,
  },
};

export const MOBILE_TEX_SCALE = 0.65;
export const MOBILE_INTENSITY_SCALE = 0.85;
export const DPR_CAP = 1.5;
export const MOUSE_LERP = 0.10;
export const HOVER_LERP = 0.06;
export const PULSE_DURATION = 0.7; // seconds
