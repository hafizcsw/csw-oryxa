/**
 * Hook for loading services pricing config from database
 * Falls back to hardcoded constants if no active config
 * 
 * FIX-2: NO BALANCING DIFF - Pricing must match original Portal behavior exactly
 * pay_rules is stored as metadata only, NOT enforced at runtime
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============= Types =============
export interface ServiceDef {
  id: string;
  name: string;
  desc?: string;
  note?: string;
  category: 'docs' | 'university' | 'arrival';
  weight: number;
  hidden?: boolean;
}

export interface PackageDef {
  id: string;
  name: string;
  badge?: string;
  highlight?: boolean;
  includes: string[] | 'ALL';
  youHandle: string;
  bullets: string[];
}

export interface AddonDef {
  id: string;
  name: string;
  desc?: string;
  note?: string;
  price: number;
  country_codes?: string[];
}

// pay_rules is metadata only - NOT enforced at runtime per FIX-2
export interface PayRules {
  split_allowed_for?: string[];
  split_deposit_ratio?: number;
}

export interface PricingConfig {
  version: string;
  base_prices: Record<string, number>;
  services: ServiceDef[];
  packages: PackageDef[];
  addons: AddonDef[];
  pay_rules: PayRules; // Metadata only, not enforced
}

// ============= Fallback Constants =============
const FALLBACK_CONFIG: PricingConfig = {
  version: 'fallback_v1',
  base_prices: {
    RU: 800,
    CN: 1200,
    GB: 1500,
    EU: 1500,
  },
  services: [
    { id: 'translate-basic', name: 'ترجمة ملف القبول الأساسي', desc: 'شهادة + كشف درجات + جواز', note: '⚠️ لا يشمل التقديم أو المتابعة', category: 'docs', weight: 0.1875 },
    { id: 'translate-residency', name: 'ترجمة إقامة/هوية مقيم', desc: 'عند الحاجة', category: 'docs', weight: 0.05 },
    { id: 'attestation', name: 'توثيق/تصديق الوثائق', desc: 'إذا بلد الدراسة يطلب', category: 'docs', weight: 0.075 },
    { id: 'apply-uni', name: 'تقديم جامعة واحدة', desc: 'نقدّم ونرفع الملفات', note: '⚠️ لا يشمل المتابعة أو خدمات الوصول', category: 'university', weight: 0.15 },
    { id: 'followup', name: 'متابعة القبول والنواقص', desc: 'تواصل + استكمال النواقص', category: 'university', weight: 0.10 },
    { id: 'confirm-seat', name: 'تأكيد المقعد / التسجيل النهائي', desc: 'بعد القبول', category: 'university', weight: 0.0625 },
    { id: 'airport', name: 'استقبال مطار + نقل للسكن', desc: 'من المطار إلى السكن', category: 'arrival', weight: 0.075 },
    { id: 'sim', name: 'شريحة اتصال عند الوصول', desc: 'SIM + تفعيل', category: 'arrival', weight: 0.025 },
    { id: 'address-reg', name: 'تسجيل سكن/عنوان', desc: 'Registration رسمي', category: 'arrival', weight: 0.0375, hidden: true },
    { id: 'housing', name: 'حجز سكن', desc: 'بحث + حجز', category: 'arrival', weight: 0.1125, hidden: true },
    { id: 'bank', name: 'فتح حساب بنكي (مساعدة)', desc: 'تجهيز أوراق + إرشاد', category: 'arrival', weight: 0.0625, hidden: true },
    { id: 'credential', name: 'معادلة الشهادة', desc: 'تقديم + متابعة', category: 'arrival', weight: 0.0625, hidden: true },
  ],
  packages: [
    { id: 'translation-only', name: 'ترجمة فقط', includes: ['translate-basic'], youHandle: 'التقديم + المتابعة + التسجيل + السكن + الوصول', bullets: ['ترجمة ملف القبول الأساسي', 'PDF مرتب وجاهز للرفع', 'تدقيق تطابق الاسم مع الجواز', 'مناسب للي يسجّل بنفسه'] },
    { id: 'admission-followup', name: 'القبول مع المتابعة', badge: '⭐ الأكثر اختيارًا', includes: ['translate-basic', 'apply-uni', 'followup'], youHandle: 'التسجيل النهائي + السكن + الوصول', bullets: ['كل ما في "ترجمة فقط"', 'تقديم جامعة واحدة', 'متابعة القبول + النواقص', 'تحديثات واضحة حتى النتيجة'] },
    { id: 'full', name: 'الخدمة الكاملة', badge: '✅ أفضل قيمة', highlight: true, includes: 'ALL', youHandle: 'لا شيء ✅ (أرسل الأوراق فقط)', bullets: ['ترجمة + تقديم + متابعة', 'تأكيد المقعد / التسجيل النهائي', 'سكن + وصول (استقبال + شريحة + تسجيل)', 'أولوية سرعة (Priority)'] },
  ],
  addons: [
    { id: 'russian-course', name: 'كورس لغة روسي', desc: 'شهرين قبل الوصول — أونلاين', price: 250, country_codes: ['RU'] },
    { id: 'scholarship-pack', name: 'ملف منحة احترافي', desc: 'تدريب للاختبار + ملف كامل', price: 500, note: '⚠️ نضمن ملف احترافي — لا نضمن القبول', country_codes: ['RU'] },
  ],
  // pay_rules is metadata only - Portal allows split for any selection
  pay_rules: {
    split_allowed_for: ['packages'],
    split_deposit_ratio: 0.4,
  },
};

// ============= Hook =============
export function useServicesPricingConfig() {
  const [config, setConfig] = useState<PricingConfig>(FALLBACK_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error: queryError } = await supabase
        .from('services_pricing_configs')
        .select('*')
        .eq('is_active', true)
        .single();

      if (queryError || !data) {
        console.log('[useServicesPricingConfig] Using fallback config:', queryError?.message);
        setConfig(FALLBACK_CONFIG);
        setError(null); // Fallback is OK, not an error
        return;
      }

      console.log('[useServicesPricingConfig] ✅ Loaded config version:', data.version);
      
      setConfig({
        version: data.version,
        base_prices: data.base_prices as Record<string, number>,
        services: (data.services as unknown) as ServiceDef[],
        packages: (data.packages as unknown) as PackageDef[],
        addons: (data.addons as unknown) as AddonDef[],
        pay_rules: ((data.pay_rules as unknown) as PayRules) || {},
      });
      setError(null);
    } catch (err) {
      console.error('[useServicesPricingConfig] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load config');
      setConfig(FALLBACK_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return { config, loading, error, reload: loadConfig };
}

// ============= Helper Functions =============

/**
 * Get price for a single service
 * Uses original Portal formula: roundTo10(basePrice * weight)
 * NO BALANCING DIFF per FIX-2
 */
