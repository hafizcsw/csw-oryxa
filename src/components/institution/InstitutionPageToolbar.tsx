/**
 * Institution Page Control Toolbar — Slim indicator bar (Facebook Pages model)
 * The operator tabs have moved to PageManageSidebar.
 */
import { useTranslation } from 'react-i18next';
import { Building2, Camera, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { InstitutionRole } from '@/types/institution';

interface InstitutionPageToolbarProps {
  universityId: string;
  role: InstitutionRole | null;
  currentCoverUrl?: string | null;
  currentLogoUrl?: string | null;
  onEditPublished?: () => void;
}

export function InstitutionPageToolbar({
  role,
}: InstitutionPageToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="sticky top-16 z-40 bg-primary/5 border-b border-primary/20 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {t('institution.toolbar.managing')}
          </span>
          <Badge variant="secondary" className="text-xs gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {t('institution.toolbar.verified')}
          </Badge>
          {role && (
            <Badge variant="outline" className="text-xs">
              {role}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Facebook-style camera button to overlay on cover image
 */
export function CoverEditButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 end-4 z-10 flex items-center gap-2 px-4 py-2 rounded-lg bg-black/50 hover:bg-black/70 text-white text-sm font-medium transition-colors backdrop-blur-sm border border-white/20"
    >
      <Camera className="w-4 h-4" />
      {t('institution.toolbar.editCover')}
    </button>
  );
}

/**
 * Facebook-style camera button to overlay on logo
 */
export function LogoEditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute -bottom-0.5 -end-0.5 z-10 w-8 h-8 rounded-full bg-muted border-2 border-card shadow-md flex items-center justify-center hover:bg-accent transition-colors"
    >
      <Camera className="w-4 h-4 text-foreground" />
    </button>
  );
}
