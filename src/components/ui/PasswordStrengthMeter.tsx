import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PasswordStrengthMeterProps {
  password: string;
}

function calculateStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

const STRENGTH_KEYS = ["weak", "fair", "good", "strong"] as const;
const STRENGTH_COLORS = [
  "bg-destructive",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
];

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { t } = useLanguage();
  const strength = useMemo(() => calculateStrength(password), [password]);

  if (!password) return null;

  const level = Math.max(0, strength - 1); // 0-3 index
  const label = t(`passwordStrength.${STRENGTH_KEYS[level]}`);
  const color = STRENGTH_COLORS[level];

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1 h-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors duration-300 ${
              i <= level ? color : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${
        level <= 0 ? "text-destructive" : level === 1 ? "text-orange-500" : level === 2 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
      }`}>
        {label}
      </p>
    </div>
  );
}
