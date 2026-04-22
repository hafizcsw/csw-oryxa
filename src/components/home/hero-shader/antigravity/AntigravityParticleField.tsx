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

const PARTICLE_COUNT = 50_000;

const VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2  uMousePos;
  uniform float uPixelRatio;
  attribute float aOffset;
  varying float vAlpha;

  void main() {
    vec3 pos = position;

    float time = uTime * 0.2 + aOffset * 10.0;
    pos.x += sin(time) * 0.5;
    pos.y += cos(time * 0.8) * 0.5;
    pos.z += sin(time * 1.2) * 0.5;

    float dist = distance(pos.xy, uMousePos * 5.0);
    float force = 1.0 - smoothstep(0.0, 3.0, dist);
    pos.xy += normalize(pos.xy - uMousePos * 5.0) * force * 1.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (15.0 * uPixelRatio) * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    vAlpha = smoothstep(0.0, 1.0, force * 0.5 + 0.2);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    float strength = 1.0 - smoothstep(0.0, 0.5, dist);
    gl_FragColor = vec4(uColor, strength * vAlpha);
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

    // Resolve color from CSS var --primary (HSL)
    const cs = getComputedStyle(document.documentElement);
    const hsl = cs.getPropertyValue('--primary').trim() || '210 80% 60%';
    const color = new THREE.Color(`hsl(${hsl.replace(/\s+/g, ', ')})`);

    const uniforms = {
      uTime:       { value: 0 },
      uMousePos:   { value: new THREE.Vector2(0, 0) },
      uPixelRatio: { value: pixelRatio },
      uColor:      { value: color },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('mousemove', onMouseMove);
      geometry.dispose();
      material.dispose();
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
