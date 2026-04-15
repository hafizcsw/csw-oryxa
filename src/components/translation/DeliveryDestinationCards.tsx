import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { GraduationCap, Home, Plane, Mail, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DeliveryDestination = 'university' | 'dormitory' | 'embassy' | 'digital';

interface DeliveryDestinationCardsProps {
  selected: DeliveryDestination | null;
  onSelect: (destination: DeliveryDestination) => void;
  disabled?: boolean;
}

const destinations: {
  id: DeliveryDestination;
  icon: typeof GraduationCap;
}[] = [
  { id: 'university', icon: GraduationCap },
  { id: 'dormitory', icon: Home },
  { id: 'embassy', icon: Plane },
  { id: 'digital', icon: Mail },
];

export function DeliveryDestinationCards({
  selected,
  onSelect,
  disabled = false,
}: DeliveryDestinationCardsProps) {
  const { t } = useTranslation('translation');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {destinations.map(({ id, icon: Icon }) => {
        const isSelected = selected === id;
        
        return (
          <motion.button
            key={id}
            whileHover={disabled ? {} : { scale: 1.02 }}
            whileTap={disabled ? {} : { scale: 0.98 }}
            onClick={() => !disabled && onSelect(id)}
            disabled={disabled}
            className={cn(
              'relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              isSelected
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Selection Indicator */}
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
              >
                <Check className="w-4 h-4 text-primary-foreground" />
              </motion.div>
            )}

            {/* Icon */}
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Icon className="w-6 h-6" />
            </div>

            {/* Label */}
            <h3 className={cn(
              'font-semibold text-sm text-center transition-colors',
              isSelected ? 'text-primary' : 'text-foreground'
            )}>
              {t(`postPayment.destinations.${id}`)}
            </h3>

            {/* Description */}
            <p className="text-xs text-muted-foreground text-center mt-1 line-clamp-2">
              {t(`postPayment.destinations.${id}Desc`)}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}
