import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronRight, Eye, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRussianTTS } from '@/hooks/useRussianTTS';

interface QuizItem {
  question: string;
  answer: string;
}

interface Props {
  items: QuizItem[];
  title: string;
  onComplete: () => void;
  isCompleted: boolean;
}

export function InteractiveMiniQuiz({ items, title, onComplete, isCompleted }: Props) {
  const { t } = useLanguage();
  const { speak, isSpeaking, speakingText } = useRussianTTS();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());

  const current = items[currentIdx];
  const progress = completedItems.size / items.length;

  const handleKnewIt = () => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      next.add(currentIdx);
      if (next.size === items.length && !isCompleted) setTimeout(onComplete, 400);
      return next;
    });
    setShowAnswer(false);
    if (currentIdx < items.length - 1) setCurrentIdx(currentIdx + 1);
  };

  const handleNext = () => {
    setShowAnswer(false);
    if (currentIdx < items.length - 1) setCurrentIdx(currentIdx + 1);
  };

  const handleSpeak = (text: string) => {
    if (isSpeaking) return;
    speak(text);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground">{completedItems.size}/{items.length}</span>
      </div>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
      </div>

      <motion.div
        key={currentIdx}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="rounded-xl border-2 border-border bg-card overflow-hidden"
      >
        <div className="p-5">
          <p className="text-xs text-muted-foreground mb-2">{t('languages.lesson.interactive.question', { defaultValue: 'Question' })} {currentIdx + 1}/{items.length}</p>
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-foreground flex-1">{current.question}</p>
            <button onClick={() => handleSpeak(current.question)} disabled={isSpeaking} className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 shrink-0">
              {speakingText === current.question ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Volume2 className="w-4 h-4 text-primary" />}
            </button>
          </div>
        </div>

        {showAnswer ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border-t border-border bg-primary/5 p-5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-primary flex-1">{current.answer}</p>
              <button onClick={() => handleSpeak(current.answer)} disabled={isSpeaking} className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 shrink-0">
                {speakingText === current.answer ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> : <Volume2 className="w-3 h-3 text-primary" />}
              </button>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleKnewIt}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />{t('languages.lesson.interactive.gotIt', { defaultValue: 'Got it!' })}
              </button>
              {currentIdx < items.length - 1 && (
                <button onClick={handleNext} className="py-2.5 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  {t('languages.lesson.interactive.skip', { defaultValue: 'Skip' })}<ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="border-t border-border p-4">
            <button
              onClick={() => setShowAnswer(true)}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />{t('languages.lesson.interactive.showAnswer', { defaultValue: 'Show Answer' })}
            </button>
          </div>
        )}
      </motion.div>

      <div className="flex justify-center gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentIdx(i); setShowAnswer(false); }}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all",
              completedItems.has(i) ? "bg-green-500" : i === currentIdx ? "bg-primary scale-125" : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </div>
  );
}
