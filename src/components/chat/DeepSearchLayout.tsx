import { ReactNode, useState, useEffect, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { X, Maximize2, Minimize2, Heart, Wallet, User } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useWalletLedger } from '@/hooks/useWalletLedger';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo-connect-study-world.png';

interface DeepSearchLayoutProps {
  chatComponent: ReactNode;
  resultsComponent: ReactNode;
}

/**
 * DeepSearchLayout - Gemini-style split view layout
 * 
 * Normal mode: Chat takes 100% width
 * Search mode: Chat shrinks to ~35%, Results panel takes ~65%
 * Expanded mode: Full overlay via Portal covering entire screen
 * 
 * RTL (Arabic): Results on left, Chat on right
 * LTR (English): Chat on left, Results on right
 */
export function DeepSearchLayout({ chatComponent, resultsComponent }: DeepSearchLayoutProps) {
  const navigate = useNavigate();
  const { showSuggestedPrograms, setShowSuggestedPrograms, universities, shortlist, crmAvatarUrl } = useMalakChat();
  const { available: walletBalance } = useWalletLedger({ currency: 'USD', limit: 1 });
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  // ✅ Guard #1: Ensure document is available (SSR/hydration safety)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Fullscreen expansion state
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Only show split view when we have programs to display
  const isSearchMode = showSuggestedPrograms && universities.length > 0;

  // ✅ Guard #3: Robust cleanup for fullscreen effects (ESC + scroll lock)
  useEffect(() => {
    if (!isExpanded) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isExpanded]);

  const handleCloseResults = () => {
    setShowSuggestedPrograms(false);
    setIsExpanded(false);
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Clone resultsComponent and inject control props
  const resultsWithControls = isValidElement(resultsComponent)
    ? cloneElement(resultsComponent as React.ReactElement<any>, {
        onClose: handleCloseResults,
        onToggleExpand: handleToggleExpand,
        isExpanded: isExpanded,
      })
    : resultsComponent;

  // ✅ Guard #2: Add key to fullscreen root for React reconciliation
  const fullscreenContent = (
    <div
      key="deepsearch-fullscreen"
      className="fixed inset-0 z-[1000] flex flex-col bg-gradient-to-br from-slate-900/98 via-slate-800/98 to-slate-900/98 backdrop-blur-xl"
    >
      {/* Fullscreen Toolbar - Always visible at top */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0 bg-slate-900/95 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {/* Logo / Brand */}
        <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="bg-white rounded-lg p-1.5 shadow-sm">
            <img src={logo} alt="Connect Study World" className="h-7 w-auto object-contain" />
          </div>
          <span className="text-white font-semibold text-base hidden sm:inline">ORYXA</span>
          
          {/* Results Count Badge */}
          <div className={`flex items-center gap-2 text-white/60 text-sm border-s border-white/20 ps-4 ${isRTL ? 'flex-row-reverse border-e border-s-0 pe-4 ps-0' : ''}`}>
            <span>{isRTL ? 'نتائج البحث:' : 'Results:'}</span>
            <span className="bg-white/10 px-2.5 py-0.5 rounded-full font-medium">{universities.length}</span>
          </div>
        </div>
        
        {/* Controls: Avatar, Language, Favorites, Wallet, Theme, Minimize, Close */}
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Student Avatar */}
          <button
            onClick={() => navigate('/account')}
            className="p-1 rounded-full hover:bg-white/10 transition-all duration-200"
            title={isRTL ? 'حسابي' : 'My Account'}
          >
            <Avatar className="h-8 w-8 border-2 border-white/20">
              <AvatarImage src={crmAvatarUrl || undefined} />
              <AvatarFallback className="bg-white/20 text-white text-xs">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          </button>

          {/* Language Toggle */}
          <div className="[&_button]:text-white [&_button]:hover:bg-white/10">
            <LanguageToggle />
          </div>

          {/* Favorites Heart */}
          <button
            onClick={() => navigate('/account?tab=shortlist')}
            className="relative p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
            title={isRTL ? 'المفضلة' : 'Favorites'}
          >
            <Heart className={`w-5 h-5 ${shortlist.length > 0 ? 'fill-red-500 text-red-500' : ''}`} />
            {shortlist.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {shortlist.length}
              </span>
            )}
          </button>

          {/* Wallet Balance */}
          <button
            onClick={() => navigate('/account?tab=wallet')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
            title={isRTL ? 'المحفظة' : 'Wallet'}
          >
            <Wallet className="w-5 h-5 text-emerald-400" />
            <span className="font-medium text-sm">
              ${walletBalance.toFixed(2)}
            </span>
          </button>

          {/* Theme Toggle */}
          <div className="[&_button]:text-white [&_button]:hover:bg-white/10">
            <ThemeToggle />
          </div>

          {/* Minimize Button */}
          <button
            onClick={handleToggleExpand}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
            title={isRTL ? 'تصغير' : 'Minimize'}
          >
            <Minimize2 className="w-5 h-5" />
          </button>

          {/* Close Button */}
          <button
            onClick={handleCloseResults}
            className="p-2.5 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-all duration-200"
            title={isRTL ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Split View Content */}
      <div className="flex w-full flex-1 min-h-0 items-stretch overflow-hidden">
        {/* Chat Panel - Always visible in fullscreen */}
        <div className={`relative z-10 flex flex-col min-w-0 w-[38%] shrink-0 ${isRTL ? 'order-2' : 'order-1'}`}>
          <div className="flex-1 min-h-0 h-full overflow-y-auto">
            {chatComponent}
          </div>
        </div>

        {/* Divider */}
        <div
          className={`w-px shrink-0 ${isRTL ? 'order-1' : 'order-2'}`}
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.2) 10%, rgba(255,255,255,0.2) 90%, transparent 100%)'
          }}
        />

        {/* Results Panel */}
        <div className={`relative z-10 flex flex-col min-w-0 flex-1 ${isRTL ? 'order-1' : 'order-2'}`}>
          <div className="flex-1 min-h-0 overflow-y-auto pb-6">
            {resultsWithControls}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-full">
      {/* ✅ Portal fullscreen - OUTSIDE AnimatePresence (fixes blank screen) */}
      {mounted && isSearchMode && isExpanded && createPortal(fullscreenContent, document.body)}

      {/* AnimatePresence for inline views only */}
      <AnimatePresence mode="wait">
        {isSearchMode && !isExpanded && (
            // ✅ Normal Search Mode: Inline split view
            <motion.div
              key="search-mode"
              className="
                oryxa-unified-container
                w-full min-h-[500px]
                flex flex-col
                border border-white/20
                shadow-2xl
                overflow-hidden
                backdrop-blur-xl
                bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95
                relative my-4 rounded-3xl h-[calc(100vh-120px)]
              "
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              layout
            >
              <div className="flex w-full flex-1 min-h-0 items-stretch">
                {/* Chat Panel - Shrinks */}
                <motion.div
                  className={`relative z-10 flex flex-col min-w-0 ${isRTL ? 'order-2' : 'order-1'}`}
                  initial={{ width: '100%' }}
                  animate={{ width: '38%' }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                    duration: 0.4
                  }}
                >
                  <div className="flex-1 min-h-0 h-full">
                    {chatComponent}
                  </div>
                </motion.div>

                {/* Elegant Divider */}
                <motion.div
                  className={`w-px h-full ${isRTL ? 'order-1' : 'order-2'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.2) 10%, rgba(255,255,255,0.2) 90%, transparent 100%)'
                  }}
                />

                {/* Results Panel - Slides In */}
                <motion.div
                  className={`relative z-10 flex flex-col min-w-0 ${isRTL ? 'order-1' : 'order-2'}`}
                  initial={{ 
                    width: '0%', 
                    opacity: 0,
                    x: isRTL ? -50 : 50 
                  }}
                  animate={{ 
                    width: '62%', 
                    opacity: 1,
                    x: 0 
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                    duration: 0.4
                  }}
                >
                  {/* Results Content - Header is inside SearchResultsPanel */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {resultsWithControls}
                  </div>
                </motion.div>
              </div>
            </motion.div>
        )}
        {!isSearchMode && (
          // ✅ Normal Mode: Chat centered
          <motion.div
            key="normal-mode"
            className="w-full flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="w-full max-w-2xl">
              {chatComponent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
