import { Copy, Check, Camera, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { uploadAvatar } from "@/features/avatar/uploadAvatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildAvatarDisplayUrl, MAX_AVATAR_BYTES, optimizeAvatarForUpload } from "@/features/avatar/avatarImageUtils";
import { supabase } from "@/integrations/supabase/client";

interface CanonicalIdentityRead {
  full_name?: string | null;
  citizenship?: string | null;
}

interface AccountContentHeaderProps {
  profile: {
    full_name?: string | null;
    phone?: string | null;
    avatar_storage_path?: string | null;
  } | null;
  crmProfile?: {
    stage?: string | null;
    full_name?: string | null;
    phone?: string | null;
    phone_e164?: string | null;
    avatar_url?: string | null;
    avatar_updated_at?: string | null;
    updated_at?: string | null;
  } | null;
  /** Door 1: canonical identity — primary read source when available */
  canonicalIdentity?: CanonicalIdentityRead | null;
  onEditProfile?: () => void;
  onAvatarUpdate?: (path: string | null) => Promise<boolean>;
}

// Mask phone number: +966512345678 → +966•••••5678
const maskPhone = (phone?: string | null): string => {
  if (!phone) return '—';
  if (phone.length < 8) return phone;
  const start = phone.slice(0, 4);
  const end = phone.slice(-4);
  return `${start}•••••${end}`;
};

export function AccountContentHeader({
  profile,
  crmProfile,
  canonicalIdentity,
  onEditProfile,
  onAvatarUpdate
}: AccountContentHeaderProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localAvatarOverride, setLocalAvatarOverride] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Door 1: canonical identity is primary read source, fallback to CRM → profile
  const fullName = canonicalIdentity?.full_name || crmProfile?.full_name || profile?.full_name || t('portal.header.student');
  const phone = crmProfile?.phone_e164 || crmProfile?.phone || profile?.phone;

  // ✅ Resolve both full URLs and storage paths safely
  const rawAvatarValue = localAvatarOverride || crmProfile?.avatar_url || profile?.avatar_storage_path || undefined;
  const avatarBaseUrl = buildAvatarDisplayUrl(rawAvatarValue);
  const cacheBuster = crmProfile?.avatar_updated_at || crmProfile?.updated_at || Date.now();
  const avatarUrl = avatarBaseUrl ? `${avatarBaseUrl}${avatarBaseUrl.includes('?') ? '&' : '?'}v=${cacheBuster}` : undefined;

  const handleCopyId = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      toast({ title: t('portal.topbar.copied'), description: t('portal.header.phoneCopied') });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t('portal.topbar.error'), description: t('portal.header.copyFailed'), variant: 'destructive' });
    }
  };

  // ✅ CUTOVER: Use uploadAvatar() from features - CRM is the only source
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: t('portal.topbar.error'), description: t('portal.header.selectValidImage'), variant: 'destructive' });
      return;
    }

    let fileToUpload = file;

    // ✅ If image is large, optimize it automatically instead of rejecting immediately
    if (file.size > MAX_AVATAR_BYTES) {
      try {
        fileToUpload = await optimizeAvatarForUpload(file, MAX_AVATAR_BYTES);
      } catch {
        toast({ title: t('portal.topbar.error'), description: t('portal.header.imageTooLarge'), variant: 'destructive' });
        return;
      }
    }

    setIsUploading(true);
    try {
      // ✅ Use unified uploadAvatar - goes directly to CRM
      const result = await uploadAvatar(fileToUpload, (stage, percent) => {
        console.log('[AccountContentHeader] Avatar upload:', stage, percent);
      });

      if (!result.success) {
        console.error('❌ Avatar upload failed:', result.error);

        // ✅ Show DOCS_LOCKED reason clearly
        if (result.error === 'DOCS_LOCKED') {
          toast({
            title: t('portal.header.docsLocked'),
            description: result.details || t('portal.header.cannotChangePhoto'),
            variant: 'destructive'
          });
        } else {
          toast({
            title: t('portal.header.uploadError'),
            description: `${result.stage}: ${result.error}`,
            variant: 'destructive'
          });
        }
        return;
      }

      console.log('✅ Avatar uploaded to CRM:', result.file_url, result.file_id);

      // ✅ Sync avatar path to local profiles table so teacher/messages surfaces can see it
      const avatarPath = result.file_id || result.file_url || null;
      if (avatarPath) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            await supabase.from('profiles').upsert(
              { user_id: session.user.id, avatar_storage_path: avatarPath },
              { onConflict: 'user_id' }
            );
          }
        } catch (e) {
          console.warn('[AccountContentHeader] Failed to sync avatar to profiles:', e);
        }
      }

      // ✅ Immediately show the new avatar (live update)
      const liveAvatar = buildAvatarDisplayUrl(result.file_url || result.file_id || null);
      if (liveAvatar) {
        setLocalAvatarOverride(liveAvatar);
      }

      toast({ title: t('portal.header.updated'), description: t('portal.header.photoUpdated') });

      // Notify parent if callback provided (prefer storage path for profile table)
      if (onAvatarUpdate) {
        await onAvatarUpdate(avatarPath);
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({ title: t('portal.topbar.error'), description: t('portal.header.uploadFailed'), variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    // TODO: Implement avatar deletion via CRM
    setLocalAvatarOverride(null);
    toast({ title: t('portal.header.notAvailable'), description: t('portal.header.deleteNotAvailable') });
  };

  return (
    <div className="flex items-center gap-6">
      {/* Large Avatar with Upload - Binance style */}
      <div className="relative group">
        <Avatar className="h-28 w-28">
          <AvatarImage
            src={avatarUrl}
            alt={fullName}
            className="object-cover [image-rendering:auto]"
            loading="eager"
            decoding="async"
            draggable={false}
          />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-3xl font-bold">
            {fullName.charAt(0)}
          </AvatarFallback>
        </Avatar>

        {/* Online indicator */}
        <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-success border-2 border-card" />

        {/* Avatar Dropdown Menu */}
        {onAvatarUpdate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                disabled={isUploading || isDeleting}
              >
                {isUploading || isDeleting ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-popover border-border">
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2 cursor-pointer">
                <RefreshCw className="h-4 w-4" />
                {t('portal.header.replacePhoto')}
              </DropdownMenuItem>
              {avatarUrl && (
                <DropdownMenuItem onClick={handleDeleteAvatar} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  {t('portal.header.deletePhoto')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
      </div>

      {/* User info - Binance style horizontal layout */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
            {t('portal.header.regularUser')}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>UID:</span>
            <span className="font-mono">{maskPhone(phone)}</span>
            <button
              onClick={handleCopyId}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

