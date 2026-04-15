import { GraduationCap, FileText, Clock, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { motion } from "framer-motion";

interface LiquidGlassHeaderProps {
  applicationId?: string;
  programName?: string;
  universityName?: string;
  status?: 'active' | 'pending' | 'completed';
  lastUpdated?: string;
  language?: string;
}

export function LiquidGlassHeader({
  applicationId,
  programName,
  universityName,
  status = 'active',
  lastUpdated,
  language = 'ar'
}: LiquidGlassHeaderProps) {
  const dateLocale = language === 'ar' ? ar : enUS;

  const statusConfig = {
    active: {
      label: 'نشط',
      className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    },
    pending: {
      label: 'قيد المراجعة',
      className: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    },
    completed: {
      label: 'مكتمل',
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  };

  const currentStatus = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Liquid Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background/80 backdrop-blur-xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent opacity-60" />
      
      {/* Animated Gradient Orbs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-2xl animate-pulse delay-1000" />

      {/* Content */}
      <div className="relative z-10 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          {/* Main Info */}
          <div className="flex items-start gap-4">
            {/* Animated Icon */}
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="relative"
            >
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30">
                <GraduationCap className="h-8 w-8 md:h-10 md:w-10 text-primary-foreground" />
              </div>
              {/* Status Indicator Dot */}
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
            </motion.div>

            <div className="space-y-2">
              {/* Application ID */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  رقم الملف
                </span>
                <Badge variant="outline" className="font-mono text-xs bg-background/50 backdrop-blur-sm">
                  #{applicationId || '---'}
                </Badge>
              </div>

              {/* Program & University */}
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                {programName || 'حالة ملفك الدراسي'}
              </h1>
              {universityName && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {universityName}
                </p>
              )}

              {/* Status Badge */}
              <Badge className={`${currentStatus.className} border font-medium`}>
                <span className="w-2 h-2 rounded-full bg-current mr-2 animate-pulse" />
                {currentStatus.label}
              </Badge>
            </div>
          </div>

          {/* Right Side - Actions & Meta */}
          <div className="flex flex-col items-end gap-3">
            {/* WhatsApp Button */}
            <Button
              variant="outline"
              className="bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20 gap-2"
              onClick={() => window.open('https://wa.me/966500000000', '_blank')}
            >
              <MessageCircle className="h-4 w-4" />
              تواصل عبر واتساب
            </Button>

            {/* Last Updated */}
            {lastUpdated && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <Clock className="h-3 w-3" />
                آخر تحديث: {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true, locale: dateLocale })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Border Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </motion.div>
  );
}
