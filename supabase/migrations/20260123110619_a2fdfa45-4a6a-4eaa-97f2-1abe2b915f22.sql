-- ============= PORTAL-1: Services State Sync Table =============
-- This table stores current service selections for realtime sync between Portal and CRM

CREATE TABLE IF NOT EXISTS public.customer_service_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL,
  country_code TEXT NOT NULL,
  selected_services TEXT[] DEFAULT '{}',
  selected_addons TEXT[] DEFAULT '{}',
  selected_package_id TEXT,
  pay_plan TEXT DEFAULT 'full' CHECK (pay_plan IN ('full', 'split')),
  pricing_snapshot JSONB DEFAULT '{}',
  pricing_version TEXT DEFAULT 'v1',
  source TEXT DEFAULT 'portal' CHECK (source IN ('portal', 'crm_staff')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed')),
  state_rev INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(auth_user_id, country_code)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_css_auth_user ON public.customer_service_selections(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_css_updated ON public.customer_service_selections(updated_at DESC);

-- Enable RLS
ALTER TABLE public.customer_service_selections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/modify their own selections
CREATE POLICY "Users can view own selections" ON public.customer_service_selections
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own selections" ON public.customer_service_selections
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own selections" ON public.customer_service_selections
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_service_selections;


-- ============= PORTAL-2: Services Pricing Config Table (Versioned) =============
-- This table stores versioned pricing configurations for admin management

CREATE TABLE IF NOT EXISTS public.services_pricing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  base_prices JSONB NOT NULL DEFAULT '{"RU": 800, "CN": 1200, "GB": 1500, "EU": 1500}',
  services JSONB NOT NULL DEFAULT '[]',
  packages JSONB NOT NULL DEFAULT '[]',
  addons JSONB NOT NULL DEFAULT '[]',
  pay_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  created_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for active config lookup
CREATE INDEX IF NOT EXISTS idx_spc_active ON public.services_pricing_configs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_spc_version ON public.services_pricing_configs(version);

-- Enable RLS (admin-only access will be enforced via service_role)
ALTER TABLE public.services_pricing_configs ENABLE ROW LEVEL SECURITY;

-- Public read policy for active config (Portal reads this)
CREATE POLICY "Anyone can read active config" ON public.services_pricing_configs
  FOR SELECT USING (is_active = true);


-- ============= PORTAL-3: Preferred Universities Table =============
-- This table stores preferred universities for staff recommendations

CREATE TABLE IF NOT EXISTS public.preferred_universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL,
  country_code TEXT,
  preferred_rank INTEGER DEFAULT 100,
  reason_short TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(university_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_pu_country ON public.preferred_universities(country_code);
CREATE INDEX IF NOT EXISTS idx_pu_rank ON public.preferred_universities(preferred_rank);

-- Enable RLS
ALTER TABLE public.preferred_universities ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated (Portal reads, CRM writes via service_role)
CREATE POLICY "Authenticated can read preferred" ON public.preferred_universities
  FOR SELECT TO authenticated USING (is_active = true);


-- ============= Initial Pricing Config (Seed Data) =============
INSERT INTO public.services_pricing_configs (
  version,
  base_prices,
  services,
  packages,
  addons,
  pay_rules,
  is_active,
  reason
) VALUES (
  'v1.0.0',
  '{"RU": 800, "CN": 1200, "GB": 1500, "EU": 1500}'::jsonb,
  '[
    {"id": "translate-basic", "name": "ترجمة ملف القبول الأساسي", "desc": "شهادة + كشف درجات + جواز", "note": "⚠️ لا يشمل التقديم أو المتابعة", "category": "docs", "weight": 0.1875},
    {"id": "translate-residency", "name": "ترجمة إقامة/هوية مقيم", "desc": "عند الحاجة", "category": "docs", "weight": 0.05},
    {"id": "attestation", "name": "توثيق/تصديق الوثائق", "desc": "إذا بلد الدراسة يطلب", "category": "docs", "weight": 0.075},
    {"id": "apply-uni", "name": "تقديم جامعة واحدة", "desc": "نقدّم ونرفع الملفات", "note": "⚠️ لا يشمل المتابعة أو خدمات الوصول", "category": "university", "weight": 0.15},
    {"id": "followup", "name": "متابعة القبول والنواقص", "desc": "تواصل + استكمال النواقص", "category": "university", "weight": 0.10},
    {"id": "confirm-seat", "name": "تأكيد المقعد / التسجيل النهائي", "desc": "بعد القبول", "category": "university", "weight": 0.0625},
    {"id": "airport", "name": "استقبال مطار + نقل للسكن", "desc": "من المطار إلى السكن", "category": "arrival", "weight": 0.075},
    {"id": "sim", "name": "شريحة اتصال عند الوصول", "desc": "SIM + تفعيل", "category": "arrival", "weight": 0.025},
    {"id": "address-reg", "name": "تسجيل سكن/عنوان", "desc": "Registration رسمي", "category": "arrival", "weight": 0.0375, "hidden": true},
    {"id": "housing", "name": "حجز سكن", "desc": "بحث + حجز", "category": "arrival", "weight": 0.1125, "hidden": true},
    {"id": "bank", "name": "فتح حساب بنكي (مساعدة)", "desc": "تجهيز أوراق + إرشاد", "category": "arrival", "weight": 0.0625, "hidden": true},
    {"id": "credential", "name": "معادلة الشهادة", "desc": "تقديم + متابعة", "category": "arrival", "weight": 0.0625, "hidden": true}
  ]'::jsonb,
  '[
    {"id": "translation-only", "name": "ترجمة فقط", "includes": ["translate-basic"], "youHandle": "التقديم + المتابعة + التسجيل + السكن + الوصول", "bullets": ["ترجمة ملف القبول الأساسي", "PDF مرتب وجاهز للرفع", "تدقيق تطابق الاسم مع الجواز", "مناسب للي يسجّل بنفسه"]},
    {"id": "admission-followup", "name": "القبول مع المتابعة", "badge": "⭐ الأكثر اختيارًا", "includes": ["translate-basic", "apply-uni", "followup"], "youHandle": "التسجيل النهائي + السكن + الوصول", "bullets": ["كل ما في \"ترجمة فقط\"", "تقديم جامعة واحدة", "متابعة القبول + النواقص", "تحديثات واضحة حتى النتيجة"]},
    {"id": "full", "name": "الخدمة الكاملة", "badge": "✅ أفضل قيمة", "highlight": true, "includes": "ALL", "youHandle": "لا شيء ✅ (أرسل الأوراق فقط)", "bullets": ["ترجمة + تقديم + متابعة", "تأكيد المقعد / التسجيل النهائي", "سكن + وصول (استقبال + شريحة + تسجيل)", "أولوية سرعة (Priority)"]}
  ]'::jsonb,
  '[
    {"id": "russian-course", "name": "كورس لغة روسي", "desc": "شهرين قبل الوصول — أونلاين", "price": 250, "country_codes": ["RU"]},
    {"id": "scholarship-pack", "name": "ملف منحة احترافي", "desc": "تدريب للاختبار + ملف كامل", "price": 500, "note": "⚠️ نضمن ملف احترافي — لا نضمن القبول", "country_codes": ["RU"]}
  ]'::jsonb,
  '{"split_allowed_for": ["packages"], "split_deposit_ratio": 0.4}'::jsonb,
  true,
  'Initial v1.0.0 - Migrated from hardcoded constants'
) ON CONFLICT (version) DO NOTHING;


-- ============= Trigger for updated_at =============
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to customer_service_selections
DROP TRIGGER IF EXISTS set_updated_at_css ON public.customer_service_selections;
CREATE TRIGGER set_updated_at_css
  BEFORE UPDATE ON public.customer_service_selections
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Apply to services_pricing_configs
DROP TRIGGER IF EXISTS set_updated_at_spc ON public.services_pricing_configs;
CREATE TRIGGER set_updated_at_spc
  BEFORE UPDATE ON public.services_pricing_configs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Apply to preferred_universities
DROP TRIGGER IF EXISTS set_updated_at_pu ON public.preferred_universities;
CREATE TRIGGER set_updated_at_pu
  BEFORE UPDATE ON public.preferred_universities
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();