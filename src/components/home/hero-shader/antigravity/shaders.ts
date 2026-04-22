/**
 * Shaders for the antigravity-style ring particle field.
 *
 * Architecture (mirrors landing-main-particles-component):
 *   Simulation pass: each texel = one particle. RG = position (NDC, aspect-corrected),
 *                    BA = velocity. Particle's "home" is a point on a ring of radius
 *                    `uRingRadius`. The sim displaces it in/out of the ring (within
 *                    `uRingWidth` band) using curl noise + mouse repulsion +
 *                    optional shockwave pulse. ringDisplacement controls the
 *                    amplitude of the noise-driven radial offset.
 *
 *   Render pass: draws gl_POINTS, vertex samples position from sim FBO,
 *                fragment uses sdRoundBox for a dash/capsule shape, oriented
 *                along velocity, with multi-color palette.
 */

const COMMON = /* glsl */ `
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }

// value noise
float vnoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash11(dot(i, vec2(1.0, 57.0)));
  float b = hash11(dot(i + vec2(1.0,0.0), vec2(1.0, 57.0)));
  float c = hash11(dot(i + vec2(0.0,1.0), vec2(1.0, 57.0)));
  float d = hash11(dot(i + vec2(1.0,1.0), vec2(1.0, 57.0)));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

vec2 curl2(vec2 p){
  float e = 0.05;
  float n1 = vnoise(p + vec2(0.0,  e));
  float n2 = vnoise(p - vec2(0.0,  e));
  float n3 = vnoise(p + vec2(e,  0.0));
  float n4 = vnoise(p - vec2(e,  0.0));
  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
}

float sdRoundBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + vec2(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
`;

