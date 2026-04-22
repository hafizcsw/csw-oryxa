/**
 * Particles builder — faithful to antigravity.google source.
 *
 * Pipeline:
 *  1. PoissonDiskSampling generates `pointsBase` across [worldExtent*2]^2.
 *  2. Pad/truncate to size*size into `pointsData` (vec3, z=0).
 *  3. `nearestPointsData` is image-driven: render abstract sine-wave grid
 *     into Canvas2D, extract bright pixels as targets, for each base point
 *     find nearest target → hover destination.
 *  4. createDataTexturePosition() packs into size×size RGBA Float texture
 *     (verbatim from source).
 */
import * as THREE from 'three';
import PoissonDiskSampling from 'poisson-disk-sampling';
import { PARTICLE_VERTEX, PARTICLE_FRAGMENT } from './shaders';
import { ANTIGRAV_CONFIG } from './config';

type Vec3 = [number, number, number];

function createDataTexturePosition(points: (Vec3 | null)[], size: number): THREE.DataTexture {
  const e = size * size;
  const t = new Float32Array(e * 4);
  for (let i = 0; i < e; i++) {
    const r = points[i];
    if (r) {
      t[i * 4]     = r[0];
      t[i * 4 + 1] = r[1];
      t[i * 4 + 2] = r[2] || 0;
    } else {
      t[i * 4]     = 0;
      t[i * 4 + 1] = 0;
      t[i * 4 + 2] = -1e4;
    }
    t[i * 4 + 3] = 1;
  }
  const tex = new THREE.DataTexture(t, size, size, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  return tex;
}

function generatePointsBase(density: number, worldExtent: number): Vec3[] {
  const shape = [worldExtent * 2, worldExtent * 2];
  // Pick minDistance so sample count ≈ density.
  const minDistance = Math.sqrt((shape[0] * shape[1]) / (density * 0.7));
  const pds = new PoissonDiskSampling({
    shape,
    minDistance,
    maxDistance: minDistance * 1.6,
    tries: 20,
  });
  const raw = pds.fill() as number[][];
  return raw.map(([x, y]) => [x - worldExtent, y - worldExtent, 0] as Vec3);
}

function generateNearestPoints(pointsBase: Vec3[], worldExtent: number): Vec3[] {
  const W = 256;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 8; row++) {
    const y0 = (row + 0.5) * (H / 8);
    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) {
      const y = y0 + Math.sin((x / W) * Math.PI * 4 + row * 0.6) * 8;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let col = 0; col < 8; col++) {
    const x0 = (col + 0.5) * (W / 8);
    ctx.beginPath();
    for (let y = 0; y <= H; y += 2) {
      const x = x0 + Math.sin((y / H) * Math.PI * 4 + col * 0.6) * 8;
      if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const img = ctx.getImageData(0, 0, W, H).data;
  const targets: Vec3[] = [];
  for (let y = 0; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      const i = (y * W + x) * 4;
      if (img[i] > 128) {
        const wx = (x / W) * 2 * worldExtent - worldExtent;
        const wy = -((y / H) * 2 * worldExtent - worldExtent);
        targets.push([wx, wy, 0]);
      }
    }
  }
  if (targets.length === 0) return pointsBase.slice();

  return pointsBase.map(([bx, by]) => {
    let best = targets[0];
    let bestD = Infinity;
    for (let i = 0; i < targets.length; i++) {
      const dx = targets[i][0] - bx;
      const dy = targets[i][1] - by;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = targets[i]; }
    }
    return best;
  });
}

export interface ParticleSystem {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  uniforms: Record<string, { value: unknown }>;
  dispose: () => void;
}

export function createParticleSystem(opts: { color: THREE.Color }): ParticleSystem {
  const { size, density, particlesScale, ringWidth, ringWidth2, ringDisplacement, worldHalfExtent } = ANTIGRAV_CONFIG;

  const base = generatePointsBase(density, worldHalfExtent);
  const total = size * size;
  const pointsData: (Vec3 | null)[] = new Array(total).fill(null);
  for (let i = 0; i < total; i++) pointsData[i] = base[i % base.length] ?? null;

  const baseFilled = pointsData.filter(Boolean) as Vec3[];
  const nearestRaw = generateNearestPoints(baseFilled, worldHalfExtent);
  const nearestData: (Vec3 | null)[] = new Array(total).fill(null);
  for (let i = 0; i < total; i++) nearestData[i] = nearestRaw[i % nearestRaw.length] ?? null;

  const posTex = createDataTexturePosition(pointsData, size);
  const posNearestTex = createDataTexturePosition(nearestData, size);

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(total * 3);
  const references = new Float32Array(total * 2);
  for (let i = 0; i < total; i++) {
    references[i * 2]     = (i % size) / size + 0.5 / size;
    references[i * 2 + 1] = Math.floor(i / size) / size + 0.5 / size;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('reference', new THREE.BufferAttribute(references, 2));

  const uniforms = {
    uTime:             { value: 0 },
    uDeltaTime:        { value: 0 },
    uMousePos:         { value: new THREE.Vector3(999, 999, 0) },
    uIsHovering:       { value: 0 },
    uPosTex:           { value: posTex },
    uPosNearestTex:    { value: posNearestTex },
    uRingRadius:       { value: 0.175 },
    uRingWidth:        { value: ringWidth },
    uRingWidth2:       { value: ringWidth2 },
    uRingDisplacement: { value: ringDisplacement },
    uPointScale:       { value: particlesScale },
    uRingOpacity:      { value: 1.0 },
    uColor:            { value: opts.color },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERTEX,
    fragmentShader: PARTICLE_FRAGMENT,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    material,
    uniforms,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      posTex.dispose();
      posNearestTex.dispose();
    },
  };
}
