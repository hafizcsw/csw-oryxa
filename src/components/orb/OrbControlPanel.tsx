import React from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Settings2, Palette, Waves } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export interface OrbSettings {
  distortion: number;
  pulseSpeed: number;
  color1: string;
  color2: string;
  color3: string;
}

interface OrbControlPanelProps {
  settings: OrbSettings;
  onChange: (settings: OrbSettings) => void;
  className?: string;
}

export function OrbControlPanel({ settings, onChange, className = "" }: OrbControlPanelProps) {
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const updateSetting = <K extends keyof OrbSettings>(key: K, value: OrbSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div 
      className={`
        bg-background/80 dark:bg-black/60 backdrop-blur-xl 
        border border-border/50 dark:border-white/10 
        rounded-2xl p-5 
        shadow-xl
        ${className}
      `}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-border/30 dark:border-white/10">
        <Settings2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground dark:text-white">
          {isRTL ? "تحكم بالكرة" : "Orb Controls"}
        </span>
      </div>

      {/* Distortion Slider */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center gap-2">
          <Waves className="w-3.5 h-3.5 text-muted-foreground" />
          <Label className="text-xs font-medium text-muted-foreground">
            {isRTL ? "شدة التشوه" : "Distortion"}
          </Label>
          <span className="ms-auto text-xs text-primary font-mono">
            {settings.distortion.toFixed(1)}
          </span>
        </div>
        <Slider
          value={[settings.distortion]}
          onValueChange={([val]) => updateSetting("distortion", val)}
          min={0}
          max={3}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Pulse Speed Slider */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center gap-2">
          <Waves className="w-3.5 h-3.5 text-muted-foreground rotate-90" />
          <Label className="text-xs font-medium text-muted-foreground">
            {isRTL ? "سرعة النبض" : "Pulse Speed"}
          </Label>
          <span className="ms-auto text-xs text-primary font-mono">
            {settings.pulseSpeed.toFixed(1)}
          </span>
        </div>
        <Slider
          value={[settings.pulseSpeed]}
          onValueChange={([val]) => updateSetting("pulseSpeed", val)}
          min={0.5}
          max={5}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Colors Section */}
      <div className="pt-3 border-t border-border/30 dark:border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-3.5 h-3.5 text-muted-foreground" />
          <Label className="text-xs font-medium text-muted-foreground">
            {isRTL ? "الألوان" : "Colors"}
          </Label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Color 1 */}
          <div className="flex flex-col items-center gap-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {isRTL ? "أساسي" : "Primary"}
            </label>
            <input
              type="color"
              value={settings.color1}
              onChange={(e) => updateSetting("color1", e.target.value)}
              className="w-10 h-10 rounded-lg border-2 border-border/50 dark:border-white/20 cursor-pointer bg-transparent p-0.5"
            />
          </div>

          {/* Color 2 */}
          <div className="flex flex-col items-center gap-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {isRTL ? "ثانوي" : "Secondary"}
            </label>
            <input
              type="color"
              value={settings.color2}
              onChange={(e) => updateSetting("color2", e.target.value)}
              className="w-10 h-10 rounded-lg border-2 border-border/50 dark:border-white/20 cursor-pointer bg-transparent p-0.5"
            />
          </div>

          {/* Color 3 */}
          <div className="flex flex-col items-center gap-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {isRTL ? "تمييز" : "Accent"}
            </label>
            <input
              type="color"
              value={settings.color3}
              onChange={(e) => updateSetting("color3", e.target.value)}
              className="w-10 h-10 rounded-lg border-2 border-border/50 dark:border-white/20 cursor-pointer bg-transparent p-0.5"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