// ---------- Sim pass ----------
export const SIM_VERTEX = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main(){
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const SIM_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D uPrevPos;
uniform float uTime;            // already pre-scaled in JS by timeScale
uniform float uDelta;
uniform vec2  uMousePos;        // NDC, aspect-corrected
uniform float uIsHovering;      // 0..1 smoothed
uniform float uMouseRadius;
uniform float uMouseForce;
uniform float uPulseProgress;
uniform vec2  uPulseOrigin;
uniform float uPulseRadius;
uniform float uRingRadius;
uniform float uRingWidth;
uniform float uRingWidth2;
uniform float uRingDisplacement;
uniform float uAspect;
uniform float uSeed;

${COMMON}

void main(){
  vec4 prev = texture2D(uPrevPos, vUv);
  vec2 pos = prev.xy;
  vec2 vel = prev.zw;

  // Stable per-particle id from texel coord
  float id = vUv.x * 131.7 + vUv.y * 311.3 + uSeed;

  // ---- Home point: distributed on the ring of radius uRingRadius ----
  // Each particle has a fixed angle + a fixed offset within the ring band.
  float ang = hash11(id * 1.13) * 6.2831853;
  float bandOffset = (hash11(id * 2.71) - 0.5) * uRingWidth;        // wider band
  float bandOffset2 = (hash11(id * 4.07) - 0.5) * uRingWidth2;       // thin band
  float r0 = uRingRadius + bandOffset + bandOffset2;

  // Noise-driven radial displacement (ringDisplacement amplitude)
  float n = vnoise(vec2(cos(ang), sin(ang)) * 2.0 + vec2(uTime * 0.6, -uTime * 0.4));
  float radial = (n - 0.5) * 2.0 * uRingDisplacement;

  float r = r0 + radial;
  vec2 home = vec2(cos(ang) * r * uAspect, sin(ang) * r);

  // ---- Tangential drift (organic motion along the ring) ----
  vec2 tangent = vec2(-sin(ang), cos(ang));
  vec2 drift = tangent * (0.05 + 0.08 * vnoise(vec2(id, uTime * 0.3)));

  // ---- Curl flow as small perturbation ----
  vec2 flow = curl2(pos * 1.4 + vec2(uTime * 0.3, -uTime * 0.2)) * 0.04;

  // ---- Spring toward home + drift + flow ----
  vec2 acc = (home - pos) * 1.6 + drift + flow;

  // ---- Mouse repulsion (radius normalized in NDC space) ----
  vec2 toMouse = pos - uMousePos;
  float md = length(toMouse) + 1e-4;
  float mFall = exp(-(md*md) / (2.0 * uMouseRadius * uMouseRadius));
  acc += (toMouse / md) * mFall * uMouseForce * uIsHovering;

  // ---- Pulse (architectural; gated by progress > 0) ----
  if (uPulseProgress > 0.0) {
    float ringR = uPulseProgress * uPulseRadius;
    vec2 toOrigin = pos - uPulseOrigin;
    float od = length(toOrigin) + 1e-4;
    float ringBand = 0.18;
    float ring = exp(-pow((od - ringR) / ringBand, 2.0));
    float decay = 1.0 - uPulseProgress;
    acc += (toOrigin / od) * ring * decay * 1.4;
  }

  // Integrate (critically damped)
  vel = vel * 0.86 + acc * uDelta;
  pos = pos + vel * uDelta;

  gl_FragColor = vec4(pos, vel);
}
`;

// ---------- Render pass ----------
export const RENDER_VERTEX = /* glsl */ `
precision highp float;

attribute vec2 aRef;            // texel UV into position texture
uniform sampler2D uPositionTex;
uniform float uPointSize;
uniform float uParticlesScale;
uniform float uDpr;
uniform float uAspect;

varying vec2  vVel;
varying float vSeed;

void main(){
  vec4 p = texture2D(uPositionTex, aRef);
  // p.xy is in aspect-corrected NDC (x in [-aspect, aspect], y in [-1, 1])
  vec2 ndc = vec2(p.x / uAspect, p.y);
  gl_Position = vec4(ndc, 0.0, 1.0);

  float speed = length(p.zw);
  float r = fract(sin(dot(aRef, vec2(91.13, 47.31))) * 43758.5);
  float size = uPointSize * uParticlesScale * mix(0.6, 1.4, r) * (1.0 + speed * 0.5);
  gl_PointSize = size * uDpr;

  vVel = p.zw;
  vSeed = r;
}
`;

export const RENDER_FRAGMENT = /* glsl */ `
precision highp float;

varying vec2  vVel;
varying float vSeed;

uniform float uTime;
uniform float uIntensity;
uniform float uIsDark;

${COMMON}

vec3 palette(float t){
  if (uIsDark > 0.5) {
    vec3 blue   = vec3(0.36, 0.55, 1.00);
    vec3 indigo = vec3(0.45, 0.40, 0.95);
    vec3 cyan   = vec3(0.55, 0.85, 1.00);
    vec3 c = mix(blue, indigo, smoothstep(0.0, 0.6, t));
    c = mix(c, cyan, smoothstep(0.7, 1.0, t));
    return c;
  } else {
    vec3 blue    = vec3(0.20, 0.40, 0.95);
    vec3 violet  = vec3(0.55, 0.30, 0.90);
    vec3 magenta = vec3(0.92, 0.28, 0.58);
    vec3 orange  = vec3(0.98, 0.58, 0.22);
    vec3 c = mix(blue, violet, smoothstep(0.0, 0.45, t));
    c = mix(c, magenta, smoothstep(0.45, 0.75, t));
    c = mix(c, orange,  smoothstep(0.75, 1.0,  t));
    return c;
  }
}

void main(){
  vec2 uv = gl_PointCoord * 2.0 - 1.0;

  // Orient dash along velocity
  float ang = atan(vVel.y, vVel.x);
  float ca = cos(-ang), sa = sin(-ang);
  vec2 ruv = mat2(ca, -sa, sa, ca) * uv;

  // Capsule (dash)
  float len = 0.85;
  float thick = 0.30;
  float sdf = sdRoundBox(ruv, vec2(len, thick), thick);
  float aa = 0.08;
  float shape = 1.0 - smoothstep(-aa, aa, sdf);
  if (shape <= 0.001) discard;

  float phase = vSeed * 6.28318;
  float flick = 0.55 + 0.45 * sin(uTime * (1.0 + vSeed * 2.0) + phase);
  float twk   = pow(0.5 + 0.5 * sin(uTime * (0.6 + vSeed * 0.9) + phase * 1.7), 6.0);
  float bright = mix(0.55, 1.0, flick) + twk * 0.45;

  vec3 col = palette(vSeed);
  float a = shape * clamp(bright, 0.0, 2.0) * uIntensity;

  gl_FragColor = vec4(col * a, a);
}
`;
