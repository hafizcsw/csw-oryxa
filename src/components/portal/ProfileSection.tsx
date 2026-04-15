import { User, Mail, Phone, MapPin, Globe, Camera, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconBox } from "@/components/ui/icon-box";

interface ProfileData {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  national_id?: string | null;
  city?: string | null;
  country?: string | null;
  profile_image?: string | null;
  reference_number?: string;
}

interface ProfileSectionProps {
  profile: ProfileData;
  onUpdate?: () => void;
}

export function ProfileSection({ profile, onUpdate }: ProfileSectionProps) {
  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">البيانات الشخصية</h2>
          <p className="text-sm text-muted-foreground mt-1">
            معلوماتك الأساسية المطلوبة لاكتمال الطلب
          </p>
        </div>
      </div>

      {/* Profile Image Section */}
      <div className="flex items-center gap-6 mb-8 pb-6 border-b border-border">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center overflow-hidden">
            {profile.profile_image ? (
              <img
                src={profile.profile_image}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-primary-foreground" />
            )}
          </div>
          <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
            <Camera className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>

        <div className="flex-1">
          <h3 className="text-xl font-bold text-foreground">الصورة الشخصية</h3>
          <p className="text-sm text-muted-foreground mb-3">
            صورة واضحة بخلفية بيضاء، بدون نظارات أو طرحة، نفسية
          </p>
          <Button size="sm" variant="default">
            <Camera className="w-4 h-4 ml-2" />
            تحميل صورة
          </Button>
        </div>
      </div>

      {/* Reference Number */}
      {profile.reference_number && (
        <div className="mb-6 p-4 bg-primary/10 dark:bg-primary/20 rounded-xl border border-primary/30">
          <div className="text-xs text-muted-foreground mb-1">الرقم المرجعي الخاص</div>
          <div className="text-2xl font-bold text-primary tracking-wider">
            {profile.reference_number}
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <IconBox icon={User} size="md" variant="primary" />
            <span>الاسم الكامل</span>
          </label>
          <Input
            value={profile.full_name || "—"}
            readOnly
            className="h-12 bg-muted/50 border-border"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <IconBox icon={Mail} size="md" variant="info" />
            <span>البريد الإلكتروني</span>
          </label>
          <Input
            value={profile.email || "—"}
            readOnly
            className="h-12 bg-muted/50 border-border"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <IconBox icon={Phone} size="md" variant="success" />
            <span>رقم الهاتف</span>
          </label>
          <Input
            value={profile.phone || "—"}
            readOnly
            className="h-12 bg-muted/50 border-border"
          />
        </div>

        {/* National ID */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <IconBox icon={IdCard} size="md" variant="orange" />
            <span>الهوية الوطنية</span>
          </label>
          <Input
            value={profile.national_id || "—"}
            readOnly
            className="h-12 bg-muted/50 border-border"
          />
        </div>

        {/* City */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <IconBox icon={MapPin} size="md" variant="pink" />
            <span>المدينة</span>
          </label>
          <Input
            value={profile.city || "—"}
            readOnly
            className="h-12 bg-muted/50 border-border"
          />
        </div>

        {/* Country */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <IconBox icon={Globe} size="md" variant="indigo" />
            <span>الدولة</span>
          </label>
          <Input
            value={profile.country || "—"}
            readOnly
            className="h-12 bg-muted/50 border-border"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3">
        <Button
          className="flex-1"
          onClick={onUpdate}
        >
          تحميل البيانات
        </Button>
        <Button variant="outline" className="px-6">
          إعادة تعيين كلمة المرور
        </Button>
      </div>
    </div>
  );
}
