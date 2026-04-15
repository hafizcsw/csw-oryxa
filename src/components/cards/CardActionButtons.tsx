import { Button } from "@/components/ui/button";
import { GitCompare, Loader2 } from "lucide-react";

interface CardActionButtonsProps {
  onViewDetails: () => void;
  onApply?: () => void;
  onCompare?: () => void;
  isInCompare?: boolean;
  isLoading?: boolean;
  isApplyLoading?: boolean;
  detailsLabel?: string;
  applyLabel?: string;
  compareLabel?: string;
}

export function CardActionButtons({
  onViewDetails,
  onApply,
  onCompare,
  isInCompare = false,
  isLoading = false,
  isApplyLoading = false,
  detailsLabel = "عرض التفاصيل",
  applyLabel = "التقديم الآن",
  compareLabel = "+ قارن",
}: CardActionButtonsProps) {
  return (
    <div className="flex gap-2 mt-4">
      <Button
        onClick={onViewDetails}
        className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        disabled={isLoading}
      >
        {detailsLabel}
      </Button>
      
      {onApply && (
        <Button
          onClick={onApply}
          variant="outline"
          className="flex-1"
          disabled={isLoading || isApplyLoading}
        >
          {isApplyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : applyLabel}
        </Button>
      )}
      
      {onCompare && (
        <Button
          onClick={onCompare}
          variant={isInCompare ? "default" : "ghost"}
          size="icon"
          disabled={isLoading}
          className={isInCompare ? "bg-primary" : ""}
        >
          <GitCompare className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