export function getServicePrice(
  serviceId: string, 
  countryCode: string, 
  config: PricingConfig
): number {
  const basePrice = config.base_prices[countryCode] || config.base_prices['EU'] || 1500;
  const service = config.services.find(s => s.id === serviceId);
  if (!service) return 0;
  // Original Portal formula: roundTo10
  return Math.round((basePrice * service.weight) / 10) * 10;
}

/**
 * Get all services with computed prices
 * NO BALANCING DIFF - each service price is independent
 * Total may not exactly equal base_price (this matches original Portal behavior)
 */
export function getServicesWithPrices(
  countryCode: string,
  config: PricingConfig
): (ServiceDef & { price: number })[] {
  const basePrice = config.base_prices[countryCode] || config.base_prices['EU'] || 1500;
  
  // Original Portal formula: roundTo10(basePrice * weight) for each service
  // NO balancing diff - this matches current Portal behavior exactly
  return config.services.map(s => ({
    ...s,
    price: Math.round((basePrice * s.weight) / 10) * 10,
  }));
}

/**
 * Get package price
 * If includes === 'ALL', returns base price
 * Otherwise, sums included service prices
 */
export function getPackagePrice(
  pkg: PackageDef,
  countryCode: string,
  config: PricingConfig
): number {
  const basePrice = config.base_prices[countryCode] || config.base_prices['EU'] || 1500;
  
  if (pkg.includes === 'ALL') {
    return basePrice;
  }
  
  return pkg.includes.reduce((sum, id) => sum + getServicePrice(id, countryCode, config), 0);
}

/**
 * Get addons available for a specific country
 */
export function getAddonsForCountry(countryCode: string, config: PricingConfig): AddonDef[] {
  return config.addons.filter(addon => {
    if (!addon.country_codes || addon.country_codes.length === 0) return true;
    return addon.country_codes.includes(countryCode);
  });
}
