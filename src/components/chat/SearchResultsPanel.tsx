import { useState, useEffect, useRef } from 'react';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { ChatProgramCard } from './ChatProgramCard';
import { University } from '@/types/chat';
import { Heart, ChevronDown, Loader2, Eye, GraduationCap, Search, X, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useCardsPlanReveal } from '@/hooks/useCardsPlanReveal';
import { useClientEvents } from '@/hooks/useClientEvents';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUnifiedShortlist } from '@/hooks/useUnifiedShortlist';
import { ensureProgramDataFromCatalog } from '@/lib/shortlist/ensureProgramData';
// ✅ Unified program validation
import { 
  getProgramId, 
  getUniversityId, 
  isValidProgram, 
  filterValidPrograms,
  getProgramDisplayInfo 
} from '@/lib/program/validators';

// Map University to ProgramCard props format
const mapUniversityToProgramCard = (uni: University) => {
  const displayInfo = getProgramDisplayInfo(uni);
  
  return {
    program_id: displayInfo.programId,
    university_id: displayInfo.universityId,
    program_name: displayInfo.programName,
    university_name: displayInfo.universityName,
    country_name: displayInfo.countryName,
    country_name_ar: displayInfo.countryNameAr,
    country_name_en: displayInfo.countryNameEn,
    city: (uni as any).city || null,
    country_slug: (displayInfo.countryCode || displayInfo.countryName || 'unknown').toLowerCase().replace(/\s+/g, '-'),
    currency_code: displayInfo.currencyCode || undefined,
    fees_yearly: displayInfo.fees,
    duration_months: displayInfo.duration,
    language: displayInfo.language,
    logo_url: displayInfo.logoUrl,
    degree_name: displayInfo.degreeLevel,
    study_mode: (uni as any).study_mode || null,
    has_dorm: (uni as any).has_dorm || null,
    scholarship_available: (uni as any).scholarship_available || null,
    ranking_global: (uni as any).ranking_global || null,
  };
};

const MAX_SHORTLIST = 5;
const PROGRAMS_PER_PAGE = 6;

interface SearchResultsPanelProps {
  onClose?: () => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
}

/**
 * SearchResultsPanel - Displays university programs in the split view
 * 
 * Features:
 * - Table/list format display (Gemini-style)
 * - Shortlist management with hearts
 * - Sequential card reveal animation
 * - Show more/Show all functionality
 * - Control buttons (Close/Expand) in header for fallback
 */
