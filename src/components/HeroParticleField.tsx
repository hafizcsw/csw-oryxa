import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Interactive Three.js particle field background.
 * 50,000 GPU points, mouse-reactive displacement, additive blending.
 * `variant` switches the particle color for light vs dark backgrounds.
 */
export default function HeroParticleField({
  className = '',
  variant = 'dark',
}: {
  className?: string;
  variant?: 'dark' | 'light';
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const width = el.clientWidth || window.innerWidth;
    const height = el.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const COUNT = 50000;
    const positions = new Float32Array(COUNT * 3);
    const offsets = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const j = i * 3;
      positions[j] = (Math.random() - 0.5) * 20;
      positions[j + 1] = (Math.random() - 0.5) * 20;
      positions[j + 2] = (Math.random() - 0.5) * 10;
      offsets[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));

    // Particle tint: soft white on dark; deep indigo on light
    const tint = variant === 'light' ? [0.15, 0.35, 0.75] : [0.85, 0.85, 0.9];
    const alphaMul = variant === 'light' ? 0.85 : 0.5;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMousePos: { value: new THREE.Vector2(0, 0) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        uniform float uTime;
        uniform vec2 uMousePos;
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
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;
          float strength = 1.0 - smoothstep(0.0, 0.5, dist);
          vec3 color = vec3(${tint[0]}, ${tint[1]}, ${tint[2]});
          gl_FragColor = vec4(color, strength * vAlpha * ${alphaMul});
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: variant === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const clock = new THREE.Clock();
    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);

    const onMouseMove = (e: MouseEvent) => {
      targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const onResize = () => {
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      mouse.x += (targetMouse.x - mouse.x) * 0.05;
      mouse.y += (targetMouse.y - mouse.y) * 0.05;
      material.uniforms.uTime.value = clock.getElapsedTime();
      material.uniforms.uMousePos.value = mouse;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, [variant]);

  return <div ref={containerRef} className={`absolute inset-0 ${className}`} aria-hidden="true" />;
}
