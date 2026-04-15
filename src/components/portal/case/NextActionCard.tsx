import { ArrowLeft, CreditCard, FileSignature, Truck, Clock, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { useSmartCountdown } from "@/hooks/usePageVisibility";

interface NextActionCardProps {
  action: 'payment' | 'contract' | 'delivery' | 'track';
  label: string;
  description?: string;
  dueAt?: string;
  onAction: () => void;
}

const actionConfig = {
  payment: {
    icon: CreditCard,
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-500/20 to-orange-500/20',
    description: 'أكمل الدفع للمتابعة في إجراءات التسجيل'
  },
  contract: {
    icon: FileSignature,
    gradient: 'from-blue-500 to-indigo-500',
    bgGradient: 'from-blue-500/20 to-indigo-500/20',
    description: 'راجع شروط العقد ووقّع إلكترونياً'
  },
  delivery: {
    icon: Truck,
    gradient: 'from-emerald-500 to-teal-500',
    bgGradient: 'from-emerald-500/20 to-teal-500/20',
    description: 'حدد طريقة استلام وثائقك الرسمية'
  },
  track: {
    icon: Clock,
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-500/20 to-pink-500/20',
    description: 'تابع حالة ملفك ومراحل التقدم'
  }
};

/**
 * Countdown Display - P1 Optimization
 * Uses useSmartCountdown which pauses when page is hidden
 */
function CountdownDisplay({ dueAt }: { dueAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  const handleTick = useCallback((secondsRemaining: number, expired: boolean) => {
    setIsExpired(expired);
    
    if (expired) {
      setTimeLeft('انتهى الوقت');
      return;
    }

    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);
    const seconds = secondsRemaining % 60;
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      setTimeLeft(`${days} يوم ${hours % 24} ساعة`);
    } else {
      setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }
  }, []);

  // Smart countdown: pauses when page is hidden
  useSmartCountdown(dueAt, handleTick);

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono",
      isExpired ? "bg-red-500/20 text-red-400" : "bg-background/50 text-foreground"
    )}>
      <Timer className="h-4 w-4" />
      {timeLeft}
    </div>
  );
}

export function NextActionCard({ action, label, description, dueAt, onAction }: NextActionCardProps) {
  const config = actionConfig[action];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      whileHover={{ scale: 1.01 }}
      className="relative overflow-hidden rounded-2xl border-2 border-primary/30"
    >
      {/* Animated Background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-r opacity-20",
        config.bgGradient
      )} />
      <div className="absolute inset-0 bg-card/80 backdrop-blur-xl" />

      {/* Animated Border Glow */}
      <div className="absolute inset-0 rounded-2xl animate-pulse" style={{
        background: `linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite'
      }} />

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left Side - Icon and Info */}
          <div className="flex items-start gap-4">
            {/* Animated Icon Container */}
            <motion.div 
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 2, -2, 0]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className={cn(
                "relative h-16 w-16 rounded-2xl flex items-center justify-center",
                "bg-gradient-to-br shadow-xl",
                config.gradient
              )}
            >
              <Icon className="h-8 w-8 text-white" />
              
              {/* Pulse Ring */}
              <span className="absolute inset-0 rounded-2xl animate-ping opacity-30" 
                style={{ background: `linear-gradient(to bottom right, ${config.gradient.includes('amber') ? '#f59e0b' : config.gradient.includes('blue') ? '#3b82f6' : config.gradient.includes('emerald') ? '#10b981' : '#a855f7'}, transparent)` }}
              />
            </motion.div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                الخطوة التالية
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-foreground">
                {label}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {description || config.description}
              </p>
            </div>
          </div>

          {/* Right Side - Countdown & Action */}
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            {dueAt && <CountdownDisplay dueAt={dueAt} />}
            
            <Button 
              size="lg"
              onClick={onAction}
              className={cn(
                "w-full md:w-auto gap-2 shadow-lg hover:shadow-xl transition-all",
                "bg-gradient-to-r text-white font-semibold",
                config.gradient
              )}
            >
              {label}
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
