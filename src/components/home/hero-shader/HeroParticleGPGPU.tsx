import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Geometry, RenderTarget, Vec2, Texture } from 'ogl';
import { SIM_VERTEX, SIM_FRAGMENT } from './shaders/simulation.glsl';
import { RENDER_VERTEX, RENDER_FRAGMENT } from './shaders/render.glsl';
import {
  PRESETS, type HeroFieldVariant,
  MOBILE_TEX_SCALE, MOBILE_INTENSITY_SCALE,
  DPR_CAP, MOUSE_LERP, HOVER_LERP, PULSE_DURATION,
} from './config';

export type { HeroFieldVariant };

interface Props {
  variant?: HeroFieldVariant;
  className?: string;
}

/**
 * GPGPU particle field.
 * - Sim pass: full-screen triangle writes positions/velocities to a float FBO (ping-pong).
 * - Render pass: gl_POINTS reads positions, draws sdRoundBox capsules with theme palette.
 * Mouse: radial repulsion + smoothing. Click: ring shockwave pulse.
 */
export function HeroParticleGPGPU({ variant = 'reactive', className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const cfg = PRESETS[variant];

    // --- WebGL probe & float-texture capability ---
    const probe = document.createElement('canvas');
    const probeGl = (probe.getContext('webgl2') ||
                     probe.getContext('webgl') ||
                     probe.getContext('experimental-webgl')) as WebGL2RenderingContext | WebGLRenderingContext | null;
    if (!probeGl) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio || 1, DPR_CAP),
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        webgl: 2,
      });
    } catch (e) {
      console.error('[HeroParticleGPGPU] Renderer init failed', e);
      return;
    }

    const gl = renderer.gl;
    const gl2 = gl as unknown as WebGL2RenderingContext;
    const isWebGL2 = (gl as any).renderer?.isWebgl2 === true;

    if (!isWebGL2) {
      console.warn('[HeroParticleGPGPU] WebGL2 not available, aborting GPGPU field');
      return;
    }

    // Float color attachment support
    if (!gl.getExtension('EXT_color_buffer_float')) {
      console.warn('[HeroParticleGPGPU] EXT_color_buffer_float not supported, aborting');
      return;
    }
    gl.getExtension('OES_texture_float_linear');

    gl.clearColor(0, 0, 0, 0);

    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);

    // --- Particle resolution ---
    const baseTex = Math.floor(cfg.texSize * (isMobile ? MOBILE_TEX_SCALE : 1));
    const TEX = Math.max(32, baseTex);
    const PARTICLE_COUNT = TEX * TEX;

    // --- Init position/velocity texture data ---
    const initialAspect = Math.max(0.1, container.clientWidth / Math.max(1, container.clientHeight));
    const initData = new Float32Array(PARTICLE_COUNT * 4);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (Math.random() * 2 - 1) * initialAspect;
      const y = Math.random() * 2 - 1;
      initData[i * 4 + 0] = x;
      initData[i * 4 + 1] = y;
      initData[i * 4 + 2] = 0;
      initData[i * 4 + 3] = 0;
    }

    const initTex = new Texture(gl, {
      image: initData,
      width: TEX,
      height: TEX,
      type: gl.FLOAT,
      format: gl.RGBA,
      internalFormat: isWebGL2 ? gl2.RGBA32F : gl.RGBA,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      flipY: false,
      generateMipmaps: false,
    });

    // --- Ping-pong FBOs ---
    const rtOpts = {
      width: TEX,
      height: TEX,
      type: gl.FLOAT,
      format: gl.RGBA,
      internalFormat: isWebGL2 ? gl2.RGBA32F : gl.RGBA,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      depth: false,
      stencil: false,
    };
    let rtA = new RenderTarget(gl, rtOpts);
    let rtB = new RenderTarget(gl, rtOpts);

    // Seed rtA with initData via a one-shot copy program
    const seedProgram = new Program(gl, {
      vertex: SIM_VERTEX,
      fragment: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uSrc;
        void main(){ gl_FragColor = texture2D(uSrc, vUv); }
      `,
      uniforms: { uSrc: { value: initTex } },
    });
    const seedMesh = new Mesh(gl, { geometry: new Triangle(gl), program: seedProgram });
    renderer.render({ scene: seedMesh, target: rtA });

    // --- Sim program ---
    const simProgram = new Program(gl, {
      vertex: SIM_VERTEX,
      fragment: SIM_FRAGMENT,
      uniforms: {
        uPrevPos:       { value: rtA.texture },
        uTime:          { value: 0 },
        uDelta:         { value: 1 / 60 },
        uMousePos:      { value: new Vec2(0, 0) },
        uIsHovering:    { value: 0 },
        uPulseProgress: { value: 0 },
        uPulseOrigin:   { value: new Vec2(0, 0) },
        uMouseRadius:   { value: cfg.mouseRadius },
        uMouseForce:    { value: cfg.mouseForce },
        uPulseRadius:   { value: cfg.pulseRadius },
        uFlowStrength:  { value: cfg.flowStrength },
        uSpeed:         { value: reduceMotion ? 0 : cfg.speed },
        uAspect:        { value: initialAspect },
        uSeed:          { value: Math.random() * 100 },
      },
    });
    const simMesh = new Mesh(gl, { geometry: new Triangle(gl), program: simProgram });

    // --- Render program: per-particle aRef geometry ---
    const refs = new Float32Array(PARTICLE_COUNT * 2);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (i % TEX) / TEX + 0.5 / TEX;
      const y = Math.floor(i / TEX) / TEX + 0.5 / TEX;
      refs[i * 2 + 0] = x;
      refs[i * 2 + 1] = y;
    }
    const pointGeo = new Geometry(gl, {
      aRef: { size: 2, data: refs },
    });

    const intensity = cfg.intensity * (isMobile ? MOBILE_INTENSITY_SCALE : 1);
    const renderProgram = new Program(gl, {
      vertex: RENDER_VERTEX,
      fragment: RENDER_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPositionTex: { value: rtA.texture },
        uPointSize:   { value: cfg.pointSize },
        uDpr:         { value: Math.min(window.devicePixelRatio || 1, DPR_CAP) },
        uAspect:      { value: initialAspect },
        uTime:        { value: 0 },
        uIntensity:   { value: intensity },
        uIsDark:      { value: 0 },
      },
    });
    const pointMesh = new Mesh(gl, { geometry: pointGeo, program: renderProgram, mode: gl.POINTS });

    // --- Resize handling ---
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h);
      const a = w / h;
      simProgram.uniforms.uAspect.value = a;
      renderProgram.uniforms.uAspect.value = a;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // --- Mouse / touch ---
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

    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom
      ) { mouseTarget.hover = 0; return; }
      const [x, y] = toAspectNDC(e.clientX, e.clientY);
      mouseTarget.x = x; mouseTarget.y = y; mouseTarget.hover = 1;
    };
    const onLeave = () => { mouseTarget.hover = 0; };
    const onClick = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom
      ) return;
      pulse.origin = toAspectNDC(e.clientX, e.clientY);
      pulse.progress = 0;
      pulse.active = true;
    };

    if (mouseEnabled) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerleave', onLeave);
      window.addEventListener('pointerdown', onClick, { passive: true });
    }

    // --- Loop ---
    let raf = 0;
    let running = true;
    let last = performance.now();
    let elapsed = 0;
    const mouseSmooth = new Vec2(0, 0);
    let hoverSmooth = 0;

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      // Smooth mouse + hover
      mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * MOUSE_LERP;
      mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * MOUSE_LERP;
      hoverSmooth   += (mouseTarget.hover - hoverSmooth) * HOVER_LERP;

      // Pulse advance
      if (pulse.active) {
        pulse.progress += dt / PULSE_DURATION;
        if (pulse.progress >= 1) { pulse.progress = 0; pulse.active = false; }
      }

      // Theme
      const isDark = document.documentElement.classList.contains('dark');
      renderProgram.uniforms.uIsDark.value = isDark ? 1 : 0;

      // ---- Sim pass: read rtA, write rtB ----
      simProgram.uniforms.uPrevPos.value = rtA.texture;
      simProgram.uniforms.uTime.value = elapsed;
      simProgram.uniforms.uDelta.value = dt;
      (simProgram.uniforms.uMousePos.value as Vec2).set(mouseSmooth.x, mouseSmooth.y);
      simProgram.uniforms.uIsHovering.value = hoverSmooth;
      simProgram.uniforms.uPulseProgress.value = pulse.active ? pulse.progress : 0;
      (simProgram.uniforms.uPulseOrigin.value as Vec2).set(pulse.origin[0], pulse.origin[1]);

      renderer.render({ scene: simMesh, target: rtB });

      // Swap
      const tmp = rtA; rtA = rtB; rtB = tmp;

      // ---- Render pass to screen ----
      renderProgram.uniforms.uPositionTex.value = rtA.texture;
      renderProgram.uniforms.uTime.value = elapsed;
      renderer.render({ scene: pointMesh });

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
