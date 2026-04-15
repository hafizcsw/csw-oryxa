import { Shield, Clock, Users, Award, HeadphonesIcon, Wallet, Globe2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const reasons = [
  {
    icon: GraduationCap,
    title: "Expert Guidance",
    titleAr: "إرشاد خبير",
    description: "Experienced counselors to guide you through every step",
    descriptionAr: "مستشارون ذوو خبرة يرشدونك في كل خطوة",
    color: "from-violet-500 to-purple-500"
  },
  {
    icon: Globe2,
    title: "Global Network",
    titleAr: "شبكة عالمية",
    description: "Partnerships with 150+ universities in 25+ countries",
    descriptionAr: "شراكات مع أكثر من 150 جامعة في 25+ دولة",
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: Shield,
    title: "Trusted Process",
    titleAr: "عملية موثوقة",
    description: "Secure document handling and verified applications",
    descriptionAr: "معالجة آمنة للوثائق وطلبات موثقة",
    color: "from-emerald-500 to-teal-500"
  },
  {
    icon: Wallet,
    title: "Best Value",
    titleAr: "أفضل قيمة",
    description: "Competitive prices with transparent pricing",
    descriptionAr: "أسعار تنافسية وشفافية كاملة",
    color: "from-amber-500 to-orange-500"
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Support",
    titleAr: "دعم على مدار الساعة",
    description: "Always here when you need us via chat or call",
    descriptionAr: "نحن هنا دائماً عبر الدردشة أو الاتصال",
    color: "from-pink-500 to-rose-500"
  },
  {
    icon: Clock,
    title: "Fast Processing",
    titleAr: "معالجة سريعة",
    description: "Quick application processing and updates",
    descriptionAr: "معالجة سريعة للطلبات وتحديثات مستمرة",
    color: "from-indigo-500 to-violet-500"
  }
];

export const WhyChooseUsSection = () => {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>
      
      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Award className="w-4 h-4" />
            {isArabic ? 'لماذا نحن' : 'Why Us'}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            {isArabic ? 'لماذا تختار CSW?' : 'Why Choose CSW?'}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {isArabic 
              ? 'نحن شريكك الموثوق في رحلة الدراسة بالخارج منذ أكثر من 10 سنوات'
              : 'Your trusted partner in the study abroad journey for over 10 years'}
          </p>
        </div>
        
        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reasons.map((reason, index) => (
            <div
              key={reason.title}
              className={cn(
                "group relative p-8 rounded-2xl bg-card border border-border/50",
                "hover:border-primary/30 hover:shadow-2xl transition-all duration-500",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Gradient background on hover */}
              <div className={cn(
                "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-5 transition-opacity duration-500",
                `bg-gradient-to-br ${reason.color}`
              )} />
              
              {/* Icon */}
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center mb-6",
                "bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
                reason.color
              )}>
                <reason.icon className="w-7 h-7 text-white" />
              </div>
              
              {/* Content */}
              <div className="space-y-3">
              <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  {isArabic ? reason.titleAr : reason.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {isArabic ? reason.descriptionAr : reason.description}
                </p>
              </div>
              
              {/* Decorative corner */}
              <div className={cn(
                "absolute top-4 right-4 w-16 h-16 rounded-full opacity-10",
                `bg-gradient-to-br ${reason.color}`
              )} />
            </div>
          ))}
        </div>
        
        {/* Trust badges */}
        <div className="mt-16 flex flex-wrap justify-center items-center gap-8 opacity-60">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="w-5 h-5" />
            <span className="text-sm font-medium">
              {isArabic ? 'موثوق من 5000+ طالب' : 'Trusted by 5000+ Students'}
            </span>
          </div>
          <div className="w-px h-6 bg-border hidden md:block" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Award className="w-5 h-5" />
            <span className="text-sm font-medium">
              {isArabic ? 'شريك معتمد' : 'Certified Partner'}
            </span>
          </div>
          <div className="w-px h-6 bg-border hidden md:block" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium">
              {isArabic ? 'خدمة عملاء 24/7' : '24/7 Support'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
