/**
 * Shaders — verbatim from antigravity.google source (chunk-E6TGZIGP.js).
 *
 * Vertex: samples uPosTex (base) and uPosNearestTex (hover target), mixes
 * by uIsHovering, applies ringEffect displacement, computes perspective
 * point size: gl_PointSize = uPointScale * (300 / -mvPosition.z).
 *
 * Fragment: simple disc with smoothstep alpha (sdRoundBox helper retained
 * but unused in main, matching source).
 */
export const PARTICLE_VERTEX = /* glsl */ `
uniform sampler2D uPosTex;
uniform sampler2D uPosNearestTex;
uniform float uTime;
uniform float uDeltaTime;
uniform vec3  uMousePos;
uniform float uIsHovering;
uniform float uRingRadius;
uniform float uRingWidth;
uniform float uRingWidth2;
uniform float uRingDisplacement;
uniform float uPointScale;

attribute vec2 reference;

varying vec2  vUv;
varying float vDistance;

void main() {
  vUv = reference;
  vec3 pos = texture2D(uPosTex, reference).xyz;
  vec3 nearestPos = texture2D(uPosNearestTex, reference).xyz;

  vec3 finalPos = mix(pos, nearestPos, uIsHovering);

  float dist = distance(finalPos, uMousePos);
  vDistance = dist;

  float ringEffect = smoothstep(uRingWidth, 0.0, abs(dist - uRingRadius));
  finalPos += normalize(finalPos - uMousePos) * ringEffect * uRingDisplacement;

  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uPointScale * (300.0 / -mvPosition.z);
}
`;

export const PARTICLE_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uRingOpacity;
uniform vec3  uColor;

varying vec2  vUv;
varying float vDistance;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float dist = length(pc);
  if (dist > 0.5) discard;

  vec3 color = uColor;
  float alpha = smoothstep(0.5, 0.45, dist);

  gl_FragColor = vec4(color, alpha);
}
`;
