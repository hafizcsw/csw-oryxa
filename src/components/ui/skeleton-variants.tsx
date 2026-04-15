import { cn } from "@/lib/utils";
import { Skeleton, SkeletonProps } from "./skeleton";

interface SkeletonTextProps extends SkeletonProps {
  lines?: number;
  lastLineWidth?: 'full' | 'half' | 'third' | 'quarter';
}

interface SkeletonCardProps extends SkeletonProps {
  hasImage?: boolean;
  lines?: number;
  imageHeight?: string;
}

interface SkeletonAvatarProps extends SkeletonProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

interface SkeletonTableProps extends SkeletonProps {
  rows?: number;
  columns?: number;
}

// Text skeleton with multiple lines
export function SkeletonText({ 
  lines = 3, 
  lastLineWidth = 'half',
  className,
  ...props 
}: SkeletonTextProps) {
  const lastWidths = {
    full: 'w-full',
    half: 'w-1/2',
    third: 'w-1/3',
    quarter: 'w-1/4',
  };

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? lastWidths[lastLineWidth] : "w-full"
          )}
          style={{ animationDelay: `${i * 100}ms` }}
          {...props}
        />
      ))}
    </div>
  );
}

// Avatar skeleton (circular)
export function SkeletonAvatar({ 
  size = 'md',
  className,
  ...props 
}: SkeletonAvatarProps) {
  const sizes = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <Skeleton 
      className={cn("rounded-full", sizes[size], className)} 
      {...props} 
    />
  );
}

// Card skeleton with optional image
export function SkeletonCard({ 
  hasImage = true, 
  lines = 3,
  imageHeight = 'h-40',
  className,
  ...props 
}: SkeletonCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-4", className)}>
      {hasImage && (
        <Skeleton 
          className={cn("w-full rounded-md", imageHeight)} 
          {...props}
        />
      )}
      <div className="space-y-3">
        <Skeleton className="h-5 w-3/4" {...props} />
        <SkeletonText lines={lines} lastLineWidth="third" {...props} />
      </div>
    </div>
  );
}

// Button skeleton
export function SkeletonButton({ 
  className,
  ...props 
}: SkeletonProps) {
  return (
    <Skeleton 
      className={cn("h-10 w-24 rounded-md", className)} 
      {...props} 
    />
  );
}

// Input skeleton
export function SkeletonInput({ 
  className,
  ...props 
}: SkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-4 w-20" {...props} />
      <Skeleton className="h-10 w-full rounded-md" {...props} />
    </div>
  );
}

// Table skeleton
export function SkeletonTable({ 
  rows = 5, 
  columns = 4,
  className,
  ...props 
}: SkeletonTableProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="flex gap-4 pb-4 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="h-4 flex-1" 
            style={{ animationDelay: `${i * 50}ms` }}
            {...props}
          />
        ))}
      </div>
      {/* Rows */}
      <div className="space-y-3 pt-4">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton 
                key={colIndex} 
                className="h-8 flex-1 rounded-md" 
                style={{ animationDelay: `${(rowIndex * columns + colIndex) * 30}ms` }}
                {...props}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Profile skeleton with avatar and info
export function SkeletonProfile({ 
  className,
  ...props 
}: SkeletonProps) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <SkeletonAvatar size="lg" {...props} />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-32" {...props} />
        <Skeleton className="h-4 w-24" {...props} />
      </div>
    </div>
  );
}

// Grid of cards skeleton
export function SkeletonCardGrid({ 
  count = 6,
  columns = 3,
  className,
  ...props 
}: SkeletonProps & { count?: number; columns?: number }) {
  return (
    <div 
      className={cn(
        "grid gap-4",
        columns === 2 && "grid-cols-1 md:grid-cols-2",
        columns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard 
          key={i} 
          style={{ animationDelay: `${i * 100}ms` }}
          {...props}
        />
      ))}
    </div>
  );
}
