import { FileText, CheckCircle, MessageCircle, Send, Clock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface TimelineEvent {
  id: string;
  type: 'document' | 'status' | 'message' | 'submission' | 'reminder' | 'alert';
  title: string;
  description?: string;
  timestamp: string;
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
}

const EVENT_CONFIG = {
  document: {
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
  },
  status: {
    icon: CheckCircle,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
  },
  message: {
    icon: MessageCircle,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10 dark:bg-purple-500/20',
  },
  submission: {
    icon: Send,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10 dark:bg-orange-500/20',
  },
  reminder: {
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
  },
  alert: {
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 dark:bg-red-500/20',
  },
};

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">آخر التحديثات</h3>
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>لا توجد تحديثات حتى الآن</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="text-lg font-bold text-foreground mb-4">آخر التحديثات</h3>
      
      <div className="space-y-4">
        {events.map((event, index) => {
          const config = EVENT_CONFIG[event.type];
          const IconComponent = config.icon;
          
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex gap-4 relative"
            >
              {/* Timeline line */}
              {index !== events.length - 1 && (
                <div className="absolute top-12 right-5 w-0.5 h-full bg-border" />
              )}
              
              {/* Icon */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center z-10`}>
                <IconComponent className={`w-5 h-5 ${config.color}`} />
              </div>
              
              {/* Content */}
              <div className="flex-1 pb-4">
                <p className="font-medium text-foreground">{event.title}</p>
                {event.description && (
                  <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(event.timestamp).toLocaleDateString('ar-SA', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
