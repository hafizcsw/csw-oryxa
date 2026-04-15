import { TrendingUp, CreditCard, FileCheck, Calendar, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlassIcon, AnimatedCounter } from "@/components/ui/glass-icon";
import { glassColors } from "@/lib/glass-colors";

interface QuickStatsGridProps {
  progressPercent: number;
  pendingAmount: number;
  currency?: string;
  readyFilesCount: number;
  estimatedDays?: number;
}

export function QuickStatsGrid({
  progressPercent,
  pendingAmount,
  currency = 'SAR',
  readyFilesCount,
  estimatedDays
}: QuickStatsGridProps) {
  const stats = [
    {
      icon: TrendingUp,
      label: 'التقدم الكلي',
      value: progressPercent,
      suffix: '%',
      subValue: 'مكتمل',
      variant: 'success' as const,
      progress: progressPercent,
      glow: progressPercent >= 50
    },
    {
      icon: CreditCard,
      label: 'المبلغ المتبقي',
      value: pendingAmount,
      suffix: '',
      subValue: currency,
      variant: pendingAmount > 0 ? 'warning' as const : 'success' as const,
      glow: pendingAmount === 0
    },
    {
      icon: FileCheck,
      label: 'ملفات جاهزة',
      value: readyFilesCount,
      suffix: '',
      subValue: 'للتحميل',
      variant: 'info' as const,
      glow: readyFilesCount > 0
    },
    {
      icon: Calendar,
      label: 'المدة المتوقعة',
      value: estimatedDays || 0,
      suffix: '',
      subValue: 'يوم',
      variant: 'purple' as const,
      showDash: !estimatedDays
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring" as const, stiffness: 300, damping: 20 }
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
    >
      {stats.map((stat, index) => {
        const colors = glassColors[stat.variant];
        
        return (
          <motion.div
            key={stat.label}
            variants={item}
            whileHover={{ scale: 1.03, y: -4 }}
            className={cn(
              "group relative overflow-hidden rounded-2xl p-4 md:p-5",
              "bg-card/50 backdrop-blur-xl border-2 transition-all duration-500",
              colors.border,
              stat.glow && `shadow-lg ${colors.glow}`
            )}
          >
            {/* Animated Background Gradient */}
            <motion.div 
              className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                `bg-gradient-to-br ${colors.bg}`
              )}
              initial={false}
            />
            
            {/* Shimmer Effect */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <motion.div
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ translateX: ['100%', '-100%'] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              />
            </div>

            {/* Floating Particles for Active Stats */}
            {stat.glow && (
              <motion.div
                className="absolute top-2 right-2"
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity }
                }}
              >
                <Sparkles className="h-4 w-4 text-amber-400/60" />
              </motion.div>
            )}
            
            {/* Glass Icon */}
            <div className="relative mb-3">
              <GlassIcon 
                icon={stat.icon}
                variant={stat.variant}
                size="md"
                glow={stat.glow}
                pulse={stat.variant === 'success' && stat.progress && stat.progress >= 100}
              />
            </div>

            {/* Label */}
            <p className="relative text-xs text-muted-foreground mb-1 font-medium">
              {stat.label}
            </p>

            {/* Value with Animation */}
            <div className="relative flex items-baseline gap-1.5">
              <span className="text-2xl md:text-3xl font-bold text-foreground">
                {stat.showDash ? '—' : (
                  <AnimatedCounter 
                    value={stat.value} 
                    suffix={stat.suffix}
                  />
                )}
              </span>
              <span className="text-xs text-muted-foreground font-medium">{stat.subValue}</span>
            </div>

            {/* Progress Bar with Gradient */}
            {stat.progress !== undefined && (
              <div className="relative mt-4">
                <div className="absolute inset-0 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      `bg-gradient-to-r ${colors.gradient}`
                    )}
                    style={{ width: `${stat.progress}%` }}
                  />
                </div>
                <Progress value={stat.progress} className="h-2 bg-muted/30" />
              </div>
            )}

            {/* Decorative Corner Orb */}
            <motion.div 
              className={cn(
                "absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20",
                `bg-gradient-to-br ${colors.gradient}`
              )}
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.3, 0.2]
              }}
              transition={{ duration: 4, repeat: Infinity }}
            />

            {/* Bottom Glow Line */}
            <div className={cn(
              "absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
              `bg-gradient-to-r ${colors.gradient}`
            )} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
