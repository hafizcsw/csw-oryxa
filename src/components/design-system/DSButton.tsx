import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface DSButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
}

export const DSButton = forwardRef<HTMLButtonElement, DSButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-xl font-bold tracking-wide transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50 active:scale-[0.97]";
    
    const variants = {
      primary: "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[0_4px_14px_-2px_hsl(var(--primary)/0.4)] hover:shadow-[0_6px_20px_-2px_hsl(var(--primary)/0.55)] hover:brightness-110 hover:-translate-y-0.5",
      secondary: "bg-secondary text-secondary-foreground shadow-[0_4px_14px_-2px_hsl(var(--secondary)/0.3)] hover:shadow-[0_6px_20px_-2px_hsl(var(--secondary)/0.45)] hover:brightness-125 hover:-translate-y-0.5",
      outline: "border-2 border-border bg-background text-foreground hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-md",
      ghost: "text-foreground hover:bg-muted/80",
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
