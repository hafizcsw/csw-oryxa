import { useState, useCallback } from 'react';

interface RateLimitOptions {
  maxAttempts?: number;
  windowMs?: number;
}

export function useRateLimit(
  action: string,
  options: RateLimitOptions = {}
) {
  const { maxAttempts = 5, windowMs = 60000 } = options;
  const [attempts, setAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);

  const canPerform = useCallback(() => {
    if (blockedUntil && Date.now() < blockedUntil) {
      return false;
    }
    if (blockedUntil && Date.now() >= blockedUntil) {
      // Reset if block period expired
      setAttempts(0);
      setBlockedUntil(null);
    }
    return attempts < maxAttempts;
  }, [attempts, blockedUntil, maxAttempts]);

  const recordAttempt = useCallback(() => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (newAttempts >= maxAttempts) {
      const blockUntil = Date.now() + windowMs;
      setBlockedUntil(blockUntil);
      
      setTimeout(() => {
        setAttempts(0);
        setBlockedUntil(null);
      }, windowMs);
    }
  }, [attempts, maxAttempts, windowMs]);

  const remainingTime = blockedUntil ? Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000)) : 0;

  return {
    canPerform: canPerform(),
    recordAttempt,
    isBlocked: !canPerform(),
    remainingTime,
    attemptsLeft: Math.max(0, maxAttempts - attempts)
  };
}
