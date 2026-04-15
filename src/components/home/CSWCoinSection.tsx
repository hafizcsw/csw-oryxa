import { useState, useEffect } from "react";
import { Bitcoin, Zap, Shield, TrendingUp, Clock, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    titleAr: "سرعة فائقة",
    desc: "Instant transactions",
    descAr: "معاملات فورية"
  },
  {
    icon: Shield,
    title: "Secure",
    titleAr: "آمن",
    desc: "Military-grade encryption",
    descAr: "تشفير عسكري"
  },
  {
    icon: TrendingUp,
    title: "Growth Potential",
    titleAr: "إمكانية نمو",
    desc: "Early adopter benefits",
    descAr: "مزايا للمتبنين الأوائل"
  }
];

const CountdownUnit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="relative">
      <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center backdrop-blur-sm">
        <span className="text-3xl md:text-4xl font-bold text-amber-400">
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 opacity-20 blur-lg -z-10" />
    </div>
    <span className="mt-2 text-sm text-amber-200/70 font-medium uppercase tracking-wider">
      {label}
    </span>
  </div>
);

export const CSWCoinSection = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 30, hours: 12, minutes: 45, seconds: 30 });
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  
  // Launch date: 45 days from now
  const launchDate = new Date();
  launchDate.setDate(launchDate.getDate() + 45);
  
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = launchDate.getTime() - now;
      
      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success(isArabic ? 'تم تسجيلك بنجاح! سنتواصل معك قريباً' : 'Successfully registered! We\'ll contact you soon');
    setEmail("");
    setIsSubmitting(false);
  };
  
  return (
    <section className="py-24 px-6 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(251,191,36,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>
      
      <div className="max-w-6xl mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-medium">
                {isArabic ? 'إطلاق قريباً' : 'Coming Soon'}
              </span>
            </div>
            
            {/* Title */}
            <div className="space-y-4">
              <h2 className="text-5xl md:text-6xl font-bold">
                <span className="text-white">CSW</span>{" "}
                <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  Coin
                </span>
              </h2>
              <p className="text-xl text-slate-300 leading-relaxed">
                {isArabic 
                  ? 'عملتنا الرقمية الحصرية للطلاب. احصل على خصومات ومكافآت عند استخدام خدماتنا.'
                  : 'Our exclusive digital currency for students. Get discounts and rewards when using our services.'}
              </p>
            </div>
            
            {/* Features */}
            <div className="grid grid-cols-3 gap-4">
              {features.map((feature, index) => (
                <div 
                  key={feature.title}
                  className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all duration-300 group"
                >
                  <feature.icon className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-white text-sm mb-1">
                    {isArabic ? feature.titleAr : feature.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isArabic ? feature.descAr : feature.desc}
                  </p>
                </div>
              ))}
            </div>
            
            {/* Waitlist Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-slate-300 font-medium">
                {isArabic ? 'انضم لقائمة الانتظار واحصل على مكافأة حصرية' : 'Join the waitlist and get an exclusive bonus'}
              </p>
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder={isArabic ? 'بريدك الإلكتروني' : 'Your email address'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-amber-500/50 h-12"
                />
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {isArabic ? 'انضم' : 'Join'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                {isArabic ? 'أكثر من 2,500 مسجل بالفعل' : 'Over 2,500 already registered'}
              </div>
            </form>
          </div>
          
          {/* Right Content - Countdown */}
          <div className="flex flex-col items-center">
            {/* Coin Visual */}
            <div className="relative mb-12">
              <div className="w-48 h-48 rounded-full bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-500 p-1 animate-pulse">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <div className="text-center">
                    <Bitcoin className="w-16 h-16 text-amber-400 mx-auto mb-2" />
                    <span className="text-2xl font-bold text-white">CSW</span>
                  </div>
                </div>
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 opacity-30 blur-2xl -z-10" />
            </div>
            
            {/* Countdown */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
                <span className="text-lg text-slate-300 font-medium">
                  {isArabic ? 'العد التنازلي للإطلاق' : 'Launch Countdown'}
                </span>
              </div>
              
              <div className="flex gap-4">
                <CountdownUnit value={timeLeft.days} label={isArabic ? 'يوم' : 'Days'} />
                <CountdownUnit value={timeLeft.hours} label={isArabic ? 'ساعة' : 'Hours'} />
                <CountdownUnit value={timeLeft.minutes} label={isArabic ? 'دقيقة' : 'Min'} />
                <CountdownUnit value={timeLeft.seconds} label={isArabic ? 'ثانية' : 'Sec'} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
