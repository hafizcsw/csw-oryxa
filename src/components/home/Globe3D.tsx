/**
 * Globe3D — Real WebGL 3D globe (three.js / react-three-fiber).
 *
 * Synced with the Leaflet map below:
 *  - When `focusCountryCode` changes (user hovered/selected a country on the map),
 *    the globe smoothly rotates to bring that country to the front.
 *  - Country markers are clickable → bubbles selection back up via `onCountrySelect`.
 *  - Idle state: slow auto-rotation.
 *
 * Uses semantic design tokens via CSS variables (resolved at runtime to hex).
 */
import { useRef, useMemo, useEffect, useState, useCallback, Suspense } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { useTranslation } from "react-i18next";
import earthTextureUrl from "@/assets/earth-texture.jpg";

// Lightweight inline replacement for drei's <Sphere> (avoids pulling drei's full bundle).
function Sphere({ args, children }: { args: [number, number, number]; children?: React.ReactNode }) {
  return (
    <mesh>
      <sphereGeometry args={args} />
      {children}
    </mesh>
  );
}

interface CountryStat {
  code: string;
  name: string;
  count: number;
}

interface Globe3DViewProps {
  countryStats: CountryStat[];
  onCountrySelect: (code: string) => void;
  language: string;
  /** Country code to focus the globe on (driven by the map below). */
  focusCountryCode?: string | null;
  /** Optional explicit lat/lon focus (used for city drill-down). */
  focusLatLon?: { lat: number; lon: number } | null;
}

// Country centroid coordinates (lat, lon)
const COUNTRY_COORDS: Record<string, [number, number]> = {
  AF:[33.93,67.71],DZ:[28.03,1.66],AR:[-38.42,-63.62],AU:[-25.27,133.78],AT:[47.52,14.55],
  BD:[23.68,90.36],BE:[50.5,4.47],BR:[-14.24,-51.93],BG:[42.73,25.49],CA:[56.13,-106.35],
  CL:[-35.68,-71.54],CN:[35.86,104.2],CO:[4.57,-74.3],HR:[45.1,15.2],CZ:[49.82,15.47],
  DK:[56.26,9.5],EG:[26.82,30.8],FI:[61.92,25.75],FR:[46.23,2.21],DE:[51.17,10.45],
  GR:[39.07,21.82],HU:[47.16,19.5],IS:[64.96,-19.02],IN:[20.59,78.96],ID:[-0.79,113.92],
  IR:[32.43,53.69],IQ:[33.22,43.68],IE:[53.41,-8.24],IL:[31.05,34.85],IT:[41.87,12.57],
  JP:[36.2,138.25],JO:[30.59,36.24],KZ:[48.02,66.92],KE:[-0.02,37.91],KW:[29.31,47.48],
  LB:[33.85,35.86],LY:[26.34,17.23],MY:[4.21,101.98],MX:[23.63,-102.55],MA:[31.79,-7.09],
  NL:[52.13,5.29],NZ:[-40.9,174.89],NG:[9.08,8.68],NO:[60.47,8.47],OM:[21.47,55.98],
  PK:[30.38,69.35],PE:[-9.19,-75.02],PH:[12.88,121.77],PL:[51.92,19.15],PT:[39.4,-8.22],
  QA:[25.35,51.18],RO:[45.94,24.97],RU:[61.52,105.32],SA:[23.89,45.08],SG:[1.35,103.82],
  ZA:[-30.56,22.94],KR:[35.91,127.77],ES:[40.46,-3.75],LK:[7.87,80.77],SE:[60.13,18.64],
  CH:[46.82,8.23],SY:[34.8,38.99],TW:[23.7,120.96],TH:[15.87,100.99],TN:[33.89,9.54],
  TR:[38.96,35.24],UA:[48.38,31.17],AE:[23.42,53.85],GB:[55.38,-3.44],US:[37.09,-95.71],
  VN:[14.06,108.28],HK:[22.32,114.17],
};

const GLOBE_RADIUS = 1.5;

/** Convert lat/lon (degrees) → 3D unit-sphere position scaled by `radius`. */
function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

/** Read an HSL CSS variable and return a THREE.Color. */
function readCssColor(varName: string, fallback = "#3b82f6"): THREE.Color {
  if (typeof window === "undefined") return new THREE.Color(fallback);
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!raw) return new THREE.Color(fallback);
  // raw is "H S% L%"
  return new THREE.Color(`hsl(${raw})`);
}

/* ──────────────────────────────────────────────────────────────────────
   Inner globe scene — handles rotation, focus animation, markers
   ────────────────────────────────────────────────────────────────────── */

interface SceneProps {
  countryStats: CountryStat[];
  onCountrySelect: (code: string) => void;
  focusCountryCode?: string | null;
  focusLatLon?: { lat: number; lon: number } | null;
  hoveredCode: string | null;
  setHoveredCode: (code: string | null) => void;
}

