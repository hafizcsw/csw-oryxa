import { MessageCircle, Search, FileText, Plane, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const steps = [
  {
    number: "01",
    icon: MessageCircle,
    title: "Chat with Malak",
    titleAr: "تحدث مع ملاك",
    description: "Our AI assistant helps you find the perfect program based on your preferences and budget.",
    descriptionAr: "مساعدتنا الذكية تساعدك في إيجاد البرنامج المثالي بناءً على تفضيلاتك وميزانيتك.",
    color: "from-violet-500 to-purple-500"
  },
  {
    number: "02",
    icon: Search,
    title: "Choose Your Program",
    titleAr: "اختر برنامجك",
    description: "Browse universities and programs, compare options, and add favorites to your shortlist.",
    descriptionAr: "تصفح الجامعات والبرامج، قارن الخيارات، وأضف المفضلة لقائمتك.",
    color: "from-blue-500 to-cyan-500"
  },
  {
    number: "03",
    icon: FileText,
    title: "Submit Documents",
    titleAr: "قدّم أوراقك",
    description: "Upload your documents securely and let us handle the application process.",
    descriptionAr: "ارفع وثائقك بأمان ودعنا نتولى عملية التقديم.",
    color: "from-emerald-500 to-teal-500"
  },
  {
    number: "04",
    icon: Plane,
    title: "Travel & Study",
    titleAr: "سافر وادرس",
    description: "Get your visa, book your flight, and start your educational journey abroad!",
    descriptionAr: "احصل على تأشيرتك، احجز رحلتك، وابدأ رحلتك التعليمية!",
    color: "from-amber-500 to-orange-500"
  }
];

export const HowItWorksSection = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>
      
      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="text-center space-y-4 mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {isArabic ? 'خطوات بسيطة' : 'Simple Steps'}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            {isArabic ? 'كيف نساعدك؟' : 'How It Works'}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {isArabic 
              ? 'رحلتك للدراسة في الخارج تبدأ من هنا - أربع خطوات بسيطة فقط'
              : 'Your journey to study abroad starts here - just four simple steps'}
          </p>
        </div>
        
        {/* Steps - Desktop */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Connection Line */}
            <div className="absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-blue-500 via-emerald-500 to-amber-500 opacity-30" />
            
            {/* Steps Grid */}
            <div className="grid grid-cols-4 gap-8">
              {steps.map((step, index) => (
                <div 
                  key={step.number}
                  className="relative group animate-fade-in"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  {/* Step Card */}
                  <div className="text-center space-y-6">
                    {/* Icon Circle */}
                    <div className="relative mx-auto">
                      <div className={cn(
                        "w-20 h-20 rounded-2xl flex items-center justify-center mx-auto",
                        "bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                        step.color
                      )}>
                        <step.icon className="w-10 h-10 text-white" />
                      </div>
                      {/* Step Number */}
                      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{step.number}</span>
                      </div>
                      {/* Glow */}
                      <div className={cn(
                        "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300",
                        `bg-gradient-to-br ${step.color}`
                      )} />
                    </div>
                    
                    {/* Content */}
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-foreground">
                        {isArabic ? step.titleAr : step.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {isArabic ? step.descriptionAr : step.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Arrow (except last) */}
                  {index < steps.length - 1 && (
                    <div className="absolute top-[88px] -right-4 transform translate-x-1/2">
                      <ArrowRight className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Steps - Mobile */}
        <div className="lg:hidden space-y-8">
          {steps.map((step, index) => (
            <div 
              key={step.number}
              className="flex gap-6 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Left - Number & Line */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center",
                  "bg-gradient-to-br shadow-lg",
                  step.color
                )}>
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                {index < steps.length - 1 && (
                  <div className="w-0.5 flex-1 mt-4 bg-gradient-to-b from-primary/30 to-transparent" />
                )}
              </div>
              
              {/* Right - Content */}
              <div className="flex-1 pb-8">
                <div className="text-xs font-bold text-primary mb-2">
                  {isArabic ? `الخطوة ${step.number}` : `STEP ${step.number}`}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">
                  {isArabic ? step.titleAr : step.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {isArabic ? step.descriptionAr : step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {/* CTA */}
        <div className="text-center mt-16">
          <Button 
            onClick={() => navigate('/universities?tab=programs')}
            size="lg"
            className="h-14 px-8 text-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            {isArabic ? 'ابدأ رحلتك الآن' : 'Start Your Journey'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
};
