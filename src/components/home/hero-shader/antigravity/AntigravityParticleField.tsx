/**
 * AntigravityParticleField — local equivalent of antigravity.google
 * `landing-main-particles-component`.
 *
 * Scene/Particles split:
 *   - This file (Scene): owns Renderer, canvas, resize, input, animation loop.
 *   - particles.ts (Particles): owns sim+render programs and ping-pong FBOs.
 *   - shaders.ts: GPGPU sim + dash-capsule render shaders.
 *   - config.ts: source-of-truth values from the reference.
 *
 * No hash-grid approximation. No fake speed preset. GPGPU only.
 * Pulse exists architecturally but is disabled by default (config.pulseEnabled).
 */
import { useEffect, useRef } from 'react';
import { Renderer, Mesh, Program } from 'ogl';
import { createParticles } from './particles';
import {
  ANTIGRAV_CONFIG,
  ANTIGRAV_DPR_CAP,
  ANTIGRAV_MOUSE_LERP,
  ANTIGRAV_HOVER_LERP,
} from './config';

interface Props {
  className?: string;
}

export function AntigravityParticleField({ className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio || 1, ANTIGRAV_DPR_CAP),
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        webgl: 2,
      });
    } catch (e) {
      console.error('[AntigravityParticleField] Renderer init failed', e);
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    const initialAspect = Math.max(0.1, container.clientWidth / Math.max(1, container.clientHeight));

    const particles = createParticles(gl, { aspect: initialAspect, isMobile, reduceMotion }) as
      | (ReturnType<typeof createParticles> & { seedMesh: Mesh; seedProgram: Program })
      | null;
    if (!particles) {
      if (canvas.parentNode === container) container.removeChild(canvas);
      return;
    }

    // Seed initial position texture
    renderer.render({ scene: particles.seedMesh, target: particles.rt.read });

    // ---- Resize ----
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h);
      particles.resize(w / h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // ---- Input ----
    const mouseTarget = { x: 0, y: 0, hover: 0 };
    const mouseEnabled = !isMobile && !reduceMotion;
    let pulse = { progress: 0, origin: [0, 0] as [number, number], active: false };

    const toAspectNDC = (clientX: number, clientY: number): [number, number] => {
      const rect = container.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = 1 - ((clientY - rect.top) / rect.height) * 2;
      const a = rect.width / rect.height;
      return [nx * a, ny];
    };

    const inside = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    const onMove = (e: PointerEvent) => {
      if (!inside(e)) { mouseTarget.hover = 0; return; }
      const [x, y] = toAspectNDC(e.clientX, e.clientY);
      mouseTarget.x = x; mouseTarget.y = y; mouseTarget.hover = 1;
    };
    const onLeave = () => { mouseTarget.hover = 0; };
    const onClick = (e: PointerEvent) => {
      if (!ANTIGRAV_CONFIG.pulseEnabled || !inside(e)) return;
      pulse.origin = toAspectNDC(e.clientX, e.clientY);
      pulse.progress = 0;
      pulse.active = true;
    };

    if (mouseEnabled) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerleave', onLeave);
      if (ANTIGRAV_CONFIG.pulseEnabled) {
        window.addEventListener('pointerdown', onClick, { passive: true });
      }
    }

    // ---- Loop ----
    let raf = 0;
    let running = true;
    let last = performance.now();
    let elapsed = 0;
    let mx = 0, my = 0, hv = 0;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      // Smooth input
      mx += (mouseTarget.x - mx) * ANTIGRAV_MOUSE_LERP;
      my += (mouseTarget.y - my) * ANTIGRAV_MOUSE_LERP;
      hv += (mouseTarget.hover - hv) * ANTIGRAV_HOVER_LERP;

      // Pulse advance
      if (pulse.active) {
        pulse.progress += dt / ANTIGRAV_CONFIG.pulseDuration;
        if (pulse.progress >= 1) { pulse.progress = 0; pulse.active = false; }
      }

      const isDark = document.documentElement.classList.contains('dark');

      // Source-faithful per-frame ring radius animation
      const ringRadius = 0.175 + Math.sin(elapsed * 1.0) * 0.03 + Math.cos(elapsed * 3.0) * 0.02;
      // Source-faithful particleScale derived from canvas backing width
      const dpr = renderer.dpr || 1;
      const cssWidth = (gl.canvas.width as number) / dpr;
      const particleScale = (cssWidth / 2000) * ANTIGRAV_CONFIG.particlesScale;

      // Sim pass
      particles.step({
        dt,
        time: elapsed,
        ringRadius,
        // Source: uMousePos = intersectionPoint * 0.175
        mouse: { x: mx * ANTIGRAV_CONFIG.mouseScale, y: my * ANTIGRAV_CONFIG.mouseScale },
        hover: hv,
        isDark,
        pulse: pulse.active ? { progress: pulse.progress, origin: pulse.origin } : undefined,
      });
      renderer.render({ scene: particles.simMesh, target: particles.rt.write });
      particles.rt.swap();

      // Render pass
      particles.syncRender(elapsed, isDark, particleScale);
      renderer.render({ scene: particles.pointMesh });

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
      if (mouseEnabled) {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerleave', onLeave);
        window.removeEventListener('pointerdown', onClick);
      }
      try {
        const loseExt = gl.getExtension('WEBGL_lose_context');
        loseExt?.loseContext();
      } catch { /* noop */ }
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
