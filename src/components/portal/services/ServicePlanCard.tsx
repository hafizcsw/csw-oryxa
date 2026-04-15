import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ServicePlan {
  id: string;
  name: string;
  nameEn: string;
  subtitle: string;
  color: 'blue' | 'amber' | 'emerald';
  badge: string | null;
  savingAmount?: number;
  features: string[];
  notIncluded?: string | null;
  cta: string;
  recommended: boolean;
  popular: boolean;
  priceIndividual?: number;
  pricePackage?: number;
  order?: number;
  price?: number;
}

interface ServicePlanCardProps {
  plan: ServicePlan;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const colorStyles = {
  blue: {
    border: 'border-blue-300 dark:border-blue-700',
    bg: 'bg-blue-50/50 dark:bg-blue-950/30',
    accent: 'text-blue-600 dark:text-blue-400',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    ring: 'ring-blue-500',
  },
  amber: {
    border: 'border-amber-300 dark:border-amber-600',
    bg: 'bg-amber-50/50 dark:bg-amber-950/30',
    accent: 'text-amber-600 dark:text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
    ring: 'ring-amber-500',
  },
  emerald: {
    border: 'border-emerald-400 dark:border-emerald-600',
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/30',
    accent: 'text-emerald-600 dark:text-emerald-400',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ring: 'ring-emerald-500',
  },
};

export function ServicePlanCard({ plan, isSelected, onSelect }: ServicePlanCardProps) {
  const styles = colorStyles[plan.color];

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border-2 p-6 transition-all duration-200 cursor-pointer",
        styles.border,
        styles.bg,
        isSelected && `ring-2 ${styles.ring} ring-offset-2 ring-offset-background`,
        // الكاملة أكبر + shadow أقوى
        plan.recommended && "scale-[1.03] md:scale-[1.05] shadow-2xl z-10",
        !plan.recommended && !plan.popular && "opacity-90 hover:opacity-100"
      )}
      onClick={() => onSelect(plan.id)}
    >
      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3 right-4">
          <span className={cn(
            "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold",
            plan.recommended 
              ? "bg-emerald-500 text-white" 
              : "bg-amber-500 text-white"
          )}>
            {plan.badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h3 className={cn("text-xl font-bold mb-1", styles.accent)}>
          {plan.name}
        </h3>
        <p className="text-sm text-muted-foreground">{plan.subtitle}</p>
      </div>

      {/* Price */}
      {plan.price && (
        <div className="mb-4">
          <p className="text-2xl font-bold text-foreground">
            ${plan.price}
          </p>
          {plan.priceIndividual && plan.pricePackage && (
            <p className="text-xs text-muted-foreground line-through">
              شراء منفردة: ${plan.priceIndividual}
            </p>
          )}
        </div>
      )}

      {/* Saving Amount */}
      {plan.savingAmount && (
        <div className="mb-4 p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 text-center">
            💰 وفّرت: ${plan.savingAmount}
          </p>
        </div>
      )}

      {/* Features */}
      <ul className="flex-1 space-y-2 mb-4">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <Check className={cn("h-4 w-4 mt-0.5 shrink-0", styles.accent)} />
            <span className="text-sm text-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Not Included */}
      {plan.notIncluded && (
        <p className="text-xs text-muted-foreground mb-4 opacity-70">
          ⚪ {plan.notIncluded}
        </p>
      )}

      {/* CTA Button */}
      <Button
        className={cn(
          "w-full h-11 text-sm font-bold transition-all",
          isSelected 
            ? "bg-muted text-muted-foreground cursor-default" 
            : styles.button
        )}
        disabled={isSelected}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(plan.id);
        }}
      >
        {isSelected ? 'مختارة ✅' : plan.cta}
      </Button>

      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-4 left-4">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", styles.button)}>
            <Check className="h-4 w-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}
