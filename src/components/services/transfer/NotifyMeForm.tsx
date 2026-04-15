import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, CheckCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function NotifyMeForm() {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email && !phone) {
      toast.error(isRTL ? "يرجى إدخال البريد الإلكتروني أو رقم الجوال" : "Please enter email or phone number");
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsLoading(false);
    setIsSubmitted(true);
    toast.success(isRTL ? "تم تسجيلك بنجاح! سنخبرك عند الإطلاق" : "Successfully registered! We'll notify you at launch");
  };

  if (isSubmitted) {
    return (
      <Card className="border-2 border-success/30 bg-success/5 max-w-lg mx-auto">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            {isRTL ? "شكراً لتسجيلك! 🎉" : "Thanks for signing up! 🎉"}
          </h3>
          <p className="text-muted-foreground">
            {isRTL 
              ? "سنرسل لك إشعاراً فور إطلاق خدمة التحويل المالي"
              : "We'll send you a notification as soon as the transfer service launches"
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background max-w-lg mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-primary-foreground">
          <Sparkles className="w-5 h-5" />
          <span className="font-bold">
            {isRTL ? "كن أول من يعلم!" : "Be the first to know!"}
          </span>
          <Sparkles className="w-5 h-5" />
        </div>
      </div>
      
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            {isRTL ? "احصل على إشعار فوري عند الإطلاق" : "Get notified when we launch"}
          </h3>
          <p className="text-muted-foreground text-sm">
            {isRTL 
              ? "سجّل الآن لتكون من أوائل المستخدمين واحصل على عروض حصرية"
              : "Sign up now to be among the first users and get exclusive offers"
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              {isRTL ? "البريد الإلكتروني" : "Email"}
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isRTL ? "example@email.com" : "example@email.com"}
              className="h-12 bg-background border-border"
              dir="ltr"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-xs text-muted-foreground">{isRTL ? "أو" : "or"}</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              {isRTL ? "رقم الواتساب" : "WhatsApp Number"}
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+966 5XX XXX XXXX"
              className="h-12 bg-background border-border"
              dir="ltr"
            />
          </div>

          <Button 
            type="submit"
            size="lg"
            disabled={isLoading}
            className="w-full h-12 font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <>
                <Bell className="w-5 h-5" />
                {isRTL ? "أبلغني عند الإطلاق" : "Notify Me"}
              </>
            )}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {isRTL 
            ? "لن نشارك بياناتك مع أي طرف ثالث"
            : "We won't share your data with any third party"
          }
        </p>
      </CardContent>
    </Card>
  );
}
