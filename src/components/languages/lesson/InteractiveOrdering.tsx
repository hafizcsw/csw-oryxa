import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, RotateCcw, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRussianTTS } from '@/hooks/useRussianTTS';

interface Props {
  prompt: string;
  tokens: string[];
  correctOrder: string[];
  title: string;
  onComplete: () => void;
  isCompleted: boolean;
}

export function InteractiveOrdering({ prompt, tokens, correctOrder, title, onComplete, isCompleted }: Props) {
  const { t } = useLanguage();
  const { speak, isSpeaking } = useRussianTTS();
  const shuffled = useMemo(() => [...tokens].sort(() => Math.random() - 0.5), [tokens]);
  const [available, setAvailable] = useState(shuffled);
  const [placed, setPlaced] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  // Detect if tokens are single characters (letter-building mode)
  const isLetterMode = correctOrder.every(t => [...t].length === 1);
  const spokenWord = isLetterMode ? correctOrder.join('') : correctOrder.join(' ');

  const handlePlace = (token: string, idx: number) => {
    if (submitted) return;
    setPlaced(prev => [...prev, token]);
    setAvailable(prev => prev.filter((_, i) => i !== idx));
  };

  const handleRemove = (idx: number) => {
    if (submitted) return;
    const token = placed[idx];
    setPlaced(prev => prev.filter((_, i) => i !== idx));
    setAvailable(prev => [...prev, token]);
  };

  const handleCheck = () => {
    const isCorrect = placed.length === correctOrder.length && placed.every((t, i) => t === correctOrder[i]);
    setCorrect(isCorrect);
    setSubmitted(true);
    if (isCorrect) {
      speak(spokenWord);
      if (!isCompleted) setTimeout(onComplete, 800);
    }
  };

  const handleReset = () => {
    setAvailable([...shuffled]);
    setPlaced([]);
    setSubmitted(false);
    setCorrect(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        {isCompleted && <span className="text-xs text-primary flex items-center gap-1"><Check className="w-3.5 h-3.5" />{t('languages.lesson.block.done')}</span>}
      </div>

      <div className="flex items-center gap-2">
        <p className="text-sm text-foreground flex-1">{prompt}</p>
        <button onClick={() => !isSpeaking && speak(spokenWord)} className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 shrink-0">
          {isSpeaking ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Volume2 className="w-4 h-4 text-primary" />}
        </button>
      </div>

      <div className={cn(
        "min-h-[56px] rounded-xl border-2 border-dashed p-3 flex flex-wrap gap-2 transition-colors",
        placed.length > 0 ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"
      )}>
        {placed.length === 0 && (
          <p className="text-xs text-muted-foreground m-auto">{t('languages.lesson.interactive.tapToPlace', { defaultValue: 'Tap letters below to build the word' })}</p>
        )}
        <AnimatePresence>
          {placed.map((token, i) => (
            <motion.button
              key={`p-${i}`}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => handleRemove(i)}
              className={cn(
                "px-4 py-2 rounded-lg border-2 font-bold text-base transition-all",
                submitted && correct && "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700",
                submitted && !correct && "border-destructive bg-destructive/5 text-destructive",
                !submitted && "border-primary bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {token}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <AnimatePresence>
          {available.map((token, i) => (
            <motion.button
              key={`a-${i}-${token}`}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handlePlace(token, i)}
              className="px-4 py-2 rounded-lg border-2 border-border bg-card font-bold text-base text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
            >
              {token}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-2">
        {!submitted ? (
          <>
            <button onClick={handleReset} className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />{t('languages.lesson.interactive.reset', { defaultValue: 'Reset' })}
            </button>
            <button
              onClick={handleCheck}
              disabled={placed.length !== correctOrder.length}
              className={cn(
                "flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all",
                placed.length === correctOrder.length ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {t('languages.lesson.interactive.check', { defaultValue: 'Check Answer' })}
            </button>
          </>
        ) : !correct ? (
          <button onClick={handleReset} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm">
            {t('languages.lesson.interactive.retry', { defaultValue: 'Try Again' })}
          </button>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-center">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">🎉 {t('languages.lesson.interactive.correct', { defaultValue: 'Correct!' })}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
