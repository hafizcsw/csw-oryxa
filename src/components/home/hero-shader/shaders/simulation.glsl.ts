/**
 * Simulation pass — full-screen triangle that updates the position/velocity texture.
 * RGBA layout: rg = position (NDC, aspect-corrected), ba = velocity.
 * Ping-ponged between two render targets each frame.
 */
import { COMMON_GLSL } from './common.glsl';

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
uniform float uTime;
uniform float uDelta;
uniform vec2  uMousePos;       // NDC-aspect space
uniform float uIsHovering;     // 0..1 smoothed
uniform float uPulseProgress;  // 0..1 (0 = idle)
uniform vec2  uPulseOrigin;    // NDC-aspect space
uniform float uMouseRadius;
uniform float uMouseForce;
uniform float uPulseRadius;
uniform float uFlowStrength;
uniform float uSpeed;
uniform float uAspect;
uniform float uSeed;

${COMMON_GLSL}

void main(){
  vec4 prev = texture2D(uPrevPos, vUv);
  vec2 pos = prev.xy;
  vec2 vel = prev.zw;

  // Stable per-particle id from texel coord
  float id = vUv.x * 131.7 + vUv.y * 311.3 + uSeed;

  // No autonomous drift — particles are at rest and only react to input.
  vec2 acc = vec2(0.0);

  // --- mouse repulsion (radial displacement field) ---
  vec2 toMouse = pos - uMousePos;
  float md = length(toMouse) + 1e-4;
  float mFall = exp(-(md*md) / (2.0 * uMouseRadius * uMouseRadius));
  acc += normalize(toMouse) * mFall * uMouseForce * uIsHovering;

  // --- click pulse (ring shockwave outward from origin) ---
  if (uPulseProgress > 0.0) {
    float ringR = uPulseProgress * uPulseRadius;
    vec2 toOrigin = pos - uPulseOrigin;
    float od = length(toOrigin) + 1e-4;
    float ringWidth = 0.18;
    float ring = exp(-pow((od - ringR) / ringWidth, 2.0));
    float decay = 1.0 - uPulseProgress;
    acc += normalize(toOrigin) * ring * decay * 1.6;
  }

  // --- spring back to fixed home (critically damped, no oscillation) ---
  vec2 home = vec2(
    (hash11(id * 1.13) - 0.5) * 2.0 * uAspect,
    (hash11(id * 2.71) - 0.5) * 2.0
  );
  acc += (home - pos) * 12.0 - vel * 6.0;

  // Integrate with heavy damping so they settle instantly when mouse leaves
  vel = vel * 0.55 + acc * uDelta;
  pos = pos + vel * uDelta;

  // Snap to home when nearly at rest to fully kill drift
  if (length(home - pos) < 0.0008 && length(vel) < 0.01) {
    pos = home;
    vel = vec2(0.0);
  }

  // Soft bounds wrap
  if (pos.x >  uAspect + 0.1) pos.x = -uAspect - 0.1;
  if (pos.x < -uAspect - 0.1) pos.x =  uAspect + 0.1;
  if (pos.y >  1.1)           pos.y = -1.1;
  if (pos.y < -1.1)           pos.y =  1.1;

  gl_FragColor = vec4(pos, vel);
}
`;
