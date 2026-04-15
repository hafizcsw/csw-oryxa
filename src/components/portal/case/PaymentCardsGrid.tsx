import { CreditCard, Upload, Download, CheckCircle2, XCircle, Clock, Eye, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlassIcon, AnimatedCounter } from "@/components/ui/glass-icon";
import { glassColors, GlassColorVariant } from "@/lib/glass-colors";

interface Payment {
  id: string;
  amount_required: number;
  currency: string;
  status: string;
  rejection_reason?: string;
  receipt_no?: string;
}

interface PaymentCardsGridProps {
  payments: Payment[];
  onCardPayment: (paymentId: string) => void;
  onUploadProof: (paymentId: string) => void;
  onViewEvidence?: (paymentId: string) => void;
  onDownloadReceipt?: (paymentId: string) => void;
}

const statusConfig: Record<string, {
  label: string;
  icon: React.ElementType;
  variant: GlassColorVariant;
}> = {
  fully_paid: {
    label: 'مدفوع',
    icon: CheckCircle2,
    variant: 'success'
  },
  proof_received: {
    label: 'قيد المراجعة',
    icon: Clock,
    variant: 'info'
  },
  proof_rejected: {
    label: 'مرفوض',
    icon: XCircle,
    variant: 'danger'
  },
  requested: {
    label: 'معلق',
    icon: CreditCard,
    variant: 'warning'
  }
};

export function PaymentCardsGrid({
  payments,
  onCardPayment,
  onUploadProof,
  onViewEvidence,
  onDownloadReceipt
}: PaymentCardsGridProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring" as const, stiffness: 300, damping: 25 }
    }
  };

  if (payments.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden text-center py-16 bg-card/50 backdrop-blur-xl rounded-3xl border-2 border-emerald-500/30"
      >
        {/* Background Animation */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5" />
        <motion.div
          className="absolute inset-0"
          animate={{ 
            background: [
              'radial-gradient(circle at 30% 30%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)',
              'radial-gradient(circle at 70% 70%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)'
            ]
          }}
          transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
        />
        
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <GlassIcon 
            icon={CheckCircle2}
            variant="success"
            size="xl"
            glow
            className="mx-auto mb-4"
          />
        </motion.div>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg font-semibold text-foreground"
        >
          لا توجد مدفوعات معلقة
        </motion.p>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-muted-foreground mt-1"
        >
          جميع المدفوعات مكتملة ✨
        </motion.p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 gap-5"
    >
      {payments.map((payment) => {
        const status = statusConfig[payment.status as keyof typeof statusConfig] || statusConfig.requested;
        const StatusIcon = status.icon;
        const colors = glassColors[status.variant];

        return (
          <motion.div
            key={payment.id}
            variants={item}
            whileHover={{ scale: 1.02, y: -4 }}
            className={cn(
              "group relative overflow-hidden rounded-3xl p-6",
              "bg-card/50 backdrop-blur-xl border-2 transition-all duration-500",
              colors.border,
              "hover:shadow-2xl"
            )}
          >
            {/* Animated Background */}
            <motion.div 
              className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                `bg-gradient-to-br ${colors.bg}`
              )}
            />

            {/* Shimmer Effect */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl">
              <motion.div
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent"
                animate={{ translateX: ['100%', '-100%'] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 3 }}
              />
            </div>

            {/* Floating Sparkle for Success */}
            {payment.status === 'fully_paid' && (
              <motion.div
                className="absolute top-4 left-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-5 w-5 text-emerald-400/60" />
              </motion.div>
            )}

            {/* Top Decorative Orb */}
            <motion.div 
              className={cn(
                "absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-30",
                `bg-gradient-to-br ${colors.gradient}`
              )}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
            />

            <div className="relative space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <GlassIcon 
                    icon={CreditCard}
                    variant={status.variant}
                    size="lg"
                    glow={payment.status === 'fully_paid'}
                  />
                  <div>
                    <motion.p 
                      className="text-3xl font-bold text-foreground"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <AnimatedCounter value={payment.amount_required} />
                    </motion.p>
                    <p className="text-sm text-muted-foreground font-medium">{payment.currency}</p>
                  </div>
                </div>

                {/* Status Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Badge className={cn(
                    "border-2 px-3 py-1.5 text-sm font-semibold",
                    `${colors.bg.replace('from-', 'bg-').split(' ')[0]} ${colors.text} ${colors.border}`
                  )}>
                    <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                    {status.label}
                  </Badge>
                </motion.div>
              </div>

              {/* Rejection Reason */}
              {payment.status === 'proof_rejected' && payment.rejection_reason && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 rounded-2xl bg-red-500/10 border-2 border-red-500/20"
                >
                  <p className="text-xs font-semibold text-red-400 mb-1.5">سبب الرفض:</p>
                  <p className="text-sm text-red-300">{payment.rejection_reason}</p>
                </motion.div>
              )}

              {/* Receipt Number */}
              {payment.status === 'fully_paid' && payment.receipt_no && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20"
                >
                  <p className="text-xs font-semibold text-emerald-400">رقم الإيصال:</p>
                  <p className="text-sm font-mono text-emerald-300 mt-1">{payment.receipt_no}</p>
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {(payment.status === 'requested' || payment.status === 'proof_rejected') && (
                  <>
                    <Button
                      className={cn(
                        "flex-1 h-12 text-base font-semibold rounded-xl",
                        "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground",
                        "shadow-lg hover:shadow-xl hover:shadow-primary/20 transition-all duration-300",
                        "group/btn"
                      )}
                      onClick={() => onCardPayment(payment.id)}
                    >
                      <CreditCard className="h-5 w-5 mr-2 group-hover/btn:scale-110 transition-transform" />
                      الدفع بالبطاقة
                      <ArrowRight className="h-4 w-4 mr-2 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-12 text-base rounded-xl border-2 hover:bg-muted/50"
                      onClick={() => onUploadProof(payment.id)}
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      رفع إثبات
                    </Button>
                  </>
                )}

                {payment.status === 'proof_received' && onViewEvidence && (
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base rounded-xl border-2 border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                    onClick={() => onViewEvidence(payment.id)}
                  >
                    <Eye className="h-5 w-5 mr-2" />
                    عرض الإثبات المرفق
                  </Button>
                )}

                {payment.status === 'fully_paid' && onDownloadReceipt && (
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base rounded-xl border-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 group/btn"
                    onClick={() => onDownloadReceipt(payment.id)}
                  >
                    <Download className="h-5 w-5 mr-2 group-hover/btn:animate-bounce" />
                    تحميل الإيصال
                  </Button>
                )}
              </div>
            </div>

            {/* Bottom Glow Line */}
            <div className={cn(
              "absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
              `bg-gradient-to-r ${colors.gradient}`
            )} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
