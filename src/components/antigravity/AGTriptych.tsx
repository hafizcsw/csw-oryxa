import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AGTriptychProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive 3-column grid. Children should be AGCard with index prop set
 * for stagger via the --i CSS variable.
 */
export function AGTriptych({ children, className }: AGTriptychProps) {
  return (
    <div
      className={cn(
        "ag-triptych grid gap-6 md:gap-8",
        "grid-cols-1 md:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}
