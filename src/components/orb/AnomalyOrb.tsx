import { useMemo } from "react";
import { useTheme } from "next-themes";
import "@/styles/anomaly-orb.css";

export type OrbColors = {
  color1: string;
  color2: string;
  color3: string;
};

type Props = {
  debug?: boolean;
  className?: string;
  size?: number;
  audioLevel?: number;
  distortion?: number;
  pulseSpeed?: number;
  customColors?: OrbColors;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function AnomalyOrb({
  debug = false,
  className = "",
  size = 380,
  audioLevel = 0,
  distortion = 1,
  pulseSpeed = 1,
  customColors,
}: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const safeSize = clamp(Number.isFinite(size) ? size : 380, 60, 700);
  const safePulseSpeed = clamp(Number.isFinite(pulseSpeed) ? pulseSpeed : 1, 0.5, 5);
  const safeDistortion = clamp(Number.isFinite(distortion) ? distortion : 1, 0, 3);

  const palette = useMemo(() => {
    const fallback = isDark
      ? { color1: "#00ffff", color2: "#8b5cf6", color3: "#0ea5e9" }
      : { color1: "#1e3a5f", color2: "#6366f1", color3: "#3b82f6" };

    return {
      color1: customColors?.color1 || fallback.color1,
      color2: customColors?.color2 || fallback.color2,
      color3: customColors?.color3 || fallback.color3,
    };
  }, [customColors?.color1, customColors?.color2, customColors?.color3, isDark]);

  const pulseDuration = `${(4 / safePulseSpeed).toFixed(1)}s`;
  const rotateDuration = `${(12 / safePulseSpeed).toFixed(1)}s`;
  const wobbleDuration = `${(8 / safePulseSpeed).toFixed(1)}s`;
  const distortionScale = 1 + safeDistortion * 0.04;

  return (
    <div
      className={`orx-anomaly-orb relative ${className}`}
      style={{ width: safeSize, height: safeSize }}
      data-debug={debug ? "true" : "false"}
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none css-orb-pulse"
        style={{
          background: `radial-gradient(circle, ${palette.color1}33 0%, ${palette.color2}18 40%, transparent 70%)`,
          transform: "scale(1.3)",
          filter: "blur(20px)",
          animationDuration: pulseDuration,
        }}
      />

      {/* Inner glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none css-orb-pulse"
        style={{
          background: `radial-gradient(circle, ${palette.color1}44 0%, ${palette.color3}22 50%, transparent 65%)`,
          transform: "scale(1.15)",
          filter: "blur(12px)",
          animationDuration: pulseDuration,
          animationDelay: `-${(2 / safePulseSpeed).toFixed(1)}s`,
        }}
      />

      {/* Main orb body */}
      <div
        className="absolute rounded-full overflow-hidden css-orb-wobble"
        style={{
          inset: "12%",
          animationDuration: wobbleDuration,
        }}
      >
        {/* Rotating conic gradient surface */}
        <div
          className="absolute inset-0 rounded-full css-orb-rotate"
          style={{
            background: `
              conic-gradient(
                from 0deg,
                ${palette.color1},
                ${palette.color2},
                ${palette.color3},
                ${palette.color1},
                ${palette.color2},
                ${palette.color1}
              )
            `,
            animationDuration: rotateDuration,
            transform: `scale(${distortionScale})`,
          }}
        />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 rounded-full css-orb-rotate"
          style={{
            background: `
              radial-gradient(ellipse at 30% 20%, ${palette.color3}88 0%, transparent 50%),
              radial-gradient(ellipse at 70% 80%, ${palette.color2}66 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, ${palette.color1}44 0%, transparent 60%)
            `,
            animationDuration: `${(18 / safePulseSpeed).toFixed(1)}s`,
            animationDirection: "reverse",
          }}
        />

        {/* Specular highlight */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 35% 25%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 30%, transparent 60%)`,
          }}
        />

        {/* Fresnel edge */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: `inset 0 0 ${safeSize * 0.15}px ${safeSize * 0.04}px rgba(0,0,0,0.3)`,
          }}
        />
      </div>

      {debug && (
        <div className="data-panel absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-1 text-[10px] text-foreground">
          CSS
        </div>
      )}
    </div>
  );
}
