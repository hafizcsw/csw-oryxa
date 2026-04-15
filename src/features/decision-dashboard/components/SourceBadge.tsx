import { Badge } from "@/components/ui/badge";
import { SOURCE_COLORS } from "../dashboard.contract";

interface SourceBadgeProps {
  source: string;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <Badge variant="outline" className={`text-[10px] ${SOURCE_COLORS[source] || ''}`}>
      {source}
    </Badge>
  );
}
