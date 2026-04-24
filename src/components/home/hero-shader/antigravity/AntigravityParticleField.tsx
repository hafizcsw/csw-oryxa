/**
 * AntigravityParticleField — 1:1 port of antigravity.google
 * `landing-hero-background-component`.
 *
 * Source verbatim:
 *  - 50,000 particles, random in (20, 20, 10)
 *  - PerspectiveCamera(75, .., .1, 1000), z=5
 *  - uMousePos = smoothed NDC vec2 (lerp 0.05)
 *  - vertex: sin/cos drift, distance(pos.xy, uMousePos*5), force radius 3, strength 1.5
 *  - gl_PointSize = (15 * pixelRatio) * (1 / -mvPosition.z)
 *  - fragment: disc, color vec3(0.5, 0.8, 1.0), alpha * 0.6
 *  - AdditiveBlending, transparent, depthWrite false
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const PARTICLE_COUNT = 25000;

const VERT = /* glsl */ `
  precision highp float;

  uniform mat4  modelViewMatrix;
  uniform mat4  projectionMatrix;
  uniform float uTime;
  uniform vec2  uMousePos;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uSizeClamp;

  // Spherical coordinates per particle
  attribute vec2  aSphere;   // x = theta (azimuth), y = phi (polar)
  attribute float aRadius;   // radius around base sphere
  attribute float aOffset;   // 0..1 stable seed

  varying float vAlpha;
  varying float vAngle;
  varying float vSeed;

  void main() {
    // Slow global rotation around Y axis -> coherent swirl
    float theta = aSphere.x + uTime * 0.08;
    float phi   = aSphere.y;

    float sp = sin(phi);
    float cp = cos(phi);
    float st = sin(theta);
    float ct = cos(theta);

    vec3 pos = vec3(aRadius * sp * ct, aRadius * cp, aRadius * sp * st);

    // Subtle organic breathing (very small, keeps coherence)
    float breath = sin(uTime * 0.4 + aOffset * 6.2831) * 0.05;
    pos *= 1.0 + breath;

    // Mouse parallax: gentle push along z based on screen distance
    float dist = distance(uMousePos * 3.0, pos.xy);
    pos.z += smoothstep(2.5, 0.0, dist) * 0.6;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float ps = (7.0 * uPixelRatio * uSizeScale) * (1.0 / -mvPosition.z);
    gl_PointSize = clamp(ps, 2.0, uSizeClamp);
    gl_Position  = projectionMatrix * mvPosition;

    // Tangent direction in world space (derivative of pos w.r.t. theta), projected to screen.
    // tangent = d(pos)/d(theta) = radius * (-sp*st, 0, sp*ct)
    vec3 tangent = vec3(-sp * st, 0.0, sp * ct);
    vec4 mvTangent = modelViewMatrix * vec4(tangent, 0.0);
    // Project tangent to screen-space angle (use x,y of view-space tangent)
    vAngle = atan(mvTangent.y, mvTangent.x);

    // Front-of-sphere fade so back hemisphere is dimmer (depth feel)
    float depthFade = smoothstep(-1.0, 1.0, -mvPosition.z * 0.0 + pos.z * 0.15 + 0.6);
    vAlpha = depthFade;
    vSeed  = aOffset;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec3  uColor;
  uniform float uAlphaBoost;
  varying float vAlpha;
  varying float vAngle;
  varying float vSeed;

  // Signed-distance to a rounded capsule, oriented along x
  float sdCapsule(vec2 p, float halfLen, float r) {
    p.x -= clamp(p.x, -halfLen, halfLen);
    return length(p) - r;
  }

  void main() {
    // Remap point coord to [-1,1] and rotate by particle angle
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    uv.y = -uv.y;
    float ca = cos(vAngle);
    float sa = sin(vAngle);
    vec2 ruv = mat2(ca, -sa, sa, ca) * uv;

    // Capsule (dash): long on x, very thin on y
    float halfLen = 0.62;
    float r       = 0.13;
    float d = sdCapsule(ruv, halfLen, r);

    // Smooth edge
    float edge = 0.05;
    float shape = 1.0 - smoothstep(-edge, edge, d);
    if (shape <= 0.001) discard;

    gl_FragColor = vec4(uColor, shape * vAlpha * 0.55 * uAlphaBoost);
  }
`;

interface Props {
  className?: string;
  /** Optional theme override. If omitted, falls back to <html class="dark"> observer. */
  theme?: 'dark' | 'light';
}

export function AntigravityParticleField({ className, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) {
      console.error('[AntigravityParticleField] WebGL init failed', e);
      return;
    }
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);

    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 5;

    // ---- Geometry: 50k random in (20, 20, 10) ----
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const offsets = new Float32Array(PARTICLE_COUNT);
    for (let a = 0; a < PARTICLE_COUNT; a++) {
      const l = a * 3;
      positions[l]     = (Math.random() - 0.5) * 20;
      positions[l + 1] = (Math.random() - 0.5) * 20;
      positions[l + 2] = (Math.random() - 0.5) * 10;
      offsets[a] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));

    // Theme: explicit prop wins; otherwise read <html class="dark"> + observe.
    const isDark = () =>
      theme ? theme === 'dark' : document.documentElement.classList.contains('dark');
    // Antigravity-style cobalt blue dashes in both modes.
    // Dark mode: brighter blue. Light mode: deeper blue so it reads on white.
    const colorFor = () =>
      isDark() ? new THREE.Color(0.42, 0.55, 1.0) : new THREE.Color(0.16, 0.30, 0.85);

    const uniforms = {
      uTime:       { value: 0 },
      uMousePos:   { value: new THREE.Vector2(0, 0) },
      uPixelRatio: { value: pixelRatio },
      uColor:      { value: colorFor() },
      uAlphaBoost: { value: isDark() ? 1.0 : 3.2 },
      uSizeScale:  { value: isDark() ? 1.0 : 1.05 },
      uSizeClamp:  { value: isDark() ? 14.0 * pixelRatio : 14.0 * pixelRatio },
    };

    // RawShaderMaterial: matches source intent (no THREE-injected prelude).
    const material = new THREE.RawShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Additive disappears on white. Use Normal blending in light mode.
      blending: isDark() ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    // Fallback observer only when no explicit theme prop is provided.
    const themeObserver = !theme
      ? new MutationObserver(() => {
          uniforms.uColor.value = colorFor();
          uniforms.uAlphaBoost.value = isDark() ? 1.0 : 3.2;
          uniforms.uSizeScale.value = isDark() ? 1.0 : 1.05;
          uniforms.uSizeClamp.value = 14.0 * pixelRatio;
          material.blending = isDark() ? THREE.AdditiveBlending : THREE.NormalBlending;
          material.needsUpdate = true;
        })
      : null;
    themeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // ---- Resize ----
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // ---- Mouse (smoothed NDC, exactly like source) ----
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);
    const onMouseMove = (e: MouseEvent) => {
      targetMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
      targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    if (!reduceMotion) {
      window.addEventListener('mousemove', onMouseMove);
    }

    // ---- Loop ----
    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;

    const animate = () => {
      if (!running) return;
      mouse.x += (targetMouse.x - mouse.x) * 0.05;
      mouse.y += (targetMouse.y - mouse.y) * 0.05;
      uniforms.uTime.value = clock.getElapsedTime();
      uniforms.uMousePos.value.copy(mouse);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    raf = requestAnimationFrame(animate);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('mousemove', onMouseMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [theme]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
