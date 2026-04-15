import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeMap = {
  xs: { box: "w-7 h-7", icon: "w-3.5 h-3.5" },
  sm: { box: "w-8 h-8", icon: "w-4 h-4" },
  md: { box: "w-10 h-10", icon: "w-5 h-5" },
  lg: { box: "w-12 h-12", icon: "w-6 h-6" },
} as const;

const variantMap = {
  primary:  { bg: "bg-primary/10 dark:bg-primary/20",        text: "text-primary" },
  success:  { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400" },
  warning:  { bg: "bg-amber-500/10 dark:bg-amber-500/20",     text: "text-amber-600 dark:text-amber-400" },
  danger:   { bg: "bg-red-500/10 dark:bg-red-500/20",         text: "text-red-600 dark:text-red-400" },
  info:     { bg: "bg-blue-500/10 dark:bg-blue-500/20",       text: "text-blue-600 dark:text-blue-400" },
  purple:   { bg: "bg-purple-500/10 dark:bg-purple-500/20",   text: "text-purple-600 dark:text-purple-400" },
  orange:   { bg: "bg-orange-500/10 dark:bg-orange-500/20",   text: "text-orange-600 dark:text-orange-400" },
  pink:     { bg: "bg-pink-500/10 dark:bg-pink-500/20",       text: "text-pink-600 dark:text-pink-400" },
  indigo:   { bg: "bg-indigo-500/10 dark:bg-indigo-500/20",   text: "text-indigo-600 dark:text-indigo-400" },
  muted:    { bg: "bg-muted",                                  text: "text-muted-foreground" },
} as const;

export type IconBoxSize = keyof typeof sizeMap;
export type IconBoxVariant = keyof typeof variantMap;

interface IconBoxProps {
  icon: LucideIcon;
  size?: IconBoxSize;
  variant?: IconBoxVariant;
  shape?: "rounded" | "circle";
  className?: string;
}

export function IconBox({
  icon: Icon,
  size = "sm",
  variant = "primary",
  shape = "rounded",
  className,
}: IconBoxProps) {
  const s = sizeMap[size];
  const v = variantMap[variant];

  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0",
        s.box,
        v.bg,
        shape === "circle" ? "rounded-full" : "rounded-lg",
        className,
      )}
    >
      <Icon className={cn(s.icon, v.text)} />
    </div>
  );
}