export function SearchResultsPanel({ onClose, onToggleExpand, isExpanded }: SearchResultsPanelProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  
  const { 
    universities, 
    shortlist, 
    customerId,
    cardsPlan
  } = useMalakChat();
  
  // ✅ P0 Fix: Use unified shortlist hook for V3 snapshot sync
  const { toggleWithSnapshot, isFavorite } = useUnifiedShortlist();
  
  const { emitShortlistToggle, emitProgramOpened, emitCardsShowAll, emitCardsShowMore } = useClientEvents();
  
  const [hasReachedFive, setHasReachedFive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [manualDisplayCount, setManualDisplayCount] = useState<number | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const prevCountRef = useRef(shortlist.length);

  // ✅ Unified validation using shared isValidProgram
  const validUniversities = filterValidPrograms(universities);

  // Sequential Cards Reveal Hook
  const {
    visibleCards,
    isRevealing,
    isLoading,
    currentTypingLine,
    showAllNow,
    hasMore: hasMoreFromPlan,
    totalCards
  } = useCardsPlanReveal({
    cards: validUniversities,
    plan: cardsPlan,
    fallbackDisplayCount: manualDisplayCount || PROGRAMS_PER_PAGE
  });

  // Reset flags when universities cleared
  useEffect(() => {
    if (universities.length === 0) {
      setHasReachedFive(false);
      prevCountRef.current = 0;
      setManualDisplayCount(null);
    }
  }, [universities.length]);

  // Trigger animation on new data
  useEffect(() => {
    if (universities.length > 0) {
      setAnimationKey(prev => prev + 1);
      setManualDisplayCount(null);
    }
  }, [universities]);

  // Detect reaching 5 programs
  useEffect(() => {
    const prev = prevCountRef.current;
    const current = shortlist.length;

    if (!hasReachedFive && prev < 5 && current >= 5) {
      setHasReachedFive(true);
      window.dispatchEvent(
        new CustomEvent('shortlist-complete', {
          detail: { program_ids: shortlist.slice(0, 5) },
        })
      );
    }
    prevCountRef.current = current;
  }, [shortlist.length, hasReachedFive, shortlist]);

  // ✅ P0 Final Fix: Toggle shortlist with V3 Snapshot + Catalog Fallback
  const handleToggleShortlist = async (uni: University) => {
    // ✅ P0: Always use unified adapter
    const programId = getProgramId(uni);
    const isCurrentlySaved = isFavorite(programId);
    
    // ✅ Evidence Log: Heart button in chat
    const guestShortlist = JSON.parse(localStorage.getItem('guest_shortlist') || '[]');
    const snapshotCache = JSON.parse(localStorage.getItem('shortlist_snapshot_cache_v1') || '{}');
    console.log('[PORTAL:CHAT:❤️ TOGGLE]', {
      program_id: programId,
      action: isCurrentlySaved ? 'remove' : 'add',
      guest_shortlist_count: guestShortlist.length,
      snapshot_cache_keys: Object.keys(snapshotCache).length,
      has_snapshot_for_id: !!snapshotCache[programId],
    });
    
    // ✅ P0-LOCK-2: If already saved, remove directly WITHOUT catalog fetch
    if (isCurrentlySaved) {
      toggleWithSnapshot({ program_id: programId });
      emitShortlistToggle(programId, 'removed');
      return;
    }
    
    // ✅ P0 Final: Ensure complete data from catalog if chat data is incomplete
    try {
      const programData = await ensureProgramDataFromCatalog(uni);
      toggleWithSnapshot(programData);
      emitShortlistToggle(programId, 'saved');
    } catch (e) {
      console.error('[PORTAL:CHAT] ❌ Cannot build snapshot:', e, uni);
      toast.error('تعذر إضافة البرنامج، حاول مرة أخرى');
    }
  };

  // ✅ P0: Removed manual save - useUnifiedShortlist handles sync automatically

  const displayCount = visibleCards.length;
  const hasMore = displayCount < validUniversities.length;

  // No results state
  if (validUniversities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
            <Search className="w-10 h-10 text-white/60" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            {isArabic ? 'لم أجد برامج مطابقة' : 'No matching programs'}
          </h3>
          <p className="text-white/70 text-sm max-w-xs leading-relaxed">
            {isArabic 
              ? 'وضّح تفضيلاتك في الشات - الدولة، التخصص، أو الميزانية'
              : 'Clarify your preferences - country, major, or budget'}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - Unified style with control buttons */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-slate-800/90 to-transparent px-4 py-4 backdrop-blur-sm">
        <div className={`flex items-center justify-between ${isArabic ? 'flex-row-reverse' : ''}`}>
          {/* Title & Count */}
          <div className={`flex items-center gap-3 ${isArabic ? 'flex-row-reverse' : ''}`}>
            <div className="p-2.5 rounded-xl bg-white/10">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className={isArabic ? 'text-right' : ''}>
              <h2 className="text-lg font-bold text-white">
                {isArabic ? 'نتائج البحث' : 'Search Results'}
              </h2>
              <p className="text-white/70 text-sm">
                {validUniversities.length} {isArabic ? 'برنامج' : 'programs'}
              </p>
            </div>
          </div>

          {/* Control Buttons - Hidden in fullscreen (toolbar handles it) */}
          {!isExpanded && (onClose || onToggleExpand) && (
            <div className={`flex items-center gap-2 ${isArabic ? 'flex-row-reverse' : ''}`}>
              {onToggleExpand && (
                <button
                  onClick={onToggleExpand}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
                  title={isExpanded ? (isArabic ? 'تصغير' : 'Minimize') : (isArabic ? 'ملء الشاشة' : 'Fullscreen')}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-all duration-200"
                  title={isArabic ? 'إغلاق' : 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Typing indicator */}
        {(isLoading || currentTypingLine) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 flex items-center gap-2 text-white/90"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{currentTypingLine || (isArabic ? 'جاري التحميل...' : 'Loading...')}</span>
          </motion.div>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 scrollbar-thin scrollbar-thumb-white/20 max-w-full">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/10 rounded-xl h-24 animate-pulse" />
            ))}
          </div>
        )}

        {/* Program Cards - Gemini Grid Style (3 columns on xl) */}
        {!isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 [&>*]:min-w-0 [&>*]:max-w-full">
            <AnimatePresence mode="popLayout">
              {visibleCards.map((uni, index) => {
                const programId = getProgramId(uni);
                const isSaved = isFavorite(programId);
                const hasValidId = !!programId;
                const programData = mapUniversityToProgramCard(uni);
                
                if (!hasValidId) return null;
                
                return (
                  <motion.div
                    key={`${animationKey}-${programId || index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ 
                      delay: isRevealing ? 0 : index * 0.05, 
                      duration: 0.3,
                      ease: "easeOut"
                    }}
                  >
                    <ChatProgramCard
                      program={programData}
                      onDetails={(id) => {
                        emitProgramOpened(id);
                        window.open(`/program/${id}`, '_blank', 'noopener,noreferrer');
                      }}
                      onFavoriteClick={() => handleToggleShortlist(uni)}
                      isFavorite={isSaved}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Show All Now button during reveal */}
        {isRevealing && cardsPlan?.allow_show_all !== false && (
          <motion.div 
            className="text-center py-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <button
              onClick={() => {
                showAllNow();
                emitCardsShowAll(totalCards);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-all duration-200 text-sm"
            >
              <Eye className="w-4 h-4" />
              <span>{isArabic ? `اعرض الكل (${totalCards})` : `Show all (${totalCards})`}</span>
            </button>
          </motion.div>
        )}

        {/* Show More button */}
        {!isRevealing && hasMore && (
          <motion.div 
            className="text-center py-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={() => {
                const fromCount = visibleCards.length;
                const toCount = Math.min(fromCount + PROGRAMS_PER_PAGE, validUniversities.length);
                setManualDisplayCount(toCount);
                emitCardsShowMore(fromCount, toCount);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-white hover:bg-white/25 transition-all duration-200 text-sm border border-white/20"
            >
              <span>{isArabic ? `المزيد (${validUniversities.length - displayCount})` : `More (${validUniversities.length - displayCount})`}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>

      {/* Shortlist Counter - Sticky footer */}
      {shortlist.length > 0 && (
        <div className="flex-shrink-0 bg-gradient-to-t from-slate-900 to-transparent px-4 pt-3 pb-3">
          <div className="flex flex-col items-center gap-1.5">
            <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm">
              <Heart className="w-4 h-4 fill-current text-red-400" />
              {shortlist.length} / {MAX_SHORTLIST}
            </span>
            
            <span className="text-xs text-emerald-400">
              {isArabic ? 'يتم الحفظ تلقائياً' : 'Auto-saved'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
