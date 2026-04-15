import { useEffect, useRef, useState } from "react";

type Options = {
  text: string;
  cps?: number; // chars per second
  enabled?: boolean;
  onComplete?: () => void;
};

export function useTypewriter({
  text,
  cps = 35,
  enabled = true,
  onComplete,
}: Options) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  const timerRef = useRef<number | null>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    setDisplayedText("");
    setIsComplete(false);
    idxRef.current = 0;

    if (!enabled || !text) {
      setDisplayedText(text || "");
      setIsComplete(true);
      return;
    }

    const stepMs = Math.max(12, Math.floor(1000 / cps));

    timerRef.current = window.setInterval(() => {
      idxRef.current = Math.min(text.length, idxRef.current + 1);
      setDisplayedText(text.slice(0, idxRef.current));

      if (idxRef.current >= text.length) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setIsComplete(true);
        onComplete?.();
      }
    }, stepMs);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [text, cps, enabled, onComplete]);

  const skipToEnd = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setDisplayedText(text);
    setIsComplete(true);
    onComplete?.();
  };

  return { displayedText, isComplete, skipToEnd };
}
