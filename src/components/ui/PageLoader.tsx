import { useTranslation } from "react-i18next";

export function PageLoader() {
  const { t } = useTranslation("common");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div
        className="flex flex-col items-center gap-5 px-8 py-7 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-lg animate-fade-in"
        role="status"
        aria-live="polite"
      >
        {/* Layered ring loader */}
        <div className="relative h-14 w-14">
          {/* Outer soft halo */}
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
          {/* Track */}
          <span className="absolute inset-0 rounded-full border-2 border-primary/15" />
          {/* Spinning arc */}
          <span
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary/70 animate-spin"
            style={{ animationDuration: "0.9s" }}
          />
          {/* Center dot */}
          <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground/80 tracking-wide">
            {t("common.loading")}
          </span>
          <span className="flex gap-0.5">
            <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      </div>
    </div>
  );
}
