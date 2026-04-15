import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface FreshnessBadgeProps {
  verifiedAt?: string | null;
  sourceUrl?: string | null;
  freshnessScore?: number | null;
}

export function FreshnessBadge({ verifiedAt, sourceUrl, freshnessScore }: FreshnessBadgeProps) {
  if (!verifiedAt) {
    return (
      <Badge variant="outline" className="gap-1">
        <AlertTriangle className="w-3 h-3" />
        غير محقق
      </Badge>
    );
  }

  const score = freshnessScore || 0;
  const variant = score >= 85 ? "default" : score >= 60 ? "secondary" : "destructive";
  const label = score >= 85 ? "حديث" : score >= 60 ? "قديم نسبياً" : "قديم";

  const timeAgo = formatDistanceToNow(new Date(verifiedAt), {
    addSuffix: true,
    locale: ar
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="gap-1 cursor-help">
            <Clock className="w-3 h-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm space-y-1">
            <p>تم التحقق: {timeAgo}</p>
            <p>نقاط النضارة: {score}/100</p>
            {sourceUrl && (
              <a 
                href={sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline block truncate max-w-xs"
              >
                المصدر →
              </a>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
