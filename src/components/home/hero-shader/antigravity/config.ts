/**
 * Local equivalent of antigravity.google `landing-main-particles-component`.
 *
 * Values below are extracted verbatim from the reference and used as the
 * starting point. Do NOT retune blindly — these are the source-of-truth
 * defaults the rest of the implementation is calibrated against.
 */
export const ANTIGRAV_CONFIG = {
  // ---- Reference uniforms (verbatim) ----
  density: 200,
  particlesScale: 0.75,
  ringWidth: 0.15,
  ringWidth2: 0.05,
  ringDisplacement: 0.15,

  // ---- Sim/init (verbatim) ----
  textureSize: 256,        // -> 256*256 = 65,536 particles
  ringRadius: 0.2,
  timeScale: 0.5,          // sim uses uTime * 0.5

  // ---- Mouse interaction ----
  mouseRadius: 0.15,       // normalized
  mouseForce: 0.6,

  // ---- Pulse (kept architecturally, disabled by default) ----
  pulseEnabled: false,
  pulseRadius: 1.6,
  pulseDuration: 0.7,

  // ---- Render ----
  pointSize: 3.2,          // base px @ dpr=1, scaled by particlesScale
  intensity: 1.0,
} as const;

export const ANTIGRAV_DPR_CAP = 1.5;
export const ANTIGRAV_MOUSE_LERP = 0.12;
export const ANTIGRAV_HOVER_LERP = 0.08;

// Mobile downscale (the source runs lighter on phones)
export const ANTIGRAV_MOBILE_TEX = 160; // 25,600 particles on mobile
export const ANTIGRAV_MOBILE_INTENSITY = 0.9;
