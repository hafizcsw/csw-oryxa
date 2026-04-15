import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { Globe, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const languages: { code: Language; name: string; nativeName: string; flag: string }[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇧🇷" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
];

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const currentLang = useMemo(
    () => languages.find((l) => l.code === language),
    [language],
  );
  const isRTL = language === "ar";

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 50);
      return;
    }

    setSearch("");
  }, [open]);

  const filtered = useMemo(
    () =>
      languages.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.nativeName.toLowerCase().includes(search.toLowerCase()) ||
          l.code.includes(search.toLowerCase()),
      ),
    [search],
  );

  const handleSelect = (code: Language) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 h-8 px-2.5 rounded-full text-inherit transition-all duration-200",
            "hover:bg-white/15 active:scale-95",
            open && "bg-white/15",
          )}
          aria-label="Change language"
          aria-expanded={open}
          type="button"
        >
          <span className="text-sm leading-none">{currentLang?.flag}</span>
          <span className="text-xs font-semibold uppercase tracking-wide">
            {currentLang?.code}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={isRTL ? "start" : "end"}
        side="bottom"
        sideOffset={10}
        collisionPadding={12}
        dir={isRTL ? "rtl" : "ltr"}
        className={cn(
          "w-[min(420px,calc(100vw-24px))] rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-2xl shadow-black/15 dark:shadow-black/40",
          "max-h-[min(70vh,560px)] overflow-hidden",
        )}
      >
        <div className="flex max-h-[min(70vh,560px)] flex-col">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {isRTL ? "اختر اللغة" : "Select Language"}
              </h3>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {languages.length} {isRTL ? "لغة متاحة" : "languages"}
            </span>
          </div>

          <div className="px-4 pb-3">
            <div className="relative">
              <Search className={cn(
                "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
                isRTL ? "right-3" : "left-3",
              )} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isRTL ? "ابحث عن لغة..." : "Search languages..."}
                className={cn(
                  "w-full h-9 rounded-lg text-sm bg-muted/60 border border-border/50 outline-none",
                  "placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all",
                  isRTL ? "pr-9 pl-3 text-right" : "pl-9 pr-3 text-left",
                )}
              />
            </div>
          </div>

          <div className="overflow-y-auto px-3 pb-3">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isRTL ? "لم يتم العثور على لغات" : "No languages found"}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {filtered.map((lang) => {
                  const isActive = language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => handleSelect(lang.code)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all duration-150 cursor-pointer",
                        "hover:bg-accent active:scale-[0.97]",
                        isRTL && "text-right",
                        isActive
                          ? "bg-primary/8 dark:bg-primary/15 ring-1.5 ring-primary/25"
                          : "hover:ring-1 hover:ring-border",
                      )}
                      type="button"
                    >
                      <span className="text-xl leading-none shrink-0">{lang.flag}</span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "truncate text-sm font-medium leading-tight",
                            isActive ? "text-primary" : "text-foreground",
                          )}
                        >
                          {lang.nativeName}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
                          {lang.name}
                        </div>
                      </div>
                      {isActive && (
                        <div className={cn(
                          "absolute top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary",
                          isRTL ? "left-2" : "right-2",
                        )}>
                          <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-b-2xl border-t border-border bg-muted/30 px-5 py-3">
            <p className="text-center text-[11px] text-muted-foreground">
              {currentLang?.flag} {currentLang?.nativeName} · {languages.length} {isRTL ? "لغة متاحة" : "languages available"}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
