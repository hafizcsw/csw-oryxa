import { Heart } from 'lucide-react';
import { useCompare } from '@/hooks/useCompare';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface CompareHeartButtonProps {
  programId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CompareHeartButton({ programId, size = 'md', className }: CompareHeartButtonProps) {
  const { addToCompare, removeFromCompare, isInCompare, maxReached } = useCompare();
  const { toast } = useToast();
  const { t } = useLanguage();
  const isInBasket = isInCompare(programId);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const buttonSizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInBasket) {
      removeFromCompare(programId);
      toast({ title: t('compare.heart.removedTitle') });
      return;
    }

    if (maxReached || !addToCompare(programId)) {
      toast({
        title: t('compare.heart.maxTitle'),
        description: t('compare.heart.maxDescription'),
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: t('compare.heart.addedTitle'),
      description: t('compare.heart.addedDescription'),
    });
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'rounded-full bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-900 transition-all shadow-sm hover:scale-110',
        buttonSizeClasses[size],
        className
      )}
      aria-label={isInBasket ? t('compare.heart.removeAria') : t('compare.heart.addAria')}
    >
      <Heart
        className={cn(
          sizeClasses[size],
          'transition-colors',
          isInBasket ? 'fill-red-500 text-red-500' : 'text-slate-600 dark:text-slate-300'
        )}
      />
    </button>
  );
}
