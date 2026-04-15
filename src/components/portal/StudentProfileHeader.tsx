import { useState, useRef } from "react";
import { Phone, MessageCircle, Camera, Loader2, Mail, MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import LazyAvatar from "@/components/portal/LazyAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StudentProfile, StudentPortalProfile } from "@/hooks/useStudentProfile";

interface StudentProfileHeaderProps {
  profile: StudentProfile;
  crmProfile: StudentPortalProfile | null;
  onAvatarUpdate?: (path: string) => Promise<boolean>;
}

export function StudentProfileHeader({ profile, crmProfile, onAvatarUpdate }: StudentProfileHeaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const referenceNumber = profile.user_id?.substring(0, 8).toUpperCase() || "—";
  const progress = crmProfile?.progress || 0;

  const getAvatarUrl = () => {
    if (profile.avatar_storage_path) {
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(profile.avatar_storage_path);
      return data?.publicUrl || '';
    }
    return '';
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !onAvatarUpdate) return;
    
    const file = e.target.files[0];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast({ title: 'خطأ', description: 'يرجى اختيار صورة (JPG, PNG, أو WEBP)', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'خطأ', description: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${profile.user_id}/avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      await onAvatarUpdate(filePath);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({ title: 'تم التحميل بنجاح', description: 'تم تحديث صورتك الشخصية' });
    } catch (error: any) {
      toast({ title: 'خطأ في رفع الصورة', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!profile.avatar_storage_path || !onAvatarUpdate) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.storage
        .from('avatars')
        .remove([profile.avatar_storage_path]);
      
      if (error) throw error;
      
      await onAvatarUpdate('');
      toast({ title: 'تم الحذف', description: 'تم حذف صورتك الشخصية' });
    } catch (error: any) {
      toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const stageBadgeColor = () => {
    switch (crmProfile?.stage) {
      case 'new': return 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'docs_collection': return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'docs_review': return 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'submitted': return 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case 'accepted': return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const stageLabel = () => {
    switch (crmProfile?.stage) {
      case 'new': return 'استفسار جديد';
      case 'docs_collection': return 'جمع المستندات';
      case 'docs_review': return 'مراجعة الملف';
      case 'submitted': return 'تم التقديم';
      case 'accepted': return 'تم القبول';
      default: return 'جديد';
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Avatar + Name + Badge */}
        <div className="flex items-center gap-4">
          {/* Avatar with Dropdown */}
          <div className="relative group">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 shadow-colored">
              <LazyAvatar
                src={getAvatarUrl()}
                alt="Profile"
                className="w-full h-full object-cover"
                fallbackIcon={
                  <div className="w-full h-full bg-gradient-primary flex items-center justify-center">
                    <span className="text-2xl font-black text-primary-foreground">
                      {referenceNumber.charAt(0)}
                    </span>
                  </div>
                }
              />
            </div>
            
            {/* Dropdown Menu Trigger */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={isUploading || isDeleting}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  {isUploading || isDeleting ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <MoreVertical className="w-5 h-5 text-white" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <RefreshCw className="w-4 h-4 ml-2" />
                  استبدال الصورة
                </DropdownMenuItem>
                {profile.avatar_storage_path && (
                  <DropdownMenuItem 
                    onClick={handleDeleteAvatar}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 ml-2" />
                    حذف الصورة
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">
                {profile.full_name || 'اسم الطالب'}
              </h1>
              <Badge variant="outline" className={`${stageBadgeColor()} font-medium text-xs`}>
                {stageLabel()}
              </Badge>
            </div>

            {/* Contact Info */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {profile.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{profile.email}</span>
                </div>
              )}
              {profile.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span className="font-mono text-xs" dir="ltr">{profile.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Progress + Actions */}
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {/* Progress Bar */}
          <div className="flex-1 sm:w-32">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">الإنجاز</span>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* WhatsApp Button */}
          {profile.phone && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
              onClick={() => window.open(`https://wa.me/${profile.phone?.replace(/\D/g, '')}`, '_blank')}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">واتساب</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
