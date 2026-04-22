/**
 * Shared GLSL helpers: hash, noise, curl, SDF.
 * Inlined into other shader strings via template literals.
 */
export const COMMON_GLSL = /* glsl */ `
// --- hash ---
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
vec2  hash22(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// --- value noise (smooth, cheap) ---
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

// --- 2D curl from scalar noise potential ---
vec2 curl2(vec2 p){
  float e = 0.05;
  float n1 = vnoise(p + vec2(0.0,  e));
  float n2 = vnoise(p - vec2(0.0,  e));
  float n3 = vnoise(p + vec2(e,  0.0));
  float n4 = vnoise(p - vec2(e,  0.0));
  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
}

// --- SDF: rounded box (capsule when extents differ) ---
float sdRoundBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + vec2(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
`;
