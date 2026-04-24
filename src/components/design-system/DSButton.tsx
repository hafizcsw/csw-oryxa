import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface DSButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
}

export const DSButton = forwardRef<HTMLButtonElement, DSButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium tracking-wide transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ag-bg)] disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50 active:scale-[0.97]";
    
    const variants = {
      primary: "bg-[var(--ag-fg)] text-[var(--ag-bg)] shadow-[0_4px_14px_-2px_hsl(var(--primary)/0.35)] hover:shadow-[0_6px_22px_-4px_hsl(var(--primary)/0.55)] hover:opacity-95 hover:-translate-y-0.5",
      secondary: "bg-[color:color-mix(in_srgb,var(--ag-fg)_8%,transparent)] text-[var(--ag-fg)] border border-[var(--ag-border)] hover:bg-[color:color-mix(in_srgb,var(--ag-fg)_12%,transparent)] hover:-translate-y-0.5",
      outline: "border border-[var(--ag-border)] bg-transparent text-[var(--ag-fg)] hover:border-[color:color-mix(in_srgb,var(--ag-fg)_30%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ag-fg)_4%,transparent)] hover:-translate-y-0.5",
      ghost: "text-[var(--ag-fg)] hover:bg-[color:color-mix(in_srgb,var(--ag-fg)_6%,transparent)]",
    };
    
    const sizes = {
      xs: "px-2 py-1.5 text-xs",
      sm: "px-5 py-2.5 text-sm",
      md: "px-7 py-3.5 text-base",
      lg: "px-9 py-4.5 text-lg font-bold",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

DSButton.displayName = "DSButton";
