import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Mic, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRussianTTS } from '@/hooks/useRussianTTS';

interface Props {
  prompt: string;
  targetPhrases: string[];
  title: string;
  onComplete: () => void;
  isCompleted: boolean;
}

export function InteractivePronunciation({ prompt, targetPhrases, title, onComplete, isCompleted }: Props) {
  const { t } = useLanguage();
  const { speak, isSpeaking, speakingText } = useRussianTTS();
  const [practiced, setPracticed] = useState<Set<number>>(new Set());
  const progress = practiced.size / targetPhrases.length;

  const handleListen = async (phrase: string) => {
    if (isSpeaking) return;
    await speak(phrase);
  };

  const handlePractice = (idx: number) => {
    setPracticed(prev => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === targetPhrases.length && !isCompleted) setTimeout(onComplete, 600);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        {isCompleted && <span className="text-xs text-primary flex items-center gap-1"><Check className="w-3.5 h-3.5" />{t('languages.lesson.block.done')}</span>}
      </div>

      <p className="text-sm text-foreground">{prompt}</p>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
      </div>

      <div className="space-y-2">
        {targetPhrases.map((phrase, i) => {
          const isDone = practiced.has(i);
          const isThisSpeaking = speakingText === phrase;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 p-3 transition-all",
                isDone ? "border-green-400/40 bg-green-50/50 dark:bg-green-950/20" : "border-border bg-card"
              )}
            >
              {/* Listen button */}
              <button
                onClick={() => handleListen(phrase)}
                disabled={isSpeaking && !isThisSpeaking}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isThisSpeaking ? "bg-primary text-primary-foreground" :
                  isDone ? "bg-green-500 text-white" : "bg-primary/10 text-primary hover:bg-primary/20"
                )}
              >
                {isThisSpeaking ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 isDone ? <Check className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <span className={cn(
                "flex-1 text-base font-bold cursor-pointer",
                isDone ? "text-green-700 dark:text-green-400" : "text-foreground"
              )} onClick={() => handleListen(phrase)}>
                {phrase}
              </span>
              {!isDone && (
                <button
                  onClick={() => handlePractice(i)}
                  className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1"
                >
                  <Mic className="w-3 h-3" />
                  {t('languages.lesson.interactive.practiced', { defaultValue: 'Done' })}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
