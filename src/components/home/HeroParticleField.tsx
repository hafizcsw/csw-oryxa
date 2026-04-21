import { useEffect, useRef } from 'react';

/**
 * HeroParticleField — Antigravity-style subtle particle layer.
 * White-only, low opacity, ultra-soft non-synchronized flicker.
 * Sits above gradient, below content (caller controls z-index via wrapper).
 */
export interface ParticleFieldConfig {
  particleCount: number;
  sizeMin: number;
  sizeMax: number;
  baseOpacityMin: number;
  baseOpacityMax: number;
  flickerAmplitudeMin: number;
  flickerAmplitudeMax: number;
  flickerSpeedMinSec: number;
  flickerSpeedMaxSec: number;
  gridSpacing: number;
  jitter: number;
  drift: number;
  mouseRadius: number;
  mouseDisplacement: number;
  mouseOpacityBoost: number;
  mouseEase: number; // 0..1, higher = faster return
}

const DEFAULT_CONFIG: ParticleFieldConfig = {
  particleCount: 140,
  sizeMin: 0.8,
  sizeMax: 1.6,
  baseOpacityMin: 0.08,
  baseOpacityMax: 0.18,
  flickerAmplitudeMin: 0.02,
  flickerAmplitudeMax: 0.06,
  flickerSpeedMinSec: 3,
  flickerSpeedMaxSec: 6,
  gridSpacing: 80,
  jitter: 20,
  drift: 0.1,
  mouseRadius: 160,
  mouseDisplacement: 8,
  mouseOpacityBoost: 0.06,
  mouseEase: 0.08,
};

interface Particle {
  hx: number; // home x
  hy: number; // home y
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  flickerAmp: number;
  flickerOmega: number;
  flickerPhase: number;
  driftAngle: number;
  driftSpeed: number;
}

export function HeroParticleField({
  config: userConfig,
  className,
}: {
  config?: Partial<ParticleFieldConfig>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const configRef = useRef<ParticleFieldConfig>({ ...DEFAULT_CONFIG, ...userConfig });

  useEffect(() => {
    configRef.current = { ...DEFAULT_CONFIG, ...userConfig };
  }, [userConfig]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;

    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = 0;
    let running = true;
    let startTime = performance.now();

    const mouse = { x: -9999, y: -9999, active: false };

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const buildParticles = () => {
      const cfg = configRef.current;
      const spacing = cfg.gridSpacing * (isMobile ? 1.2 : 1);
      const cols = Math.max(1, Math.floor(width / spacing));
      const rows = Math.max(1, Math.floor(height / spacing));
      const cellW = width / cols;
      const cellH = height / rows;

      const targetCount = isMobile
        ? Math.floor(cfg.particleCount / 2)
        : cfg.particleCount;

      const arr: Particle[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (arr.length >= targetCount) break;
          const cx = c * cellW + cellW / 2 + rand(-cfg.jitter, cfg.jitter);
          const cy = r * cellH + cellH / 2 + rand(-cfg.jitter, cfg.jitter);
          arr.push({
            hx: cx,
            hy: cy,
            x: cx,
            y: cy,
            size: rand(cfg.sizeMin, cfg.sizeMax),
            baseOpacity: rand(cfg.baseOpacityMin, cfg.baseOpacityMax),
            flickerAmp: rand(cfg.flickerAmplitudeMin, cfg.flickerAmplitudeMax),
            flickerOmega:
              (Math.PI * 2) /
              rand(cfg.flickerSpeedMinSec, cfg.flickerSpeedMaxSec),
            flickerPhase: Math.random() * Math.PI * 2,
            driftAngle: Math.random() * Math.PI * 2,
            driftSpeed: rand(0.3, 1) * cfg.drift,
          });
        }
      }
      particles = arr;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(rafId);
      } else if (!running) {
        running = true;
        startTime = performance.now();
        loop(startTime);
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      const cfg = configRef.current;
      const t = (now - startTime) / 1000;

      ctx.clearRect(0, 0, width, height);

      const mouseEnabled = !isMobile && mouse.active;
      const r2 = cfg.mouseRadius * cfg.mouseRadius;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Idle drift — extremely small, slow wandering around home position
        if (!reduceMotion) {
          p.driftAngle += 0.0008;
          const dxIdle = Math.cos(p.driftAngle) * p.driftSpeed;
          const dyIdle = Math.sin(p.driftAngle) * p.driftSpeed;
          p.hx += dxIdle * 0.02;
          p.hy += dyIdle * 0.02;
        }

        // Mouse field
        let targetX = p.hx;
        let targetY = p.hy;
        let opacityBoost = 0;

        if (mouseEnabled) {
          const dx = p.hx - mouse.x;
          const dy = p.hy - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2 && d2 > 0) {
            const d = Math.sqrt(d2);
            const falloff = 1 - d / cfg.mouseRadius; // 0..1
            const push = falloff * cfg.mouseDisplacement;
            targetX = p.hx + (dx / d) * push;
            targetY = p.hy + (dy / d) * push;
            opacityBoost = falloff * cfg.mouseOpacityBoost;
          }
        }

        // Ease toward target (smooth return when mouse leaves)
        p.x += (targetX - p.x) * cfg.mouseEase;
        p.y += (targetY - p.y) * cfg.mouseEase;

        // Flicker — sine wave with per-particle phase/freq → non-synchronized
        const flicker = reduceMotion
          ? 0
          : Math.sin(t * p.flickerOmega + p.flickerPhase) * p.flickerAmp;

        const alpha = Math.max(0, Math.min(1, p.baseOpacity + flicker + opacityBoost));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (!isMobile) {
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('mouseleave', onLeave);
    }
    document.addEventListener('visibilitychange', onVisibility);

    rafId = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
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
