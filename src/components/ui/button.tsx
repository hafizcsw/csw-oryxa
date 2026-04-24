import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium tracking-wide ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ag-bg)] disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        // AG Primary: ink on paper / paper on ink — flips correctly with theme
        default:
          "bg-[var(--ag-fg)] text-[var(--ag-bg)] shadow-[0_4px_14px_-2px_hsl(var(--primary)/0.35)] hover:shadow-[0_6px_22px_-4px_hsl(var(--primary)/0.55)] hover:-translate-y-0.5 hover:opacity-95",
        destructive:
          "bg-gradient-to-r from-destructive to-destructive/85 text-destructive-foreground shadow-[0_4px_14px_-2px_hsl(var(--destructive)/0.4)] hover:shadow-[0_6px_20px_-2px_hsl(var(--destructive)/0.55)] hover:brightness-110 hover:-translate-y-0.5",
        // AG Outline: hairline border on AG bg
        outline:
          "border border-[var(--ag-border)] bg-transparent text-[var(--ag-fg)] hover:border-[color:color-mix(in_srgb,var(--ag-fg)_30%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ag-fg)_4%,transparent)] hover:-translate-y-0.5",
        // AG Secondary: subtle tinted surface
        secondary:
          "bg-[color:color-mix(in_srgb,var(--ag-fg)_8%,transparent)] text-[var(--ag-fg)] border border-[var(--ag-border)] hover:bg-[color:color-mix(in_srgb,var(--ag-fg)_12%,transparent)] hover:-translate-y-0.5",
        ghost:
          "text-[var(--ag-fg)] hover:bg-[color:color-mix(in_srgb,var(--ag-fg)_6%,transparent)]",
        link:
          "text-[hsl(var(--primary))] underline-offset-4 hover:underline hover:opacity-80 px-0",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 px-4 py-2 text-xs rounded-lg",
        lg: "h-13 px-8 py-3.5 text-base rounded-2xl",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
