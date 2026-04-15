import { FileSignature, CheckCircle2, Download, RefreshCw, Shield, AlertTriangle, Sparkles, PenTool, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useState } from "react";
import { GlassIcon } from "@/components/ui/glass-icon";
import { glassColors } from "@/lib/glass-colors";

interface ContractSigningCardProps {
  contract: {
    id: string;
    status: string;
    signed_at?: string;
    signed_contract_file_id?: string;
  };
  onSign: (contractId: string) => void;
  onDownload?: (fileId: string) => void;
  isLoading?: boolean;
}

export function ContractSigningCard({
  contract,
  onSign,
  onDownload,
  isLoading
}: ContractSigningCardProps) {
  const [agreed, setAgreed] = useState(false);
  const isSigned = contract.status === 'signed';
  const isReady = contract.status === 'ready';

  const colors = isSigned ? glassColors.success : glassColors.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative overflow-hidden rounded-3xl",
        "bg-card/50 backdrop-blur-xl border-2 transition-all duration-500",
        isSigned ? "border-emerald-500/30 shadow-xl shadow-emerald-500/10" : 
        isReady ? "border-primary/30" : "border-border/50"
      )}
    >
      {/* Animated Background */}
      <motion.div 
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-20",
          isSigned ? "from-emerald-500 to-teal-500" : "from-primary to-primary/50"
        )}
        animate={{ 
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Floating Particles */}
      {isSigned && (
        <>
          <motion.div
            className="absolute top-8 left-8"
            animate={{ 
              rotate: 360,
              y: [0, -10, 0]
            }}
            transition={{ 
              rotate: { duration: 10, repeat: Infinity, ease: "linear" },
              y: { duration: 3, repeat: Infinity }
            }}
          >
            <Sparkles className="h-6 w-6 text-amber-400/60" />
          </motion.div>
          <motion.div
            className="absolute bottom-12 right-12"
            animate={{ 
              rotate: -360,
              y: [0, 10, 0]
            }}
            transition={{ 
              rotate: { duration: 12, repeat: Infinity, ease: "linear" },
              y: { duration: 4, repeat: Infinity }
            }}
          >
            <Award className="h-8 w-8 text-emerald-400/40" />
          </motion.div>
        </>
      )}

      {/* Top Decorative Orb */}
      <motion.div 
        className={cn(
          "absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl",
          isSigned ? "bg-emerald-500/30" : "bg-primary/20"
        )}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      <div className="relative p-8 md:p-10">
        {/* Header */}
        <div className="flex items-start gap-5 mb-8">
          <GlassIcon 
            icon={isSigned ? CheckCircle2 : FileSignature}
            variant={isSigned ? 'success' : 'primary'}
            size="xl"
            glow
            pulse={isSigned}
          />
          
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-foreground mb-2">
              {isSigned ? 'تم توقيع العقد بنجاح ✨' : 'العقد جاهز للتوقيع'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isSigned 
                ? `بتاريخ: ${contract.signed_at ? format(new Date(contract.signed_at), 'dd MMMM yyyy - HH:mm', { locale: ar }) : ''}`
                : 'راجع شروط العقد ووقّع إلكترونياً لإتمام الإجراءات'
              }
            </p>
          </div>
        </div>

        {/* Contract Ready State */}
        <AnimatePresence>
          {isReady && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Terms Preview */}
              <div className="p-5 rounded-2xl bg-background/50 border-2 border-border/50 space-y-4">
                <div className="flex items-start gap-4">
                  <GlassIcon icon={Shield} variant="info" size="sm" />
                  <div>
                    <p className="font-semibold text-foreground mb-1">شروط وأحكام الخدمة</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      بالتوقيع على هذا العقد، أوافق على الشروط والأحكام الخاصة بخدمات التسجيل والقبول الجامعي.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <GlassIcon icon={AlertTriangle} variant="warning" size="sm" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    يرجى قراءة العقد بعناية قبل التوقيع. التوقيع الإلكتروني ملزم قانونياً.
                  </p>
                </div>
              </div>

              {/* Agreement Checkbox */}
              <motion.div 
                whileHover={{ scale: 1.01 }}
                className={cn(
                  "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-300",
                  agreed 
                    ? "bg-primary/10 border-primary/30" 
                    : "bg-muted/30 border-border/50 hover:border-muted-foreground/30"
                )}
              >
                <Checkbox 
                  id="contract-agree" 
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked as boolean)}
                  className="h-6 w-6 rounded-lg"
                />
                <label htmlFor="contract-agree" className="text-sm font-medium cursor-pointer flex-1">
                  أوافق على الشروط والأحكام وأؤكد أنني قرأت العقد بالكامل
                </label>
                {agreed && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </motion.div>
                )}
              </motion.div>

              {/* Sign Button */}
              <Button
                size="lg"
                onClick={() => onSign(contract.id)}
                disabled={!agreed || isLoading}
                className={cn(
                  "w-full gap-3 h-14 text-lg font-bold rounded-2xl",
                  "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground",
                  "shadow-xl hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    جاري التوقيع...
                  </>
                ) : (
                  <>
                    <PenTool className="h-6 w-6" />
                    أوافق وأوقّع على العقد
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Contract Signed State */}
        <AnimatePresence>
          {isSigned && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-5"
            >
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20"
              >
                <GlassIcon icon={CheckCircle2} variant="success" size="sm" glow />
                <span className="font-bold text-emerald-500 text-lg">تم التوقيع بنجاح</span>
              </motion.div>

              {contract.signed_contract_file_id && onDownload && (
                <Button
                  variant="outline"
                  className={cn(
                    "w-full gap-3 h-14 text-base font-semibold rounded-2xl",
                    "border-2 border-emerald-500/30 text-emerald-500",
                    "hover:bg-emerald-500/10 transition-all duration-300"
                  )}
                  onClick={() => onDownload(contract.signed_contract_file_id!)}
                >
                  <Download className="h-5 w-5" />
                  تحميل نسخة العقد الموقع
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending State */}
        {!isReady && !isSigned && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <GlassIcon 
              icon={RefreshCw}
              variant="neutral"
              size="lg"
              pulse
              className="mx-auto mb-4"
            />
            <p className="text-muted-foreground font-medium">العقد قيد الإعداد...</p>
          </motion.div>
        )}
      </div>

      {/* Bottom Glow Line */}
      <div className={cn(
        "absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-1 rounded-full",
        isSigned 
          ? "bg-gradient-to-r from-emerald-500 to-teal-500" 
          : "bg-gradient-to-r from-primary to-primary/50 opacity-50"
      )} />
    </motion.div>
  );
}
