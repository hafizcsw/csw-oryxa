/**
 * Atmospheric field shader — full-screen fragment shader.
 * Outputs a monochrome white mask (RGB=1, A=mask) intended to be blended
 * over the existing hero gradient via mix-blend-mode: screen.
 *
 * Visual signature:
 *  - Two layers of 3D simplex noise at different frequencies/speeds
 *    create non-synchronized micro-flicker.
 *  - A very slow low-frequency layer adds depth/parallax feel.
 *  - A soft Gaussian disturbance follows the mouse and locally lifts the field.
 */

export const vertex = /* glsl */ `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

export const fragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec2  uMouse;          // 0..1 in canvas space (y flipped to match uv)
  uniform float uMouseStrength;  // 0..1 smoothed
  uniform float uIntensity;      // overall mask multiplier
  uniform float uNoiseScale;     // base spatial frequency
  uniform float uSpeed;          // base time speed
  uniform float uMouseRadius;    // 0..1 in normalized space
  uniform float uDepthBoost;     // 0..1 depth layer contribution
  uniform vec3  uTint;           // ink color (black on light bg, white on dark bg)

  // ---- 3D simplex noise (Ashima / Stefan Gustavson) ----
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // 2D rotation helper for layer offsets
  vec2 rot(vec2 v, float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c) * v;
  }

  void main() {
    // Aspect-correct uv so noise cells stay roughly square
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    float t = uTime * uSpeed;

    // ---- Mouse vector field (flow distortion, not just additive lift) ----
    vec2 mp = vec2(uMouse.x * aspect, uMouse.y);
    vec2 toM = p - mp;
    float dM = length(toM);
    float r = max(uMouseRadius, 0.0001);
    float gauss = exp(-(dM * dM) / (2.0 * r * r));
    // Swirl direction perpendicular to mouse-radial → curl flow
    vec2 swirl = vec2(-toM.y, toM.x) / max(dM, 1e-4);
    vec2 flow = swirl * gauss * 0.06 * uMouseStrength;
    vec2 pf = p + flow; // distorted sample position for mid/far layers

    // ---- Energy zones (very-low-frequency mask) ----
    // Defines slow-moving "active" vs "calm" regions; not uniform field.
    float zone = snoise(vec3(p * 0.6, t * 0.18 + 41.0));
    zone = smoothstep(-0.25, 0.85, zone); // 0..1 weight

    // ---- Far layer (depth, slow, large cells) ----
    float nFar = snoise(vec3(rot(pf, 0.3) * (uNoiseScale * 0.35), t * 0.22));
    float far  = smoothstep(0.20, 0.95, nFar * 0.5 + 0.5);

    // ---- Mid layer (primary atmosphere) ----
    float nMid = snoise(vec3(pf * uNoiseScale, t));
    float mid  = smoothstep(0.40, 0.88, nMid * 0.5 + 0.5);

    // ---- Near layer (faster, secondary, non-synchronized) ----
    float nNear = snoise(vec3(rot(pf, -0.7) * (uNoiseScale * 2.1) + 11.7, t * 1.7 + 3.1));
    float near  = smoothstep(0.45, 0.92, nNear * 0.5 + 0.5);

    // ---- Micro-detail (high-frequency, very subtle texture) ----
    float micro = snoise(vec3(p * (uNoiseScale * 6.5), t * 0.6 + 91.3));
    micro = micro * 0.5 + 0.5;
    float microContribution = (micro - 0.5) * 0.18; // can subtract slightly too

    // ---- Compose with depth weighting ----
    // Far is broad/soft, mid is the body, near adds bright peaks.
    float field =
        far  * (0.30 + uDepthBoost * 0.35)
      + mid  * 0.55
      + near * 0.40;

    // Spatial variation: zones modulate amplitude (active vs calm regions)
    field *= mix(0.55, 1.25, zone);

    // Sprinkle micro texture
    field += microContribution * mix(0.4, 1.0, zone);

    // ---- Mouse: distortion already applied; add subtle local lift too ----
    field += gauss * 0.30 * uMouseStrength;

    // Final intensity, clamped
    float a = clamp(field * uIntensity, 0.0, 1.0);

    gl_FragColor = vec4(uTint, a);
  }
`;
