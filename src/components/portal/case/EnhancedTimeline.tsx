import { CheckCircle2, Clock, AlertCircle, MessageSquare, CreditCard, FileSignature, Truck, Sparkles, ArrowUpRight, LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { GlassIcon } from "@/components/ui/glass-icon";
import { glassColors, GlassColorVariant } from "@/lib/glass-colors";

interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  status: string;
  event_type?: string;
  created_at: string;
}

interface EnhancedTimelineProps {
  events: TimelineEvent[];
  language?: string;
}

const eventTypeIcons: Record<string, { 
  icon: LucideIcon; 
  variant: GlassColorVariant;
}> = {
  payment: { icon: CreditCard, variant: 'warning' },
  contract: { icon: FileSignature, variant: 'info' },
  delivery: { icon: Truck, variant: 'purple' },
  message: { icon: MessageSquare, variant: 'danger' },
  default: { icon: Clock, variant: 'neutral' }
};

const statusConfig: Record<string, { 
  label: string; 
  icon: LucideIcon; 
  variant: GlassColorVariant;
}> = {
  done: { label: 'مكتمل', icon: CheckCircle2, variant: 'success' },
  in_progress: { label: 'جاري', icon: Clock, variant: 'info' },
  open: { label: 'قيد الانتظار', icon: Clock, variant: 'warning' },
  blocked: { label: 'متوقف', icon: AlertCircle, variant: 'danger' }
};

export function EnhancedTimeline({ events, language = 'ar' }: EnhancedTimelineProps) {
  const dateLocale = language === 'ar' ? ar : enUS;

  if (events.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden text-center py-16 bg-card/50 backdrop-blur-xl rounded-3xl border-2 border-border/50"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-muted/20 to-transparent" />
        
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <GlassIcon 
            icon={Clock}
            variant="neutral"
            size="xl"
            className="mx-auto mb-4"
          />
        </motion.div>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg font-semibold text-foreground"
        >
          لا توجد أحداث بعد
        </motion.p>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-muted-foreground mt-1"
        >
          ستظهر تحديثات ملفك هنا
        </motion.p>
      </motion.div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, x: -30 },
    show: { 
      opacity: 1, 
      x: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 25 }
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="relative"
    >
      {/* Gradient Vertical Line */}
      <div className="absolute right-6 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-primary via-primary/50 to-muted/30" />

      <div className="space-y-5">
        {events.map((event, index) => {
          const eventType = eventTypeIcons[event.event_type || 'default'] || eventTypeIcons.default;
          const status = statusConfig[event.status] || statusConfig.open;
          const EventIcon = eventType.icon;
          const StatusIcon = status.icon;
          const colors = glassColors[status.variant];
          const isFirst = index === 0;

          return (
            <motion.div
              key={event.id}
              variants={item}
              whileHover={{ x: -8 }}
              className="relative flex gap-5 pr-14 group"
            >
              {/* Timeline Node */}
              <div className="absolute right-3.5 top-2">
                <motion.div
                  whileHover={{ scale: 1.3 }}
                  className={cn(
                    "relative h-6 w-6 rounded-full border-3 border-background shadow-lg",
                    `bg-gradient-to-br ${colors.gradient}`
                  )}
                >
                  {/* Pulse Animation for First/In Progress */}
                  {(isFirst || event.status === 'in_progress') && (
                    <>
                      <span className={cn(
                        "absolute inset-0 rounded-full animate-ping",
                        colors.bg.replace('from-', 'bg-').split(' ')[0]
                      )} style={{ opacity: 0.5 }} />
                      <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-amber-400" />
                    </>
                  )}
                </motion.div>
              </div>

              {/* Event Card */}
              <motion.div 
                className={cn(
                  "flex-1 p-5 rounded-2xl transition-all duration-500",
                  "bg-card/50 backdrop-blur-xl border-2",
                  colors.border,
                  "group-hover:bg-card group-hover:shadow-xl"
                )}
              >
                {/* Shimmer on Hover */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <motion.div
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100"
                    animate={{ translateX: ['100%', '-100%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  />
                </div>

                <div className="relative flex items-start justify-between gap-4">
                  {/* Icon & Content */}
                  <div className="flex items-start gap-4">
                    <GlassIcon 
                      icon={EventIcon}
                      variant={eventType.variant}
                      size="md"
                      glow={isFirst}
                    />

                    <div>
                      <h4 className="font-semibold text-foreground text-base flex items-center gap-2">
                        {event.title}
                        {isFirst && (
                          <ArrowUpRight className="h-4 w-4 text-primary" />
                        )}
                      </h4>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Badge 
                      className={cn(
                        "shrink-0 text-xs border-2 px-2.5 py-1 font-semibold",
                        `${colors.bg.replace('from-', 'bg-').split(' ')[0]} ${colors.text} ${colors.border}`
                      )}
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </motion.div>
                </div>

                {/* Timestamp */}
                <div className="relative mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: dateLocale })}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
