import { useState } from "react";
import { Wallet, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Lock, TrendingUp, Clock, CheckCircle, XCircle, RotateCcw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { useStudentPayments } from "@/hooks/useStudentPayments";
import { useWalletLedger } from "@/hooks/useWalletLedger";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LedgerEntryType, LedgerEntryStatus } from "@/types/portal";

type PaymentFilter = 'all' | 'paid' | 'pending' | 'refunded' | 'failed';

export function WalletHeaderWidget() {
  // Payments for totals + next due
  const { payments, totalPaid, totalRequired, nextDuePayment, loading: paymentsLoading, error: paymentsError, refetch: refetchPayments } = useStudentPayments();
  
  // Wallet ledger for balance + recent entries (limit=5 for summary)
  const { available, pending, entries, loading: ledgerLoading, error: ledgerError, featureAvailable, refetch: refetchLedger } = useWalletLedger({ currency: 'USD', limit: 5 });
  
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [open, setOpen] = useState(false);
  
  const loading = paymentsLoading || ledgerLoading;
  const error = paymentsError || ledgerError;
  
  const refetch = () => {
    refetchPayments();
    refetchLedger();
  };
  
  // Ensure payments is always an array
  const safePayments = Array.isArray(payments) ? payments : [];

  // Calculate stats from payments
  const totalRefunded = safePayments
    .filter(p => p.status === 'refunded')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const safeTotalRequired = totalRequired ?? 0;
  const safeTotalPaid = totalPaid ?? 0;
  const remaining = Math.max(0, safeTotalRequired - safeTotalPaid);

  // Filter payments for transactions section
  const filteredPayments = filter === 'all' 
    ? safePayments 
    : safePayments.filter(p => p.status === filter);

  // Wallet actions (Coming Soon)
  const walletActions = [
    { icon: ArrowDownLeft, label: "إيداع", sublabel: "Top Up", disabled: true },
    { icon: ArrowUpRight, label: "سحب", sublabel: "Withdraw", disabled: true },
    { icon: ArrowRightLeft, label: "تحويل", sublabel: "Transfer", disabled: true },
  ];

  // Ledger entry type config
  const getLedgerEntryConfig = (entryType: LedgerEntryType) => {
    switch (entryType) {
      case 'deposit':
        return { icon: ArrowDownLeft, label: 'إيداع', className: 'text-success bg-success/10' };
      case 'withdrawal':
        return { icon: ArrowUpRight, label: 'سحب', className: 'text-amber-600 bg-amber-500/10' };
      case 'transfer':
        return { icon: ArrowRightLeft, label: 'تحويل', className: 'text-info bg-info/10' };
      case 'payment':
        return { icon: Wallet, label: 'دفعة', className: 'text-primary bg-primary/10' };
      case 'refund':
        return { icon: RotateCcw, label: 'استرداد', className: 'text-info bg-info/10' };
      case 'adjustment':
        return { icon: TrendingUp, label: 'تعديل', className: 'text-muted-foreground bg-muted' };
      default:
        return { icon: Wallet, label: entryType, className: 'text-muted-foreground bg-muted' };
    }
  };

  // Ledger entry status config
  const getLedgerStatusConfig = (status: LedgerEntryStatus) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, label: 'مكتمل', className: 'text-success bg-success/10' };
      case 'pending':
        return { icon: Clock, label: 'معلق', className: 'text-amber-600 bg-amber-500/10' };
      case 'failed':
        return { icon: XCircle, label: 'فشل', className: 'text-destructive bg-destructive/10' };
      case 'reversed':
        return { icon: RotateCcw, label: 'ملغي', className: 'text-info bg-info/10' };
      case 'canceled':
        return { icon: XCircle, label: 'ملغي', className: 'text-muted-foreground bg-muted' };
      default:
        return { icon: Clock, label: status, className: 'text-muted-foreground bg-muted' };
    }
  };

  // Payment status config (for payments section)
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'paid':
        return { icon: CheckCircle, label: 'مدفوع', className: 'text-success bg-success/10' };
      case 'pending':
        return { icon: Clock, label: 'معلق', className: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' };
      case 'refunded':
        return { icon: RotateCcw, label: 'مسترد', className: 'text-info bg-info/10' };
      case 'failed':
        return { icon: XCircle, label: 'فشل', className: 'text-destructive bg-destructive/10' };
      default:
        return { icon: Clock, label: status, className: 'text-muted-foreground bg-muted' };
    }
  };

  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 hover:bg-primary/10 dark:hover:bg-primary/20 px-3 py-2 rounded-lg"
              >
                <Wallet className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">
                  ${Number(available || 0).toFixed(2)}
                </span>
                {pending > 0 && (
                  <span className="text-xs text-muted-foreground">+${Number(pending || 0).toFixed(0)}</span>
                )}
              </Button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>المحفظة</p>
          </TooltipContent>
        </Tooltip>

        <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <Wallet className="h-5 w-5 text-primary" />
              المحفظة
            </SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-48 rounded-2xl bg-muted" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl bg-muted" />)}
              </div>
              <div className="h-64 rounded-xl bg-muted" />
            </div>
          ) : error ? (
            <Card className="p-8 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive font-medium mb-2">حدث خطأ في تحميل البيانات</p>
              <Button onClick={refetch} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 ml-2" />
                إعادة المحاولة
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Section 1: Balance Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-5 text-primary-foreground shadow-xl"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm opacity-80">الرصيد المتاح</p>
                      <p className="text-xs opacity-60">Available Balance</p>
                    </div>
                  </div>
                  
                  <div className="mb-5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight">${Number(available || 0).toFixed(2)}</span>
                      <span className="text-sm opacity-70">USD</span>
                    </div>
                    {pending > 0 && (
                      <div className="flex items-center gap-2 mt-1 text-sm opacity-80">
                        <Clock className="h-4 w-4" />
                        <span>معلق: ${Number(pending || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {!featureAvailable && (
                      <div className="flex items-center gap-2 mt-2 text-sm opacity-80">
                        <Lock className="h-4 w-4" />
                        <span>المحفظة قيد التطوير</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-3 gap-2">
                    {walletActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <Button
                          key={action.label}
                          variant="secondary"
                          disabled={action.disabled}
                          className="relative flex-col h-auto py-3 gap-1 bg-white/10 hover:bg-white/20 border-white/20 text-white disabled:opacity-50"
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-medium">{action.label}</span>
                          <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[9px] font-bold bg-amber-500 text-amber-950 rounded-full">
                            قريباً
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>

              {/* Section 2: Recent Ledger Entries (from CRM) */}
              {featureAvailable && entries.length > 0 && (
                <Card>
                  <CardContent className="pt-3 pb-2">
                    <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      آخر الحركات
                    </h3>
                    <div className="space-y-2">
                      {entries.slice(0, 5).map((entry) => {
                        const typeConfig = getLedgerEntryConfig(entry.entry_type);
                        const statusConfig = getLedgerStatusConfig(entry.status);
                        const TypeIcon = typeConfig.icon;
                        
                        return (
                          <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${typeConfig.className}`}>
                                <TypeIcon className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground text-sm">{typeConfig.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(entry.created_at), 'd MMM', { locale: ar })}
                                </p>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className={`font-bold text-sm ${
                                entry.entry_type === 'deposit' || entry.entry_type === 'refund' ? 'text-success' : 'text-foreground'
                              }`}>
                                {entry.entry_type === 'deposit' || entry.entry_type === 'refund' ? '+' : '-'}${Number(entry.amount || 0).toFixed(2)}
                              </p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusConfig.className}`}>
                                {statusConfig.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Section 3: Payment Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-muted-foreground/20">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Wallet className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">المطلوب</span>
                    </div>
                    <p className="text-xl font-bold">${safeTotalRequired.toLocaleString()}</p>
                  </CardContent>
                </Card>

                <Card className="border-success/20 bg-success/5">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-2 text-success mb-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">المدفوع</span>
                    </div>
                    <p className="text-xl font-bold text-success">${safeTotalPaid.toLocaleString()}</p>
                  </CardContent>
                </Card>

                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">المتبقي</span>
                    </div>
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">${remaining.toLocaleString()}</p>
                  </CardContent>
                </Card>

                <Card className="border-info/20 bg-info/5">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-2 text-info mb-1">
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">المسترد</span>
                    </div>
                    <p className="text-xl font-bold text-info">${totalRefunded.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Next Due Payment Alert */}
              {nextDuePayment && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/20">
                        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">الدفعة القادمة</p>
                        <p className="text-xs text-muted-foreground">{nextDuePayment.description || 'دفعة مستحقة'}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">${(nextDuePayment.amount ?? 0).toLocaleString()}</p>
                      {nextDuePayment.due_date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(nextDuePayment.due_date), 'd MMM yyyy', { locale: ar })}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Section 3: Transactions Ledger */}
              <Card>
                <div className="p-3 border-b border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      سجل المعاملات
                    </h3>
                    <span className="text-xs text-muted-foreground">{safePayments.length} معاملة</span>
                  </div>
                  
                  <Tabs value={filter} onValueChange={(v) => setFilter(v as PaymentFilter)}>
                    <TabsList className="w-full grid grid-cols-5 h-8">
                      <TabsTrigger value="all" className="text-xs px-1">الكل</TabsTrigger>
                      <TabsTrigger value="paid" className="text-xs px-1">مدفوع</TabsTrigger>
                      <TabsTrigger value="pending" className="text-xs px-1">معلق</TabsTrigger>
                      <TabsTrigger value="refunded" className="text-xs px-1">مسترد</TabsTrigger>
                      <TabsTrigger value="failed" className="text-xs px-1">فشل</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                  <AnimatePresence mode="popLayout">
                    {filteredPayments.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-6 text-center text-muted-foreground"
                      >
                        <Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">لا توجد معاملات {filter !== 'all' ? `بحالة "${getStatusConfig(filter).label}"` : ''}</p>
                      </motion.div>
                    ) : (
                      filteredPayments.map((payment, index) => {
                        const statusConfig = getStatusConfig(payment.status);
                        const StatusIcon = statusConfig.icon;
                        
                        return (
                          <motion.div
                            key={payment.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.03 }}
                            className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${statusConfig.className}`}>
                                <StatusIcon className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground text-sm">
                                  {payment.description || payment.service_type || 'دفعة'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {payment.payment_date 
                                    ? format(new Date(payment.payment_date), 'd MMM yyyy', { locale: ar })
                                    : 'تاريخ غير محدد'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-left">
                              <p className={`font-bold text-sm ${
                                payment.status === 'paid' ? 'text-success' :
                                payment.status === 'refunded' ? 'text-info' :
                                payment.status === 'failed' ? 'text-destructive' :
                                'text-foreground'
                              }`}>
                                {payment.status === 'refunded' ? '+' : ''}{payment.currency === 'USD' ? '$' : ''}{(payment.amount ?? 0).toLocaleString()}
                              </p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusConfig.className}`}>
                                {statusConfig.label}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>
              </Card>

              {/* Coming Soon Notice */}
              <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/30">
                <CardContent className="py-4 text-center text-sm text-muted-foreground space-y-2">
                  <Lock className="h-5 w-5 mx-auto opacity-50" />
                  <p className="font-medium text-xs">المحفظة الذكية - قريباً</p>
                  <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                    {['إيداع فوري', 'تحويلات بنكية', 'دفع بالعملات الرقمية', 'تتبع المصاريف'].map((feature) => (
                      <span 
                        key={feature}
                        className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
