/**
 * AntigravityParticleField — clean rebuild.
 *
 * Spec:
 *  - 50,000 particles, random positions in 20x20x10 space
 *  - sin/cos motion in vertex shader
 *  - mouse repulsion (radius ≈ 3, strength ≈ 1.5)
 *  - perspective gl_PointSize with depth scaling
 *  - circular fragment with soft alpha
 *  - additive blending
 *
 * No textures, no nearestPoints, no GPGPU.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const PARTICLE_COUNT = 50_000;
const SPACE = { x: 20, y: 20, z: 10 };
const REPULSION_RADIUS = 3.0;
const REPULSION_STRENGTH = 1.5;

const VERT = /* glsl */ `
  uniform float uTime;
  uniform vec3  uMouse;
  uniform float uMouseActive;
  uniform float uPointScale;
  uniform float uRepulsionRadius;
  uniform float uRepulsionStrength;

  attribute float aSeed;

  varying float vDepth;

  void main() {
    vec3 pos = position;

    // sin/cos drift driven by per-particle seed
    float t = uTime * 0.5;
    pos.x += sin(t + aSeed * 6.2831) * 0.35;
    pos.y += cos(t * 1.1 + aSeed * 12.566) * 0.35;
    pos.z += sin(t * 0.7 + aSeed * 9.42) * 0.25;

    // mouse repulsion (radial falloff)
    vec3 toP = pos - uMouse;
    float d  = length(toP);
    float falloff = 1.0 - smoothstep(0.0, uRepulsionRadius, d);
    pos += normalize(toP + vec3(1e-5)) * falloff * uRepulsionStrength * uMouseActive;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    vDepth = -mv.z;
    gl_PointSize = uPointScale * (300.0 / -mv.z);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3  uColor;
  uniform float uAlpha;
  varying float vDepth;

  void main() {
    vec2 pc = gl_PointCoord - 0.5;
    float d = length(pc);
    if (d > 0.5) discard;

    float soft = smoothstep(0.5, 0.0, d);
    float depthFade = clamp(1.0 - (vDepth - 5.0) / 30.0, 0.2, 1.0);

    gl_FragColor = vec4(uColor, soft * uAlpha * depthFade);
  }
`;

interface Props {
  className?: string;
}

export function AntigravityParticleField({ className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false });
    } catch (e) {
      console.error('[AntigravityParticleField] WebGL init failed', e);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    camera.position.set(0, 0, 18);

    // Resolve color from --primary
    const cs = getComputedStyle(document.documentElement);
    const hsl = cs.getPropertyValue('--primary').trim() || '210 80% 60%';
    const color = new THREE.Color(`hsl(${hsl.replace(/\s+/g, ', ')})`);

    // ---- Geometry: random positions in 20x20x10 ----
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const seeds = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * SPACE.x;
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPACE.y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * SPACE.z;
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const uniforms = {
      uTime:              { value: 0 },
      uMouse:             { value: new THREE.Vector3(999, 999, 999) },
      uMouseActive:       { value: 0 },
      uPointScale:        { value: 0.9 },
      uRepulsionRadius:   { value: REPULSION_RADIUS },
      uRepulsionStrength: { value: REPULSION_STRENGTH },
      uColor:             { value: color },
      uAlpha:             { value: 0.85 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // Invisible plane at z=0 for raycasting mouse → world space
    const interactionPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(SPACE.x * 2, SPACE.y * 2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    scene.add(interactionPlane);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(999, 999);
    let mouseTarget = 0;

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

    // ---- Pointer ----
    const inside = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    const onMove = (e: PointerEvent) => {
      if (!inside(e)) { mouseTarget = 0; return; }
      const r = container.getBoundingClientRect();
      pointer.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
      pointer.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
      mouseTarget = 1;
    };
    const onLeave = () => { mouseTarget = 0; };

    const interactive = !reduceMotion;
    if (interactive) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerleave', onLeave);
    }

    // ---- Loop ----
    let raf = 0;
    let running = true;
    let last = performance.now();
    let elapsed = 0;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      uniforms.uTime.value = elapsed;

      // Smooth mouse activation
      const cur = uniforms.uMouseActive.value as number;
      uniforms.uMouseActive.value = cur + (mouseTarget - cur) * 0.1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(interactionPlane);
      if (hits.length > 0) {
        (uniforms.uMouse.value as THREE.Vector3).copy(hits[0].point);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (interactive) {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerleave', onLeave);
      }
      geometry.dispose();
      material.dispose();
      interactionPlane.geometry.dispose();
      (interactionPlane.material as THREE.Material).dispose();
      renderer.dispose();
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, []);

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
