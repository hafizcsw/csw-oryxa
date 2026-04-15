import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { glassColors, GlassColorVariant } from "@/lib/glass-colors";

interface GlassIconProps {
  icon: LucideIcon;
  variant?: GlassColorVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  glow?: boolean;
  pulse?: boolean;
  animate?: boolean;
  className?: string;
}

const sizeConfig = {
  xs: { container: 'w-8 h-8', icon: 'h-4 w-4' },
  sm: { container: 'w-10 h-10', icon: 'h-5 w-5' },
  md: { container: 'w-12 h-12', icon: 'h-6 w-6' },
  lg: { container: 'w-14 h-14', icon: 'h-7 w-7' },
  xl: { container: 'w-16 h-16', icon: 'h-8 w-8' },
};

export function GlassIcon({
  icon: Icon,
  variant = 'primary',
  size = 'md',
  glow = false,
  pulse = false,
  animate = true,
  className,
}: GlassIconProps) {
  const colors = glassColors[variant];
  const sizes = sizeConfig[size];

  return (
    <motion.div
      initial={animate ? { scale: 0.8, opacity: 0 } : false}
      animate={animate ? { scale: 1, opacity: 1 } : false}
      whileHover={animate ? { scale: 1.05, y: -2 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn(
        "relative flex items-center justify-center rounded-xl",
        "bg-gradient-to-br backdrop-blur-sm",
        "border shadow-lg",
        "transition-all duration-300",
        colors.bg,
        colors.border,
        glow && colors.glow,
        glow && "shadow-xl",
        sizes.container,
        className
      )}
    >
      {/* Inner glow effect */}
      <div className={cn(
        "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity",
        `bg-gradient-to-br ${colors.gradient}`,
        "blur-xl -z-10"
      )} />
      
      {/* Shimmer effect */}
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div className={cn(
          "absolute inset-0 -translate-x-full",
          "bg-gradient-to-r from-transparent via-white/10 to-transparent",
          "group-hover:translate-x-full transition-transform duration-1000"
        )} />
      </div>

      {/* Icon */}
      <motion.div
        animate={pulse ? { scale: [1, 1.1, 1] } : undefined}
        transition={pulse ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <Icon 
          className={cn(sizes.icon, colors.text)}
          style={{ color: colors.icon }}
        />
      </motion.div>

      {/* Decorative corner highlight */}
      <div className={cn(
        "absolute -top-1 -right-1 w-3 h-3 rounded-full opacity-60",
        `bg-gradient-to-br ${colors.gradient}`
      )} />
    </motion.div>
  );
}

// Animated status badge with glass effect
interface GlassStatusBadgeProps {
  status: string;
  label: string;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  className?: string;
}

export function GlassStatusBadge({
  status,
  label,
  icon: Icon,
  size = 'md',
  className,
}: GlassStatusBadgeProps) {
  const variant = getStatusVariant(status);
  const colors = glassColors[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full",
        "bg-gradient-to-r backdrop-blur-sm",
        "border px-3 py-1",
        colors.bg,
        colors.border,
        size === 'sm' && 'text-xs px-2 py-0.5',
        size === 'md' && 'text-sm',
        className
      )}
    >
      {Icon && <Icon className={cn("h-3.5 w-3.5", colors.text)} style={{ color: colors.icon }} />}
      <span className={cn("font-medium", colors.text)}>{label}</span>
    </motion.div>
  );
}

function getStatusVariant(status: string): GlassColorVariant {
  const statusMap: Record<string, GlassColorVariant> = {
    requested: 'warning',
    proof_received: 'info',
    proof_rejected: 'danger',
    fully_paid: 'success',
    paid: 'success',
    pending: 'warning',
    done: 'success',
    completed: 'success',
    in_progress: 'info',
    active: 'info',
    waiting: 'warning',
    error: 'danger',
    rejected: 'danger',
    verified: 'success',
    uploaded: 'info',
    missing: 'warning',
    signed: 'success',
    ready: 'warning',
  };
  return statusMap[status?.toLowerCase()] || 'neutral';
}

// Animated counter for numbers
interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function AnimatedCounter({ value, suffix = '', prefix = '', className }: AnimatedCounterProps) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <motion.span
        key={value}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {prefix}{value.toLocaleString()}{suffix}
      </motion.span>
    </motion.span>
  );
}

// Glass card wrapper
interface GlassCardProps {
  children: React.ReactNode;
  variant?: GlassColorVariant;
  hover?: boolean;
  className?: string;
  onClick?: () => void;
}

export function GlassCard({ children, variant = 'neutral', hover = true, className, onClick }: GlassCardProps) {
  const colors = glassColors[variant];

  return (
    <motion.div
      whileHover={hover ? { scale: 1.02, y: -4 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl p-4",
        "bg-card/50 backdrop-blur-xl",
        "border shadow-lg",
        "transition-all duration-300",
        colors.border,
        hover && "hover:shadow-xl cursor-pointer",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Background gradient */}
      <div className={cn(
        "absolute inset-0 opacity-30",
        `bg-gradient-to-br ${colors.bg}`
      )} style={{ opacity: 0.1 }} />
      
      {/* Shimmer on hover */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div className={cn(
          "absolute inset-0 -translate-x-full",
          "bg-gradient-to-r from-transparent via-white/5 to-transparent",
          "group-hover:translate-x-full transition-transform duration-1000"
        )} />
      </div>

      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
