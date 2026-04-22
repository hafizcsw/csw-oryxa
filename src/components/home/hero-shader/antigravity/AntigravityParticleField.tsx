/**
 * AntigravityParticleField — 1:1 port of `nI` class from
 * antigravity.google main-5LR4F4TY.js (morphing particles).
 *
 * + Orca whale flyby: a glowing whale dives across the scene ONCE per
 *   session (re-triggered on page refresh). While crossing it pushes
 *   nearby particles outward, mimicking the mouse-repulsion behavior.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// --- Locked defaults (source-confirmed) ---
const DEFAULT_DENSITY = 100;
const DEFAULT_PARTICLES_SCALE = 1;
const DEFAULT_CAMERA_ZOOM = 3.5;
const DEFAULT_THEME: 'dark' | 'light' = 'dark';

// --- Whale flyby ---
const WHALE_SESSION_KEY = 'oryxa-whale-shown';
const WHALE_DURATION = 9.0;        // seconds for full crossing
const WHALE_START_DELAY = 0.8;     // seconds after mount before it appears
const WHALE_PUSH_RADIUS = 1.2;     // world units of influence
const WHALE_PUSH_STRENGTH = 0.6;   // how hard particles are shoved aside

const DARK_PALETTE = {
  color1: '#80CCFF',
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
  uniform vec3  uWhalePos;
  uniform float uWhaleStrength;
  uniform float uWhaleRadius;
  varying vec3 vColor;
  varying float vType;
  varying float vAlpha;
  void main() {
    vColor = color;
    vType = type;
    vec3 pos = mix(position, target, uProgress);
    pos.x += sin(uTime * 0.5 + position.z) * 0.1;
    pos.y += cos(uTime * 0.5 + position.x) * 0.1;

    // ---- Whale repulsion (same shape as mouse repulsion) ----
    if (uWhaleStrength > 0.0) {
      vec3 diff = pos - uWhalePos;
      float d = length(diff);
      if (d < uWhaleRadius) {
        float falloff = 1.0 - (d / uWhaleRadius);
        // smoother falloff
        falloff = falloff * falloff;
        pos += normalize(diff + vec3(0.0001)) * falloff * uWhaleStrength;
      }
    }

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

/**
 * Build a stylized luminous orca: an elongated ellipsoid body + dorsal fin
 * + tail flukes, all using additive emissive material so it reads as
 * "light" rather than a solid creature.
 */
