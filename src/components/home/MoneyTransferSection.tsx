import { useState } from "react";
import { ArrowRight, ArrowLeftRight, Shield, Zap, Clock, Bell, CheckCircle2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

// Simulated exchange rate (SAR to RUB)
const EXCHANGE_RATE = 24.5;

const features = [
  {
    icon: Shield,
    title: "Bank-Level Security",
    titleAr: "أمان بنكي",
    desc: "Your money is protected",
    descAr: "أموالك في أمان تام"
  },
  {
    icon: Zap,
    title: "Fast Transfer",
    titleAr: "تحويل سريع",
    desc: "Within 24 hours",
    descAr: "خلال 24 ساعة"
  },
  {
    icon: TrendingUp,
    title: "Best Rates",
    titleAr: "أفضل الأسعار",
    desc: "Competitive exchange",
    descAr: "أسعار تنافسية"
  }
];

export const MoneyTransferSection = () => {
  const [amount, setAmount] = useState("1000");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  
  const sarAmount = parseFloat(amount) || 0;
  const rubAmount = sarAmount * EXCHANGE_RATE;
  
  const handleNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success(isArabic ? 'تم تسجيل رقمك! سنبلغك فور إطلاق الخدمة' : 'Number registered! We\'ll notify you when service launches');
    setPhone("");
    setIsSubmitting(false);
  };
  
  return (
    <section className="py-24 px-6 relative overflow-hidden bg-gradient-to-br from-emerald-950 via-teal-900 to-cyan-950">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />
        
        {/* Russia flag colors subtle decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-white via-blue-500 to-red-500 opacity-30" />
      </div>
      
      <div className="max-w-6xl mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Calculator */}
          <div className="order-2 lg:order-1">
            <div className="relative">
              {/* Calculator Card */}
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    <ArrowLeftRight className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {isArabic ? 'حاسبة التحويل' : 'Transfer Calculator'}
                    </h3>
                    <p className="text-sm text-emerald-200/70">
                      {isArabic ? 'سعر تقريبي' : 'Estimated rate'}
                    </p>
                  </div>
                </div>
                
                {/* From SAR */}
                <div className="space-y-3 mb-6">
                  <label className="text-sm text-emerald-200/80 font-medium">
                    {isArabic ? 'المبلغ المرسل' : 'You Send'}
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-16 text-2xl font-bold bg-white/10 border-white/20 text-white pr-20 focus:border-emerald-400/50"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="text-2xl">🇸🇦</span>
                      <span className="text-white font-semibold">SAR</span>
                    </div>
                  </div>
                </div>
                
                {/* Exchange Rate */}
                <div className="flex items-center justify-center my-4">
                  <div className="px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                    <span className="text-sm text-emerald-300">
                      1 SAR = {EXCHANGE_RATE} RUB
                    </span>
                  </div>
                </div>
                
                {/* To RUB */}
                <div className="space-y-3">
                  <label className="text-sm text-emerald-200/80 font-medium">
                    {isArabic ? 'المبلغ المستلم' : 'They Receive'}
                  </label>
                  <div className="relative">
                    <div className="h-16 flex items-center px-6 text-2xl font-bold bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-300">
                      {rubAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="text-2xl">🇷🇺</span>
                      <span className="text-white font-semibold">RUB</span>
                    </div>
                  </div>
                </div>
                
                {/* Coming Soon Badge */}
                <div className="mt-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-amber-300 font-semibold">
                        {isArabic ? 'قريباً جداً!' : 'Coming Very Soon!'}
                      </p>
                      <p className="text-xs text-amber-200/70">
                        {isArabic ? 'سجل اهتمامك ليصلك إشعار فور الإطلاق' : 'Register your interest to be notified at launch'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-20 blur-3xl rounded-3xl -z-10" />
            </div>
          </div>
          
          {/* Right - Content */}
          <div className="order-1 lg:order-2 space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-2xl">🇷🇺</span>
              <span className="text-emerald-400 text-sm font-medium">
                {isArabic ? 'تحويلات روسيا' : 'Russia Transfers'}
              </span>
            </div>
            
            {/* Title */}
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                {isArabic ? (
                  <>
                    حوّل أموالك <br />
                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                      إلى روسيا بسهولة
                    </span>
                  </>
                ) : (
                  <>
                    Transfer Money <br />
                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                      to Russia Easily
                    </span>
                  </>
                )}
              </h2>
              <p className="text-lg text-slate-300 leading-relaxed">
                {isArabic 
                  ? 'أرسل الأموال لعائلتك أو لتغطية مصاريف دراستك في روسيا. آمن وسريع وبأفضل أسعار الصرف.'
                  : 'Send money to your family or cover your study expenses in Russia. Secure, fast, and with the best exchange rates.'}
              </p>
            </div>
            
            {/* Features */}
            <div className="space-y-4">
              {features.map((feature) => (
                <div 
                  key={feature.title}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {isArabic ? feature.titleAr : feature.title}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {isArabic ? feature.descAr : feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Notify Form */}
            <form onSubmit={handleNotify} className="space-y-4">
              <p className="text-slate-300 font-medium flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-400" />
                {isArabic ? 'أدخل رقمك ليصلك إشعار عند الإطلاق' : 'Enter your number to be notified at launch'}
              </p>
              <div className="flex gap-3">
                <Input
                  type="tel"
                  placeholder={isArabic ? 'رقم الواتساب' : 'WhatsApp number'}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-emerald-500/50 h-12"
                  dir="ltr"
                />
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 px-6 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {isArabic ? 'سجّل' : 'Notify Me'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {isArabic ? 'أكثر من 1,200 مسجل بالفعل' : 'Over 1,200 already registered'}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
