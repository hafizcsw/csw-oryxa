/**
 * Local equivalent of antigravity.google `landing-main-particles-component`.
 *
 * Top-level uniforms verbatim from source:
 *   density=200, particlesScale=0.75, ringWidth=0.15, ringWidth2=0.05,
 *   ringDisplacement=0.15
 *
 * NOTE on ringRadius: source animates it inside the update loop:
 *   uRingRadius = 0.175 + sin(t*1)*0.03 + cos(t*3)*0.02
 * so it is NOT a static config value — computed per-frame in the loop.
 *
 * NOTE on mousePos: source feeds intersectionPoint * 0.175 (not raw NDC).
 *
 * NOTE on particleScale: source = canvas.width / pixelRatio / 2000 * particlesScale
 * — computed at runtime, not baked here.
 */
export const ANTIGRAV_CONFIG = {
  // ---- Reference uniforms (verbatim) ----
  density: 200,
  particlesScale: 0.75,
  ringWidth: 0.15,
  ringWidth2: 0.05,
  ringDisplacement: 0.15,

  // ---- Sim/init ----
  // Effective particle count = textureSize^2. Reference visual is sparse —
  // 64² = 4,096 desktop / 48² = 2,304 mobile matches the on-screen density.
  textureSize: 64,
  timeScale: 0.5,          // sim uses uTime * 0.5

  // ---- Distribution (full hero coverage with soft quiet zone) ----
  quietCenterRadius: 0.5,
  quietSoftness: 0.3,

  // ---- Mouse interaction ----
  // Source: uMousePos = intersectionPoint * 0.175
  mouseScale: 0.175,
  mouseRadius: 0.15,       // normalized
  mouseForce: 0.5,

  // ---- Pulse (architectural; disabled by default) ----
  pulseEnabled: false,
  pulseRadius: 1.6,
  pulseDuration: 0.7,

  // ---- Render ----
  // Base alpha for the dash sprite (multiplied by smoothstep of vScale).
  intensity: 1.0,
  alpha: 0.9,
} as const;

export const ANTIGRAV_DPR_CAP = 1.5;
export const ANTIGRAV_MOUSE_LERP = 0.12;
export const ANTIGRAV_HOVER_LERP = 0.08;

// Mobile downscale
export const ANTIGRAV_MOBILE_TEX = 48;
export const ANTIGRAV_MOBILE_INTENSITY = 0.9;