function GlobeScene({
  countryStats,
  onCountrySelect,
  focusCountryCode,
  focusLatLon,
  hoveredCode,
  setHoveredCode,
}: SceneProps) {
  const globeRef = useRef<THREE.Group>(null!);
  const { camera } = useThree();

  // Resolve theme colors once per mount.
  const colors = useMemo(() => ({
    primary: readCssColor("--primary", "#3b82f6"),
    accent: readCssColor("--accent", "#10b981"),
    background: readCssColor("--background", "#0f172a"),
  }), []);

  // Target rotation (drives smooth tween toward focused country).
  const targetRotation = useRef({ x: 0, y: 0 });
  const isUserFocused = useRef(false);

  // When focus changes → compute target rotation so that point faces camera (+Z).
  useEffect(() => {
    let lat: number | null = null;
    let lon: number | null = null;

    if (focusLatLon) {
      lat = focusLatLon.lat;
      lon = focusLatLon.lon;
    } else if (focusCountryCode && COUNTRY_COORDS[focusCountryCode]) {
      [lat, lon] = COUNTRY_COORDS[focusCountryCode];
    }

    if (lat == null || lon == null) {
      isUserFocused.current = false;
      return;
    }

    isUserFocused.current = true;
    // Globe sits at origin; rotate so given lat/lon faces +Z (camera).
    targetRotation.current = {
      x: lat * (Math.PI / 180),
      y: -(lon + 180) * (Math.PI / 180) - Math.PI / 2,
    };
  }, [focusCountryCode, focusLatLon]);

  useFrame((_, delta) => {
    if (!globeRef.current) return;
    if (isUserFocused.current) {
      // Smoothly tween rotation toward target (LERP with shortest path on Y).
      const cur = globeRef.current.rotation;
      const tx = targetRotation.current.x;
      let ty = targetRotation.current.y;
      // Normalize Y to nearest multiple of 2π to take shortest path.
      const twoPi = Math.PI * 2;
      while (ty - cur.y > Math.PI) ty -= twoPi;
      while (ty - cur.y < -Math.PI) ty += twoPi;
      cur.x += (tx - cur.x) * Math.min(1, delta * 3);
      cur.y += (ty - cur.y) * Math.min(1, delta * 3);
    } else {
      // Idle slow rotation.
      globeRef.current.rotation.y += delta * 0.12;
    }
  });

  // Build markers once per data set.
  const markers = useMemo(() => {
    return countryStats
      .filter(c => COUNTRY_COORDS[c.code])
      .map(c => {
        const [lat, lon] = COUNTRY_COORDS[c.code];
        const pos = latLonToVec3(lat, lon, GLOBE_RADIUS * 1.01);
        const size = Math.max(0.025, Math.min(0.07, 0.02 + Math.log10(c.count + 1) * 0.025));
        return { ...c, pos, size };
      });
  }, [countryStats]);

  // Load Earth texture (continents + oceans). Suspends until ready.
  const earthTexture = useLoader(THREE.TextureLoader, earthTextureUrl);
  useEffect(() => {
    if (earthTexture) {
      earthTexture.colorSpace = THREE.SRGBColorSpace;
      earthTexture.anisotropy = 8;
    }
  }, [earthTexture]);

  return (
    <group ref={globeRef}>
      {/* Earth sphere with continents texture */}
      <Sphere args={[GLOBE_RADIUS, 64, 64]}>
        <meshPhongMaterial
          map={earthTexture}
          shininess={8}
          specular={new THREE.Color(0x222233)}
        />
      </Sphere>

      {/* Subtle wireframe overlay = lat/lon grid */}
      <Sphere args={[GLOBE_RADIUS * 1.002, 24, 16]}>
        <meshBasicMaterial
          color={colors.primary}
          wireframe
          transparent
          opacity={0.08}
        />
      </Sphere>

      {/* Atmosphere halo */}
      <Sphere args={[GLOBE_RADIUS * 1.08, 32, 32]}>
        <meshBasicMaterial
          color={colors.primary}
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Country markers */}
      {markers.map(m => {
        const isFocused = m.code === focusCountryCode;
        const isHovered = m.code === hoveredCode;
        const scale = isFocused ? 2.2 : isHovered ? 1.6 : 1;
        return (
          <group key={m.code} position={m.pos}>
            <mesh
              scale={scale}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredCode(m.code); document.body.style.cursor = "pointer"; }}
              onPointerOut={() => { setHoveredCode(null); document.body.style.cursor = "auto"; }}
              onClick={(e) => { e.stopPropagation(); onCountrySelect(m.code); }}
            >
              <sphereGeometry args={[m.size, 16, 16]} />
              <meshBasicMaterial
                color={isFocused ? colors.accent : colors.primary}
                transparent
                opacity={isFocused ? 1 : 0.85}
              />
            </mesh>
            {isFocused && (
              <mesh>
                <ringGeometry args={[m.size * 1.8, m.size * 2.4, 32]} />
                <meshBasicMaterial
                  color={colors.accent}
                  transparent
                  opacity={0.6}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Public component
   ────────────────────────────────────────────────────────────────────── */

export function Globe3DView({
  countryStats,
  onCountrySelect,
  focusCountryCode,
  focusLatLon,
}: Globe3DViewProps) {
  const { t } = useTranslation();
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const size = 160;

  const hovered = hoveredCode ? countryStats.find(c => c.code === hoveredCode) : null;

  const handleSelect = useCallback((code: string) => {
    onCountrySelect(code);
  }, [onCountrySelect]);

  return (
    <div
      className="relative mx-auto select-none"
      style={{ width: size, height: size }}
    >
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 3, 5]} intensity={0.8} />
        <pointLight position={[-5, -3, -5]} intensity={0.3} />
        <Suspense fallback={null}>
          <GlobeScene
            countryStats={countryStats}
            onCountrySelect={handleSelect}
            focusCountryCode={focusCountryCode}
            focusLatLon={focusLatLon}
            hoveredCode={hoveredCode}
            setHoveredCode={setHoveredCode}
          />
        </Suspense>
      </Canvas>

      {/* Hover tooltip (HTML overlay, not inside Canvas to keep it crisp) */}
      {hovered && (
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 bg-popover/95 backdrop-blur-sm text-popover-foreground border border-border rounded-lg shadow-lg px-3 py-1.5 text-xs whitespace-nowrap z-10">
          <p className="font-semibold">{hovered.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {hovered.count} {t("map.universities", "universities")}
          </p>
        </div>
      )}
    </div>
  );
}

export default Globe3DView;
