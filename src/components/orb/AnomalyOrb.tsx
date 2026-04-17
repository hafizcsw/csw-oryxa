import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { useTheme } from "next-themes";
import "@/styles/anomaly-orb.css";

export type OrbColors = {
  color1: string;
  color2: string;
  color3: string;
};

type Props = {
  /** show debug UI panels (controls/terminal/spectrum) */
  debug?: boolean;
  className?: string;
  size?: number; // px
  /** External audio level (0-1) for reactivity */
  audioLevel?: number;
  /** Distortion intensity (0-3) */
  distortion?: number;
  /** Pulse speed multiplier */
  pulseSpeed?: number;
  /** Custom colors (hex strings) */
  customColors?: OrbColors;
};

// Vertex shader - displaces vertices based on noise and audio
const vertexShader = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uDistortion;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;
  
  // Simplex noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    
    // Create displacement based on noise and audio
    float noise1 = snoise(position * 2.0 + uTime * 0.3);
    float noise2 = snoise(position * 4.0 - uTime * 0.5);
    float noise3 = snoise(position * 1.0 + uTime * 0.2);
    
    // Audio-reactive displacement
    float audioBoost = 1.0 + uAudioLevel * 2.0;
    float displacement = (noise1 * 0.3 + noise2 * 0.15 + noise3 * 0.1) * uDistortion * audioBoost;
    
    // Apply displacement along normal
    vec3 newPosition = position + normal * displacement * 0.15;
    
    vDisplacement = displacement;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// Fragment shader - creates the glowing plasma effect
