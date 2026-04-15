import { AlertTriangle, Link2, RefreshCw, MessageCircle, X, WifiOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import type { PortalErrorCode } from "@/types/portal";

interface PortalNoticeBarProps {
  errorCode: PortalErrorCode | null;
  onRelink?: () => void;
  onRetry?: () => void;
  onLoginFromChat?: () => void;
  onDismiss?: () => void;
}

const ERROR_CONFIG: Record<PortalErrorCode, {
  icon: typeof AlertTriangle;
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: 'relink' | 'retry' | 'login';
  variant: 'warning' | 'error' | 'info';
}> = {
  no_linked_customer: {
    icon: Link2,
    title: "الحساب غير مربوط",
    message: "لم يتم ربط حسابك بنظام الإدارة بعد. يرجى إعادة الربط للوصول لبياناتك.",
    actionLabel: "إعادة الربط",
    actionType: 'relink',
    variant: 'warning',
  },
  invalid_token: {
    icon: Lock,
    title: "انتهت صلاحية الجلسة",
    message: "يرجى تسجيل الدخول مجدداً من خلال المحادثة للحصول على رابط جديد.",
    actionLabel: "الذهاب للمحادثة",
    actionType: 'login',
    variant: 'error',
  },
  network_error: {
    icon: WifiOff,
    title: "خطأ في الاتصال",
    message: "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.",
    actionLabel: "إعادة المحاولة",
    actionType: 'retry',
    variant: 'error',
  },
  feature_not_available: {
    icon: AlertTriangle,
    title: "الميزة غير متاحة",
    message: "هذه الميزة قيد التطوير وستكون متاحة قريباً.",
    variant: 'info',
  },
  auth_required: {
    icon: Lock,
    title: "يرجى تسجيل الدخول",
    message: "يجب تسجيل الدخول للوصول لهذه الصفحة.",
    actionLabel: "تسجيل الدخول",
    actionType: 'login',
    variant: 'warning',
  },
  unknown: {
    icon: AlertTriangle,
    title: "حدث خطأ",
    message: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
    actionLabel: "إعادة المحاولة",
    actionType: 'retry',
    variant: 'error',
  },
};

export function PortalNoticeBar({ 
  errorCode, 
  onRelink, 
  onRetry, 
  onLoginFromChat,
  onDismiss 
}: PortalNoticeBarProps) {
  if (!errorCode) return null;

  const config = ERROR_CONFIG[errorCode] || ERROR_CONFIG.unknown;
  const Icon = config.icon;

  const handleAction = () => {
    switch (config.actionType) {
      case 'relink':
        onRelink?.();
        break;
      case 'retry':
        onRetry?.();
        break;
      case 'login':
        onLoginFromChat?.();
        break;
    }
  };

  const variantStyles = {
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
    error: 'bg-destructive/10 border-destructive/30 text-destructive',
    info: 'bg-primary/10 border-primary/30 text-primary',
  };

  const iconStyles = {
    warning: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    error: 'bg-destructive/20 text-destructive',
    info: 'bg-primary/20 text-primary',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`relative overflow-hidden rounded-xl border p-4 ${variantStyles[config.variant]}`}
      >
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 p-2 rounded-lg ${iconStyles[config.variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-1">{config.title}</h4>
            <p className="text-sm opacity-90">{config.message}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {config.actionLabel && config.actionType && (
              <Button
                size="sm"
                variant={config.variant === 'error' ? 'destructive' : 'default'}
                onClick={handleAction}
                className="gap-2"
              >
                {config.actionType === 'relink' && <Link2 className="h-4 w-4" />}
                {config.actionType === 'retry' && <RefreshCw className="h-4 w-4" />}
                {config.actionType === 'login' && <MessageCircle className="h-4 w-4" />}
                {config.actionLabel}
              </Button>
            )}
            
            {onDismiss && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onDismiss}
                className="h-8 w-8 opacity-60 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
