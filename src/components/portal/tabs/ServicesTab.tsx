import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  Search, FileText, GraduationCap, Plane, Sparkles, 
  Languages, FileCheck, BadgeCheck, Send, MessageSquare, CheckCircle,
  PlaneLanding, Smartphone, MapPin, Home, CreditCard, Award, BookOpen, Trophy,
  Check, Plus, X, MessageCircle, type LucideIcon
} from "lucide-react";
import { IconBox } from "@/components/ui/icon-box";
import { Button } from "@/components/ui/button";
import { TabNavigation } from "./TabNavigation";
import { useShortlist } from "@/hooks/useShortlist";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { useDraftApplications } from "@/hooks/useDraftApplications";
import { useSubmissionCache } from "@/hooks/useSubmissionCache";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";
// ✅ EXEC ORDER: Workflow Tracing
import { 
  buildTraceBody, 
  buildTraceHeaders, 
  clearWorkflowSession,
  getClientTraceId 
} from "@/lib/workflow";
import { buildProgramRef, type ProgramRef } from "@/lib/workflow";

// ============= Types =============
type ServiceCategory = "docs" | "university" | "arrival";
type CountryCode = "RU" | "CN" | "GB" | "EU";
type PayPlan = "full" | "split";

// All display text comes from locale resources — types contain structural data only
type ServiceDef = {
  id: string;
  category: ServiceCategory;
  weight: number;
  hidden?: boolean;
};

type RussiaAddon = {
  id: string;
  price: number;
};

type PackageDef = {
  id: string;
  highlight?: boolean;
  hasBadge?: boolean;
  includes: string[] | "ALL";
};

// ============= Icon Mapping =============
const SERVICE_ICON_MAP: Record<string, LucideIcon> = {
  'translate-basic': Languages,
  'translate-residency': FileCheck,
  'attestation': BadgeCheck,
  'apply-uni': Send,
  'followup': MessageSquare,
  'confirm-seat': CheckCircle,
  'airport': PlaneLanding,
  'sim': Smartphone,
  'address-reg': MapPin,
  'housing': Home,
  'bank': CreditCard,
  'credential': Award,
  'russian-course': BookOpen,
  'scholarship-pack': Trophy,
};
type CountrySelection = {
  serviceIds: string[];
  addOnIds: string[];
  packageId: string | null;
  payPlan: PayPlan;
};

// ============= Constants =============
const COUNTRY_BASE_PRICES: Record<CountryCode, number> = {
  RU: 800,
  CN: 1200,
  GB: 1500,
  EU: 1500,
};

const COUNTRY_FLAGS: Record<CountryCode, string> = {
  RU: "🇷🇺",
  CN: "🇨🇳",
  GB: "🇬🇧",
  EU: "🇪🇺",
};

// Service definitions — structural only (display text from locale resources)
const SERVICE_DEFINITIONS: ServiceDef[] = [
  // Documents
  { id: "translate-basic", category: "docs", weight: 0.1875 },
  { id: "translate-residency", category: "docs", weight: 0.05 },
  { id: "attestation", category: "docs", weight: 0.075 },
  // University
  { id: "apply-uni", category: "university", weight: 0.15 },
  { id: "followup", category: "university", weight: 0.10 },
  { id: "confirm-seat", category: "university", weight: 0.0625 },
  // Arrival
  { id: "airport", category: "arrival", weight: 0.075 },
  { id: "sim", category: "arrival", weight: 0.025 },
  { id: "address-reg", category: "arrival", weight: 0.0375, hidden: true },
  { id: "housing", category: "arrival", weight: 0.1125, hidden: true },
  { id: "bank", category: "arrival", weight: 0.0625, hidden: true },
  { id: "credential", category: "arrival", weight: 0.0625, hidden: true },
];

// Russia-only add-ons (fixed prices, not weight-based)
const RUSSIA_ADDONS: RussiaAddon[] = [
  { id: "russian-course", price: 250 },
  { id: "scholarship-pack", price: 500 },
];

const PACKAGES: PackageDef[] = [
  { id: "translation-only", includes: ["translate-basic"] },
  { id: "admission-followup", hasBadge: true, includes: ["translate-basic", "apply-uni", "followup"] },
  { id: "full", hasBadge: true, highlight: true, includes: "ALL" },
];

// ============= Helper Functions =============
function money(n: number) {
  return `$${Math.round(n)}`;
}

function roundTo10(n: number): number {
  return Math.round(n / 10) * 10;
}

// Calculate service price based on country base price and weight
function getServicePrice(serviceId: string, countryCode: CountryCode): number {
  const basePrice = COUNTRY_BASE_PRICES[countryCode];
  const service = SERVICE_DEFINITIONS.find(s => s.id === serviceId);
  if (!service) return 0;
  return roundTo10(basePrice * service.weight);
}

// Get all service prices for a country (balanced to match base price exactly)
function getServicesWithPrices(countryCode: CountryCode): (ServiceDef & { price: number })[] {
  const basePrice = COUNTRY_BASE_PRICES[countryCode];
  
  let services = SERVICE_DEFINITIONS.map(s => ({
    ...s,
    price: roundTo10(basePrice * s.weight),
  }));
  
  // Balance total to match base_price exactly
  const total = services.reduce((sum, s) => sum + s.price, 0);
  const diff = basePrice - total;
  
  if (diff !== 0) {
    // Adjust last service (credential) to balance
    const lastIdx = services.findIndex(s => s.id === "credential");
    if (lastIdx >= 0) {
      services[lastIdx].price += diff;
    }
  }
  
  return services;
}

// Get package price for a country
function getPackagePrice(pkg: PackageDef, countryCode: CountryCode): number {
  if (pkg.includes === "ALL") {
    return COUNTRY_BASE_PRICES[countryCode];
  }
  return pkg.includes.reduce((sum, id) => sum + getServicePrice(id, countryCode), 0);
}

