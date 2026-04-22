/**
 * AntigravityParticleField — faithful port of antigravity.google
 * `landing-main-particles-component`.
 *
 * Architecture (1:1 with source):
 *   - Three.js + PerspectiveCamera + Raycaster
 *   - One Points object, vertex shader samples uPosTex + uPosNearestTex
 *   - PointSize = uPointScale * (300 / -mvPosition.z)  ← perspective-aware
 *   - Mouse → raycaster.intersectObject(interactionPlane) → vec3 world-space
 *   - uRingRadius animated per-frame: 0.175 + sin(t)*0.03 + cos(3t)*0.02
 *   - PoissonDiskSampling for pointsBase, image-driven nearestPoints
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createParticleSystem } from './particles';
import { ANTIGRAV_CONFIG, ANTIGRAV_DPR_CAP, ANTIGRAV_HOVER_LERP } from './config';

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
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
      });
    } catch (e) {
      console.error('[AntigravityParticleField] init failed', e);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ANTIGRAV_DPR_CAP));
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(ANTIGRAV_CONFIG.cameraFov, 1, 0.1, 100);
    camera.position.set(0, 0, ANTIGRAV_CONFIG.cameraZ);

    // Resolve color from CSS var --primary (HSL) → THREE.Color
    const cs = getComputedStyle(document.documentElement);
    const hsl = cs.getPropertyValue('--primary').trim() || '210 80% 60%';
    const color = new THREE.Color(`hsl(${hsl.replace(/\s+/g, ', ')})`);

    const sys = createParticleSystem({ color });
    scene.add(sys.points);

    // Invisible interaction plane at z=0
    const planeSize = ANTIGRAV_CONFIG.worldHalfExtent * 4;
    const interactionPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(planeSize, planeSize),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    scene.add(interactionPlane);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(999, 999);
    let hoverTarget = 0;

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
      if (!inside(e)) { hoverTarget = 0; return; }
      const r = container.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      hoverTarget = ANTIGRAV_CONFIG.hoverEnabled ? 1 : 0;
    };
    const onLeave = () => { hoverTarget = 0; };

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

      // Source-faithful ring radius animation
      const ringRadius = 0.175 + Math.sin(elapsed) * 0.03 + Math.cos(elapsed * 3) * 0.02;
      sys.uniforms.uRingRadius.value = ringRadius;
      sys.uniforms.uTime.value = elapsed;
      sys.uniforms.uDeltaTime.value = dt;

      // Smooth hover toggle
      const cur = sys.uniforms.uIsHovering.value as number;
      sys.uniforms.uIsHovering.value = cur + (hoverTarget - cur) * ANTIGRAV_HOVER_LERP;

      // Raycast pointer → world-space mouse position
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(interactionPlane);
      if (hits.length > 0) {
        (sys.uniforms.uMousePos.value as THREE.Vector3).copy(hits[0].point);
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
      sys.dispose();
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
