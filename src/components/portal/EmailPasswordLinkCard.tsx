import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Lock, Check } from "lucide-react";
import { usePortalAuth } from "@/hooks/usePortalAuth";
import { toast } from "sonner";

interface EmailPasswordLinkCardProps {
  defaultEmail?: string;
  onSuccess: () => void;
}

export function EmailPasswordLinkCard({ defaultEmail = '', onSuccess }: EmailPasswordLinkCardProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { linkEmailPassword } = usePortalAuth();

  const getErrorMessage = (errorCode?: string): string => {
    switch (errorCode) {
      case 'email_already_linked':
        return 'هذا البريد الإلكتروني مرتبط بحساب آخر';
      case 'auth_account_already_configured':
        return 'لديك بالفعل بيانات تسجيل دخول مفعلة';
      case 'invalid_token':
        return 'رمز الجلسة غير صالح، يرجى تسجيل الدخول مجدداً';
      default:
        return 'حدث خطأ أثناء ربط البريد الإلكتروني';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!email.trim()) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }
    
    if (!password || password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('كلمة المرور غير متطابقة');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await linkEmailPassword(email.trim(), password);
      
      if (result.ok) {
        toast.success('تم تفعيل تسجيل الدخول بالإيميل بنجاح');
        onSuccess();
      } else {
        toast.error(getErrorMessage(result.error_code));
      }
    } catch (err) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">أنشئ تسجيل دخول بالإيميل</h3>
          <p className="text-sm text-muted-foreground">
            أضف بريدك الإلكتروني وكلمة مرور للوصول لحسابك بسهولة
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            البريد الإلكتروني
          </label>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="h-11 pr-10 bg-background"
              dir="ltr"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            كلمة المرور
          </label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 pr-10 bg-background"
              dir="ltr"
            />
          </div>
          <p className="text-xs text-muted-foreground">6 أحرف على الأقل</p>
          <PasswordStrengthMeter password={password} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            تأكيد كلمة المرور
          </label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 pr-10 bg-background"
              dir="ltr"
            />
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full h-11 gap-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              حفظ وتفعيل
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
