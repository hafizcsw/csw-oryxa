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
        "bg-[var(--ag-bg)] text-[var(--ag-fg)]",
        // Flush to bottom — no padding below, generous space above
        "pt-[clamp(80px,12vw,180px)] pb-0 -mb-[0.18em]",
        className
      )}
    >
      <div
        className={cn(
          "ag-fade-up text-center font-semibold tracking-[-0.04em]",
          // Antigravity-style: oversized, bleeds to edges, sits on baseline
          "text-[clamp(120px,28vw,420px)] leading-[0.78]",
          "select-none whitespace-nowrap px-2"
        )}
        style={{ ["--ag-word-delay" as string]: "200ms" }}
      >
        {word}
      </div>
    </div>
  );
}
