// Premium Liquid Glass 2.0 Color System
export const glassColors = {
  success: {
    bg: 'from-emerald-500/20 to-teal-500/10',
    glow: 'shadow-emerald-500/30',
    border: 'border-emerald-500/30',
    text: 'text-emerald-500',
    icon: '#10b981',
    gradient: 'from-emerald-500 to-teal-500',
  },
  warning: {
    bg: 'from-amber-500/20 to-orange-500/10',
    glow: 'shadow-amber-500/30',
    border: 'border-amber-500/30',
    text: 'text-amber-500',
    icon: '#f59e0b',
    gradient: 'from-amber-500 to-orange-500',
  },
  danger: {
    bg: 'from-red-500/20 to-rose-500/10',
    glow: 'shadow-red-500/30',
    border: 'border-red-500/30',
    text: 'text-red-500',
    icon: '#ef4444',
    gradient: 'from-red-500 to-rose-500',
  },
  info: {
    bg: 'from-blue-500/20 to-indigo-500/10',
    glow: 'shadow-blue-500/30',
    border: 'border-blue-500/30',
    text: 'text-blue-500',
    icon: '#3b82f6',
    gradient: 'from-blue-500 to-indigo-500',
  },
  purple: {
    bg: 'from-purple-500/20 to-pink-500/10',
    glow: 'shadow-purple-500/30',
    border: 'border-purple-500/30',
    text: 'text-purple-500',
    icon: '#a855f7',
    gradient: 'from-purple-500 to-pink-500',
  },
  primary: {
    bg: 'from-primary/20 to-primary/10',
    glow: 'shadow-primary/30',
    border: 'border-primary/30',
    text: 'text-primary',
    icon: 'hsl(var(--primary))',
    gradient: 'from-primary to-primary/80',
  },
  neutral: {
    bg: 'from-muted/40 to-muted/20',
    glow: 'shadow-muted/20',
    border: 'border-border',
    text: 'text-muted-foreground',
    icon: 'hsl(var(--muted-foreground))',
    gradient: 'from-muted to-muted/60',
  },
} as const;

export type GlassColorVariant = keyof typeof glassColors;

// Status to color mapping
export const statusColors: Record<string, GlassColorVariant> = {
  // Payment statuses
  requested: 'warning',
  proof_received: 'info',
  proof_rejected: 'danger',
  fully_paid: 'success',
  paid: 'success',
  pending: 'warning',
  
  // General statuses
  done: 'success',
  completed: 'success',
  in_progress: 'info',
  active: 'info',
  waiting: 'warning',
  error: 'danger',
  rejected: 'danger',
  
  // Document statuses
  verified: 'success',
  uploaded: 'info',
  missing: 'warning',
  
  // Contract statuses
  signed: 'success',
  ready: 'warning',
  
  // Delivery statuses
  delivered: 'success',
  in_transit: 'info',
  processing: 'warning',
};

export function getStatusColor(status: string): GlassColorVariant {
  return statusColors[status?.toLowerCase()] || 'neutral';
}
