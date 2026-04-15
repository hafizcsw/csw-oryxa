import * as React from "react";
import { cn } from "@/lib/utils";

interface CarouselIndicatorsProps {
  count: number;
  activeIndex: number;
  onIndicatorClick?: (index: number) => void;
  className?: string;
}

export function CarouselIndicators({ 
  count, 
  activeIndex, 
  onIndicatorClick,
  className 
}: CarouselIndicatorsProps) {
  return (
    <div className={cn("flex items-center justify-center gap-3 py-6", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          onClick={() => onIndicatorClick?.(index)}
          className={cn(
            "transition-all duration-300 rounded-full",
            activeIndex === index 
              ? "w-10 h-3 bg-white shadow-lg" 
              : "w-3 h-3 bg-white/40 hover:bg-white/60 hover:scale-125"
          )}
          aria-label={`Go to slide ${index + 1}`}
          aria-current={activeIndex === index ? "true" : "false"}
        />
      ))}
    </div>
  );
}
