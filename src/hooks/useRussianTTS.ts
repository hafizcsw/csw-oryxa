import { useCallback, useState } from 'react';
import { fetchAndCacheTTS, playAudioUrl } from '@/lib/ttsCache';

/**
 * Hook for playing Russian TTS audio with OpenAI via edge function.
 * Falls back to browser SpeechSynthesis if the API call fails.
 * All audio is cached in IndexedDB after first fetch.
 */
export function useRussianTTS(speed = 0.9) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);

  const speak = useCallback(async (text: string) => {
    if (!text) return;
    setIsSpeaking(true);
    setSpeakingText(text);
    try {
      const audioUrl = await fetchAndCacheTTS(text, speed);
      await playAudioUrl(audioUrl);
    } catch (err) {
      console.warn('OpenAI TTS failed, falling back to browser:', err);
      try {
        await browserTTSFallback(text, speed);
      } catch {
        // silently fail
      }
    } finally {
      setIsSpeaking(false);
      setSpeakingText(null);
    }
  }, [speed]);

  return { speak, isSpeaking, speakingText };
}

function browserTTSFallback(text: string, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    u.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const ruVoice = voices.find(v => v.lang.startsWith('ru'));
    if (ruVoice) u.voice = ruVoice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}
