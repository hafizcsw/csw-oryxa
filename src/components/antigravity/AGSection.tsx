import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAGReveal } from "./useAGReveal";

interface AGSectionProps {
  children: ReactNode;
  tone?: "light" | "dark";
  fullBleed?: boolean;
  className?: string;
  innerClassName?: string;
  id?: string;
  /** uppercase eyebrow label that fades as you scroll past */
  eyebrow?: string;
}

/**
 * AG-style section wrapper.
 * - Pure white or pure black tone
 * - Generous vertical padding
 * - Intersection-driven enter animation via [data-ag-reveal]
 */
export function AGSection({
  children,
  tone = "light",
  fullBleed = false,
  className,
  innerClassName,
  id,
  eyebrow,
}: AGSectionProps) {
  const ref = useAGReveal<HTMLElement>(0.15);

  return (
    <section
      id={id}
      ref={ref}
      data-ag-reveal
      data-ag-tone={tone}
      className={cn(
        "ag-section relative w-full",
        tone === "light" ? "bg-[var(--ag-bg)] text-[var(--ag-fg)]" : "bg-[var(--ag-fg)] text-[var(--ag-bg)]",
        "py-[clamp(96px,14vw,200px)]",
        className
      )}
    >
      <div
        className={cn(
          fullBleed ? "w-full px-6 md:px-12" : "max-w-[1280px] mx-auto px-6 md:px-12",
          innerClassName
        )}
      >
        {eyebrow && (
          <div
            className={cn(
              "ag-eyebrow mb-10 text-[11px] tracking-[0.18em] uppercase font-medium",
              tone === "light" ? "text-[var(--ag-muted)]" : "text-white/60"
            )}
          >
            {eyebrow}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
