import { useEffect, useRef } from 'react';

/**
 * HeroParticleField — Antigravity-style grid field.
 * Thin white grid lines + intersection dots that breathe and react to mouse.
 * No scattered particles. Sits above gradient, below content.
 */
export interface GridFieldConfig {
  gridSpacing: number;
  lineOpacity: number;
  dotOpacityMin: number;
  dotOpacityMax: number;
  dotRadius: number;
  mouseRadius: number;
  mouseOpacityBoost: number;
  mouseDisplacement: number;
  mouseEase: number;
  breatheAmplitude: number;
  breatheSpeedSec: number;
}

const DEFAULT_CONFIG: GridFieldConfig = {
  gridSpacing: 64,
  lineOpacity: 0.05,
  dotOpacityMin: 0.10,
  dotOpacityMax: 0.18,
  dotRadius: 1.2,
  mouseRadius: 220,
  mouseOpacityBoost: 0.12,
  mouseDisplacement: 3,
  mouseEase: 0.06,
  breatheAmplitude: 0.01,
  breatheSpeedSec: 8,
};

interface Dot {
  hx: number;
  hy: number;
  x: number;
  y: number;
  baseOpacity: number;
}

export function HeroParticleField({
  config: userConfig,
  className,
}: {
  config?: Partial<GridFieldConfig>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const configRef = useRef<GridFieldConfig>({ ...DEFAULT_CONFIG, ...userConfig });

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

    let dots: Dot[] = [];
    let cols: number[] = []; // x positions of vertical lines
    let rows: number[] = []; // y positions of horizontal lines
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = 0;
    let running = true;
    let startTime = performance.now();

    const mouse = { x: -9999, y: -9999, active: false };

    const buildGrid = () => {
      const cfg = configRef.current;
      const spacing = cfg.gridSpacing * (isMobile ? 1.15 : 1);

      cols = [];
      rows = [];
      const nCols = Math.ceil(width / spacing) + 1;
      const nRows = Math.ceil(height / spacing) + 1;
      // Center the grid so it feels intentional
      const offsetX = (width - (nCols - 1) * spacing) / 2;
      const offsetY = (height - (nRows - 1) * spacing) / 2;

      for (let c = 0; c < nCols; c++) cols.push(offsetX + c * spacing);
      for (let r = 0; r < nRows; r++) rows.push(offsetY + r * spacing);

      const arr: Dot[] = [];
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < cols.length; c++) {
          const x = cols[c];
          const y = rows[r];
          arr.push({
            hx: x,
            hy: y,
            x,
            y,
            baseOpacity:
              cfg.dotOpacityMin +
              Math.random() * (cfg.dotOpacityMax - cfg.dotOpacityMin),
          });
        }
      }
      dots = arr;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
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
        rafId = requestAnimationFrame(loop);
      }
    };

    // Draw a horizontal line with mouse-aware opacity falloff via segmenting
    const drawLineWithMouse = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      baseAlpha: number,
      mouseEnabled: boolean,
      cfg: GridFieldConfig,
    ) => {
      if (!mouseEnabled) {
        ctx.strokeStyle = `rgba(255,255,255,${baseAlpha})`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return;
      }

      // Segment line every ~24px and modulate alpha per segment
      const isHoriz = y1 === y2;
      const len = isHoriz ? x2 - x1 : y2 - y1;
      const seg = 24;
      const steps = Math.max(1, Math.ceil(len / seg));
      const r2 = cfg.mouseRadius * cfg.mouseRadius;

      for (let i = 0; i < steps; i++) {
        const t1 = i / steps;
        const t2 = (i + 1) / steps;
        const sx1 = isHoriz ? x1 + len * t1 : x1;
        const sx2 = isHoriz ? x1 + len * t2 : x1;
        const sy1 = isHoriz ? y1 : y1 + len * t1;
        const sy2 = isHoriz ? y1 : y1 + len * t2;

        const mx = (sx1 + sx2) / 2;
        const my = (sy1 + sy2) / 2;
        const dx = mx - mouse.x;
        const dy = my - mouse.y;
        const d2 = dx * dx + dy * dy;

        let alpha = baseAlpha;
        if (d2 < r2) {
          const falloff = 1 - Math.sqrt(d2) / cfg.mouseRadius;
          alpha = baseAlpha + falloff * cfg.mouseOpacityBoost;
        }

        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      const cfg = configRef.current;
      const t = (now - startTime) / 1000;

      ctx.clearRect(0, 0, width, height);

      // Idle breathing — global subtle alpha modulation
      const breathe = reduceMotion
        ? 0
        : Math.sin((t * Math.PI * 2) / cfg.breatheSpeedSec) * cfg.breatheAmplitude;

      const mouseEnabled = !isMobile && !reduceMotion && mouse.active;
      const r2 = cfg.mouseRadius * cfg.mouseRadius;
      const lineAlpha = Math.max(0, cfg.lineOpacity + breathe);

      ctx.lineWidth = 1;

      // Vertical lines
      for (let c = 0; c < cols.length; c++) {
        const x = cols[c];
        drawLineWithMouse(x, 0, x, height, lineAlpha, mouseEnabled, cfg);
      }
      // Horizontal lines
      for (let r = 0; r < rows.length; r++) {
        const y = rows[r];
        drawLineWithMouse(0, y, width, y, lineAlpha, mouseEnabled, cfg);
      }

      // Intersection dots — with displacement + opacity boost near mouse
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];

        let targetX = d.hx;
        let targetY = d.hy;
        let alpha = d.baseOpacity + breathe;

        if (mouseEnabled) {
          const dx = d.hx - mouse.x;
          const dy = d.hy - mouse.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < r2 && dist2 > 0) {
            const dist = Math.sqrt(dist2);
            const falloff = 1 - dist / cfg.mouseRadius;
            const push = falloff * cfg.mouseDisplacement;
            targetX = d.hx + (dx / dist) * push;
            targetY = d.hy + (dy / dist) * push;
            alpha += falloff * cfg.mouseOpacityBoost;
          }
        }

        d.x += (targetX - d.x) * cfg.mouseEase;
        d.y += (targetY - d.y) * cfg.mouseEase;

        alpha = Math.max(0, Math.min(1, alpha));
        ctx.beginPath();
        ctx.arc(d.x, d.y, cfg.dotRadius, 0, Math.PI * 2);
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
