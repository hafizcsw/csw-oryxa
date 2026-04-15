import { useState, useEffect, useRef, useCallback } from 'react';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { ProgramCard } from '@/components/ProgramCard';
import { University } from '@/types/chat';
import { Heart, ChevronDown, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useCardsPlanReveal, CardsPlanV1 } from '@/hooks/useCardsPlanReveal';
import { useClientEvents } from '@/hooks/useClientEvents';
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

// تحويل University إلى Program props المتوقعة من ProgramCard
const mapUniversityToProgram = (uni: University) => {
  const displayInfo = getProgramDisplayInfo(uni);
  
  return {
    program_id: displayInfo.programId,
    university_id: displayInfo.universityId,
    program_name: displayInfo.programName,
    university_name: displayInfo.universityName,
    country_name: displayInfo.countryName,
    country_name_ar: displayInfo.countryNameAr,
    country_name_en: displayInfo.countryNameEn,
    country_slug: (displayInfo.countryCode || displayInfo.countryName || 'unknown').toLowerCase().replace(/\s+/g, '-'),
    currency_code: displayInfo.currencyCode || undefined,
    fees_yearly: displayInfo.fees,
    duration_months: displayInfo.duration,
    language: displayInfo.language,
  };
};

const MAX_SHORTLIST = 5;
const PROGRAMS_PER_PAGE = 6;

// 🆕 Extract cards_plan from response (future-ready)
interface UniversitiesResponse {
  universities?: University[];
  ui?: {
    cards_plan?: CardsPlanV1;
  };
}

