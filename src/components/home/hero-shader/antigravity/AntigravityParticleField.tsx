/**
 * AntigravityParticleField — morphing-particles visual layer
 * (source-matched to landing-morphing-particles-component / nI).
 *
 * Locked rules (do not redesign):
 *  - particleCount = density * 200  (default density = 200 → 40,000)
 *  - shape: sdRoundBox on (gl_PointCoord - 0.5), discard if dist > 0.0
 *  - size : gl_PointSize = uSize * size * uPixelRatio * (500.0 / -mvPosition.z)
 *  - 3-color palette assigned by thirds at creation
 *  - theme: dark → uAlpha=1.0 / clearColor=0x000000 / NormalBlending
 *           light→ uAlpha=0.8 / clearColor=0xffffff / NormalBlending
 *  - RawShaderMaterial, Points, transparent, depthTest=false, depthWrite=false
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// --- Locked defaults (source-confirmed) ---
const DEFAULT_DENSITY = 200;          // → particleCount = 40,000
const DEFAULT_PARTICLES_SCALE = 1;
const DEFAULT_CAMERA_ZOOM = 3.5;
const DEFAULT_THEME: 'dark' | 'light' = 'dark';

// --- Palettes (source-confirmed 3-color) ---
const DARK_PALETTE = {
  color1: new THREE.Color(0.50, 0.80, 1.00), // #80CCFF cyan-blue
  color2: new THREE.Color(0.45, 0.55, 1.00), // #7388FF indigo
  color3: new THREE.Color(0.70, 0.90, 1.00), // #B3E5FF pale-cyan
};
const LIGHT_PALETTE = {
  color1: new THREE.Color(0.20, 0.45, 0.95), // #3373F2 blue
  color2: new THREE.Color(0.35, 0.30, 0.90), // #594DE6 indigo
  color3: new THREE.Color(0.10, 0.60, 0.95), // #1A99F2 cyan
};

const VERT = /* glsl */ `
  precision highp float;

  attribute vec3  position;
  attribute vec3  target;
  attribute vec3  color;
  attribute float size;
  attribute float type;

  uniform mat4  modelViewMatrix;
  uniform mat4  projectionMatrix;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec2  uMousePos;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // gentle drift (preserve current motion feel)
    float t = uTime * 0.2 + type * 10.0;
    pos.x += sin(t) * 0.5;
    pos.y += cos(t * 0.8) * 0.5;
    pos.z += sin(t * 1.2) * 0.5;

    // mouse repulsion
    float dist = distance(pos.xy, uMousePos * 5.0);
    float force = 1.0 - smoothstep(0.0, 3.0, dist);
    pos.xy += normalize(pos.xy - uMousePos * 5.0) * force * 1.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // LOCKED size formula
    gl_PointSize = uSize * size * uPixelRatio * (500.0 / -mvPosition.z);
    gl_Position  = projectionMatrix * mvPosition;

    vColor = color;
    vAlpha = smoothstep(0.0, 1.0, force * 0.5 + 0.6);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  varying vec3  vColor;
  varying float vAlpha;

  uniform float uAlpha;
  uniform sampler2D uTexture;

  // SDF: rounded box. r is per-corner radius (we use uniform r).
  float sdRoundBox(in vec2 p, in vec2 b, in vec4 r){
    r.xy = (p.x > 0.0) ? r.xy : r.zw;
    r.x  = (p.y > 0.0) ? r.x  : r.y;
    vec2 q = abs(p) - b + r.x;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
  }

  void main() {
    // LOCKED shape
    vec2 uv = gl_PointCoord - 0.5;
    float d = sdRoundBox(uv, vec2(0.4), vec4(0.1));
    if (d > 0.0) discard;

    vec4 texColor = texture2D(uTexture, gl_PointCoord);

    // LOCKED final color formula
    gl_FragColor = vec4(vColor, vAlpha * uAlpha * texColor.a);
  }
`;

// Procedural soft-disc texture (alpha mask for the texColor.a multiplier)
function makeSpriteTexture(): THREE.Texture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

interface Props {
  className?: string;
  theme?: 'dark' | 'light';
  density?: number;          // particleCount = density * 200
  particlesScale?: number;
  cameraZoom?: number;
}

export function AntigravityParticleField({
  className,
  theme = DEFAULT_THEME,
  density = DEFAULT_DENSITY,
  particlesScale = DEFAULT_PARTICLES_SCALE,
  cameraZoom = DEFAULT_CAMERA_ZOOM,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const particleCount = Math.max(1, Math.floor(density)) * 200;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) {
      console.error('[AntigravityParticleField] WebGL init failed', e);
      return;
    }
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);

    // LOCKED theme switch
    const isDark = theme === 'dark';
    const uAlphaValue = isDark ? 1.0 : 0.8;
    renderer.setClearColor(isDark ? 0x000000 : 0xffffff, 0);

    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = cameraZoom;

    // ---- Attributes: position, target, color, size, type ----
    const positions = new Float32Array(particleCount * 3);
    const targets   = new Float32Array(particleCount * 3);
    const colors    = new Float32Array(particleCount * 3);
    const sizes     = new Float32Array(particleCount);
    const types     = new Float32Array(particleCount);

    const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
    const third = Math.floor(particleCount / 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3]     = (Math.random() - 0.5) * 20;
      positions[i3 + 1] = (Math.random() - 0.5) * 20;
      positions[i3 + 2] = (Math.random() - 0.5) * 10;

      targets[i3]     = positions[i3];
      targets[i3 + 1] = positions[i3 + 1];
      targets[i3 + 2] = positions[i3 + 2];

      // 3-color palette assigned by thirds
      const c = i < third ? palette.color1 : i < third * 2 ? palette.color2 : palette.color3;
      colors[i3]     = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;

      sizes[i] = particlesScale * (0.5 + Math.random() * 0.7);
      types[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('target',   new THREE.BufferAttribute(targets, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('type',     new THREE.BufferAttribute(types, 1));

    const sprite = makeSpriteTexture();

    const uniforms = {
      uTime:       { value: 0 },
      uSize:       { value: 1.0 },
      uPixelRatio: { value: pixelRatio },
      uMousePos:   { value: new THREE.Vector2(0, 0) },
      uAlpha:      { value: uAlphaValue },
      uTexture:    { value: sprite },
    };

    const material = new THREE.RawShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

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

    // ---- Mouse (smoothed NDC) ----
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
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('mousemove', onMouseMove);
      geometry.dispose();
      material.dispose();
      sprite.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [theme, density, particlesScale, cameraZoom]);

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
