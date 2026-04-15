import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRussianTTS } from '@/hooks/useRussianTTS';

interface Option {
  id: string;
  label: string;
  isCorrect: boolean;
}

interface Props {
  prompt: string;
  options: Option[];
  title: string;
  onComplete: () => void;
  isCompleted: boolean;
}

export function InteractiveMultipleChoice({ prompt, options, title, onComplete, isCompleted }: Props) {
  const { t } = useLanguage();
  const { speak, isSpeaking, speakingText } = useRussianTTS();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  const handleSelect = (optionId: string) => {
    if (submitted) return;
    setSelected(optionId);
  };

  const handleSubmit = () => {
    if (!selected || submitted) return;
    const opt = options.find(o => o.id === selected);
    const isCorrect = opt?.isCorrect ?? false;
    setCorrect(isCorrect);
    setSubmitted(true);
    if (isCorrect && !isCompleted) {
      setTimeout(onComplete, 800);
    }
  };

  const handleRetry = () => {
    setSelected(null);
    setSubmitted(false);
    setCorrect(false);
  };

  const handleSpeak = (text: string) => {
    if (isSpeaking) return;
    speak(text);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        {isCompleted && <span className="text-xs text-primary flex items-center gap-1"><Check className="w-3.5 h-3.5" />{t('languages.lesson.block.done')}</span>}
      </div>

      <div className="flex items-center gap-2">
        <p className="text-sm text-foreground font-medium flex-1">{prompt}</p>
        <button onClick={() => handleSpeak(prompt)} disabled={isSpeaking} className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 shrink-0">
          {speakingText === prompt ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Volume2 className="w-4 h-4 text-primary" />}
        </button>
      </div>

      <div className="space-y-2">
        {options.map((opt) => {
          const isSelected = selected === opt.id;
          const showCorrect = submitted && opt.isCorrect;
          const showWrong = submitted && isSelected && !opt.isCorrect;
          const isThisSpeaking = speakingText === opt.label;

          return (
            <motion.button
              key={opt.id}
              whileTap={!submitted ? { scale: 0.98 } : undefined}
              onClick={() => handleSelect(opt.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all",
                !submitted && isSelected && "border-primary bg-primary/5",
                !submitted && !isSelected && "border-border bg-card hover:border-primary/30",
                showCorrect && "border-green-500 bg-green-50 dark:bg-green-950/30",
                showWrong && "border-destructive bg-destructive/5",
                submitted && !showCorrect && !showWrong && "border-border/50 bg-muted/30 opacity-60"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold",
                !submitted && isSelected && "bg-primary text-primary-foreground",
                !submitted && !isSelected && "bg-muted text-muted-foreground",
                showCorrect && "bg-green-500 text-white",
                showWrong && "bg-destructive text-destructive-foreground",
              )}>
                {showCorrect ? <Check className="w-4 h-4" /> : showWrong ? <X className="w-4 h-4" /> : opt.id}
              </div>
              <span className={cn("text-sm font-medium flex-1", submitted && !showCorrect && !showWrong && "text-muted-foreground")}>
                {opt.label}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleSpeak(opt.label); }}
                className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 shrink-0"
              >
                {isThisSpeaking ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> : <Volume2 className="w-3 h-3 text-primary" />}
              </button>
            </motion.button>
          );
        })}
      </div>

      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={!selected}
          className={cn(
            "w-full py-3 rounded-xl font-semibold text-sm transition-all",
            selected ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {t('languages.lesson.interactive.check', { defaultValue: 'Check Answer' })}
        </button>
      ) : !correct ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <p className="text-sm text-destructive font-medium">{t('languages.lesson.interactive.tryAgain', { defaultValue: 'Not quite — try again!' })}</p>
          <button onClick={handleRetry} className="w-full py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:opacity-90">
            {t('languages.lesson.interactive.retry', { defaultValue: 'Try Again' })}
          </button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-center">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">🎉 {t('languages.lesson.interactive.correct', { defaultValue: 'Correct!' })}</p>
        </motion.div>
      )}
    </div>
  );
}
