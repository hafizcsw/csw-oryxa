/**
 * Globe3D — Lightweight CSS-based 3D globe visualization.
 * No heavy Three.js dependency — uses CSS transforms and SVG.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface CountryStat {
  code: string;
  name: string;
  count: number;
  lat?: number;
  lon?: number;
}

interface Globe3DViewProps {
  countryStats: CountryStat[];
  onCountrySelect: (code: string) => void;
  language: string;
}

const COUNTRY_COORDS: Record<string, [number, number]> = {
  AF:[33.93,67.71],DZ:[28.03,1.66],AU:[-25.27,133.78],AT:[47.52,14.55],
  BD:[23.68,90.36],BR:[-14.24,-51.93],CA:[56.13,-106.35],CN:[35.86,104.2],
  EG:[26.82,30.8],FR:[46.23,2.21],DE:[51.17,10.45],IN:[20.59,78.96],
  ID:[-0.79,113.92],IR:[32.43,53.69],IQ:[33.22,43.68],IT:[41.87,12.57],
  JP:[36.2,138.25],JO:[30.59,36.24],KZ:[48.02,66.92],KW:[29.31,47.48],
  MY:[4.21,101.98],MX:[23.63,-102.55],MA:[31.79,-7.09],NL:[52.13,5.29],
  NG:[9.08,8.68],PK:[30.38,69.35],PH:[12.88,121.77],PL:[51.92,19.15],
  QA:[25.35,51.18],RU:[61.52,105.32],SA:[23.89,45.08],KR:[35.91,127.77],
  ES:[40.46,-3.75],SE:[60.13,18.64],CH:[46.82,8.23],TR:[38.96,35.24],
  AE:[23.42,53.85],GB:[55.38,-3.44],US:[37.09,-95.71],
};

function latLonToGlobeXY(lat: number, lon: number, rotation: number, size: number) {
  const r = size / 2;
  const lonRad = ((lon + rotation) % 360) * (Math.PI / 180);
  const latRad = lat * (Math.PI / 180);
  const x = r + r * Math.cos(latRad) * Math.sin(lonRad);
  const y = r - r * Math.sin(latRad);
  const z = Math.cos(latRad) * Math.cos(lonRad);
  return { x, y, visible: z > 0, depth: z };
}

export function Globe3DView({ countryStats, onCountrySelect, language }: Globe3DViewProps) {
  const { t } = useTranslation();
  const [rotation, setRotation] = useState(0);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const animRef = useRef<number>();
  const lastTimeRef = useRef(0);
  const size = 380;

  useEffect(() => {
    const animate = (time: number) => {
      if (!isPaused) {
        const delta = time - lastTimeRef.current;
        if (delta > 30) {
          setRotation(prev => (prev + 0.3) % 360);
          lastTimeRef.current = time;
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isPaused]);

  const markers = useMemo(() => {
    return countryStats
      .filter(c => COUNTRY_COORDS[c.code])
      .map(c => {
        const [lat, lon] = COUNTRY_COORDS[c.code];
        const pos = latLonToGlobeXY(lat, lon, rotation, size);
        return { ...c, ...pos, lat, lon };
      })
      .filter(m => m.visible)
      .sort((a, b) => a.depth - b.depth);
  }, [countryStats, rotation, size]);

  const hovered = hoveredCountry ? markers.find(m => m.code === hoveredCountry) : null;

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size, margin: "0 auto" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => { setIsPaused(false); setHoveredCountry(null); }}
    >
      {/* Globe sphere */}
      <div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          background: "radial-gradient(circle at 35% 35%, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05) 60%, transparent 80%)",
          border: "2px solid hsl(var(--primary) / 0.2)",
          boxShadow: "inset -20px -20px 60px hsl(var(--primary) / 0.1), 0 0 40px hsl(var(--primary) / 0.08)",
        }}
      />

      {/* Grid lines */}
      <svg className="absolute" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Latitude lines */}
        {[-60, -30, 0, 30, 60].map(lat => {
          const latRad = lat * (Math.PI / 180);
          const ry = (size / 2) * Math.cos(latRad);
          const cy = size / 2 - (size / 2) * Math.sin(latRad);
          return (
            <ellipse
              key={`lat-${lat}`}
              cx={size / 2}
              cy={cy}
              rx={ry}
              ry={ry * 0.15}
              fill="none"
              stroke="hsl(var(--primary) / 0.08)"
              strokeWidth={0.5}
            />
          );
        })}
        {/* Longitude lines */}
        {[0, 45, 90, 135].map(lon => {
          const lonRad = ((lon + rotation) % 180) * (Math.PI / 180);
          const rx = (size / 2) * Math.abs(Math.sin(lonRad));
          return (
            <ellipse
              key={`lon-${lon}`}
              cx={size / 2}
              cy={size / 2}
              rx={rx}
              ry={size / 2 - 2}
              fill="none"
              stroke="hsl(var(--primary) / 0.06)"
              strokeWidth={0.5}
            />
          );
        })}
      </svg>

      {/* Country markers */}
      {markers.map(m => {
        const markerSize = Math.max(6, Math.min(16, 4 + m.count * 0.3));
        const opacity = 0.4 + m.depth * 0.6;
        const isHovered = hoveredCountry === m.code;
        return (
          <button
            key={m.code}
            className="absolute rounded-full transition-all duration-200 cursor-pointer z-10"
            style={{
              width: isHovered ? markerSize * 1.8 : markerSize,
              height: isHovered ? markerSize * 1.8 : markerSize,
              left: m.x - (isHovered ? markerSize * 0.9 : markerSize / 2),
              top: m.y - (isHovered ? markerSize * 0.9 : markerSize / 2),
              opacity,
              background: isHovered
                ? "hsl(var(--primary))"
                : "hsl(var(--primary) / 0.7)",
              boxShadow: isHovered
                ? "0 0 12px hsl(var(--primary) / 0.6)"
                : "0 0 4px hsl(var(--primary) / 0.3)",
            }}
            onMouseEnter={() => setHoveredCountry(m.code)}
            onMouseLeave={() => setHoveredCountry(null)}
            onClick={() => onCountrySelect(m.code)}
            aria-label={m.name}
          />
        );
      })}

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute z-20 bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-sm pointer-events-none whitespace-nowrap"
          style={{
            left: Math.min(hovered.x + 12, size - 120),
            top: Math.max(hovered.y - 40, 8),
          }}
        >
          <p className="font-semibold">{hovered.name}</p>
          <p className="text-xs text-muted-foreground">
            {hovered.count} {t("map.universities", "universities")}
          </p>
        </div>
      )}

      {/* Atmosphere glow */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size + 20,
          height: size + 20,
          left: -10,
          top: -10,
          background: "radial-gradient(circle, transparent 45%, hsl(var(--primary) / 0.05) 65%, transparent 75%)",
        }}
      />
    </div>
  );
}

export default Globe3DView;
