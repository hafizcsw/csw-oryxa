import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold tracking-wide ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-[0_4px_14px_-2px_hsl(var(--primary)/0.4)] hover:shadow-[0_6px_20px_-2px_hsl(var(--primary)/0.55)] hover:brightness-110 hover:-translate-y-0.5",
        destructive:
          "bg-gradient-to-r from-destructive to-destructive/85 text-destructive-foreground shadow-[0_4px_14px_-2px_hsl(var(--destructive)/0.4)] hover:shadow-[0_6px_20px_-2px_hsl(var(--destructive)/0.55)] hover:brightness-110 hover:-translate-y-0.5",
        outline:
          "border-2 border-border bg-background text-foreground hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_4px_14px_-2px_hsl(var(--secondary)/0.3)] hover:shadow-[0_6px_20px_-2px_hsl(var(--secondary)/0.45)] hover:brightness-125 hover:-translate-y-0.5",
        ghost:
          "text-foreground hover:bg-muted/80 hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline hover:text-primary/80 px-0",
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
