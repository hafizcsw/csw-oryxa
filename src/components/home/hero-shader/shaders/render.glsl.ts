/**
 * Render pass — draws particles as gl_POINTS.
 * Vertex shader samples position from the simulation FBO using a per-vertex UV.
 * Fragment shader uses sdRoundBox on gl_PointCoord for a dash/capsule shape.
 */
import { COMMON_GLSL } from './common.glsl';

export const RENDER_VERTEX = /* glsl */ `
precision highp float;

attribute vec2 aRef;          // texel UV into position texture
uniform sampler2D uPositionTex;
uniform float uPointSize;
uniform float uDpr;
uniform float uAspect;

varying vec2  vVel;
varying float vSeed;
varying float vDepth;

void main(){
  vec4 p = texture2D(uPositionTex, aRef);
  // p.xy is in aspect-corrected NDC: x in [-aspect, aspect], y in [-1, 1]
  vec2 ndc = vec2(p.x / uAspect, p.y);
  gl_Position = vec4(ndc, 0.0, 1.0);

  float speed = length(p.zw);
  // depth in [0,1] — 0 = far, 1 = near (closer to viewer)
  float depth = fract(sin(dot(aRef, vec2(12.989, 78.233))) * 43758.5);
  // size variation per particle, scaled strongly by depth for 3D pop
  float r = fract(sin(dot(aRef, vec2(91.13, 47.31))) * 43758.5);
  float sizeBase = uPointSize * mix(0.45, 1.55, r);
  float depthScale = mix(0.55, 1.85, depth);
  float size = sizeBase * depthScale * (1.0 + speed * 0.4);
  gl_PointSize = size * uDpr;

  vVel = p.zw;
  vSeed = r;
  vDepth = depth;
}
`;

export const RENDER_FRAGMENT = /* glsl */ `
precision highp float;

varying vec2  vVel;
varying float vSeed;
varying float vDepth;

uniform float uTime;
uniform float uIntensity;
uniform float uIsDark;

${COMMON_GLSL}

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
  // gl_PointCoord is [0,1]; remap to [-1,1]
  vec2 uv = gl_PointCoord * 2.0 - 1.0;

  // Orient the dash along velocity direction
  float ang = atan(vVel.y, vVel.x);
  float ca = cos(-ang), sa = sin(-ang);
  vec2 ruv = mat2(ca, -sa, sa, ca) * uv;

  // Capsule: long on x, thin on y
  float len = 0.85;
  float thick = 0.32;
  float sdf = sdRoundBox(ruv, vec2(len, thick), thick);
  // Soft edge without fwidth (works on WebGL1/2 without extensions)
  float aa = 0.08;
  float shape = 1.0 - smoothstep(-aa, aa, sdf);
  if (shape <= 0.001) discard;

  // Async micro-flicker
  float phase = vSeed * 6.28318;
  float flick = 0.55 + 0.45 * sin(uTime * (1.2 + vSeed * 2.4) + phase);
  float twk   = pow(0.5 + 0.5 * sin(uTime * (0.6 + vSeed * 0.9) + phase * 1.7), 6.0);
  float bright = mix(0.55, 1.0, flick) + twk * 0.45;

  vec3 col = palette(vSeed);
  float a = shape * clamp(bright, 0.0, 2.0) * uIntensity;

  gl_FragColor = vec4(col * a, a);
}
`;
