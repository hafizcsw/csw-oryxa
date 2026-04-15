/**
 * #7.3 Heart Button Component
 * Unified favorite button for programs AND universities
 * With macOS genie fly-to-dock animation on add
 */
import { useState, useRef } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGuestAwareShortlist } from '@/hooks/useGuestShortlist';
import { useUniversityShortlistHook } from '@/hooks/useUniversityShortlist';
import { ShortlistLimitModal } from './ShortlistLimitModal';
import { ShortlistDrawer } from './ShortlistDrawer';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { flyToFavorite } from '@/lib/flyToAnimation';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import type { ShortlistItem } from '@/lib/portalApi';

interface HeartButtonProps {
  programId?: string;
  universityId?: string;
  type?: 'program' | 'university';
  variant?: 'icon' | 'button';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** CSS selector for the element to "fly" toward the navbar heart */
  flySourceSelector?: string;
}

export function HeartButton({ 
  programId, 
  universityId,
  type = 'program',
  variant = 'icon',
  size = 'md',
  className,
  flySourceSelector,
}: HeartButtonProps) {
  const navigate = useNavigate();
  const programShortlist = useGuestAwareShortlist();
  const uniShortlist = useUniversityShortlistHook();
  const { openAuthModal } = useMalakChat();
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [limitItems, setLimitItems] = useState<ShortlistItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const entityId = type === 'university' ? universityId : programId;
  const isAuthenticated = type === 'university' ? uniShortlist.isAuthenticated : programShortlist.isAuthenticated;
  
  const isFavorite = type === 'university' 
    ? uniShortlist.isInShortlist(entityId || '')
    : programShortlist.isInShortlist(entityId || '');
  
  const busy = isBusy || 
    (type === 'university' ? (uniShortlist.isAdding || uniShortlist.isRemoving) : (programShortlist.isAdding || programShortlist.isRemoving));

  /** Trigger the fly-to-dock animation */
  const triggerFlyAnimation = () => {
    if (!flySourceSelector) return;
    const sourceEl = document.querySelector<HTMLElement>(flySourceSelector);
    if (sourceEl) {
      flyToFavorite({ sourceEl });
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (busy || !entityId) return;

    // University shortlist still requires auth (CRM-only)
    if (type === 'university' && !isAuthenticated) {
      openAuthModal();
      return;
    }
    // Program shortlist: NO auth gate - guests use localStorage draft

    setIsBusy(true);

    try {
      if (type === 'university') {
        if (isFavorite) {
          const res = await uniShortlist.remove(entityId);
          if (!res?.ok && (res as any)?.error_code === 'auth_required') openAuthModal();
        } else {
          const res = await uniShortlist.add(entityId);
          if (res.ok && res.added) {
            triggerFlyAnimation();
          }
          if (!res.ok && (res.error_code === 'auth_required' || res.error_code === 'not_authenticated')) openAuthModal();
        }
      } else {
        if (isFavorite) {
          const res = await programShortlist.remove(entityId);
          if (!res?.ok && (res as any)?.error_code === 'auth_required') openAuthModal();
        } else {
          const res = await programShortlist.add(entityId);
          if (res.ok) {
            triggerFlyAnimation();
          }
          if (!res.ok && res.error_code === 'shortlist_limit_reached') {
            setLimitItems([]);
            setShowLimitModal(true);
          }
          if (!res.ok && (res.error_code === 'auth_required' || res.error_code === 'not_authenticated')) openAuthModal();
        }
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleCompare = () => navigate('/compare');
  const handleManage = () => setShowDrawer(true);

  const sizeClasses = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-11 h-11' };
  const iconSizes = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' };

  const label = type === 'university'
    ? (isFavorite ? 'في المفضلة' : 'أضف الجامعة للمفضلة')
    : (isFavorite ? 'في المفضلة' : 'أضف للمفضلة');

  if (variant === 'button') {
    return (
      <>
        <Button
          ref={buttonRef}
          variant={isFavorite ? "default" : "outline"}
          size="sm"
          onClick={handleClick}
          disabled={busy}
          className={cn("gap-2", className)}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
          )}
          {label}
        </Button>

        <ShortlistLimitModal open={showLimitModal} onOpenChange={setShowLimitModal} items={limitItems} onCompare={handleCompare} onManage={handleManage} />
        <ShortlistDrawer open={showDrawer} onOpenChange={setShowDrawer} />
      </>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        disabled={busy}
        className={cn(
          "rounded-full flex items-center justify-center transition-all",
          "bg-white/90 dark:bg-black/50 backdrop-blur-sm",
          "hover:bg-white dark:hover:bg-black/70",
          "shadow-sm hover:shadow-md",
          "disabled:opacity-50",
          sizeClasses[size],
          className
        )}
        aria-label={isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      >
        {busy ? (
          <Loader2 className={cn(iconSizes[size], "animate-spin text-muted-foreground")} />
        ) : (
          <Heart 
            className={cn(
              iconSizes[size],
              "transition-colors",
              isFavorite 
                ? "fill-red-500 text-red-500" 
                : "text-muted-foreground hover:text-red-500"
            )} 
          />
        )}
      </button>

      <ShortlistLimitModal open={showLimitModal} onOpenChange={setShowLimitModal} items={limitItems} onCompare={handleCompare} onManage={handleManage} />
      <ShortlistDrawer open={showDrawer} onOpenChange={setShowDrawer} />
    </>
  );
}
