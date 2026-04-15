import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'shimmer' | 'pulse' | 'wave';
  speed?: 'slow' | 'normal' | 'fast';
}

function Skeleton({ 
  className, 
  variant = 'shimmer', 
  speed = 'normal',
  ...props 
}: SkeletonProps) {
  const speedClasses = {
    slow: 'animate-[skeleton-shimmer_2.5s_ease-in-out_infinite]',
    normal: 'animate-[skeleton-shimmer_1.5s_ease-in-out_infinite]',
    fast: 'animate-[skeleton-shimmer_0.8s_ease-in-out_infinite]',
  };

  const variantClasses = {
    shimmer: 'skeleton-shimmer',
    pulse: 'animate-pulse bg-muted/50',
    wave: 'skeleton-wave',
  };

  return (
    <div 
      className={cn(
        "rounded-lg bg-muted/50",
        variant === 'shimmer' && speedClasses[speed],
        variantClasses[variant],
        className
      )} 
      {...props} 
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
