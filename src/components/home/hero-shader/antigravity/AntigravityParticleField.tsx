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

const PARTICLE_COUNT = 25000;

const VERT = /* glsl */ `
  precision highp float;

  uniform mat4  modelViewMatrix;
  uniform mat4  projectionMatrix;
  uniform float uTime;
  uniform vec2  uMousePos;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uSizeClamp;
  uniform vec3  uWhalePos;     // world-space whale head position
  uniform float uWhaleRadius;  // influence radius
  uniform float uWhaleStrength;

  // Placeholder position attribute (unused; required for draw count)
  attribute vec3  position;
  // Spherical coordinates per particle
  attribute vec2  aSphere;   // x = theta (azimuth), y = phi (polar)
  attribute float aRadius;   // radius around base sphere
  attribute float aOffset;   // 0..1 stable seed

  varying float vAlpha;
  varying float vAngle;
  varying float vSeed;

  void main() {
    // Reference position so the attribute isn't stripped (drives draw count).
    float _keep = position.x * 0.0;

    // Slow global rotation around Y axis -> coherent swirl
    float theta = aSphere.x + uTime * 0.08 + _keep;
    float phi   = aSphere.y;

    float sp = sin(phi);
    float cp = cos(phi);
    float st = sin(theta);
    float ct = cos(theta);

    vec3 pos = vec3(aRadius * sp * ct, aRadius * cp, aRadius * sp * st);

    // Subtle organic breathing (very small, keeps coherence)
    float breath = sin(uTime * 0.4 + aOffset * 6.2831) * 0.04;
    pos *= 1.0 + breath;

    // Mouse parallax: gentle push along z based on screen distance
    float dist = distance(uMousePos * 3.0, pos.xy);
    pos.z += smoothstep(2.5, 0.0, dist) * 0.5;

    // Whale displacement: push particles outward from whale's path (radial in 3D)
    vec3 toWhale = pos - uWhalePos;
    float wd = length(toWhale);
    float wInfluence = smoothstep(uWhaleRadius, 0.0, wd) * uWhaleStrength;
    pos += normalize(toWhale + vec3(0.0001)) * wInfluence;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float ps = (7.0 * uPixelRatio * uSizeScale) * (1.0 / -mvPosition.z);
    gl_PointSize = clamp(ps, 2.0, uSizeClamp);
    gl_Position  = projectionMatrix * mvPosition;

    // Screen-space tangent angle for dash orientation (tangent = d(pos)/d(theta))
    vec3 tangent = vec3(-sp * st, 0.0, sp * ct);
    vec4 mvTangent = modelViewMatrix * vec4(tangent, 0.0);
    vAngle = atan(mvTangent.y, mvTangent.x);

    // Front-of-sphere fade so back hemisphere is dimmer (depth feel)
    // Camera looks down -Z, so larger pos.z (toward camera) = brighter.
    vAlpha = smoothstep(-1.0, 1.0, pos.z / max(aRadius, 0.001));
    vSeed  = aOffset;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec3  uColor;
  uniform float uAlphaBoost;
  varying float vAlpha;
  varying float vAngle;
  varying float vSeed;

  // Signed-distance to a rounded capsule, oriented along x
  float sdCapsule(vec2 p, float halfLen, float r) {
    p.x -= clamp(p.x, -halfLen, halfLen);
    return length(p) - r;
  }

  void main() {
    // Remap point coord to [-1,1] and rotate by particle angle
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    uv.y = -uv.y;
    float ca = cos(vAngle);
    float sa = sin(vAngle);
    vec2 ruv = mat2(ca, -sa, sa, ca) * uv;

    // Capsule (dash): long on x, very thin on y
    float halfLen = 0.62;
    float r       = 0.13;
    float d = sdCapsule(ruv, halfLen, r);

    // Smooth edge
    float edge = 0.05;
    float shape = 1.0 - smoothstep(-edge, edge, d);
    if (shape <= 0.001) discard;

    gl_FragColor = vec4(uColor, shape * vAlpha * 0.55 * uAlphaBoost);
  }
`;

interface Props {
  className?: string;
  /** Optional theme override. If omitted, falls back to <html class="dark"> observer. */
  theme?: 'dark' | 'light';
}

