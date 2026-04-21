import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Vec2, Vec3 } from 'ogl';
import { vertex, fragment } from './atmosphericFieldShader';

// === CONFIG ===
// All visual knobs in one place. Tweak here, no other file needs changes.
export type HeroFieldVariant = 'quieter' | 'reactive';

const PRESETS: Record<HeroFieldVariant, {
  intensity: number;
  noiseScale: number;
  speed: number;
  mouseRadius: number;
  depthBoost: number;
}> = {
  // A — quieter: layered depth, soft presence
  quieter:  { intensity: 0.55, noiseScale: 1.4, speed: 0.07, mouseRadius: 0.24, depthBoost: 0.55 },
  // B — more alive: faster, more reactive, deeper zones
  reactive: { intensity: 0.80, noiseScale: 1.9, speed: 0.13, mouseRadius: 0.32, depthBoost: 0.80 },
};

const MOBILE_INTENSITY_SCALE = 0.7; // lower on small screens
const DPR_CAP = 1.5;
const MOUSE_LERP = 0.08;            // smoothing toward target strength
// === /CONFIG ===

interface Props {
  variant?: HeroFieldVariant;
  className?: string;
}

export function HeroAtmosphericField({ variant = 'quieter', className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const cfg = PRESETS[variant];

    // --- WebGL availability check ---
    const probe = document.createElement('canvas');
    const gl = (probe.getContext('webgl2') ||
                probe.getContext('webgl') ||
                probe.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return; // graceful no-op fallback

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio || 1, DPR_CAP),
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
      });
    } catch {
      return;
    }

    const glCtx = renderer.gl;
    glCtx.clearColor(0, 0, 0, 0);

    const canvas = glCtx.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    const geometry = new Triangle(glCtx);
    const program = new Program(glCtx, {
      vertex,
      fragment,
      transparent: true,
      uniforms: {
        uTime:          { value: 0 },
        uResolution:    { value: new Vec2(1, 1) },
        uMouse:         { value: new Vec2(0.5, 0.5) },
        uMouseStrength: { value: 0 },
        uIntensity:     { value: cfg.intensity * (isMobile ? MOBILE_INTENSITY_SCALE : 1) },
        uNoiseScale:    { value: cfg.noiseScale },
        uSpeed:         { value: reduceMotion ? 0 : cfg.speed },
        uMouseRadius:   { value: cfg.mouseRadius },
        uDepthBoost:    { value: cfg.depthBoost },
        uTint:          { value: new Vec3(0, 0, 0) }, // updated each frame from theme
      },
    });

    const mesh = new Mesh(glCtx, { geometry, program });

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h);
      program.uniforms.uResolution.value.set(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // --- Mouse handling (desktop only) ---
    const mouseTarget = { x: 0.5, y: 0.5, strength: 0 };
    const mouseEnabled = !isMobile && !reduceMotion;

    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom
      ) return;
      mouseTarget.x = (e.clientX - rect.left) / rect.width;
      // y flipped so vUv.y matches (vUv origin is bottom-left after position*0.5+0.5)
      mouseTarget.y = 1 - (e.clientY - rect.top) / rect.height;
      mouseTarget.strength = 1;
    };
    const onLeave = () => { mouseTarget.strength = 0; };

    if (mouseEnabled) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerleave', onLeave);
    }

    // --- Loop ---
    let raf = 0;
    let running = true;
    let last = performance.now();
    let elapsed = 0;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      // smooth mouse strength
      const mu = program.uniforms.uMouse.value as Vec2;
      mu.x += (mouseTarget.x - mu.x) * MOUSE_LERP;
      mu.y += (mouseTarget.y - mu.y) * MOUSE_LERP;
      const ms = program.uniforms.uMouseStrength;
      ms.value += (mouseTarget.strength - ms.value) * MOUSE_LERP;

      // Tint follows theme: black ink on light bg, white ink on dark bg
      const isDark = document.documentElement.classList.contains('dark');
      const tint = program.uniforms.uTint.value as Vec3;
      const target = isDark ? 1 : 0;
      tint.x += (target - tint.x) * 0.1;
      tint.y = tint.x;
      tint.z = tint.x;

      program.uniforms.uTime.value = elapsed;
      renderer.render({ scene: mesh });
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
      }
      try {
        const loseExt = glCtx.getExtension('WEBGL_lose_context');
        loseExt?.loseContext();
      } catch { /* noop */ }
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [variant]);

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
        mixBlendMode: 'normal',
      }}
    />
  );
}