const fragmentShader = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uPulseSpeed;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplacement;
  
  void main() {
    // Fresnel effect for edge glow
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
    
    // Color mixing based on displacement and time
    float colorMix1 = sin(vDisplacement * 10.0 + uTime * uPulseSpeed) * 0.5 + 0.5;
    float colorMix2 = cos(vDisplacement * 8.0 - uTime * uPulseSpeed * 0.7) * 0.5 + 0.5;
    
    // Base color gradient
    vec3 baseColor = mix(uColor1, uColor2, colorMix1);
    baseColor = mix(baseColor, uColor3, colorMix2 * 0.5);
    
    // Audio-reactive color intensity
    float audioGlow = 1.0 + uAudioLevel * 1.5;
    
    // Core glow
    float core = pow(1.0 - fresnel, 2.0);
    vec3 coreColor = vec3(1.0) * core * 0.3;
    
    // (Disabled) Edge glow to remove halo around the sphere
    vec3 edgeGlow = vec3(0.0);
    
    // Combine all effects
    vec3 finalColor = baseColor * audioGlow + coreColor + edgeGlow;
    
    // Pulsing effect
    float pulse = 0.9 + 0.1 * sin(uTime * uPulseSpeed * 2.0 + uAudioLevel * 10.0);
    finalColor *= pulse;
    
    // Fully opaque to avoid any shadow/halo artifacts
    float alpha = 1.0;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function AnomalyOrb({ 
  debug = false, 
  className = "", 
  size = 380, 
  audioLevel = 0,
  distortion = 1.0,
  pulseSpeed = 1.0,
  customColors,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  
  // Theme detection
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Convert custom colors from hex string or use theme colors
  const getColorValue = (customHex: string | undefined, themeDefault: number): number => {
    if (customHex) {
      return parseInt(customHex.replace("#", ""), 16);
    }
    return themeDefault;
  };

  // Theme-based colors as defaults
  const themeDefaults = isDark
    ? {
        color1: 0x00ffff, // Cyan
        color2: 0x8b5cf6, // Purple
        color3: 0x0ea5e9, // Sky blue
      }
    : {
        color1: 0x1e3a5f, // Navy blue
        color2: 0x6366f1, // Indigo
        color3: 0x3b82f6, // Blue
      };

  const activeColors = {
    color1: getColorValue(customColors?.color1, themeDefaults.color1),
    color2: getColorValue(customColors?.color2, themeDefaults.color2),
    color3: getColorValue(customColors?.color3, themeDefaults.color3),
  };

  // Internal audio analysis state
  const [internalAudioLevel, setInternalAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Simulated audio level for demo (when no real audio)
  const [simulatedLevel, setSimulatedLevel] = useState(0);

  // Use external audioLevel if provided, otherwise use internal or simulated
  const effectiveAudioLevel =
    audioLevel > 0
      ? audioLevel
      : internalAudioLevel > 0
        ? internalAudioLevel
        : simulatedLevel;

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = size;
    const height = size;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 3;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Shader material with custom/theme colors
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uAudioLevel: { value: 0 },
        uDistortion: { value: distortion },
        uPulseSpeed: { value: pulseSpeed },
        uColor1: { value: new THREE.Color(activeColors.color1) },
        uColor2: { value: new THREE.Color(activeColors.color2) },
        uColor3: { value: new THREE.Color(activeColors.color3) },
      },
      transparent: false,
      side: THREE.FrontSide,
    });
    materialRef.current = material;

    // Sphere geometry with high detail
    const geometry = new THREE.IcosahedronGeometry(1, 64);
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    sphereRef.current = sphere;

    // Animation loop
    const animate = () => {
      const elapsedTime = clockRef.current.getElapsedTime();

      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = elapsedTime;
        materialRef.current.uniforms.uAudioLevel.value = effectiveAudioLevel;
      }

      if (sphereRef.current) {
        // Slow rotation
        sphereRef.current.rotation.y = elapsedTime * 0.1;
        sphereRef.current.rotation.x = Math.sin(elapsedTime * 0.05) * 0.1;

        // Audio-reactive scale
        const scale = 1 + effectiveAudioLevel * 0.15;
        sphereRef.current.scale.setScalar(scale);
      }

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [size, activeColors.color1, activeColors.color2, activeColors.color3, distortion, pulseSpeed]);

  // Update colors/distortion/pulseSpeed when props change
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uColor1.value = new THREE.Color(activeColors.color1);
      materialRef.current.uniforms.uColor2.value = new THREE.Color(activeColors.color2);
      materialRef.current.uniforms.uColor3.value = new THREE.Color(activeColors.color3);
      materialRef.current.uniforms.uDistortion.value = distortion;
      materialRef.current.uniforms.uPulseSpeed.value = pulseSpeed;
    }
  }, [activeColors.color1, activeColors.color2, activeColors.color3, distortion, pulseSpeed]);

  
  // Update audio level uniform
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uAudioLevel.value = effectiveAudioLevel;
    }
  }, [effectiveAudioLevel]);
  
  // Simulated audio for demo purposes
  useEffect(() => {
    if (audioLevel > 0 || internalAudioLevel > 0) return;
    
    let frame: number;
    const simulateAudio = () => {
      const time = Date.now() * 0.001;
      // Create organic-looking audio simulation
      const level = 
        Math.sin(time * 2) * 0.15 + 
        Math.sin(time * 5.3) * 0.1 + 
        Math.sin(time * 8.7) * 0.05 +
        Math.random() * 0.1;
      setSimulatedLevel(Math.max(0, Math.min(1, level * 0.5 + 0.1)));
      frame = requestAnimationFrame(simulateAudio);
    };
    
    simulateAudio();
    return () => cancelAnimationFrame(frame);
  }, [audioLevel, internalAudioLevel]);
  
  // Function to start microphone input
  const startMicrophoneInput = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      audioSourceRef.current = source;
      
      // Start analyzing
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const analyze = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        setInternalAudioLevel(avg);
        
        requestAnimationFrame(analyze);
      };
      
      analyze();
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }, []);

  return (
    <div className={`orx-anomaly-orb relative ${className}`} style={{ width: size, height: size }}>
      {/* Three.js container - transparent background, no rectangular halo */}
      <div 
        ref={containerRef}
        id="three-container" 
        className="absolute inset-0"
      />

      {/* === Debug UI (hidden by default) === */}
      <div className={debug ? "block" : "hidden"}>
        <div className="absolute bottom-4 left-4 bg-black/80 text-cyan-400 text-xs font-mono p-2 rounded">
          Audio Level: {(effectiveAudioLevel * 100).toFixed(1)}%
        </div>
        <button 
          onClick={startMicrophoneInput}
          className="absolute top-4 left-4 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 text-xs font-mono px-3 py-1 rounded hover:bg-cyan-500/30 transition-colors"
        >
          Enable Mic
        </button>
      </div>
    </div>
  );
}