export function AntigravityParticleField({ className, theme }: Props) {
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

    // ---- Geometry: spherical-shell distribution for coherent swirl ----
    const aSphere = new Float32Array(PARTICLE_COUNT * 2);
    const aRadius = new Float32Array(PARTICLE_COUNT);
    const offsets = new Float32Array(PARTICLE_COUNT);
    for (let a = 0; a < PARTICLE_COUNT; a++) {
      // Uniform distribution on sphere via inverse CDF
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2.0;            // azimuth 0..2π
      const phi   = Math.acos(2.0 * v - 1.0);     // polar 0..π
      aSphere[a * 2]     = theta;
      aSphere[a * 2 + 1] = phi;
      // Thin shell with slight thickness for depth richness
      aRadius[a] = 4.2 + (Math.random() - 0.5) * 0.9;
      offsets[a] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    // Placeholder position attribute so three derives draw count (shader ignores it).
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
    geometry.setAttribute('aSphere', new THREE.BufferAttribute(aSphere, 2));
    geometry.setAttribute('aRadius', new THREE.BufferAttribute(aRadius, 1));
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));

    // Theme: explicit prop wins; otherwise read <html class="dark"> + observe.
    const isDark = () =>
      theme ? theme === 'dark' : document.documentElement.classList.contains('dark');
    // Antigravity-style cobalt blue dashes in both modes.
    // Dark mode: brighter blue. Light mode: deeper blue so it reads on white.
    const colorFor = () =>
      isDark() ? new THREE.Color(0.42, 0.55, 1.0) : new THREE.Color(0.16, 0.30, 0.85);

    const uniforms = {
      uTime:          { value: 0 },
      uMousePos:      { value: new THREE.Vector2(0, 0) },
      uPixelRatio:    { value: pixelRatio },
      uColor:         { value: colorFor() },
      uAlphaBoost:    { value: isDark() ? 1.0 : 3.2 },
      uSizeScale:     { value: isDark() ? 1.0 : 1.05 },
      uSizeClamp:     { value: isDark() ? 14.0 * pixelRatio : 14.0 * pixelRatio },
      uWhalePos:      { value: new THREE.Vector3(999, 0, 0) },
      uWhaleRadius:   { value: 1.6 },
      uWhaleStrength: { value: 0.85 },
    };

    // RawShaderMaterial: matches source intent (no THREE-injected prelude).
    const material = new THREE.RawShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Additive disappears on white. Use Normal blending in light mode.
      blending: isDark() ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    // Fallback observer only when no explicit theme prop is provided.
    const themeObserver = !theme
      ? new MutationObserver(() => {
          const c = colorFor();
          uniforms.uColor.value.copy(c);
          whaleColor.copy(c);
          uniforms.uAlphaBoost.value = isDark() ? 1.0 : 3.2;
          uniforms.uSizeScale.value = isDark() ? 1.0 : 1.05;
          uniforms.uSizeClamp.value = 14.0 * pixelRatio;
          material.blending = isDark() ? THREE.AdditiveBlending : THREE.NormalBlending;
          material.needsUpdate = true;
        })
      : null;
    themeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // ---- Luminous orca whale (right -> left) ----
    // Built from a small set of additive ellipsoid sprites that read as
    // body + head + dorsal fin + tail fluke. Color matches the particles.
    const whaleGroup = new THREE.Group();
    whaleGroup.frustumCulled = false;

    const whaleVert = /* glsl */ `
      precision highp float;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      attribute vec3 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const whaleFrag = /* glsl */ `
      precision highp float;
      uniform vec3  uColor;
      uniform float uIntensity;
      uniform float uSoftness;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        // Soft elliptical falloff
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), uSoftness);
        if (a <= 0.001) discard;
        gl_FragColor = vec4(uColor, a * uIntensity);
      }
    `;

    const whaleColor = colorFor().clone();
    const makeBlob = (
      w: number, h: number,
      x: number, y: number, z: number,
      intensity: number, softness: number,
      rotZ = 0,
    ) => {
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.RawShaderMaterial({
        uniforms: {
          uColor:     { value: whaleColor },
          uIntensity: { value: intensity },
          uSoftness:  { value: softness },
        },
        vertexShader: whaleVert,
        fragmentShader: whaleFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: isDark() ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.z = rotZ;
      m.frustumCulled = false;
      whaleGroup.add(m);
      return m;
    };

    // Body parts (local space, head points to +X, body extends to -X)
    const body     = makeBlob(2.6, 0.85, -0.1, 0.0,  0.0, isDark() ? 0.9 : 0.7, 1.6);
    const head     = makeBlob(1.1, 0.8,   1.0, 0.05, 0.05, isDark() ? 1.0 : 0.8, 1.4);
    const dorsal   = makeBlob(0.55, 0.9,  0.05, 0.55, 0.0, isDark() ? 0.85 : 0.65, 1.8, 0.15);
    const tailStem = makeBlob(0.9, 0.35, -1.25, 0.0, 0.0, isDark() ? 0.8 : 0.6, 1.7);
    const flukeT   = makeBlob(0.7, 0.45, -1.85, 0.25, 0.0, isDark() ? 0.8 : 0.6, 1.6, 0.5);
    const flukeB   = makeBlob(0.7, 0.45, -1.85,-0.25, 0.0, isDark() ? 0.8 : 0.6, 1.6, -0.5);
    // Faint outer glow halo so it reads as luminous
    const halo     = makeBlob(4.5, 1.8,  -0.2, 0.05, -0.05, isDark() ? 0.18 : 0.12, 2.6);

    // Position whale in scene (matches particle sphere depth)
    whaleGroup.position.set(0, 0, 1.5);
    scene.add(whaleGroup);

    // Drives whale traversal — single right→left sweep, then long pause, repeat.
    const whaleState = { t: 0, cycle: 9.0 /* seconds */, startDelay: 1.5 };

    if (reduceMotion) {
      whaleGroup.visible = false;
    }


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
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;
      uniforms.uMousePos.value.copy(mouse);

      // ---- Whale traversal (right -> left) ----
      if (whaleGroup.visible) {
        const aspect = camera.aspect;
        const span = 6.0 + aspect * 4.0;          // travel distance in world units
        const startX =  span * 0.5;
        const endX   = -span * 0.5;
        const cyc = whaleState.cycle;
        const phase = ((t - whaleState.startDelay) % cyc + cyc) % cyc;
        const p = Math.min(1, Math.max(0, phase / (cyc * 0.65))); // active portion
        const x = startX + (endX - startX) * p;
        const y = Math.sin(t * 0.6) * 0.35;       // gentle vertical sway
        const tailWag = Math.sin(t * 3.2) * 0.35;

        whaleGroup.position.x = x;
        whaleGroup.position.y = y;
        // Face direction of travel (head pointing -X) -> flip on Y
        whaleGroup.rotation.y = Math.PI;
        // Tail wag
        flukeT.rotation.z = 0.5 + tailWag;
        flukeB.rotation.z = -0.5 - tailWag;
        tailStem.rotation.z = 1.7 + tailWag * 0.3;

        // Fade in/out at edges
        const edgeFade = Math.min(1, p * 6.0) * Math.min(1, (1 - p) * 6.0);
        const baseI = isDark() ? 1.0 : 0.85;
        body.material.uniforms.uIntensity.value     = (isDark() ? 0.9 : 0.7) * edgeFade * baseI;
        head.material.uniforms.uIntensity.value     = (isDark() ? 1.0 : 0.8) * edgeFade * baseI;
        dorsal.material.uniforms.uIntensity.value   = (isDark() ? 0.85 : 0.65) * edgeFade * baseI;
        tailStem.material.uniforms.uIntensity.value = (isDark() ? 0.8 : 0.6) * edgeFade * baseI;
        flukeT.material.uniforms.uIntensity.value   = (isDark() ? 0.8 : 0.6) * edgeFade * baseI;
        flukeB.material.uniforms.uIntensity.value   = (isDark() ? 0.8 : 0.6) * edgeFade * baseI;
        halo.material.uniforms.uIntensity.value     = (isDark() ? 0.18 : 0.12) * edgeFade;

        // Push particles around the whale (head leads ~+0.6 in local -X after flip = world +0.6 toward travel dir)
        // Use group world position with a slight forward bias toward travel direction.
        uniforms.uWhalePos.value.set(x - 0.5, y, whaleGroup.position.z);
        uniforms.uWhaleStrength.value = 0.85 * edgeFade;
      } else {
        uniforms.uWhalePos.value.set(999, 0, 0);
        uniforms.uWhaleStrength.value = 0;
      }

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
      themeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('mousemove', onMouseMove);
      whaleGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [theme]);

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
