import { Heart } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface ShortlistHeaderProps {
  count: number;
}

export function ShortlistHeader({ count }: ShortlistHeaderProps) {
  return (
    <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-right-5 duration-300">
      <div
        className={cn(
          "relative p-4 rounded-2xl border-2 shadow-2xl backdrop-blur-md transition-all duration-300",
          count > 0
            ? "bg-gradient-to-br from-primary/10 via-white/95 to-accent/10 border-primary/30 hover:scale-105"
            : "bg-white/95 border-border/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-3 rounded-xl transition-all duration-300",
            count >= 5 
              ? "bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/50" 
              : count > 0
              ? "bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/50"
              : "bg-muted"
          )}>
            <Heart
              className={cn(
                "w-6 h-6 transition-all duration-300",
                count > 0 ? "fill-white text-white" : "text-muted-foreground"
              )}
            />
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">القائمة المختصرة</span>
            <Badge
              className={cn(
                "text-base font-bold px-3 py-0.5 border-0 shadow-md",
                count >= 5 
                  ? "bg-gradient-to-r from-red-500 to-red-600 text-white" 
                  : count > 0
                  ? "bg-gradient-to-r from-primary to-accent text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {count}/5
            </Badge>
          </div>
        </div>

        {count >= 5 && (
          <div className="absolute -top-1 -right-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
