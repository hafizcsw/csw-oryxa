import { useState, useRef } from "react";
import { User, ArrowLeft, Camera, Loader2, Settings, CheckCircle2, AlertTriangle, Clock, FileCheck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { NotificationsBell } from "./NotificationsBell";
import { WalletHeaderWidget } from "@/components/layout/WalletHeaderWidget";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
// AccountSettingsSheet removed — settings tab is the canonical surface
import { Badge } from "@/components/ui/badge";

interface AccountHeroProps {
  name: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  avatarUpdatedAt?: string | null;  // ✅ For cache busting
  stage?: string;
  progress: number;
  userId?: string;
  hasLoginCredentials?: boolean;
  onAvatarUpdate?: () => void;
  isLinked?: boolean;
  docsStatus?: 'pending' | 'reviewing' | 'verified' | 'rejected';
  paymentStatus?: 'pending' | 'partial' | 'paid' | 'overdue';
  studentSubstage?: string;
}

export function AccountHero({ 
  name, 
  phone, 
  email,
  avatarUrl, 
  avatarUpdatedAt,
  stage, 
  progress,
  userId,
  hasLoginCredentials,
  onAvatarUpdate,
  isLinked = false,
  docsStatus,
  paymentStatus,
  studentSubstage
}: AccountHeroProps) {
  // ✅ Cache bust avatar URL to prevent stale images
  const cacheBuster = avatarUpdatedAt || Date.now();
  const finalAvatarUrl = avatarUrl ? `${avatarUrl}?v=${cacheBuster}` : undefined;
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  // Legacy showSettingsSheet state removed — gear icon now navigates to /account?tab=settings
  
  const getProgressMessage = () => {
    if (progress < 30) return "أكمل بياناتك الأساسية";
    if (progress < 60) return "قم بتحميل وثائقك المطلوبة";
    if (progress < 90) return "في انتظار مراجعة الفريق";
    return "ملفك جاهز للتقديم! 🎉";
  };

  const getProgressColor = () => {
    if (progress >= 80) return "from-emerald-500 to-emerald-400";
    if (progress >= 50) return "from-amber-500 to-amber-400";
    return "from-primary to-primary/80";
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      return;
    }
    
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      // Path must be: userId/filename to match RLS policy
      const filePath = `${userId}/avatar.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;
      
      // Update local profiles table so other surfaces (teacher dashboard, messages) can see it
      try {
        await supabase.from('profiles').upsert(
          { user_id: userId, avatar_storage_path: filePath },
          { onConflict: 'user_id' }
        );
      } catch (e) {
        console.warn('[AccountHero] Failed to update local profile avatar:', e);
      }
      
      // ⚠️ DO NOT send avatar via generic update_profile.
      // Avatar must flow through the unified uploadAvatar → set_avatar pipeline,
      // otherwise a raw storage path would overwrite the public URL set by set_avatar.
      
      // Also register as customer file in CRM with FULL metadata
      try {
        await supabase.functions.invoke('student-portal-api', {
          body: {
            action: 'add_file',
            file_kind: 'avatar',
            file_url: publicUrl,
            file_name: file.name,
            description: 'Avatar uploaded via Portal',
            // ✅ NEW: Full storage metadata
            mime_type: file.type,
            size_bytes: file.size,
            storage_bucket: 'avatars',
            storage_path: filePath,
          }
        });
      } catch (e) {
        console.warn('[AccountHero] Failed to register avatar file:', e);
      }
      
      toast.success('تم تحميل الصورة بنجاح');
      onAvatarUpdate?.();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('حدث خطأ أثناء تحميل الصورة');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-br from-card via-card to-muted/50 border-b border-border">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative container mx-auto px-4 py-6 md:py-8">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/")}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">العودة للرئيسية</span>
            </Button>
            
            <div className="flex items-center gap-2">
              {/* Wallet Widget */}
              <WalletHeaderWidget />
              
              {/* Settings Button — redirects to settings tab instead of legacy sheet */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9"
                onClick={() => window.location.href = '/account?tab=settings'}
              >
                <Settings className="h-4 w-4" />
              </Button>
              
              <NotificationsBell userId={userId} />
            </div>
          </div>

          {/* Main hero content */}
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
            {/* Avatar with progress ring - Clickable for upload */}
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              
              <div className="relative w-24 h-24 md:w-28 md:h-28">
                {/* Progress ring SVG */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="50%" cy="50%" r="46%" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
                  <circle
                    cx="50%" cy="50%" r="46%" fill="none"
                    stroke="url(#progressGradient)" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${progress * 2.89} 289`}
                    className="transition-all duration-700 ease-out"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" />
                      <stop offset="100%" stopColor="hsl(142 76% 36%)" />
                    </linearGradient>
                  </defs>
                </svg>
                
                {/* Avatar */}
                <div className="absolute inset-2 rounded-full overflow-hidden bg-muted border-4 border-background shadow-lg">
                  {finalAvatarUrl ? (
                    <img src={finalAvatarUrl} alt="صورة شخصية" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                      <User className="h-10 w-10 md:h-12 md:w-12 text-primary/60" />
                    </div>
                  )}
                </div>
                
                {/* Upload overlay on hover */}
                <div className="absolute inset-2 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
                
                {/* Progress percentage badge */}
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full px-2 py-0.5 shadow-md border border-border">
                  <span className="text-xs font-bold text-primary">{progress}%</span>
                </div>
              </div>
            </div>

            {/* User info */}
            <div className="text-center md:text-right flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                مرحباً، {name || 'طالب جديد'} 👋
              </h1>
              
              <p className="text-muted-foreground text-sm mb-3" dir="ltr">
                {phone || email || 'بوابة الطالب'}
              </p>

              {/* Stage badge */}
              <div className="flex flex-wrap items-center gap-2">
                {/* KYC Link Status Badge */}
                <Badge 
                  variant={isLinked ? "default" : "outline"}
                  className={isLinked 
                    ? "bg-success/10 text-success border-success/30 hover:bg-success/20" 
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                  }
                >
                  {isLinked ? (
                    <><CheckCircle2 className="h-3 w-3 ml-1" /> مربوط</>
                  ) : (
                    <><AlertTriangle className="h-3 w-3 ml-1" /> غير مربوط</>
                  )}
                </Badge>

                {/* Docs Status Badge */}
                {docsStatus && (
                  <Badge 
                    variant="outline"
                    className={
                      docsStatus === 'verified' ? "bg-success/10 text-success border-success/30" :
                      docsStatus === 'reviewing' ? "bg-info/10 text-info border-info/30" :
                      docsStatus === 'rejected' ? "bg-destructive/10 text-destructive border-destructive/30" :
                      "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                    }
                  >
                    <FileCheck className="h-3 w-3 ml-1" />
                    {docsStatus === 'verified' ? 'الوثائق معتمدة' :
                     docsStatus === 'reviewing' ? 'قيد المراجعة' :
                     docsStatus === 'rejected' ? 'مرفوضة' : 'بانتظار الرفع'}
                  </Badge>
                )}

                {/* Payment Status Badge */}
                {paymentStatus && (
                  <Badge 
                    variant="outline"
                    className={
                      paymentStatus === 'paid' ? "bg-success/10 text-success border-success/30" :
                      paymentStatus === 'partial' ? "bg-info/10 text-info border-info/30" :
                      paymentStatus === 'overdue' ? "bg-destructive/10 text-destructive border-destructive/30" :
                      "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                    }
                  >
                    <CreditCard className="h-3 w-3 ml-1" />
                    {paymentStatus === 'paid' ? 'مدفوع بالكامل' :
                     paymentStatus === 'partial' ? 'مدفوع جزئياً' :
                     paymentStatus === 'overdue' ? 'متأخر' : 'بانتظار الدفع'}
                  </Badge>
                )}

                {/* Stage badge */}
                {stage && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    <Clock className="h-3 w-3 ml-1" />
                    {stage}
                  </Badge>
                )}

                {/* Substage chip */}
                {studentSubstage && studentSubstage !== stage && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {studentSubstage}
                  </Badge>
                )}
              </div>
            </div>

            {/* Progress info - desktop */}
            <div className="hidden md:flex flex-col items-end gap-2 min-w-[200px]">
              <div className="text-sm text-muted-foreground">تقدم الملف</div>
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                <div 
                  className={`h-full rounded-full bg-gradient-to-l ${getProgressColor()} transition-all duration-700 ease-out`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{getProgressMessage()}</p>
            </div>
          </div>

          {/* Progress info - mobile */}
          <div className="md:hidden mt-6 p-4 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">تقدم الملف</span>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <div 
                className={`h-full rounded-full bg-gradient-to-l ${getProgressColor()} transition-all duration-700 ease-out`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{getProgressMessage()}</p>
          </div>
        </div>
      </div>

      {/* Legacy AccountSettingsSheet removed — settings tab is the canonical surface */}
    </>
  );
}
