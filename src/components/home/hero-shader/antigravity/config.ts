/**
 * Local equivalent of antigravity.google `landing-main-particles-component`.
 *
 * Uniforms verbatim from source (chunk-E6TGZIGP.js):
 *   density=200, particlesScale=0.75, ringWidth=0.15, ringWidth2=0.05,
 *   ringDisplacement=0.15, size=256
 *
 * ringRadius animated per-frame in update loop:
 *   uRingRadius = 0.175 + sin(t)*0.03 + cos(3t)*0.02
 *
 * mousePos = raycaster intersectionPoint (vec3, world space)
 * pointSize = uPointScale * (300 / -mvPosition.z)  // perspective-aware
 */
export const ANTIGRAV_CONFIG = {
  // ---- Reference uniforms (verbatim) ----
  density: 200,
  particlesScale: 0.75,
  ringWidth: 0.15,
  ringWidth2: 0.05,
  ringDisplacement: 0.15,

  // Source: const size = 256 → texture is 256x256, points sampled via
  // PoissonDiskSampling and then mapped into the texture.
  size: 256,

  // World-space half-extent for the interaction plane (z=0).
  // Source uses normalized world coords; intersectionPoint magnitudes ~ [-1,1].
  worldHalfExtent: 1.0,

  // Camera Z (PerspectiveCamera). Tuned so the plane fills the viewport.
  cameraZ: 1.5,
  cameraFov: 50,

  // Hover (1 = points snap to nearestPos targets).
  hoverEnabled: true,
} as const;

export const ANTIGRAV_DPR_CAP = 1.5;
export const ANTIGRAV_HOVER_LERP = 0.06;
