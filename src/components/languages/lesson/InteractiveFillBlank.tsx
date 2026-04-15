import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Volume2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRussianTTS } from '@/hooks/useRussianTTS';

interface Props {
  prompt: string;
  sentence: string;
  answers: string[];
  title: string;
  onComplete: () => void;
  isCompleted: boolean;
}

export function InteractiveFillBlank({ prompt, sentence, answers, title, onComplete, isCompleted }: Props) {
  const { t } = useLanguage();
  const { speak, isSpeaking, speakingText } = useRussianTTS();
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  const handleSubmit = () => {
    if (!value.trim() || submitted) return;
    const normalized = value.trim().toLowerCase();
    const isCorrect = answers.some(a => a.toLowerCase() === normalized);
    setCorrect(isCorrect);
    setSubmitted(true);
    if (isCorrect && !isCompleted) setTimeout(onComplete, 800);
  };

  const handleRetry = () => {
    setValue('');
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

      <p className="text-sm text-foreground">{prompt}</p>

      <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center gap-2">
        <p className="text-base text-foreground font-medium text-center flex-1">{sentence}</p>
        <button onClick={() => handleSpeak(sentence.replace('___', answers[0]))} disabled={isSpeaking} className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 shrink-0">
          {isSpeaking ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Volume2 className="w-4 h-4 text-primary" />}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          disabled={submitted && correct}
          placeholder={t('languages.lesson.interactive.typePlaceholder', { defaultValue: 'Type your answer...' })}
          className={cn(
            "flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium bg-card outline-none transition-all",
            !submitted && "border-border focus:border-primary",
            submitted && correct && "border-green-500 bg-green-50 dark:bg-green-950/30",
            submitted && !correct && "border-destructive bg-destructive/5"
          )}
        />
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className={cn(
              "px-5 rounded-xl font-semibold text-sm transition-all shrink-0",
              value.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            <Check className="w-4 h-4" />
          </button>
        ) : !correct ? (
          <button onClick={handleRetry} className="px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shrink-0">
            ↻
          </button>
        ) : null}
      </div>

      {submitted && !correct && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground">
          {t('languages.lesson.interactive.hint', { defaultValue: 'Hint' })}: 
          <button onClick={() => handleSpeak(answers[0])} className="inline-flex items-center gap-1 text-primary hover:underline mx-1">
            {answers[0]} <Volume2 className="w-3 h-3" />
          </button>
        </motion.p>
      )}

      {submitted && correct && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-center">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">✅ {t('languages.lesson.interactive.correct', { defaultValue: 'Correct!' })}</p>
        </motion.div>
      )}
    </div>
  );
}
