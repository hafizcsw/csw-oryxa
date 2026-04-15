import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProcessingStage =
  | 'payment_received'
  | 'processing_ocr'
  | 'processing_extract'
  | 'processing_translate'
  | 'processing_render'
  | 'notarization'
  | 'delivery';

interface TranslationTimelineProps {
  currentStage: ProcessingStage;
}

const stages: ProcessingStage[] = [
  'payment_received',
  'processing_ocr',
  'processing_extract',
  'processing_translate',
  'processing_render',
  'notarization',
  'delivery',
];

const stageEstimates: Record<ProcessingStage, string> = {
  payment_received: '-',
  processing_ocr: '~5 min',
  processing_extract: '~10 min',
  processing_translate: '~30 min',
  processing_render: '~15 min',
  notarization: '2-3 days',
  delivery: 'varies',
};

export function TranslationTimeline({ currentStage }: TranslationTimelineProps) {
  const { t } = useTranslation('translation');
  const currentIndex = stages.indexOf(currentStage);

  const getStageStatus = (stageIndex: number): 'completed' | 'current' | 'pending' => {
    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="relative">
      {/* Vertical line connecting stages */}
      <div className="absolute start-4 top-4 bottom-4 w-0.5 bg-border" />

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const status = getStageStatus(index);
          
          return (
            <motion.div
              key={stage}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="relative flex items-center gap-4"
            >
              {/* Status Icon */}
              <div
                className={cn(
                  'relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300',
                  status === 'completed' && 'bg-green-500 text-white',
                  status === 'current' && 'bg-primary text-primary-foreground animate-pulse',
                  status === 'pending' && 'bg-muted text-muted-foreground border-2 border-border'
                )}
              >
                {status === 'completed' && <Check className="w-4 h-4" />}
                {status === 'current' && <Loader2 className="w-4 h-4 animate-spin" />}
                {status === 'pending' && <Clock className="w-4 h-4" />}
              </div>

              {/* Stage Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4
                    className={cn(
                      'font-medium text-sm transition-colors',
                      status === 'completed' && 'text-green-600 dark:text-green-400',
                      status === 'current' && 'text-primary',
                      status === 'pending' && 'text-muted-foreground'
                    )}
                  >
                    {t(`stages.${stage}`)}
                  </h4>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {stageEstimates[stage]}
                  </span>
                </div>

                {/* Progress indicator for current stage */}
                {status === 'current' && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="mt-1 h-1 bg-primary/30 rounded-full overflow-hidden"
                  >
                    <div className="h-full w-1/3 bg-primary rounded-full" />
                  </motion.div>
                )}

                {/* Status text */}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {status === 'completed' && t('postPayment.stageCompleted')}
                  {status === 'current' && t('postPayment.stageInProgress')}
                  {status === 'pending' && t('postPayment.stagePending')}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
