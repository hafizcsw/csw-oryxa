import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { AGRevealText } from "./AGRevealText";
import { useAGReveal } from "./useAGReveal";

const AntigravityParticleField = lazy(() =>
  import("@/components/home/hero-shader/antigravity/AntigravityParticleField").then(
    (m) => ({ default: m.AntigravityParticleField })
  )
);

interface AGAnchorBandProps {
  headline: string;
  primaryCta?: { label: string; onClick: () => void };
  secondaryCta?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * Full-bleed dark band with particle field.
 * On mobile (≤768px) the particles are skipped — static dark band only.
 */
export function AGAnchorBand({
  headline,
  primaryCta,
  secondaryCta,
  className,
}: AGAnchorBandProps) {
  const ref = useAGReveal<HTMLElement>(0.2);

  const isMobile =
    typeof window !== "undefined" && window.matchMedia?.("(max-width: 768px)").matches;

  return (
    <section
      ref={ref}
      data-ag-reveal
      data-ag-tone="dark"
      className={cn(
        "ag-section relative w-full overflow-hidden",
        "bg-[var(--ag-fg)] text-[var(--ag-bg)]",
        "py-[clamp(120px,16vw,220px)]",
        className
      )}
    >
      {!isMobile && (
        <div className="absolute inset-0 pointer-events-none opacity-70">
          <Suspense fallback={null}>
            <AntigravityParticleField />
          </Suspense>
        </div>
      )}
      <div className="relative z-10 max-w-[1280px] mx-auto px-6 md:px-12 text-center">
        <AGRevealText
          text={headline}
          as="h2"
          className={cn(
            "font-semibold tracking-[-0.02em] leading-[1.02]",
            "text-[clamp(44px,7vw,112px)]",
            "max-w-[18ch] mx-auto"
          )}
        />
        {(primaryCta || secondaryCta) && (
          <div
            className="mt-12 flex flex-wrap items-center justify-center gap-4 ag-fade-up"
            style={{ ["--ag-word-delay" as string]: "400ms" }}
          >
            {primaryCta && (
              <button
                type="button"
                onClick={primaryCta.onClick}
                className={cn(
                  "px-7 py-3.5 rounded-[var(--ag-radius-pill)]",
                  "bg-white text-[var(--ag-fg)] font-medium text-[15px]",
                  "transition-transform duration-300 hover:scale-[1.03]"
                )}
              >
                {primaryCta.label}
              </button>
            )}
            {secondaryCta && (
              <button
                type="button"
                onClick={secondaryCta.onClick}
                className={cn(
                  "px-7 py-3.5 rounded-[var(--ag-radius-pill)]",
                  "bg-transparent text-white border border-white/30 font-medium text-[15px]",
                  "transition-colors duration-300 hover:bg-white/10"
                )}
              >
                {secondaryCta.label}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