// Map country name/code/slug to CountryCode (returns null if unknown)
function mapCountryNameToCode(name: string | undefined | null): CountryCode | null {
  if (!name) return null;
  
  const normalized = name.trim().toLowerCase();
  
  const map: Record<string, CountryCode> = {
    // Arabic names
    "روسيا": "RU", "الصين": "CN", "بريطانيا": "GB",
    "ألمانيا": "EU", "فرنسا": "EU", "إيطاليا": "EU",
    "إسبانيا": "EU", "هولندا": "EU", "بولندا": "EU", "تركيا": "EU",
    
    // English names (case-insensitive via normalized)
    "russia": "RU", "china": "CN",
    "uk": "GB", "united kingdom": "GB", "britain": "GB", "great britain": "GB",
    "germany": "EU", "france": "EU", "italy": "EU",
    "spain": "EU", "netherlands": "EU", "poland": "EU", "turkey": "EU",
    
    // ISO codes (uppercase)
    "RU": "RU", "CN": "CN", "GB": "GB",
    "DE": "EU", "FR": "EU", "IT": "EU", "ES": "EU", "NL": "EU", "PL": "EU", "TR": "EU",
    
    // ISO codes (lowercase for normalized)
    "ru": "RU", "cn": "CN", "gb": "GB",
    "de": "EU", "fr": "EU", "it": "EU", "es": "EU", "nl": "EU", "pl": "EU", "tr": "EU",
  };
  
  // Try original first (for Arabic)
  if (map[name]) return map[name];
  
  // Try normalized (lowercase)
  return map[normalized] || null;  // ✅ null instead of "EU"
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function getIncludedIds(pkg: PackageDef): string[] {
  if (pkg.includes === "ALL") return SERVICE_DEFINITIONS.map((s) => s.id);
  return pkg.includes;
}

// ============= UI Components =============
function StepPills({ included, t }: { included: Partial<Record<string, boolean>>; t: (key: string) => string }) {
  const STEP_KEYS = ["docs", "apply", "followup", "register", "housing", "arrival"] as const;
  const STEP_ICONS: Record<string, LucideIcon> = {
    docs: FileText, apply: Send, followup: MessageSquare,
    register: CheckCircle, housing: Home, arrival: PlaneLanding,
  };
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {STEP_KEYS.map((stepKey) => {
        const label = t(`portal.services.stepLabels.${stepKey}`);
        const ok = !!included[stepKey];
        const StepIcon = STEP_ICONS[stepKey] || FileText;
        return (
          <span
            key={stepKey}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
              ok 
                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shadow-sm" 
                : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            <span className={[
              "w-4 h-4 rounded-full flex items-center justify-center shrink-0",
              ok ? "bg-emerald-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"
            ].join(" ")}>
              {ok ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
            </span>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function ServiceToggle({
  service,
  price,
  selected,
  onToggle,
  translatedName,
  translatedDesc,
  translatedNote,
  addedLabel,
  addLabel,
}: {
  service: ServiceDef;
  price: number;
  selected: boolean;
  onToggle: (id: string) => void;
  translatedName: string;
  translatedDesc: string;
  translatedNote?: string;
  addedLabel: string;
  addLabel: string;
}) {
  const ServiceIcon = SERVICE_ICON_MAP[service.id] || FileText;
  return (
    <button
      type="button"
      onClick={() => onToggle(service.id)}
      className={[
        "group w-full text-right rounded-2xl border-2 p-5 transition-all duration-300",
        selected 
          ? "border-emerald-400 dark:border-emerald-600 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 shadow-lg shadow-emerald-500/10" 
          : "border-border bg-card hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Content */}
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{translatedName}</div>
          <div className="text-sm text-muted-foreground mt-1">{translatedDesc}</div>
          {translatedNote && (
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
              {translatedNote}
            </div>
          )}
        </div>
        
        {/* Price & Toggle */}
        <div className="flex flex-col items-end shrink-0 gap-2">
          <span className={[
            "text-sm font-bold px-3 py-1 rounded-full transition-colors duration-300",
            selected 
              ? "bg-emerald-500 text-white" 
              : "bg-primary/10 text-primary"
          ].join(" ")}>
            {money(price)}
          </span>
          <span
            className={[
              "inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-300",
              selected 
                ? "bg-emerald-600 text-white shadow-sm" 
                : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
            ].join(" ")}
          >
            {selected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {selected ? addedLabel : addLabel}
          </span>
        </div>
      </div>
    </button>
  );
}

function RussiaAddonCard({
  addon,
  selected,
  onToggle,
  translatedName,
  translatedDesc,
  translatedNote,
  addedLabel,
  addLabel,
}: {
  addon: RussiaAddon;
  selected: boolean;
  onToggle: (id: string) => void;
  translatedName: string;
  translatedDesc: string;
  translatedNote?: string;
  addedLabel: string;
  addLabel: string;
}) {
  const AddonIcon = SERVICE_ICON_MAP[addon.id] || Sparkles;
  return (
    <button
      type="button"
      onClick={() => onToggle(addon.id)}
      className={[
        "group w-full text-right rounded-2xl border-2 p-5 transition-all duration-300",
        selected 
          ? "border-purple-400 dark:border-purple-600 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20 shadow-lg shadow-purple-500/10" 
          : "border-border bg-card hover:border-purple-400/40 hover:-translate-y-0.5 hover:shadow-lg",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Content */}
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{translatedName}</div>
          <div className="text-sm text-muted-foreground mt-1">{translatedDesc}</div>
          {translatedNote && (
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
              {translatedNote}
            </div>
          )}
        </div>
        
        {/* Price & Toggle */}
        <div className="flex flex-col items-end shrink-0 gap-2">
          <span className={[
            "text-sm font-bold px-3 py-1 rounded-full transition-colors duration-300",
            selected 
              ? "bg-purple-500 text-white" 
              : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
          ].join(" ")}>
            {money(addon.price)}
          </span>
          <span
            className={[
              "inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-300",
              selected 
                ? "bg-purple-600 text-white shadow-sm" 
                : "bg-muted text-muted-foreground group-hover:bg-purple-500/10 group-hover:text-purple-600",
            ].join(" ")}
          >
            {selected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {selected ? addedLabel : addLabel}
          </span>
        </div>
      </div>
    </button>
  );
}

function PackageCard({
  pkg,
  selected,
  price,
  comparePrice,
  onSelect,
  stepState,
  t,
  translatedName,
  translatedBadge,
  translatedYouHandle,
  translatedBullets,
}: {
  pkg: PackageDef;
  selected: boolean;
  price: number;
  comparePrice: number;
  onSelect: (id: string) => void;
  stepState: Partial<Record<string, boolean>>;
  t: (key: string) => string;
  translatedName: string;
  translatedBadge?: string;
  translatedYouHandle: string;
  translatedBullets: string[];
}) {
  const savings = Math.max(0, comparePrice - price);

  return (
    <div
      className={[
        "relative rounded-2xl border-2 p-6 bg-card transition-all duration-300 flex flex-col",
        pkg.highlight 
          ? "border-emerald-400 dark:border-emerald-600 shadow-xl shadow-emerald-500/10 scale-[1.02]" 
          : "border-border hover:shadow-lg hover:-translate-y-0.5",
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      ].join(" ")}
    >
      {/* Badge */}
      {translatedBadge && (
        <div className="absolute -top-3 right-4">
          <span className={[
            "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold shadow-md",
            pkg.highlight 
              ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white" 
              : "bg-gradient-to-r from-amber-400 to-amber-500 text-white",
          ].join(" ")}>
            {translatedBadge}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-bold text-foreground">{translatedName}</div>
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{t('portal.services.youHandle')}</span> {translatedYouHandle}
          </div>
        </div>

        <div className="text-left shrink-0">
          <div className="text-2xl font-extrabold text-foreground">{money(price)}</div>
          {savings > 0 && (
            <div className="mt-1 text-sm text-muted-foreground">
              {t('portal.services.insteadOf')} <span className="line-through">{money(comparePrice)}</span>
            </div>
          )}
        </div>
      </div>

      {savings > 0 && (
        <div className="mt-4 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 text-center">
          💰 {t('portal.services.saved_amount')} <span className="font-bold">{money(savings)}</span>
        </div>
      )}

      <ul className="mt-4 flex-1 space-y-2.5 text-sm">
        {translatedBullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
            <span className="w-5 h-5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/25 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <StepPills included={stepState} t={t} />

      <button
        type="button"
        onClick={() => onSelect(pkg.id)}
        className={[
          "mt-5 w-full rounded-xl py-3.5 font-bold transition-all duration-300 text-sm",
          selected
            ? "bg-emerald-600 text-white cursor-default shadow-inner"
            : pkg.highlight
              ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl"
              : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg",
        ].join(" ")}
        disabled={selected}
      >
        {selected ? (
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {t('portal.services.selectedPackage')}
          </span>
        ) : t('portal.services.replaceWithPackage')}
      </button>

      <div className="mt-2 text-xs text-muted-foreground text-center">{t('portal.services.upgradeNote')}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <div className="mb-5 flex items-center gap-3">
        {icon && <IconBox icon={icon as any} size="md" variant="primary" />}
        <div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <div className="mt-1 h-0.5 w-12 rounded-full bg-gradient-to-r from-primary to-primary/30" />
        </div>
      </div>
      {children}
    </div>
  );
}

// ============= Main Component =============
interface ServicesTabProps {
  onTabChange?: (tab: string) => void;
  initialProgramId?: string | null;
  onClearProgramAndGoToFavorites?: () => void;
}

export function ServicesTab({ onTabChange, initialProgramId, onClearProgramAndGoToFavorites }: ServicesTabProps) {
  const { t, language } = useLanguage();
  const { t: i18nT } = useTranslation('common');
  const getCountryName = (code: CountryCode) => t(`portal.services.countries.${code}`);
  const getServiceName = (id: string) => t(`portal.services.serviceNames.${id}`);
  const getServiceDesc = (id: string) => t(`portal.services.serviceDescs.${id}`);
  const getServiceNote = (id: string) => {
    const key = `portal.services.serviceNotes.${id}`;
    const val = t(key);
    return val === key ? undefined : val;
  };
  const { shortlist, loading: shortlistLoading } = useShortlist();
  const { shortlist: localShortlistIds } = useMalakChat();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftIdFromUrl = searchParams.get("draft_id");
  const countryFromUrl = searchParams.get("country"); // ✅ P0: Read country from URL
  const { getById, getByProgramId, upsertForProgram, removeByProgramId } = useDraftApplications();
  const { save: saveSubmissionCache } = useSubmissionCache();
  
  // Multi-country state
  const [selectionsByCountry, setSelectionsByCountry] = useState<Record<string, CountrySelection>>({});
  const [selectedCountry, setSelectedCountry] = useState<CountryCode | null>(null);
  const [showMoreArrival, setShowMoreArrival] = useState(false);
  
  // Primary program state - initialize directly from URL param for immediate display
  const [primaryProgramId, setPrimaryProgramId] = useState<string | null>(initialProgramId || null);
  
  // ✅ Sync primaryProgramId when initialProgramId prop changes (e.g. from shortlist "start program")
  useEffect(() => {
    if (initialProgramId && initialProgramId !== primaryProgramId) {
      console.log('[ServicesTab] ✅ Syncing primaryProgramId from prop:', initialProgramId);
      setPrimaryProgramId(initialProgramId);
    }
  }, [initialProgramId]);
  
  // ✅ P0: Immediately set country from URL on mount (before shortlist loads)
  useEffect(() => {
    if (countryFromUrl && !selectedCountry) {
      const validCodes: CountryCode[] = ['RU', 'CN', 'GB', 'EU'];
      const upper = countryFromUrl.toUpperCase() as CountryCode;
      if (validCodes.includes(upper)) {
        console.log('[ServicesTab] ✅ Setting country from URL:', upper);
        setSelectedCountry(upper);
      }
    }
  }, [countryFromUrl, selectedCountry]);
  
  // CRM sync state
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedHashRef = useRef<string>("");

  // ============= CRM API Helper =============
  const callPortalApi = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn('[ServicesTab] No auth session for CRM call');
      return {
        ok: false,
        error: 'NO_SESSION',
        error_code: 'auth_required',
        message: 'auth_required',
        cta: 'login',
      };
    }
    
    // ✅ EXEC ORDER: Add trace headers for end-to-end tracking
    const traceHeaders = buildTraceHeaders();
    
    // IMPORTANT: when passing custom headers, include Authorization explicitly
    // otherwise the backend will reject the request with "Missing authorization header".
    const headers = {
      ...traceHeaders,
      Authorization: `Bearer ${session.access_token}`,
    };

    const result = await supabase.functions.invoke('student-portal-api', {
      headers,
      body: { action, ...payload }
    });
    
    if (result.error) {
      console.error(`[ServicesTab] API ${action} error:`, result.error);
      return {
        ok: false,
        error: result.error.message,
        error_code: (result.error as any)?.status === 401 ? 'auth_required' : 'invoke_error',
        message: (result.error as any)?.status === 401 ? 'auth_required' : 'connection_error',
      };
    }
    
    return result.data as { ok: boolean; [key: string]: unknown };
  }, []);

  // Get current selection for selected country (moved up for use in effects)
  const currentSelection = useMemo((): CountrySelection => {
    if (!selectedCountry) {
      return { serviceIds: [], addOnIds: [], packageId: null, payPlan: "full" };
    }
    return selectionsByCountry[selectedCountry] || { 
      serviceIds: [], 
      addOnIds: [], 
      packageId: null, 
      payPlan: "full" 
    };
  }, [selectedCountry, selectionsByCountry]);

  // ============= Hydration: Load selections from CRM on mount =============
  // ✅ FIX: Use ref to prevent re-hydration causing flicker
  const hydrationDoneRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  
  useEffect(() => {
    // ✅ FIX: Only hydrate once to prevent flicker on service selection
    if (hydrationDoneRef.current) return;
    
    async function hydrateFromCRM() {
      try {
        const result = await callPortalApi('get_service_selections');
        
        // ✅ Guard against unmount
        if (!isMountedRef.current) return;
        
        const selections = (result as { selections?: unknown[] }).selections;
        if (result.ok && Array.isArray(selections) && selections.length > 0) {
          console.log('[ServicesTab] 📥 Hydrating from CRM:', selections);
          
          const newSelections: Record<string, CountrySelection> = {};
          
          for (const sel of selections as Array<{
            country_code: string;
            selected_services?: string[];
            selected_addons?: string[];
            selected_package_id?: string | null;
            pay_plan?: PayPlan;
            status?: string;
          }>) {
            // Prefer draft over submitted
            const existing = newSelections[sel.country_code];
            if (existing && sel.status === 'submitted') continue;
            
            newSelections[sel.country_code] = {
              serviceIds: sel.selected_services || [],
              addOnIds: sel.selected_addons || [],
              packageId: sel.selected_package_id || null,
              payPlan: sel.pay_plan || 'full',
            };
          }
          
          if (Object.keys(newSelections).length > 0) {
            setSelectionsByCountry(prev => {
              // ✅ FIX: Merge with existing local selections instead of overwriting
              const merged = { ...prev };
              for (const [country, sel] of Object.entries(newSelections)) {
                // Only apply CRM data if local is empty
                if (!merged[country] || merged[country].serviceIds.length === 0) {
                  merged[country] = sel;
                }
              }
              return merged;
            });
            // Auto-select first country from saved selections if none selected
            setSelectedCountry(prev => {
              if (prev) return prev; // Keep existing selection
              const firstCountry = Object.keys(newSelections)[0] as CountryCode;
              return firstCountry || prev;
            });
          }
        }
      } catch (err) {
        console.warn('[ServicesTab] Hydration error:', err);
      } finally {
        // ✅ B) Hardening: Always set hydration done in finally block
        hydrationDoneRef.current = true;
        if (isMountedRef.current) {
          setIsHydrated(true);
        }
      }
    }
    
    hydrateFromCRM();
  }, [callPortalApi]); // ✅ FIX: Remove selectedCountry from deps to prevent re-hydration

  // ============= Auto-save with debounce =============
  const buildPricingSnapshot = useCallback((countryCode: CountryCode, selection: CountrySelection) => {
    const base = COUNTRY_BASE_PRICES[countryCode];
    const pricesForCountry = getServicesWithPrices(countryCode);
    
    const serviceItems = selection.serviceIds.map(id => {
      const svc = pricesForCountry.find(s => s.id === id);
      return { code: id, kind: 'service' as const, price: svc?.price || 0 };
    });
    
    const addonItems = selection.addOnIds.map(id => {
      const addon = RUSSIA_ADDONS.find(a => a.id === id);
      return { code: id, kind: 'addon' as const, price: addon?.price || 0 };
    });
    
    const svcTotal = serviceItems.reduce((sum, i) => sum + i.price, 0);
    const addTotal = addonItems.reduce((sum, i) => sum + i.price, 0);
    const total = svcTotal + addTotal;
    
    return {
      currency: 'USD',
      base_price: base,
      items: [...serviceItems, ...addonItems],
      services_total: svcTotal,
      addons_total: addTotal,
      total,
      pay_plan: selection.payPlan,
      deposit_amount: selection.payPlan === 'split' ? Math.round(total * 0.4) : total,
      remainder_amount: selection.payPlan === 'split' ? Math.round(total * 0.6) : 0,
      note: selection.payPlan === 'split' ? 'second installment due pre-travel' : null,
    };
  }, []);

  const computeSelectionHash = useCallback((countryCode: CountryCode, selection: CountrySelection) => {
    const snapshot = buildPricingSnapshot(countryCode, selection);
    return `${countryCode}:${selection.serviceIds.sort().join(',')}:${selection.addOnIds.sort().join(',')}:${selection.packageId}:${snapshot.total}:${selection.payPlan}`;
  }, [buildPricingSnapshot]);

  // ✅ P0: Build "effective shortlist" BEFORE using it in callbacks
  // This prevents Services from breaking when remote shortlist is delayed/empty
  const effectiveShortlist = useMemo(() => {
    // If remote has data, use it
    if (Array.isArray(shortlist) && shortlist.length > 0) {
      return shortlist;
    }
    
    // ✅ Fallback: Build from local IDs + snapshot cache
    if (localShortlistIds?.length > 0) {
      console.log('[ServicesTab] ⚡ Using local fallback, IDs:', localShortlistIds.length);
      try {
        const cacheKey = 'shortlist_snapshot_cache_v1';
        const cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
        
        return localShortlistIds.map((id: string) => {
          const cachedSnapshot = cache[id];
          if (cachedSnapshot?.snapshot) {
            const s = cachedSnapshot.snapshot;
            return {
              program_id: id,
              id: id,
              program_ref_id: cachedSnapshot.program_ref_id || id,
              program_name: s.program_name_ar || s.program_name_en || s.program_name,
              program_name_ar: s.program_name_ar,
              university_name: s.university_name_ar || s.university_name_en || s.university_name,
              university_name_ar: s.university_name_ar,
              country_code: s.country_code,
              country_name: s.country_name_ar || s.country_name_en,
              city: s.city,
              fees_yearly: s.tuition_usd_min,
              duration_months: s.duration_months,
            };
          }
          // Partial fallback
          return { program_id: id, id: id };
        }).filter(Boolean);
      } catch (e) {
        console.warn('[ServicesTab] Failed to build local fallback:', e);
      }
    }
    
    return [];
  }, [shortlist, localShortlistIds]);

  const saveSelectionToCRM = useCallback(async (countryCode: CountryCode, selection: CountrySelection) => {
    if (selection.serviceIds.length === 0) return; // Don't save empty selections
    
    const hash = computeSelectionHash(countryCode, selection);
    if (hash === lastSavedHashRef.current) return; // Skip if unchanged
    
    setIsSaving(true);
    
    // ✅ P0: Use effectiveShortlist for program IDs
    const programIds = Array.isArray(effectiveShortlist) 
      ? effectiveShortlist
          .filter((p: any) => mapCountryNameToCode(p?.country_code || p?.country) === countryCode)
          .map((p: any) => p.program_id || p.program_ref_id || p.id)
          .filter(Boolean)
      : [];
    
    // ✅ EXEC ORDER: Add trace body for service selection tracking
    const traceBody = buildTraceBody('service_select');
    console.log('[WF] services_change → set_services_selection', { 
      count: selection.serviceIds.length, 
      total: buildPricingSnapshot(countryCode, selection).total,
      client_trace_id: traceBody.client_trace_id 
    });
    
    // ✅ ORDER #2: Redirect old autosave to new set_services_selection action
    const result = await callPortalApi('set_services_selection', {
      country_code: countryCode,
      selected_services: selection.serviceIds,
      selected_addons: selection.addOnIds,
      selected_package_id: selection.packageId,
      pay_plan: selection.payPlan,
    });
    
    if (result.ok) {
      lastSavedHashRef.current = hash;
      console.log('[ServicesTab] ✅ Auto-saved via set_services_selection');
    } else {
      console.warn('[ServicesTab] ⚠️ Auto-save failed:', result.error);
    }
    
    setIsSaving(false);
  }, [callPortalApi, effectiveShortlist, buildPricingSnapshot, computeSelectionHash]);

  // ✅ A) FIX: DISABLED auto-save effect - Single write path via Save button only
  // The auto-save was causing multiple write paths which violates ORDER #2
  // All writes to CRM must go through handleSaveSelection() triggered by Save button
  // 
  // useEffect(() => {
  //   if (!isHydrated || !selectedCountry) return;
  //   if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  //   saveTimeoutRef.current = setTimeout(() => {
  //     saveSelectionToCRM(selectedCountry, currentSelection);
  //   }, 800);
  //   return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  // }, [isHydrated, selectedCountry, currentSelection, saveSelectionToCRM]);

  // (effectiveShortlist already defined above)

  // Extract countries from effective shortlist (not just remote)
  const countriesFromShortlist = useMemo(() => {
    const countryMap = new Map<CountryCode, number>();
    
    if (Array.isArray(effectiveShortlist)) {
      effectiveShortlist.forEach((item: any) => {
        const code = mapCountryNameToCode(item?.country_code || item?.country || item?.country_name);
        if (code) {
          countryMap.set(code, (countryMap.get(code) || 0) + 1);
        }
      });
    }
    
    return Array.from(countryMap.entries()).map(([code, count]) => ({
      code,
      name: getCountryName(code),
      flag: COUNTRY_FLAGS[code],
      count,
    }));
  }, [effectiveShortlist]);

  // Helper to get program by ID from effective shortlist (with localStorage fallback)
  const getProgramById = useCallback((programId: string) => {
    // ✅ P0: First try effective shortlist (includes local fallback)
    if (Array.isArray(effectiveShortlist)) {
      const found = effectiveShortlist.find((p: any) => 
        p.program_id === programId || 
        p.id === programId ||
        p.program_ref_id === programId  // ✅ P0: Also check program_ref_id
      );
      if (found) return found;
    }
    
    // ✅ FIX: Fallback to localStorage snapshot cache (prevents "برنامج غير معروف" on cold start)
    try {
      const cacheKey = 'shortlist_snapshot_cache_v1';
      const cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
      const cachedSnapshot = cache[programId];
      
      if (cachedSnapshot?.snapshot) {
        const s = cachedSnapshot.snapshot;
        console.log('[WF] getProgramById fallback to cache:', programId);
        return {
          program_id: programId,
          id: programId,
          program_ref_id: cachedSnapshot.program_ref_id || programId,
          // ✅ FIX: Match actual ProgramSnapshot structure from shortlist.ts
          program_name: s.program_name_ar || s.program_name_en || s.program_name,
          program_name_ar: s.program_name_ar,
          name: s.program_name_ar || s.program_name_en || s.program_name,
          university_name: s.university_name_ar || s.university_name_en || s.university_name,
          university_name_ar: s.university_name_ar,
          university_logo: s.university_logo,
          country_code: s.country_code,
          country_name: s.country_name_ar || s.country_name_en,
          city: s.city,
          degree_name: s.degree_level,
          degree_slug: s.degree_level?.toLowerCase()?.replace(/\s+/g, '-'),
          language: s.language,
          fees_yearly: s.tuition_usd_min,
          duration_months: s.duration_months,
          program_slug: cachedSnapshot.program_slug || s.portal_url?.split('/program/')?.[1],
        };
      }
    } catch (e) {
      console.warn('[WF] getProgramById cache read failed:', e);
    }
    
    return null;
  }, [effectiveShortlist]);

  // Get programs in selected country (using effective shortlist)
  const programsInSelectedCountry = useMemo(() => {
    if (!selectedCountry || !Array.isArray(effectiveShortlist)) return [];
    return effectiveShortlist.filter((p: any) => 
      mapCountryNameToCode(p?.country_code || p?.country || p?.country_name) === selectedCountry
    );
  }, [effectiveShortlist, selectedCountry]);

  // Set country from program after shortlist loads (primaryProgramId already set from prop)
  useEffect(() => {
    // ✅ P0: Use effectiveShortlist instead of shortlist
    if (primaryProgramId && Array.isArray(effectiveShortlist) && effectiveShortlist.length > 0 && !selectedCountry) {
      const program = getProgramById(primaryProgramId);
      if (program) {
        const countryCode = mapCountryNameToCode(program?.country_code || program?.country || program?.country_name);
        if (countryCode) {
          setSelectedCountry(countryCode);
        }
      }
    }
  }, [primaryProgramId, effectiveShortlist, getProgramById, selectedCountry]);

  // Prefill from Draft (when editing)
  useEffect(() => {
    if (!primaryProgramId) return;

    const draft = draftIdFromUrl
      ? getById(draftIdFromUrl)
      : getByProgramId(primaryProgramId);

    if (!draft) return;

    // Set country from draft first if not yet selected
    if (draft.country_code && !selectedCountry) {
      setSelectedCountry(draft.country_code as CountryCode);
      return; // Let effect rerun after country is set
    }

    const country = selectedCountry || draft.country_code;
    if (!country) return;

    // Prefill services from draft
    const serviceIds = draft.services
      .filter(s => SERVICE_DEFINITIONS.some(def => def.id === s.service_code))
      .map(s => s.service_code);
    
    const addonIds = draft.services
      .filter(s => RUSSIA_ADDONS.some(addon => addon.id === s.service_code))
      .map(s => s.service_code);
    
    if (serviceIds.length > 0 || addonIds.length > 0) {
      setSelectionsByCountry(prev => ({
        ...prev,
        [country]: {
          ...(prev[country] || { serviceIds: [], addOnIds: [], packageId: null, payPlan: "full" }),
          serviceIds,
          addOnIds: addonIds,
          packageId: null,
        },
      }));
    }
  }, [primaryProgramId, selectedCountry, draftIdFromUrl, getById, getByProgramId]);

  // Auto-select first country if not selected (only if no initialProgramId)
  useEffect(() => {
    if (!initialProgramId && !selectedCountry && countriesFromShortlist.length > 0) {
      setSelectedCountry(countriesFromShortlist[0].code);
    }
  }, [countriesFromShortlist, selectedCountry, initialProgramId]);

  // Handle country change - reset primary program if needed
  function handleCountryChange(code: CountryCode) {
    setSelectedCountry(code);
    
    // ✅ P0: Use effectiveShortlist instead of shortlist
    const programsInCountry = Array.isArray(effectiveShortlist) 
      ? effectiveShortlist.filter((p: any) => mapCountryNameToCode(p?.country_code || p?.country || p?.country_name) === code)
      : [];
    
    if (programsInCountry.length === 1) {
      // Single program = auto-select
      setPrimaryProgramId(programsInCountry[0].program_id || programsInCountry[0].id);
    } else if (programsInCountry.length > 1) {
      // Multiple programs = need selection
      setPrimaryProgramId(null);
    } else {
      setPrimaryProgramId(null);
    }
  }

  // (currentSelection already defined above)

  // Update selection for a country
  function updateCountrySelection(countryCode: CountryCode, update: Partial<CountrySelection>) {
    setSelectionsByCountry(prev => ({
      ...prev,
      [countryCode]: {
        ...(prev[countryCode] || { serviceIds: [], addOnIds: [], packageId: null, payPlan: "full" }),
        ...update,
      },
    }));
  }

  // Services with dynamic prices for selected country
  const servicesWithPrices = useMemo(() => {
    if (!selectedCountry) return [];
    return getServicesWithPrices(selectedCountry);
  }, [selectedCountry]);

  const servicesByCategory = useMemo(() => {
    const docs = servicesWithPrices.filter((s) => s.category === "docs");
    const uni = servicesWithPrices.filter((s) => s.category === "university");
    const arrival = servicesWithPrices.filter((s) => s.category === "arrival");
    return { docs, uni, arrival };
  }, [servicesWithPrices]);

  // Calculate totals
  const basePrice = selectedCountry ? COUNTRY_BASE_PRICES[selectedCountry] : 0;
  
  const servicesTotal = useMemo(() => {
    if (!selectedCountry) return 0;
    return currentSelection.serviceIds.reduce(
      (sum, id) => sum + getServicePrice(id, selectedCountry), 
      0
    );
  }, [selectedCountry, currentSelection.serviceIds]);

  const addOnsTotal = useMemo(() => {
    return currentSelection.addOnIds.reduce(
      (sum, id) => sum + (RUSSIA_ADDONS.find(a => a.id === id)?.price || 0),
      0
    );
  }, [currentSelection.addOnIds]);

  const totalPrice = servicesTotal + addOnsTotal;
  
  const depositAmount = currentSelection.payPlan === "split" ? Math.round(totalPrice * 0.4) : totalPrice;
  const remainderAmount = currentSelection.payPlan === "split" ? Math.round(totalPrice * 0.6) : 0;

  // Get selected service names
  const activeSelectionNames = useMemo(() => {
    return currentSelection.serviceIds.map(id => getServiceName(id));
  }, [currentSelection.serviceIds, language]);

  // Handlers
  function toggleService(id: string) {
    if (!selectedCountry) return;
    const newIds = currentSelection.serviceIds.includes(id)
      ? currentSelection.serviceIds.filter(x => x !== id)
      : uniq([...currentSelection.serviceIds, id]);
    updateCountrySelection(selectedCountry, { serviceIds: newIds, packageId: null });
  }

  function toggleAddon(id: string) {
    if (!selectedCountry) return;
    const newIds = currentSelection.addOnIds.includes(id)
      ? currentSelection.addOnIds.filter(x => x !== id)
      : uniq([...currentSelection.addOnIds, id]);
    updateCountrySelection(selectedCountry, { addOnIds: newIds });
  }

  function selectPackage(pkgId: string) {
    if (!selectedCountry) return;
    const pkg = PACKAGES.find((p) => p.id === pkgId);
    if (!pkg) return;
    const ids = getIncludedIds(pkg);
    updateCountrySelection(selectedCountry, { serviceIds: ids, packageId: pkgId });
  }

  function setPayPlan(plan: PayPlan) {
    if (!selectedCountry) return;
    updateCountrySelection(selectedCountry, { payPlan: plan });
  }

  function stepStateForPackage(pkg: PackageDef): Partial<Record<string, boolean>> {
    const ids = getIncludedIds(pkg);
    const hasDocs = ids.some((id) => ["translate-basic", "translate-residency", "attestation"].includes(id));
    const hasApply = ids.includes("apply-uni");
    const hasFollow = ids.includes("followup");
    const hasConfirm = ids.includes("confirm-seat");
    const hasHousing = ids.includes("housing");
    const hasArrival = ids.some((id) => ["airport", "sim", "address-reg"].includes(id));

    return {
      docs: hasDocs,
      apply: hasApply,
      followup: hasFollow,
      register: hasConfirm,
      housing: hasHousing,
      arrival: hasArrival,
    };
  }

  // ============= ORDER #2: UNIFIED Write Path - saveServicesDraft() =============
  // ✅ A) This is the ONLY function that writes service selections to CRM.
  // Both "💾 حفظ" button and "متابعة الدفع" use this before any further action.
  const saveServicesDraft = useCallback(async (origin: string): Promise<boolean> => {
    if (!selectedCountry) {
      console.warn('[saveServicesDraft] No country selected');
      return false;
    }
    if (currentSelection.serviceIds.length === 0) {
      console.warn('[saveServicesDraft] No services selected');
      return false;
    }

    setIsSaving(true);

    try {
      const result = await callPortalApi('set_services_selection', {
        country_code: selectedCountry,
        selected_services: currentSelection.serviceIds,
        selected_addons: currentSelection.addOnIds,
        selected_package_id: currentSelection.packageId,
        pay_plan: currentSelection.payPlan,
        origin, // ✅ Required: Identifies calling context
      }) as {
        ok: boolean;
        applied?: boolean;
        synced?: boolean;
        state_rev?: number;
        error?: string;
        error_code?: string;
        message?: string;
        cta?: string;
        pricing?: {
          total: number;
          deposit: number;
          remainder: number;
          currency: string;
        };
      };

      if (result.ok) {
        console.log('[saveServicesDraft] ✅ Saved, state_rev:', result.state_rev, 'origin:', origin);
        const hash = computeSelectionHash(selectedCountry, currentSelection);
        lastSavedHashRef.current = hash;
        return true;
      }

      // Auth required
      if (result.error_code === 'auth_required' || result.cta === 'login') {
        toast.error(t('portal.services.loginRequired'), {
          action: {
            label: t('portal.services.loginAction'),
            onClick: () => {
              onTabChange?.('profile');
              try { navigate('/account?tab=profile'); } catch { /* no-op */ }
            },
          },
        });
        return false;
      }

      // Handle not_linked error
      if (result.error_code === 'no_linked_customer' || result.cta === 'link_account') {
        toast.error(t('portal.services.linkAccountRequired'), {
          action: { label: t('portal.services.linkAccountAction'), onClick: () => onTabChange?.('profile') },
        });
        return false;
      }

      console.error('[saveServicesDraft] ❌ Failed:', result.error);
      return false;
    } catch (err) {
      console.error('[saveServicesDraft] ❌ Error:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [selectedCountry, currentSelection, callPortalApi, computeSelectionHash, onTabChange, navigate]);

  // Handler for "💾 حفظ" button
  async function handleSaveSelection() {
    if (!selectedCountry || currentSelection.serviceIds.length === 0) {
      toast.error(t('portal.services.selectAtLeastOne'));
      return;
    }

    const ok = await saveServicesDraft('ui_save_button');
    if (ok) {
      toast.success(t('portal.services.selectionsSaved'));
    } else {
      toast.error(t('portal.services.selectionsSaveFailed'));
    }
  }

  async function handleCheckout() {
    if (!selectedCountry || currentSelection.serviceIds.length === 0) {
      toast.error(t('portal.services.selectAtLeastOne'));
      return;
    }

    // Require primary program selection
    if (!primaryProgramId) {
      toast.error(t('portal.services.selectProgramBeforeCheckout'));
      return;
    }

    setIsSubmitting(true);

    // ✅ ORDER #2: UNIFIED WRITE PATH — Save draft before proceeding to payment
    // Check if dirty (current selection differs from last saved)
    const currentHash = computeSelectionHash(selectedCountry, currentSelection);
    const isDirty = currentHash !== lastSavedHashRef.current;

    if (isDirty) {
      console.log('[handleCheckout] Dirty state detected, saving first...');
      const saveOk = await saveServicesDraft('ui_save_before_payment');
      if (!saveOk) {
        // Save failed (auth error, etc.) – saveServicesDraft already showed toast
        setIsSubmitting(false);
        return;
      }
    }

    // Build services array (codes + qty only - NO prices from client)
    const services: Array<{ code: string; qty: number }> = [];
    
    // Add regular services
    currentSelection.serviceIds.forEach(id => {
      services.push({ code: id, qty: 1 });
    });
    
    // Add Russia add-ons if any
    currentSelection.addOnIds.forEach(id => {
      services.push({ code: id, qty: 1 });
    });
    
    // ✅ EXEC ORDER: Build program_ref with snapshot (P0)
    const program = getProgramById(primaryProgramId);
    const programRef: ProgramRef = buildProgramRef({
      program_id: primaryProgramId,
      program_name: program?.program_name || program?.name,
      university_name: program?.university_name,
      university_logo: program?.university_logo || program?.logo_url,
      country_code: selectedCountry,
      country_name: program?.country_name,
      city: program?.city,
      degree_name: program?.degree_name,
      degree_slug: program?.degree_slug,
      language: program?.language,
      fees_yearly: program?.fees_yearly,
      duration_months: program?.duration_months,
      program_slug: program?.program_slug || program?.slug,
    });
    
    // ✅ EXEC ORDER: Build trace body for submit
    const traceBody = buildTraceBody('submit');
    
    // ✅ Build full payload
    const submitPayload = {
      program_id: primaryProgramId,
      program_name: programRef.snapshot.program_name,
      university_name: programRef.snapshot.university_name,
      country_code: selectedCountry,
      services: services,
      // ✅ EXEC ORDER: Add program_ref for CRM (prevents "unknown program")
      program_ref: programRef,
      // ✅ EXEC ORDER: Add trace fields
      ...traceBody,
    };
    
    // ✅ WF Log: Submit payload
    console.log('[WF] submit_payload', submitPayload);
    
    // ✅ SYNC TO CRM: Program Choice only (Service choices already saved via saveServicesDraft above)
    const programSnapshot = {
      program_name: programRef.snapshot.program_name,
      university_name: programRef.snapshot.university_name,
      country_code: selectedCountry,
      degree_name: programRef.snapshot.degree || programRef.snapshot.degree_slug,
      city: programRef.snapshot.city,
      fees_yearly: programRef.snapshot.tuition,
    };
    
    // ✅ Fire program sync (non-blocking - service sync already done via saveServicesDraft)
    callPortalApi('sync_program_choice', {
      program_id: primaryProgramId,
      program_source: 'portal',
      program_snapshot: programSnapshot,
    }).then(res => {
      console.log('[WF] sync_program_choice response:', res);
    }).catch(err => {
      console.warn('[WF] sync_program_choice failed (non-fatal):', err);
    });
    
    // ✅ Call submit_application_portal_v1 (Portal DB - prices calculated server-side)
    const result = await callPortalApi('submit_application_portal_v1', submitPayload) as {
      ok: boolean; 
      application_id?: string; 
      payment_id?: string;
      message?: string;
      error?: string;
    };
    
    setIsSubmitting(false);
    
    // Handle response (support both data.ok and data.data.application_id patterns)
    const isOk = !!result.ok;
    const applicationId = (result as any).data?.application_id || result.application_id;
    const paymentId = (result as any).data?.payment_id || result.payment_id;
    
    // ✅ WF Log: Submit response
    console.log('[WF] submit_response', { 
      ok: isOk, 
      trace: traceBody.client_trace_id, 
      application_id: applicationId,
      error: result.error 
    });
    
    if (isOk && applicationId) {
      // ✅ EXEC ORDER: Clear workflow session after successful submit
      clearWorkflowSession();
      
      // ✅ Success: Remove any draft for this program
      removeByProgramId(primaryProgramId);
      
      // ✅ Save submission cache for UI enrichment
      const program = getProgramById(primaryProgramId);
      saveSubmissionCache({
        application_id: applicationId,
        program_id: primaryProgramId,
        program_name: program?.program_name || program?.name || undefined,
        university_name: program?.university_name || undefined,
        country_code: selectedCountry || undefined,
        services: services.map(s => {
          const serviceDef = SERVICE_DEFINITIONS.find(def => def.id === s.code);
          const addonDef = RUSSIA_ADDONS.find(a => a.id === s.code);
          const unitPrice = serviceDef 
            ? getServicePrice(s.code, selectedCountry!) 
            : addonDef?.price || 0;
          const name = getServiceName(s.code) || t(`portal.services.addonNames.${s.code}`) || s.code;
          return {
            service_code: s.code,
            qty: s.qty,
            name,
            unit_price: unitPrice,
            line_total: unitPrice * s.qty,
          };
        }),
        total_amount: totalPrice,
        currency: "USD",
        payment_id: paymentId || undefined,
        created_at: new Date().toISOString(),
      });
      
      toast.success(t('portal.services.orderConfirmed'));
      
      // Dispatch event to refresh applications list
      window.dispatchEvent(new Event('application-submitted'));
      
        // Navigate DIRECTLY to payments tab for immediate payment action
        if (paymentId) {
          navigate(`/account?tab=payments&payment_id=${paymentId}&application_id=${applicationId}`);
        } else {
          // Fallback to applications if no payment created
          navigate(`/account?tab=applications&application_id=${applicationId}`);
        }
    } else {
      // ❌ Failed: Save as Draft (Outbox)
      console.error('[ServicesTab] Submit failed:', result.error);
      
      const program = getProgramById(primaryProgramId);
      upsertForProgram({
        program_id: primaryProgramId,
        program_name: program?.program_name || program?.name || undefined,
        university_name: program?.university_name || undefined,
        country_code: selectedCountry,
        services: services.map(s => {
          const serviceDef = SERVICE_DEFINITIONS.find(def => def.id === s.code);
          const addonDef = RUSSIA_ADDONS.find(a => a.id === s.code);
          const unitPrice = serviceDef 
            ? getServicePrice(s.code, selectedCountry) 
            : addonDef?.price || 0;
          const name = getServiceName(s.code) || t(`portal.services.addonNames.${s.code}`) || s.code;
          return {
            service_code: s.code,
            qty: s.qty,
            name,
            unit_price: unitPrice,
            line_total: unitPrice * s.qty,
          };
        }),
        total_amount: totalPrice,
        currency: "USD",
      });
      
      toast.info(t('portal.services.savedAsDraft'));
      onTabChange?.('applications');
    }
  }

  // Loading state
  if (shortlistLoading) {
    return (
      <div className="w-full py-12 text-center">
        <div className="text-muted-foreground">{t('portal.services.loading')}</div>
      </div>
    );
  }

  // ✅ Empty state: No countries from shortlist
  if (!shortlistLoading && countriesFromShortlist.length === 0) {
    console.log('[PORTAL:SERVICES] No countries from shortlist');
    return (
      <div className="space-y-6">
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <div className="text-6xl mb-4">🌍</div>
          <h3 className="text-xl font-bold mb-2 text-foreground">{t('portal.services.chooseProgramFirst')}</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t('portal.services.chooseProgramFirstDesc')}
          </p>
          <Button 
            onClick={() => navigate('/universities?tab=programs')} 
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            {t('portal.services.searchPrograms')}
          </Button>
        </div>
        {onTabChange && <TabNavigation currentTab="services" onTabChange={onTabChange} />}
      </div>
    );
  }

  // If no program selected and not loading, show message to go to favorites first
  if (!primaryProgramId && !shortlistLoading) {
    return (
      <div className="w-full pb-24" dir="rtl">
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-8 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-xl font-bold text-foreground mb-2">{t('portal.services.selectProgramFirst')}</h3>
          <p className="text-muted-foreground mb-6">
            {t('portal.services.selectProgramFirstDesc')}
          </p>
          <button
            type="button"
            onClick={() => {
              if (onClearProgramAndGoToFavorites) onClearProgramAndGoToFavorites();
              else onTabChange?.('shortlist');
            }}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-3 transition"
          >
            {t('portal.services.goToFavorites')}
          </button>
        </div>
        
        {/* Tab Navigation */}
        {onTabChange && <TabNavigation currentTab="services" onTabChange={onTabChange} />}
      </div>
    );
  }

  return (
    <div className="w-full pb-24" dir={language === 'ar' ? 'rtl' : 'ltr'}>

      {/* Current Path Bar (when primary program is selected) */}
      {primaryProgramId && selectedCountry && (
        <div className="mb-6 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-primary">🎯</span>
            <span className="font-medium text-foreground">{t('portal.services.currentPath')}:</span>
            <span className="text-foreground">
              {getProgramById(primaryProgramId)?.program_name || getProgramById(primaryProgramId)?.name || t('portal.services.selectedProgram')}
            </span>
            <span className="text-muted-foreground">—</span>
            <span className="text-muted-foreground">
              {COUNTRY_FLAGS[selectedCountry]} {getCountryName(selectedCountry)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onClearProgramAndGoToFavorites) onClearProgramAndGoToFavorites();
              else onTabChange?.('shortlist');
            }}
            className="text-sm text-primary hover:underline shrink-0"
          >
            {t('portal.services.changeProgram')}
          </button>
        </div>
      )}


      {/* Show content only if country is selected */}
      {selectedCountry && (
        <>
          {/* 1) استشارة الذكاء الاصطناعي — $99/شهر */}
          <div className="mb-10 rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-background to-primary/10 dark:from-primary/20 dark:via-background dark:to-primary/10 p-6 shadow-lg shadow-primary/10 relative overflow-hidden">
            {/* Premium badge */}
            <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-br-lg tracking-wider uppercase">
              AI-Powered
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
              <div className="flex items-start gap-4">
                <IconBox icon={MessageCircle} size="lg" variant="primary" shape="circle" />
                <div>
                  <h3 className="text-lg font-bold text-foreground">{t('portal.services.freeConsultation')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-xl">
                    {t('portal.services.freeConsultationDesc')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-center">
                  <span className="text-2xl font-extrabold text-primary">$99</span>
                  <span className="text-xs text-muted-foreground block">/ month</span>
                </div>
                <button 
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-bold px-6 py-3 transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5"
                >
                  {t('portal.services.startConsultation')}
                </button>
              </div>
            </div>
          </div>

          {/* 2) الخدمات الفردية */}
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-foreground">
                  {t('portal.services.chooseServices')} — {COUNTRY_FLAGS[selectedCountry]} {getCountryName(selectedCountry)}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('portal.services.chooseServicesDesc')}
                </p>
                <div className="mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-primary to-primary/30" />
              </div>

              <div className="text-left shrink-0 bg-primary/5 dark:bg-primary/10 rounded-xl px-4 py-3 border border-primary/20">
                <div className="text-xs text-muted-foreground">{t('portal.services.currentTotal')}</div>
                <div className="text-2xl font-extrabold text-primary">{money(totalPrice)}</div>
              </div>
            </div>

            {/* الوثائق */}
            <Section title={t('portal.services.sectionDocs')} icon={FileText}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {servicesByCategory.docs.map((s) => (
                  <ServiceToggle 
                    key={s.id} 
                    service={s} 
                    price={s.price}
                    selected={currentSelection.serviceIds.includes(s.id)} 
                    onToggle={toggleService}
                    translatedName={getServiceName(s.id)}
                    translatedDesc={getServiceDesc(s.id)}
                    translatedNote={getServiceNote(s.id)}
                    addedLabel={t('portal.services.added')}
                    addLabel={t('portal.services.add')}
                  />
                ))}
              </div>
            </Section>

            {/* الجامعة */}
            <Section title={t('portal.services.sectionUniversity')} icon={GraduationCap}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {servicesByCategory.uni.map((s) => (
                  <ServiceToggle 
                    key={s.id} 
                    service={s} 
                    price={s.price}
                    selected={currentSelection.serviceIds.includes(s.id)} 
                    onToggle={toggleService}
                    translatedName={getServiceName(s.id)}
                    translatedDesc={getServiceDesc(s.id)}
                    translatedNote={getServiceNote(s.id)}
                    addedLabel={t('portal.services.added')}
                    addLabel={t('portal.services.add')}
                  />
                ))}
              </div>
            </Section>

            {/* بعد الوصول */}
            <Section title={t('portal.services.sectionArrival')} icon={Plane}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {servicesByCategory.arrival
                  .filter((s) => showMoreArrival || !s.hidden)
                  .map((s) => (
                    <ServiceToggle 
                      key={s.id} 
                      service={s}
                      price={s.price} 
                      selected={currentSelection.serviceIds.includes(s.id)} 
                      onToggle={toggleService}
                      translatedName={getServiceName(s.id)}
                      translatedDesc={getServiceDesc(s.id)}
                      translatedNote={getServiceNote(s.id)}
                      addedLabel={t('portal.services.added')}
                      addLabel={t('portal.services.add')}
                    />
                  ))}
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowMoreArrival((v) => !v)}
                  className="text-sm font-semibold text-primary hover:text-primary/80 underline"
                >
                  {showMoreArrival ? t('portal.services.hideExtraServices') : t('portal.services.showMoreArrival')}
                </button>
              </div>
            </Section>

            {/* 3) إضافات روسيا فقط */}
            {selectedCountry === "RU" && (
              <Section title={t('portal.services.sectionRussiaAddons')} icon={Sparkles}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {RUSSIA_ADDONS.map((addon) => (
                    <RussiaAddonCard
                      key={addon.id}
                      addon={addon}
                      selected={currentSelection.addOnIds.includes(addon.id)}
                      onToggle={toggleAddon}
                      translatedName={t(`portal.services.addonNames.${addon.id}`)}
                      translatedDesc={t(`portal.services.addonDescs.${addon.id}`)}
                      translatedNote={(() => { const k = `portal.services.addonNotes.${addon.id}`; const v = t(k); return v === k ? undefined : v; })()}
                      addedLabel={t('portal.services.added')}
                      addLabel={t('portal.services.add')}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* 4) السلة + الدفع المرحلي */}
            <div className="mt-8 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 dark:to-primary/10 p-6 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-muted-foreground">{t('portal.services.yourSelectedServices')} — {getCountryName(selectedCountry)}</div>
                  <div className="mt-1.5 text-sm text-foreground">
                    {activeSelectionNames.length ? activeSelectionNames.join(" • ") : t('portal.services.noServiceSelected')}
                  </div>
                  {currentSelection.addOnIds.length > 0 && (
                    <div className="mt-1 text-sm text-purple-600 dark:text-purple-400 font-medium">
                      + {currentSelection.addOnIds.map(id => t(`portal.services.addonNames.${id}`)).join(" • ")}
                    </div>
                  )}
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-sm text-emerald-700 dark:text-emerald-300">
                    💡 {t('portal.services.tip')} <span className="font-bold">{money(Math.max(0, basePrice - getPackagePrice(PACKAGES[2], selectedCountry)))}</span> {t('portal.services.tipSuffix')}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-4">
                  {isSaving && (
                    <span className="text-sm text-amber-600 dark:text-amber-400 animate-pulse font-medium">
                      💾 {t('portal.services.saving')}
                    </span>
                  )}
                  
                  <div className="text-left bg-card rounded-xl px-4 py-3 border border-border">
                    <div className="text-xs text-muted-foreground">{t('portal.services.currentTotal')}</div>
                    <div className="text-2xl font-extrabold text-foreground">{money(totalPrice)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isSaving || isSubmitting}
                      className={[
                        "rounded-xl font-bold px-6 py-3.5 transition-all duration-300 text-sm",
                        isSaving
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5",
                      ].join(" ")}
                      onClick={handleSaveSelection}
                    >
                      {isSaving ? t('portal.services.saving') : t('portal.services.save')}
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting || isSaving}
                      className={[
                        "rounded-xl font-bold px-6 py-3.5 transition-all duration-300 text-sm",
                        isSubmitting || isSaving
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-0.5",
                      ].join(" ")}
                      onClick={handleCheckout}
                    >
                      {isSubmitting ? t('portal.services.submitting') : t('portal.services.proceedToPayment')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggle الدفع المرحلي */}
              <div className="mt-5 pt-5 border-t border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <span className="text-sm font-semibold text-foreground">{t('portal.services.paymentMethod')}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPayPlan("full")}
                      className={[
                        "px-5 py-2.5 rounded-xl border-2 transition-all duration-300 text-sm font-semibold",
                        currentSelection.payPlan === "full" 
                          ? "bg-primary text-primary-foreground border-primary shadow-md" 
                          : "bg-card border-border hover:border-primary/50 text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {t('portal.services.payFull')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayPlan("split")}
                      className={[
                        "px-5 py-2.5 rounded-xl border-2 transition-all duration-300 text-sm font-semibold",
                        currentSelection.payPlan === "split" 
                          ? "bg-primary text-primary-foreground border-primary shadow-md" 
                          : "bg-card border-border hover:border-primary/50 text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {t('portal.services.payInTwo')}
                    </button>
                  </div>
                </div>
                
                {currentSelection.payPlan === "split" && totalPrice > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <div className="text-xs text-muted-foreground mb-1">💰 {t('portal.services.payNow')}</div>
                      <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{money(depositAmount)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t('portal.services.depositPercent')}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <div className="text-xs text-muted-foreground mb-1">📅 {t('portal.services.remainingBeforeTravel')}</div>
                      <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{money(remainderAmount)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t('portal.services.remainingPercent')}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-country notice */}
              <div className="mt-4 text-xs text-muted-foreground">
                {t('portal.services.pricesForCountry')} {getCountryName(selectedCountry)} {t('portal.services.pricesForCountrySuffix')}
              </div>
            </div>

            {/* رابط المستندات */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  {t('portal.services.docsNotice')}
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange?.("documents")}
                  className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  {t('portal.services.goToDocuments')}
                </button>
              </div>
            </div>
          </div>

          {/* 5) الباقات */}
          <div className="mt-12">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-extrabold text-foreground">{t('portal.services.readyPackages')}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('portal.services.readyPackagesDesc')}
                </p>
                <div className="mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-primary to-primary/30" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
              {PACKAGES.map((pkg) => {
                const includedIds = getIncludedIds(pkg);
                const pkgPrice = getPackagePrice(pkg, selectedCountry);
                const comparePrice = includedIds.reduce(
                  (sum, id) => sum + getServicePrice(id, selectedCountry), 
                  0
                );
                return (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    price={pkgPrice}
                    selected={currentSelection.packageId === pkg.id}
                    comparePrice={comparePrice}
                    onSelect={selectPackage}
                    stepState={stepStateForPackage(pkg)}
                    t={t}
                    translatedName={t(`portal.services.packageNames.${pkg.id}`)}
                    translatedBadge={pkg.hasBadge ? t(`portal.services.packageBadges.${pkg.id}`) : undefined}
                    translatedYouHandle={t(`portal.services.packageYouHandle.${pkg.id}`)}
                    translatedBullets={i18nT(`portal.services.packageBullets.${pkg.id}`, { returnObjects: true }) as string[]}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Tab Navigation */}
      {onTabChange && <TabNavigation currentTab="services" onTabChange={onTabChange} />}
    </div>
  );
}

export default ServicesTab;
