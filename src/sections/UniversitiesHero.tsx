import { useSearchParams, useNavigate } from "react-router-dom";
import { GenericFilters } from "@/components/GenericFilters";
import { SEARCH_TABS, type TabKey, DEFAULT_TAB } from "@/config/searchTabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { Sparkles } from "lucide-react";

interface UniversitiesHeroProps {
  currentTab: TabKey;
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  onSearch: () => void;
}

export default function UniversitiesHero({
  currentTab,
  filters,
  onFiltersChange,
  onSearch
}: UniversitiesHeroProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  // Translate tab labels using t()
  const tabs: Array<{key: TabKey; labelKey: string}> = [
    { key: "programs", labelKey: SEARCH_TABS.programs.label },
    { key: "scholarships", labelKey: SEARCH_TABS.scholarships.label },
    { key: "universities", labelKey: SEARCH_TABS.universities.label },
    { key: "events", labelKey: SEARCH_TABS.events.label },
  ];

  const handleTabClick = (tabKey: TabKey) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tabKey);
    newParams.delete('offset');
    setSearchParams(newParams, { replace: true });
  };

  const currentConfig = SEARCH_TABS[currentTab];

  // Dynamic direction based on language
  const isRtl = language === 'ar';

  return (
    <section className="uni-hero" dir={isRtl ? "rtl" : "ltr"}>
      <div className="uni-hero__bg" aria-hidden="true" />
      <div className="uni-hero__wrap">
        {/* Tabs inside hero */}
        <nav className="uni-hero__tabs" aria-label={t("tabs.ariaLabel")} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={`uni-tab-btn ${currentTab === tab.key ? "is-active" : ""}`}
              role="tab"
              aria-selected={currentTab === tab.key}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>

        {/* Filter Card inside hero */}
        <div className="uni-hero__filterCard">
          {currentConfig.isReady ? (
            <>
              <GenericFilters
                fields={[...currentConfig.fields]}
                filters={filters}
                onFiltersChange={onFiltersChange}
                onSearch={onSearch}
              />
              {/* AI Assistant Button */}
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => {
                    const lang = (language || 'ar').toLowerCase();
                    navigate(`/${lang}?ai_assist=1`);
                  }}
                  className="group flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
                  <span>
                    {language === 'ar' 
                      ? 'دع الذكاء الاصطناعي يختار الأفضل لك' 
                      : 'Let AI find the best for you'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-4">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center">
                <span className="text-4xl">🚀</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">{t('common.comingSoon')}</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {t('tabs.comingSoonDesc')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
