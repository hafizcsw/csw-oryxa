/**
 * AntigravityParticleField — 1:1 port of `nI` class from
 * antigravity.google main-5LR4F4TY.js (morphing particles).
 *
 * Verbatim from source:
 *  - particleCount = density * 200   (density default = 100 → 20,000)
 *  - position = (0,0,0); target = (rand-0.5)*10 per axis
 *  - color assigned by thirds (color1/2/3)
 *  - size = random * particlesScale; type = floor(random * textures.length)
 *  - PerspectiveCamera(45, .., .1, 1000), z = cameraZoom (default 3.5)
 *  - vertex: pos = mix(position, target, uProgress);
 *            pos.x += sin(uTime*0.5 + position.z)*0.1
 *            pos.y += cos(uTime*0.5 + position.x)*0.1
 *            gl_PointSize = uSize * size * uPixelRatio * (500.0 / -mvPosition.z)
 *            vAlpha = smoothstep(-10.0, -2.0, mvPosition.z)
 *  - fragment: sdRoundBox(uv, vec2(0.4), vec4(0.1)); discard if dist > 0
 *              gl_FragColor = vec4(vColor, vAlpha * uAlpha * texColor.a)
 *              if (gl_FragColor.a < 0.01) discard
 *  - theme: dark  → uAlpha=1.0, AdditiveBlending,  clearColor=0x000000
 *           light → uAlpha=0.8, NormalBlending,    clearColor=0xffffff
 *  - RawShaderMaterial, transparent, depthTest=false, depthWrite=false
 *
 * Note: source starts uProgress=0 (all at origin) and animates externally.
 * We initialize uProgress=1 so particles are visible at mount.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// --- Locked defaults (source-confirmed) ---
const DEFAULT_DENSITY = 100;          // → particleCount = 20,000
const DEFAULT_PARTICLES_SCALE = 1;
const DEFAULT_CAMERA_ZOOM = 3.5;
const DEFAULT_THEME: 'dark' | 'light' = 'dark';

// --- Palettes (3-color) ---
const DARK_PALETTE = {
  color1: '#80CCFF', // vec3(0.5, 0.8, 1.0)
  color2: '#7388FF',
  color3: '#B3E5FF',
};
const LIGHT_PALETTE = {
  color1: '#3373F2',
  color2: '#594DE6',
  color3: '#1A99F2',
};

const VERT = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec3 target;
  attribute vec3 color;
  attribute float size;
  attribute float type;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uProgress;
  uniform float uSize;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vType;
  varying float vAlpha;
  void main() {
    vColor = color;
    vType = type;
    vec3 pos = mix(position, target, uProgress);
    pos.x += sin(uTime * 0.5 + position.z) * 0.1;
    pos.y += cos(uTime * 0.5 + position.x) * 0.1;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uSize * size * uPixelRatio * (500.0 / -mvPosition.z);
    vAlpha = smoothstep(-10.0, -2.0, mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uAlpha;
  varying vec3 vColor;
  varying float vType;
  varying float vAlpha;
  float sdRoundBox(vec2 p, vec2 b, vec4 r) {
    r.xy = (p.x > 0.0) ? r.xy : r.zw;
    r.x  = (p.y > 0.0) ? r.x  : r.y;
    vec2 q = abs(p) - b + r.x;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
  }
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = sdRoundBox(uv, vec2(0.4), vec4(0.1));
    if (dist > 0.0) discard;
    vec4 texColor = texture2D(uTexture, gl_PointCoord);
    gl_FragColor = vec4(vColor, vAlpha * uAlpha * texColor.a);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

// Procedural soft sprite (alpha mask)
function makeSpriteTexture(): THREE.Texture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.9)');
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
  density?: number;
  particlesScale?: number;
  cameraZoom?: number;
  color1?: string;
  color2?: string;
  color3?: string;
}

export function AntigravityParticleField({
  className,
  theme = DEFAULT_THEME,
  density = DEFAULT_DENSITY,
  particlesScale = DEFAULT_PARTICLES_SCALE,
  cameraZoom = DEFAULT_CAMERA_ZOOM,
  color1,
  color2,
  color3,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isDark = theme === 'dark';
    const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
    const c1 = color1 || palette.color1;
    const c2 = color2 || palette.color2;
    const c3 = color3 || palette.color3;

    const particleCount = Math.max(1, Math.floor(density)) * 200;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      console.error('[AntigravityParticleField] WebGL init failed', e);
      return;
    }
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(isDark ? 0x000000 : 0xffffff, 0);

    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    // Source: PerspectiveCamera(45, ..)
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = cameraZoom;

    // ---- Attributes (verbatim from source) ----
    const positions = new Float32Array(particleCount * 3); // all zeros
    const targets   = new Float32Array(particleCount * 3);
    const colors    = new Float32Array(particleCount * 3);
    const sizes     = new Float32Array(particleCount);
    const types     = new Float32Array(particleCount);

    const col1 = new THREE.Color(c1);
    const col2 = new THREE.Color(c2);
    const col3 = new THREE.Color(c3);

    for (let i = 0; i < particleCount; i++) {
      const f = i / particleCount;
      // position stays (0,0,0)
      targets[i * 3]     = (Math.random() - 0.5) * 10;
      targets[i * 3 + 1] = (Math.random() - 0.5) * 10;
      targets[i * 3 + 2] = (Math.random() - 0.5) * 10;

      const c = f < 0.33 ? col1 : f < 0.66 ? col2 : col3;
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = Math.random() * particlesScale;
      types[i] = 0; // single sprite texture
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
      uProgress:   { value: 1.0 }, // start at target so particles are visible
      uSize:       { value: particlesScale },
      uPixelRatio: { value: pixelRatio },
      uAlpha:      { value: isDark ? 1.0 : 0.8 },
      uTexture:    { value: sprite },
    };

    const material = new THREE.RawShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
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

    // ---- Loop ----
    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;

    const animate = () => {
      if (!running) return;
      uniforms.uTime.value = clock.getElapsedTime();
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
      geometry.dispose();
      material.dispose();
      sprite.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [theme, density, particlesScale, cameraZoom, color1, color2, color3]);

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
