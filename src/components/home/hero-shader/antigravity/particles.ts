/**
 * Particles unit — owns the GPGPU sim+render programs and ping-pong FBOs.
 * Built clean from the antigravity `landing-main-particles-component` reference.
 *
 * Source-of-truth values live in ./config.ts (ANTIGRAV_CONFIG).
 *
 * Public API:
 *   const particles = createParticles(gl, { aspect, isMobile, reduceMotion });
 *   particles.resize(aspect);
 *   particles.step({ dt, time, mouse, hover, isDark });
 *   particles.dispose();
 */
import { Program, Mesh, Triangle, Geometry, RenderTarget, Vec2, Texture, type OGLRenderingContext } from 'ogl';
import { SIM_VERTEX, SIM_FRAGMENT, RENDER_VERTEX, RENDER_FRAGMENT } from './shaders';
import {
  ANTIGRAV_CONFIG,
  ANTIGRAV_DPR_CAP,
  ANTIGRAV_MOBILE_TEX,
  ANTIGRAV_MOBILE_INTENSITY,
} from './config';

interface CreateOpts {
  aspect: number;
  isMobile: boolean;
  reduceMotion: boolean;
}

interface StepOpts {
  dt: number;
  time: number;          // seconds since start (will be * timeScale internally)
  mouse: { x: number; y: number };
  hover: number;         // 0..1
  isDark: boolean;
  pulse?: { progress: number; origin: [number, number] };
}

export interface ParticlesUnit {
  simMesh: Mesh;
  pointMesh: Mesh;
  rt: { read: RenderTarget; write: RenderTarget; swap: () => void };
  resize: (aspect: number) => void;
  step: (opts: StepOpts) => void;
  /** Bind the latest position texture to the render program before drawing. */
  syncRender: (time: number, isDark: boolean) => void;
  dispose: () => void;
}