function buildWhale(color: THREE.Color): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });

  // Body — elongated along X (swim direction)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 16), bodyMat);
  body.scale.set(2.6, 0.7, 0.9);
  group.add(body);

  // Head bulge
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 12), bodyMat);
  head.position.set(0.55, 0.0, 0);
  head.scale.set(1.0, 0.85, 0.95);
  group.add(head);

  // Dorsal fin
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16), bodyMat);
  fin.position.set(-0.05, 0.18, 0);
  fin.rotation.z = Math.PI; // point up
  fin.scale.set(0.6, 1.0, 0.25);
  group.add(fin);

  // Tail stalk
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), bodyMat);
  tail.position.set(-0.7, 0, 0);
  tail.scale.set(1.5, 0.45, 0.5);
  group.add(tail);

  // Tail fluke (flat horizontal)
  const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 16), bodyMat);
  fluke.position.set(-0.95, 0, 0);
  fluke.rotation.z = Math.PI / 2; // point along -X
  fluke.scale.set(1.0, 1.0, 0.18);
  group.add(fluke);

  // Soft glow halo (a billboard-ish big sphere)
  const haloMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), haloMat);
  halo.scale.set(2.8, 1.1, 1.4);
  group.add(halo);

  return group;
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
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = cameraZoom;

    // ---- Particle attributes ----
    const positions = new Float32Array(particleCount * 3);
    const targets   = new Float32Array(particleCount * 3);
    const colors    = new Float32Array(particleCount * 3);
    const sizes     = new Float32Array(particleCount);
    const types     = new Float32Array(particleCount);

    const col1 = new THREE.Color(c1);
    const col2 = new THREE.Color(c2);
    const col3 = new THREE.Color(c3);

    for (let i = 0; i < particleCount; i++) {
      const f = i / particleCount;
      targets[i * 3]     = (Math.random() - 0.5) * 10;
      targets[i * 3 + 1] = (Math.random() - 0.5) * 10;
      targets[i * 3 + 2] = (Math.random() - 0.5) * 10;

      const c = f < 0.33 ? col1 : f < 0.66 ? col2 : col3;
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = Math.random() * particlesScale;
      types[i] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('target',   new THREE.BufferAttribute(targets, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('type',     new THREE.BufferAttribute(types, 1));

    const sprite = makeSpriteTexture();

    const uniforms = {
      uTime:          { value: 0 },
      uProgress:      { value: 1.0 },
      uSize:          { value: particlesScale },
      uPixelRatio:    { value: pixelRatio },
      uAlpha:         { value: isDark ? 1.0 : 0.8 },
      uTexture:       { value: sprite },
      uWhalePos:      { value: new THREE.Vector3(0, 0, -1000) },
      uWhaleStrength: { value: 0.0 },
      uWhaleRadius:   { value: WHALE_PUSH_RADIUS },
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

    // ---- Whale (only if not yet shown this session) ----
    let whale: THREE.Group | null = null;
    let whaleStart = -1; // seconds; -1 = not started, -2 = already finished
    const alreadyShown = (() => {
      try { return sessionStorage.getItem(WHALE_SESSION_KEY) === '1'; }
      catch { return false; }
    })();

    if (!alreadyShown) {
      const whaleColor = new THREE.Color(c3); // brightest of the three
      whale = buildWhale(whaleColor);
      whale.visible = false;
      scene.add(whale);
    } else {
      whaleStart = -2;
    }

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
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;

      // Whale lifecycle
      if (whale && whaleStart === -1 && t >= WHALE_START_DELAY) {
        whaleStart = t;
        whale.visible = true;
      }

      if (whale && whaleStart > 0) {
        const elapsed = t - whaleStart;
        const k = elapsed / WHALE_DURATION; // 0..1

        if (k >= 1) {
          // Done — remove and free memory
          scene.remove(whale);
          whale.traverse((obj) => {
            const m = obj as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material as THREE.Material | THREE.Material[] | undefined;
            if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
            else if (mat) mat.dispose();
          });
          whale = null;
          whaleStart = -2;
          uniforms.uWhaleStrength.value = 0;
          try { sessionStorage.setItem(WHALE_SESSION_KEY, '1'); } catch {}
        } else {
          // Diving arc: enters from upper-right, exits lower-left, crossing through
          const x =  4.5 - 9.0 * k;                   // +4.5 → -4.5
          const y =  1.6 * Math.cos(k * Math.PI);     // gentle dive (top → bottom-ish)
          const z = -0.6 + Math.sin(k * Math.PI) * 0.8; // arcs slightly toward camera mid-flight
          whale.position.set(x, y, z);

          // Face direction of motion (always traveling -X, slight pitch from dy)
          const dyApprox = -1.6 * Math.sin(k * Math.PI) * Math.PI / WHALE_DURATION;
          whale.rotation.z = Math.atan2(dyApprox, -1) * 0.25;
          whale.rotation.y = Math.PI; // facing -X
          // Subtle tail wag
          whale.rotation.x = Math.sin(t * 6.0) * 0.08;

          // Fade in/out at the edges of the crossing
          const edgeFade = Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.15);

          // Drive the particle repulsion uniforms
          uniforms.uWhalePos.value.set(x, y, z);
          uniforms.uWhaleStrength.value = WHALE_PUSH_STRENGTH * edgeFade;

          // Apply opacity to whale meshes
          whale.traverse((obj) => {
            const m = obj as THREE.Mesh;
            const mat = m.material as THREE.MeshBasicMaterial | undefined;
            if (mat && 'opacity' in mat) {
              // Preserve per-mesh base opacity ratio: body ~0.85, halo ~0.18
              const base = (mat.userData.baseOpacity as number | undefined);
              if (base === undefined) mat.userData.baseOpacity = mat.opacity;
              mat.opacity = (mat.userData.baseOpacity as number) * edgeFade;
            }
          });
        }
      }

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
      if (whale) {
        whale.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
          else if (mat) mat.dispose();
        });
      }
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
