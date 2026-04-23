import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { X } from 'lucide-react';
import { MalakChatInterface } from '@/components/chat/MalakChatInterface';
// Lazy: pulls three.js (~700KB). Keep out of the homepage initial bundle.
const AntigravityParticleField = lazy(() =>
  import('@/components/home/hero-shader/antigravity/AntigravityParticleField').then(m => ({
    default: m.AntigravityParticleField,
  }))
);
import oryxaMark from '@/assets/orxya-mark.png';
import { DeepSearchLayout } from '@/components/chat/DeepSearchLayout';
import { SearchResultsPanel } from '@/components/chat/SearchResultsPanel';
import { DebugOverlay } from '@/components/chat/DebugOverlay';
import { CompareFloatingBar } from '@/components/compare/CompareFloatingBar';
import { CompareDrawer } from '@/components/compare/CompareDrawer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TickerSettings {
  enabled: boolean;
  text_en: string;
  label_en: string;
  bg_color: string;
  label_color: string;
  text_color: string;
  speed_seconds: number;
}

export function HeroSection() {
  const { language, t } = useLanguage();
  const { showSuggestedPrograms, universities } = useMalakChat();
  const isArabic = language === 'ar';
  const [isTickerVisible, setIsTickerVisible] = useState(true);
  const [compareDrawerOpen, setCompareDrawerOpen] = useState(false);
  const [chatMessageCount, setChatMessageCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Check if we're in deep search mode
  const isDeepSearchMode = showSuggestedPrograms && universities.length > 0;
  
  // Fetch ticker settings from database
  const { data: tickerSettings } = useQuery({
    queryKey: ['news-ticker-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_settings')
        .select('value')
        .eq('key', 'news_ticker')
        .single();
      
      if (error) {
        console.warn('[HeroSection] Failed to fetch ticker settings:', error);
        return null;
      }
      return data?.value as unknown as TickerSettings | null;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Translate ticker if language is not English
  const { data: translatedTicker } = useQuery({
    queryKey: ['ticker-translation', language, tickerSettings?.text_en],
    queryFn: async () => {
      if (!tickerSettings) return null;
      
      const { data, error } = await supabase.functions.invoke('translate-ticker', {
        body: { 
          text_en: tickerSettings.text_en, 
          label_en: tickerSettings.label_en,
          target_lang: language 
        }
      });
      
      if (error) {
        console.warn('[HeroSection] Translation failed:', error);
        return null;
      }
      return data as { text: string; label: string } | null;
    },
    enabled: !!tickerSettings && language !== 'en',
    staleTime: 60 * 60 * 1000, // Cache translations for 1 hour
  });

  // Use translated text or fallback to English
  const tickerText = translatedTicker?.text || tickerSettings?.text_en || '';
  const tickerLabel = translatedTicker?.label || tickerSettings?.label_en || 'BREAKING';
  const isTickerEnabled = tickerSettings?.enabled !== false;
  
  // Auto-hide ticker when entering deep search mode
  useEffect(() => {
    if (isDeepSearchMode) {
      setIsTickerVisible(false);
    }
  }, [isDeepSearchMode]);
  
  // Auto-scroll to center the chat/results when entering deep search
  useEffect(() => {
    if (isDeepSearchMode && containerRef.current) {
      containerRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, [isDeepSearchMode]);
  
  // Don't show ticker if disabled or no settings
  const shouldShowTicker = !isDeepSearchMode && isTickerVisible && isTickerEnabled && tickerText;

  return (
    <div className="relative flex flex-col">
      {/* 🆕 P0: Debug Overlay - shows when ?debug=1 */}
      <DebugOverlay />
      
      {/* News Ticker - Dynamic from Database */}
      {shouldShowTicker && (
        <div 
          className="hidden sm:block w-full border-b border-red-600/30 shadow-lg"
          style={{ 
            background: tickerSettings?.bg_color 
              ? `linear-gradient(to right, ${tickerSettings.bg_color}, #000, ${tickerSettings.bg_color})`
              : 'linear-gradient(to right, #111827, #000, #111827)'
          }}
        >
          <div className="flex items-center">
            {/* BREAKING Label */}
            <div 
              className="flex-shrink-0 px-4 sm:px-6 py-2 sm:py-3 font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2"
              style={{ 
                backgroundColor: tickerSettings?.label_color || '#DC2626',
                color: '#FFFFFF'
              }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              {tickerLabel}
            </div>
            {/* Scrolling Text */}
            <div className="flex-1 overflow-hidden py-2 sm:py-3">
              <div 
                className={`animate-marquee whitespace-nowrap font-medium text-xs sm:text-sm tracking-wide ${isArabic ? 'direction-rtl' : ''}`}
                style={{ 
                  color: tickerSettings?.text_color || '#FFFFFF',
                  animationDuration: `${tickerSettings?.speed_seconds || 15}s`
                }}
              >
                {tickerText}
                {'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
                {tickerText}
                {'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}
                {tickerText}
              </div>
            </div>
            {/* Close Button */}
            <button
              onClick={() => setIsTickerVisible(false)}
              className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-3 hover:bg-white/10 transition-colors"
              style={{ color: `${tickerSettings?.text_color || '#FFFFFF'}99` }}
              aria-label={t("home.hero.ticker.closeAriaLabel")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Main Chat Section */}
      <div
        ref={containerRef}
        className={`relative overflow-hidden ${isDeepSearchMode ? 'h-[calc(100dvh-80px)] sm:h-[calc(100dvh-100px)]' : 'min-h-[calc(100dvh-80px)] sm:min-h-[calc(100dvh-100px)]'}`}
      >
        {/* Solid hero background: white in light mode, black in dark mode */}
        <div className="absolute inset-0 bg-white dark:bg-black" />


        {/* Antigravity-style ring particle field (GPGPU sim + dash render) */}
        <AntigravityParticleField />

        <div className="relative z-10 w-full h-full max-w-6xl mx-auto px-4 sm:px-8 py-8 flex items-center justify-center">
          {isDeepSearchMode ? (
            <div className="flex-1 min-h-0 max-h-[calc(100%-2rem)] w-full">
              <DeepSearchLayout
                chatComponent={
                  <div className="w-full h-full max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <MalakChatInterface isInDeepSearch={isDeepSearchMode} />
                  </div>
                }
                resultsComponent={<SearchResultsPanel />}
              />
            </div>
          ) : (
            <div
              className={`w-full max-w-2xl mx-auto animate-fade-in flex flex-col transition-all duration-300 ${
                chatMessageCount === 0
                  ? 'gap-8 items-center justify-center pt-[35vh] pb-10'
                  : 'gap-4 items-stretch justify-start pt-[8vh] pb-8'
              }`}
            >
              {chatMessageCount === 0 && (
                <div className="flex flex-col items-center gap-5">
                  {/* Brand lockup above hero title (Antigravity-style) */}
                  <div className="flex items-center gap-3">
                    <img
                      src={oryxaMark}
                      alt="ORXYA"
                      width={64}
                      height={64}
                      className="h-9 sm:h-10 w-auto select-none"
                      draggable={false}
                    />
                    <span className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                      ORXYA
                    </span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-center text-foreground drop-shadow-sm">
                    {t('home.hero.title')}
                  </h1>
                </div>
              )}
              <div className="w-full">
                <MalakChatInterface isInDeepSearch={false} compact onMessagesCountChange={setChatMessageCount} />
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Compare Floating Bar - يظهر عند count >= 2 */}
      <CompareFloatingBar 
        onCompareClick={() => setCompareDrawerOpen(true)} 
        position="bottom"
      />
      
      {/* Compare Drawer */}
      <CompareDrawer 
        open={compareDrawerOpen} 
        onOpenChange={setCompareDrawerOpen} 
      />
    </div>
  );
}