export function createParticles(
  gl: OGLRenderingContext,
  { aspect, isMobile, reduceMotion }: CreateOpts,
): ParticlesUnit | null {
  const gl2 = gl as unknown as WebGL2RenderingContext;
  const isWebGL2 = (gl as unknown as { renderer?: { isWebgl2?: boolean } }).renderer?.isWebgl2 === true;

  if (!isWebGL2) {
    console.warn('[antigravity/particles] WebGL2 required');
    return null;
  }
  if (!gl.getExtension('EXT_color_buffer_float')) {
    console.warn('[antigravity/particles] EXT_color_buffer_float not supported');
    return null;
  }
  gl.getExtension('OES_texture_float_linear');

  // ---- Particle resolution ----
  const TEX = isMobile ? ANTIGRAV_MOBILE_TEX : ANTIGRAV_CONFIG.textureSize;
  const PARTICLE_COUNT = TEX * TEX;

  // ---- Init: scatter particles across the WHOLE hero, with a soft quiet
  //       zone around the centered text/card. Rejection-sample so the quiet
  //       region has lower (not zero) density.
  const initData = new Float32Array(PARTICLE_COUNT * 4);
  const qR = ANTIGRAV_CONFIG.quietCenterRadius;
  const qS = ANTIGRAV_CONFIG.quietSoftness;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let x = 0, y = 0;
    // Up to 4 tries; otherwise accept anyway (keeps count exact)
    for (let t = 0; t < 4; t++) {
      x = (Math.random() * 2 - 1) * aspect;
      y = Math.random() * 2 - 1;
      // Distance to center in NDC.y units (aspect-normalized x)
      const d = Math.hypot(x / aspect, y);
      // Probability of keeping increases with distance from center
      const keep = Math.min(1, Math.max(0.05, (d - qR) / qS + 0.5));
      if (Math.random() < keep) break;
    }
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
    internalFormat: gl2.RGBA32F,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
    minFilter: gl.NEAREST,
    magFilter: gl.NEAREST,
    flipY: false,
    generateMipmaps: false,
  });

  const rtOpts = {
    width: TEX,
    height: TEX,
    type: gl.FLOAT,
    format: gl.RGBA,
    internalFormat: gl2.RGBA32F,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
    minFilter: gl.NEAREST,
    magFilter: gl.NEAREST,
    depth: false,
    stencil: false,
  };
  let rtRead = new RenderTarget(gl, rtOpts);
  let rtWrite = new RenderTarget(gl, rtOpts);

  // Seed rtRead with initData
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

  // ---- Sim program ----
  const simProgram = new Program(gl, {
    vertex: SIM_VERTEX,
    fragment: SIM_FRAGMENT,
    uniforms: {
      uPrevPos:          { value: rtRead.texture },
      uTime:             { value: 0 },
      uDelta:            { value: 1 / 60 },
      uMousePos:         { value: new Vec2(0, 0) },
      uIsHovering:       { value: 0 },
      uMouseRadius:      { value: ANTIGRAV_CONFIG.mouseRadius },
      uMouseForce:       { value: ANTIGRAV_CONFIG.mouseForce },
      uPulseProgress:    { value: 0 },
      uPulseOrigin:      { value: new Vec2(0, 0) },
      uPulseRadius:      { value: ANTIGRAV_CONFIG.pulseRadius },
      uRingRadius:       { value: ANTIGRAV_CONFIG.ringRadius },
      uRingWidth:        { value: ANTIGRAV_CONFIG.ringWidth },
      uRingWidth2:       { value: ANTIGRAV_CONFIG.ringWidth2 },
      uRingDisplacement: { value: ANTIGRAV_CONFIG.ringDisplacement },
      uAspect:           { value: aspect },
      uSeed:             { value: Math.random() * 100 },
    },
  });
  const simMesh = new Mesh(gl, { geometry: new Triangle(gl), program: simProgram });

  // ---- Render program ----
  const refs = new Float32Array(PARTICLE_COUNT * 2);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    refs[i * 2 + 0] = (i % TEX) / TEX + 0.5 / TEX;
    refs[i * 2 + 1] = Math.floor(i / TEX) / TEX + 0.5 / TEX;
  }
  const pointGeo = new Geometry(gl, { aRef: { size: 2, data: refs } });

  const intensity = ANTIGRAV_CONFIG.intensity * (isMobile ? ANTIGRAV_MOBILE_INTENSITY : 1);
  const renderProgram = new Program(gl, {
    vertex: RENDER_VERTEX,
    fragment: RENDER_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uPositionTex:    { value: rtRead.texture },
      uPointSize:      { value: ANTIGRAV_CONFIG.pointSize },
      uParticlesScale: { value: ANTIGRAV_CONFIG.particlesScale },
      uDpr:            { value: Math.min(window.devicePixelRatio || 1, ANTIGRAV_DPR_CAP) },
      uAspect:         { value: aspect },
      uTime:           { value: 0 },
      uIntensity:      { value: intensity },
      uIsDark:         { value: 0 },
    },
  });
  const pointMesh = new Mesh(gl, { geometry: pointGeo, program: renderProgram, mode: gl.POINTS });

  // Sanity: check link succeeded
  for (const [name, p] of [
    ['seedProgram', seedProgram],
    ['simProgram', simProgram],
    ['renderProgram', renderProgram],
  ] as const) {
    if (!(p as unknown as { uniformLocations?: unknown }).uniformLocations) {
      console.error(`[antigravity/particles] ${name} failed to link`);
      return null;
    }
  }

  const rt = {
    get read() { return rtRead; },
    get write() { return rtWrite; },
    swap: () => { const t = rtRead; rtRead = rtWrite; rtWrite = t; },
  };

  const speedScale = reduceMotion ? 0 : 1;

  return {
    simMesh,
    pointMesh,
    rt: rt as unknown as ParticlesUnit['rt'],
    seedMesh,
    seedProgram,
    resize: (a: number) => {
      simProgram.uniforms.uAspect.value = a;
      renderProgram.uniforms.uAspect.value = a;
    },
    step: ({ dt, time, mouse, hover, pulse }) => {
      simProgram.uniforms.uPrevPos.value = rtRead.texture;
      simProgram.uniforms.uTime.value = time * ANTIGRAV_CONFIG.timeScale * speedScale;
      simProgram.uniforms.uDelta.value = dt * speedScale || 1e-4;
      (simProgram.uniforms.uMousePos.value as Vec2).set(mouse.x, mouse.y);
      simProgram.uniforms.uIsHovering.value = hover;
      simProgram.uniforms.uPulseProgress.value = pulse?.progress ?? 0;
      if (pulse) (simProgram.uniforms.uPulseOrigin.value as Vec2).set(pulse.origin[0], pulse.origin[1]);
    },
    syncRender: (time, isDark) => {
      renderProgram.uniforms.uPositionTex.value = rtRead.texture;
      renderProgram.uniforms.uTime.value = time;
      renderProgram.uniforms.uIsDark.value = isDark ? 1 : 0;
    },
    dispose: () => {
      // OGL RenderTargets don't expose explicit dispose; GC + context loss handles it.
    },
  } as ParticlesUnit & { seedMesh: Mesh; seedProgram: Program };
}
