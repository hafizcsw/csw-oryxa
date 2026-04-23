import { cn } from "@/lib/utils";
import { useAGReveal } from "./useAGReveal";

interface AGDisplayAnchorProps {
  word: string;
  className?: string;
  tone?: "light" | "dark";
}

/**
 * Gigantic display word that bleeds toward the viewport edges,
 * placed just above the footer (Antigravity-style).
 */
export function AGDisplayAnchor({
  word,
  className,
  tone = "light",
}: AGDisplayAnchorProps) {
  const ref = useAGReveal<HTMLDivElement>(0.05);

  return (
    <div
      ref={ref}
      data-ag-reveal
      className={cn(
        "ag-display-anchor relative w-full overflow-hidden",
        // Inherits parent bg/text — works in both themes via AG tokens
        "bg-[var(--ag-bg)] text-[var(--ag-fg)]",
        "pt-12 pb-0",
        className
      )}
    >
      <div
        className={cn(
          "ag-fade-up text-center font-semibold tracking-[-0.04em] leading-[0.85]",
          "text-[clamp(96px,22vw,320px)]",
          "select-none"
        )}
        style={{ ["--ag-word-delay" as string]: "200ms" }}
      >
        {word}
      </div>
    </div>
  );
}
