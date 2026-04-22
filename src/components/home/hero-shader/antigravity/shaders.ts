/**
 * Shaders for the antigravity ring particle field.
 *
 * Sim pass:
 *   RG = position (NDC, aspect-corrected: x in [-aspect, aspect], y in [-1,1])
 *   BA = velocity
 *   Each particle has a "home" on a ring of radius uRingRadius (animated by
 *   the JS loop: 0.175 + sin(t)*0.03 + cos(3t)*0.02). Curl-noise drives radial
 *   displacement up to ringDisplacement, mouse repulsion pushes outward.
 *
 * Render pass:
 *   gl_POINTS, vertex samples sim FBO. Fragment uses sdRoundBox(uv, vec2(0.5,0.2), 0.25)
 *   for a dash/capsule. Alpha = uAlpha * disc * smoothstep(0.1, 0.2, vScale).
 *   Color mixes uColor1/2/3 by velocity magnitude.
 */

const COMMON = /* glsl */ `
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }

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

// Source-style rounded box SDF (uniform corner radius)
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
uniform float uTime;            // pre-scaled in JS by timeScale
uniform float uDelta;
uniform vec2  uMousePos;        // intersectionPoint * 0.175 (source convention)
uniform float uIsHovering;
uniform float uMouseRadius;
uniform float uMouseForce;
uniform float uPulseProgress;
uniform vec2  uPulseOrigin;
uniform float uPulseRadius;
uniform float uRingRadius;      // animated by JS loop
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

  float id = vUv.x * 131.7 + vUv.y * 311.3 + uSeed;
  float jitter = hash11(id * 1.91);

  // Calm noise drift — per-particle phase
  vec2 nP = pos * 0.9 + vec2(uTime * 0.18, -uTime * 0.13) + jitter * 7.0;
  vec2 flow = curl2(nP) * uRingDisplacement * 0.18;
  vec2 acc = flow;

  // Subtle breathing
  float life = sin(uTime * (0.4 + jitter * 0.6) + jitter * 6.28) * 0.015;
  acc += vec2(cos(jitter * 11.0), sin(jitter * 7.0)) * life;

  // Mouse repulsion (uMousePos already scaled by 0.175 in JS)
  vec2 toMouse = pos - uMousePos;
  float md = length(toMouse) + 1e-4;
  float mFall = exp(-(md*md) / (2.0 * uMouseRadius * uMouseRadius));
  acc += (toMouse / md) * mFall * uMouseForce * uIsHovering;

  // Pulse (gated)
  if (uPulseProgress > 0.0) {
    float ringR = uPulseProgress * uPulseRadius;
    vec2 toOrigin = pos - uPulseOrigin;
    float od = length(toOrigin) + 1e-4;
    float ringBand = 0.18;
    float ring = exp(-pow((od - ringR) / ringBand, 2.0));
    float decay = 1.0 - uPulseProgress;
    acc += (toOrigin / od) * ring * decay * 1.2;
  }

  // Soft bounds — keep particles inside hero rect
  vec2 bounds = vec2(uAspect, 1.0);
  vec2 over = max(abs(pos) - bounds, 0.0);
  acc -= sign(pos) * over * 1.2;

  vel = vel * 0.92 + acc * uDelta;
  pos = pos + vel * uDelta;

  gl_FragColor = vec4(pos, vel);
}
`;

// ---------- Render pass ----------
export const RENDER_VERTEX = /* glsl */ `
precision highp float;

attribute vec2 aRef;
uniform sampler2D uPositionTex;
uniform float uParticleScale;   // canvas.width / dpr / 2000 * particlesScale (JS)
uniform float uDpr;
uniform float uAspect;

varying vec2  vVel;
varying float vSeed;
varying float vScale;

void main(){
  vec4 p = texture2D(uPositionTex, aRef);
  vec2 ndc = vec2(p.x / uAspect, p.y);
  gl_Position = vec4(ndc, 0.0, 1.0);

  float speed = length(p.zw);
  float r = fract(sin(dot(aRef, vec2(91.13, 47.31))) * 43758.5);

  // Source convention: gl_PointSize derived from particleScale * per-particle
  // size factor. Multiply by ~80 to map the [0..0.4] particleScale range to a
  // visible pixel range without re-tuning particlesScale.
  float sizeFactor = mix(0.6, 1.4, r) * (1.0 + speed * 0.4);
  vScale = uParticleScale * sizeFactor;
  gl_PointSize = vScale * 80.0 * uDpr;

  vVel  = p.zw;
  vSeed = r;
}
`;

export const RENDER_FRAGMENT = /* glsl */ `
precision highp float;

varying vec2  vVel;
varying float vSeed;
varying float vScale;

uniform float uTime;
uniform float uIntensity;
uniform float uAlpha;
uniform float uIsDark;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;

${COMMON}

void main(){
  vec2 uv = gl_PointCoord * 2.0 - 1.0;

  // Orient dash along velocity
  float ang = atan(vVel.y, vVel.x);
  float ca = cos(-ang), sa = sin(-ang);
  vec2 ruv = mat2(ca, -sa, sa, ca) * uv;

  // Source: sdRoundBox(uv, vec2(0.5, 0.2), 0.25)
  float sdf = sdRoundBox(ruv, vec2(0.5, 0.2), 0.25);
  float disc = 1.0 - smoothstep(0.0, 0.06, sdf);
  if (disc <= 0.001) discard;

  // Color mix by velocity magnitude
  float speed = clamp(length(vVel) * 4.0, 0.0, 1.0);
  vec3 col = mix(uColor1, uColor2, smoothstep(0.0, 0.5, speed));
  col = mix(col, uColor3, smoothstep(0.5, 1.0, speed));

  // Subtle twinkle
  float phase = vSeed * 6.28318;
  float flick = 0.7 + 0.3 * sin(uTime * (0.8 + vSeed * 1.5) + phase);

  // Source alpha law: uAlpha * disc * smoothstep(0.1, 0.2, vScale)
  float a = uAlpha * disc * smoothstep(0.1, 0.2, vScale) * flick * uIntensity;

  gl_FragColor = vec4(col * a, a);
}
`;
