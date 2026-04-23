import { AGRevealText } from "./AGRevealText";
import { cn } from "@/lib/utils";

interface AGStatementProps {
  headline: string;
  description?: string;
  className?: string;
}

/**
 * Large statement: huge left-aligned headline, supporting copy on the right.
 */
export function AGStatement({ headline, description, className }: AGStatementProps) {
  return (
    <div className={cn("grid gap-10 md:grid-cols-12 md:gap-16 items-end", className)}>
      <AGRevealText
        text={headline}
        as="h2"
        className={cn(
          "md:col-span-8",
          "font-semibold tracking-[-0.02em] leading-[1.02]",
          "text-[clamp(40px,6vw,96px)]"
        )}
      />
      {description && (
        <p
          className="md:col-span-4 md:pb-3 text-[var(--ag-muted)] text-base md:text-lg leading-relaxed ag-fade-up"
          style={{ ["--ag-word-delay" as string]: "300ms" }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
