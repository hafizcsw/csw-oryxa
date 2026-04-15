import { LucideIcon, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AddOn {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  includedInFull: boolean;
  price?: number;
}

interface AddOnCardProps {
  addOn: AddOn;
  isIncluded: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export function AddOnCard({ addOn, isIncluded, isSelected, onToggle }: AddOnCardProps) {
  const Icon = addOn.icon;

  return (
    <div
      className={cn(
        "relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200",
        isIncluded 
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 cursor-default"
          : isSelected
            ? "border-primary bg-primary/5 cursor-pointer"
            : "border-border bg-card hover:border-primary/50 cursor-pointer"
      )}
      onClick={() => !isIncluded && onToggle(addOn.id)}
    >
      {/* Icon */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        isIncluded 
          ? "bg-emerald-100 dark:bg-emerald-900" 
          : "bg-muted"
      )}>
        <Icon className={cn(
          "h-6 w-6",
          isIncluded 
            ? "text-emerald-600 dark:text-emerald-400" 
            : "text-muted-foreground"
        )} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground">{addOn.name}</h4>
        <p className="text-sm text-muted-foreground">{addOn.description}</p>
      </div>

      {/* Action */}
      {isIncluded ? (
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Check className="h-5 w-5" />
          <span className="text-sm font-medium">مُضمّنة</span>
        </div>
      ) : (
        <Button
          size="sm"
          variant={isSelected ? "default" : "outline"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(addOn.id);
          }}
        >
          {isSelected ? (
            <>
              <Check className="h-4 w-4 ml-1" />
              مُختارة
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 ml-1" />
              إضافة
            </>
          )}
        </Button>
      )}
    </div>
  );
}