export function ChatSuggestedProgramsSection() {
  const { 
    universities, 
    showSuggestedPrograms, 
    shortlist, 
    customerId,
    cardsPlan  // 🆕 Fix #4: Read cardsPlan from context
  } = useMalakChat();
  
  // ✅ P0 Fix: Use unified shortlist hook for V3 snapshot sync
  const { toggleWithSnapshot, isFavorite } = useUnifiedShortlist();
  
  // 🆕 Fix #2: Use hook instead of util functions
  const { emitShortlistToggle, emitProgramOpened, emitCardsShowAll, emitCardsShowMore } = useClientEvents();
  
  const [hasReachedFive, setHasReachedFive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [manualDisplayCount, setManualDisplayCount] = useState<number | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const prevCountRef = useRef(shortlist.length);
  const sectionRef = useRef<HTMLElement>(null);

  // ✅ Unified validation using shared isValidProgram
  const validUniversities = filterValidPrograms(universities);

  // 🆕 Sequential Cards Reveal Hook
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

  // Reset flags عند مسح الجامعات (جلسة جديدة)
  useEffect(() => {
    if (universities.length === 0) {
      setHasReachedFive(false);
      prevCountRef.current = 0;
      setManualDisplayCount(null);
      console.log('[ChatSuggestedProgramsSection] 🔄 Reset flags for new session');
    }
  }, [universities.length]);

  // Trigger animation عند تغيير البرامج
  useEffect(() => {
    if (universities.length > 0) {
      setAnimationKey(prev => prev + 1);
      setManualDisplayCount(null); // Reset manual count for new data
    }
  }, [universities]);

  // 👇 Effect لكشف لحظة الوصول لـ 5 برامج
  useEffect(() => {
    const prev = prevCountRef.current;
    const current = shortlist.length;

    if (!hasReachedFive && prev < 5 && current >= 5) {
      setHasReachedFive(true);
      console.log('[ChatSuggestedProgramsSection] 🎯 Reached 5 programs!', shortlist.slice(0, 5));
      
      window.dispatchEvent(
        new CustomEvent('shortlist-complete', {
          detail: { program_ids: shortlist.slice(0, 5) },
        })
      );
    }

    prevCountRef.current = current;
  }, [shortlist.length, hasReachedFive, shortlist]);

  // ✅ P0: Removed manual sync - useUnifiedShortlist handles sync automatically

  // ✅ P0 Final Fix: Toggle with V3 Snapshot + Catalog Fallback
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

  // 🆕 Order #5: Handler for program card click
  const handleProgramClick = (programId: string) => {
    emitProgramOpened(programId);
  };

  // Calculate display count for Show More button
  const displayCount = visibleCards.length;
  const hasMore = displayCount < validUniversities.length;

  // Debug log for Show More button visibility
  console.log('[ChatSuggestedProgramsSection] 📊 Render state:', {
    total: validUniversities.length,
    displaying: displayCount,
    isRevealing,
    isLoading,
    showMoreVisible: hasMore
  });

  // 🆕 PORTAL-2: لا تظهر إلا إذا جاءت البرامج من الشات ديناميكياً
  // إذا كان showSuggestedPrograms true لكن لا توجد برامج، نظهر رسالة "لا توجد نتائج"
  if (!showSuggestedPrograms) return null;

  // 🆕 PORTAL-2: No results state - show helpful message instead of empty cards
  if (validUniversities.length === 0) {
    return (
      <section 
        ref={sectionRef}
        id="cards_area"
        data-section="suggested-programs"
        className="relative z-10 mt-8 max-w-7xl mx-auto px-6 pb-12"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
        >
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-white mb-2">
            لم أجد برامج مطابقة حالياً
          </h3>
          <p className="text-white/80 text-sm max-w-md mx-auto leading-relaxed">
            حاول توضيح تفضيلاتك أكثر في الشات - أخبرني عن الدولة، التخصص، أو الميزانية المناسبة لك.
          </p>
        </motion.div>
      </section>
    );
  }

  return (
    <section 
      ref={sectionRef}
      id="cards_area"
      data-section="suggested-programs"
      data-tour-id="tour-programs"
      className="relative z-10 mt-8 max-w-7xl mx-auto px-6 pb-12"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">
          🎓 البرامج المقترحة بناءً على حديثك مع ملاك
        </h3>
        <p className="text-white/80 text-sm leading-relaxed">
          هذه البرامج تتحدث تلقائياً حسب أسئلتك وتفضيلاتك في الشات.<br/>
          اضغط على ❤️ لحفظها في حسابك الشخصي ومتابعة الطلب.
        </p>
        
        {/* 🆕 Typing indicator during reveal */}
        {(isLoading || currentTypingLine) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 flex items-center justify-center gap-2 text-white/90"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{currentTypingLine || 'جاري تحميل البرامج...'}</span>
          </motion.div>
        )}
      </div>

      {/* 🆕 Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/10 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      )}

      {/* Program Cards Grid with Animation */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {visibleCards.map((uni, index) => {
              // ✅ P0 Fix V2: Extract programId once at the top of the map
              const programId = getProgramId(uni);
              const isSaved = isFavorite(programId);
              // ✅ P0 Fix V3: Guard against empty programId
              const hasValidId = !!programId;
              
              return (
              <motion.div
                key={`${animationKey}-${programId || uni.id || index}`}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ 
                  delay: isRevealing ? 0 : (index % PROGRAMS_PER_PAGE) * 0.15, 
                  duration: 0.5,
                  ease: "easeOut"
                }}
                className="relative"
              >
                {/* Heart Button Overlay - ✅ P0 V3: Disabled if no valid programId */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hasValidId) {
                      toast.error('بيانات البرنامج ناقصة');
                      return;
                    }
                    handleToggleShortlist(uni);
                  }}
                  disabled={!hasValidId || (!isSaved && shortlist.length >= MAX_SHORTLIST)}
                  className={`absolute top-3 right-3 z-20 p-2 rounded-full transition-all duration-200 ${
                    !hasValidId 
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-50'
                      : isSaved
                        ? 'bg-red-500 text-white shadow-lg'
                        : 'bg-white/90 text-muted-foreground hover:bg-white hover:text-red-500'
                  } ${(!isSaved && shortlist.length >= MAX_SHORTLIST) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={!hasValidId ? 'بيانات البرنامج غير مكتملة' : (isSaved ? 'إزالة من المفضلة' : 'إضافة للمفضلة')}
                >
                  <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                </button>

                <ProgramCard
                  p={mapUniversityToProgram(uni)}
                />
              </motion.div>
            );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* 🆕 Show All Now button during reveal */}
      {isRevealing && cardsPlan?.allow_show_all !== false && (
        <motion.div 
          className="mt-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <button
            onClick={() => {
              showAllNow();
              // 🆕 Order #5: Emit client event
              emitCardsShowAll(totalCards);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-all duration-200 text-sm"
          >
            <Eye className="w-4 h-4" />
            <span>اعرض الكل الآن ({totalCards})</span>
          </button>
        </motion.div>
      )}

      {/* Show More Button */}
      {!isRevealing && hasMore && (
        <motion.div 
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={() => {
              const fromCount = visibleCards.length;
              const toCount = Math.min(fromCount + PROGRAMS_PER_PAGE, validUniversities.length);
              setManualDisplayCount(toCount);
              // 🆕 Order #5: Emit client event
              emitCardsShowMore(fromCount, toCount);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all duration-200 border border-white/30"
          >
            <span>عرض المزيد ({validUniversities.length - displayCount} برنامج إضافي)</span>
            <ChevronDown className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* Shortlist Counter */}
      {shortlist.length > 0 && (
        <div className="mt-4 text-center flex flex-col items-center gap-2">
          <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
            <Heart className="w-4 h-4 fill-current" />
            {shortlist.length} / {MAX_SHORTLIST} برامج في قائمتك
          </span>
          
          {/* ✅ P0: Auto-sync - no manual save needed */}
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-green-500/20 text-green-200 border border-green-400/30">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            يتم الحفظ تلقائياً
          </span>
        </div>
      )}
    </section>
  );
}
