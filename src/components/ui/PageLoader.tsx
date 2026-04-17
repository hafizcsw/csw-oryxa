import { useTranslation } from "react-i18next";

/**
 * PageLoader — Oryxa signature loader.
 * Minimal, editorial, monochrome. No chrome, no card, no dots.
 * A single hairline ring with a slow precise sweep + wordmark beneath.
 */
export function PageLoader() {
  const { t } = useTranslation("common");

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-7 animate-fade-in">
        <div className="relative h-12 w-12">
          <svg
            viewBox="0 0 50 50"
            className="h-full w-full -rotate-90"
            fill="none"
          >
            {/* Hairline track */}
            <circle
              cx="25"
              cy="25"
              r="22"
              stroke="hsl(var(--foreground))"
              strokeOpacity="0.08"
              strokeWidth="1"
            />
            {/* Sweeping arc */}
            <circle
              cx="25"
              cy="25"
              r="22"
              stroke="hsl(var(--foreground))"
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray="138"
              strokeDashoffset="100"
              className="origin-center animate-spin"
              style={{ animationDuration: "1.6s", transformOrigin: "center" }}
            />
          </svg>
        </div>

        <span className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground/70 font-light">
          {t("common.loading")}
        </span>
      </div>
    </div>
  );
}
