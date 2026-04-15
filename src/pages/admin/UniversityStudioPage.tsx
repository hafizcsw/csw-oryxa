import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLookups } from "@/hooks/useLookups";
import { motion } from "framer-motion";

// UI Components
import { Loader2, GraduationCap, DollarSign, Search as SearchIcon, Shield, BarChart3 } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";

// Studio Components
import { 
  StudioHeader, 
  StudioSidebar, 
  StudioMediaCard, 
  StudioTabs,
  type SectionId 
} from "@/components/admin/studio";

// Tab Components
import { BasicInfoTab } from "@/components/admin/university/tabs/BasicInfoTab";
import ProgramsTab from "@/pages/admin/universities/programs/ProgramsTab";
import { CSWGuidanceEditor } from "@/components/admin/CSWGuidanceEditor";
import PriceGrid from "@/pages/admin/universities/prices/PriceGrid";
import SeoManager from "@/pages/admin/universities/seo/SeoManager";
import { UniRanksPanel } from "@/components/admin/studio/UniRanksPanel";

// Types
interface UniversityData {
  id?: string;
  name: string;
  name_en?: string;
  slug?: string;
  country_id?: string;
  city?: string;
  website?: string;
  ranking?: number | null;
  description?: string;
  tuition_min?: number | null;
  tuition_max?: number | null;
  annual_fees?: number | null;
  monthly_living?: number | null;
  is_active?: boolean;
  show_in_home?: boolean;
  display_order?: number | null;
  logo_url?: string | null;
  hero_image_url?: string | null;
  main_image_url?: string | null;
  publish_status?: string;
  seo_title?: string | null;
  seo_description?: string | null;
  // University Housing
  has_dorm?: boolean;
  dorm_price_monthly_local?: number | null;
  dorm_currency_code?: string | null;
}

const EMPTY_UNIVERSITY: UniversityData = {
  name: "",
  name_en: "",
  is_active: true,
  show_in_home: false,
  publish_status: "draft",
};

export default function UniversityStudioPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { countries } = useLookups();

  const isNew = id === "new" || !id;
  const universityId = isNew ? undefined : id;

  // Keep an immutable baseline to prevent saving defaults (Unknown -> false/0)
  const originalRef = useRef<UniversityData | null>(null);

  // State
  const [formData, setFormData] = useState<UniversityData>(EMPTY_UNIVERSITY);
  const [isDirty, setIsDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>(
    (searchParams.get("tab") as SectionId) || "basic"
  );

  // Fetch existing university data
  const { data: university, isLoading } = useQuery({
    queryKey: ["university-studio", universityId],
    queryFn: async () => {
      if (!universityId) return null;
      const { data, error } = await supabase
        .from("universities")
        .select("*")
        .eq("id", universityId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!universityId,
  });

  // Fetch program counts for checklist (total + published)
  const { data: programCounts = { total: 0, published: 0 } } = useQuery({
    queryKey: ["university-program-counts", universityId],
    queryFn: async () => {
      if (!universityId) return { total: 0, published: 0 };
      
      // Get total count
      const { count: total } = await supabase
        .from("programs")
        .select("*", { count: "exact", head: true })
        .eq("university_id", universityId);
      
      // Get published + active count (SoT requirement for visibility in filters)
      const { count: published } = await supabase
        .from("programs")
        .select("*", { count: "exact", head: true })
        .eq("university_id", universityId)
        .eq("publish_status", "published")
        .eq("is_active", true);
      
      return { total: total || 0, published: published || 0 };
    },
    enabled: !!universityId,
  });

  // Initialize form data when university loads
  useEffect(() => {
    if (university) {
      const next: UniversityData = {
        ...university,
      };
      setFormData(next);
      // Baseline for change detection (SoT fields must not be defaulted on save)
      originalRef.current = next;
      setIsDirty(false);
    }
  }, [university]);

  // Baseline for new universities
  useEffect(() => {
    if (isNew && !originalRef.current) {
      originalRef.current = EMPTY_UNIVERSITY;
    }
  }, [isNew]);

  // Update URL when section changes
  useEffect(() => {
    setSearchParams({ tab: activeSection });
  }, [activeSection, setSearchParams]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Save mutation - SoT compliant: includes housing + living fields
  const saveMutation = useMutation({
    mutationFn: async (data: UniversityData) => {
      const original = originalRef.current;
      const changed = (key: keyof UniversityData) => {
        const prev = original ? (original as any)[key] : undefined;
        const next = (data as any)[key];
        return prev !== next;
      };

      // Build payload with all SoT fields including housing
      const payload: Record<string, any> = {
        name: data.name,
        name_en: data.name_en || null,
        slug: data.slug || data.name?.toLowerCase().replace(/\s+/g, "-"),
        country_id: data.country_id,
        city: data.city || null,
        website: data.website || null,
        ranking: data.ranking || null,
        description: data.description || null,
        // SoT Filter Fields: tuition_min/max for display
        tuition_min: data.tuition_min || null,
        tuition_max: data.tuition_max || null,
        annual_fees: data.annual_fees || null,
        // ===== Status =====
        is_active: data.is_active ?? true,
        show_in_home: data.show_in_home ?? false,
        display_order: data.display_order || null,
        logo_url: data.logo_url || null,
        hero_image_url: data.hero_image_url || data.main_image_url || null,
        main_image_url: data.main_image_url || data.hero_image_url || null,
      };

      // ===== SoT fields: only write if user actually changed them =====
      const hasDormChanged = changed("has_dorm");
      const dormPriceChanged = changed("dorm_price_monthly_local");
      const dormCurrencyChanged = changed("dorm_currency_code");
      const monthlyLivingChanged = changed("monthly_living");

      const shouldWriteDorm = hasDormChanged || dormPriceChanged || dormCurrencyChanged;

      if (hasDormChanged) {
        payload.has_dorm = data.has_dorm ?? null;
      }
      if (shouldWriteDorm) {
        // Rule: never write dorm price/currency if has_dorm=false (or null)
        payload.dorm_price_monthly_local = data.has_dorm === true ? (data.dorm_price_monthly_local ?? null) : null;
        payload.dorm_currency_code = data.has_dorm === true ? (data.dorm_currency_code ?? null) : null;
      }
      if (monthlyLivingChanged) {
        payload.monthly_living = data.monthly_living ?? null;
      }

      if (universityId) {
        const { error } = await supabase
          .from("universities")
          .update(payload as any)
          .eq("id", universityId);
        if (error) throw error;
        return universityId;
      } else {
        const { data: newUni, error } = await supabase
          .from("universities")
          .insert(payload as any)
          .select("id")
          .single();
        if (error) throw error;
        return newUni.id;
      }
    },
    onSuccess: (savedId) => {
      toast({ title: isNew ? "تم إنشاء الجامعة بنجاح" : "تم حفظ التغييرات" });
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["university-studio", savedId] });
      if (isNew && savedId) {
        navigate(`/admin/university/${savedId}/studio?tab=gallery`, { replace: true });
      }
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Handle form changes
  const handleBasicInfoChange = (data: UniversityData) => {
    setFormData(data);
    setIsDirty(true);
  };

  const handleImagesChange = (data: { logo_url?: string | null; hero_image_url?: string | null }) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setIsDirty(true);
  };

  // Checklist calculations - aligned with SoT publish gate
  const selectedCountry = countries.find((c) => c.id === formData.country_id);
  const countryName = selectedCountry?.name || "";
  
  // FIX #3: Robust ISO2 validation with regex (not just length check)
  const rawCountryCode = (selectedCountry?.country_code || (selectedCountry as any)?.code || "").toUpperCase().trim();
  const hasValidCountryCode = /^[A-Z]{2}$/.test(rawCountryCode);

  const checklist = useMemo(() => {
    return {
      hasName: !!formData.name?.trim(),
      hasCountry: !!formData.country_id,
      hasValidCountryCode, // SoT: country must have valid ISO2 code for filters
      hasLogo: !!formData.logo_url,
      hasCover: !!(formData.hero_image_url || formData.main_image_url),
      hasDescription: !!formData.description?.trim(),
      // FIX #2: Use published+active count, not total count
      hasPublishedProgram: programCounts.published > 0,
      hasSeo: !!(formData.seo_title || formData.seo_description),
    };
  }, [formData, programCounts.published, hasValidCountryCode]);

  // University checklist - matches SoT publish requirements
  const checklistItems = [
    { label: "اسم الجامعة", done: checklist.hasName, critical: true },
    { label: `الدولة (ISO2)${rawCountryCode ? `: ${rawCountryCode}` : ""}`, done: checklist.hasCountry && checklist.hasValidCountryCode, critical: true },
    { label: "الشعار", done: checklist.hasLogo, critical: false },
    { label: "الصورة الرئيسية", done: checklist.hasCover, critical: false },
    { label: "الوصف", done: checklist.hasDescription, critical: false, action: () => setActiveSection("basic") },
    // FIX #2: Show published count explicitly
    { label: `برنامج منشور (${programCounts.published}/${programCounts.total})`, done: checklist.hasPublishedProgram, critical: true, action: () => setActiveSection("programs") },
  ];

  const completedCount = checklistItems.filter((item) => item.done).length;
  const progress = (completedCount / checklistItems.length) * 100;

  if (isLoading && !isNew) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="text-muted-foreground">جاري تحميل بيانات الجامعة...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background" dir="rtl">
      {/* Modern Sticky Header */}
      <StudioHeader
        universityId={universityId}
        universityName={formData.name || ""}
        countryName={countryName}
        isNew={isNew}
        isDirty={isDirty}
        isActive={formData.is_active ?? true}
        isSaving={saveMutation.isPending}
        progress={progress}
        onSave={() => saveMutation.mutate(formData)}
      />

      {/* Media Section - Modern Card */}
      <motion.div 
        className="w-full px-6 pt-8 pb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="mx-auto max-w-7xl w-full">
          <StudioMediaCard
            universityId={universityId}
            logoUrl={formData.logo_url}
            heroImageUrl={formData.hero_image_url || formData.main_image_url}
            onLogoChange={(url) => {
              setFormData((prev) => ({ ...prev, logo_url: url }));
              setIsDirty(true);
            }}
            onHeroChange={(url) => {
              setFormData((prev) => ({ ...prev, hero_image_url: url }));
              setIsDirty(true);
            }}
          />
        </div>
      </motion.div>

      {/* Main Content: Editor + Sidebar */}
      <div className="w-full px-6 pb-12">
        <div className="mx-auto max-w-7xl w-full">
          <div className="grid grid-cols-12 gap-x-8 gap-y-6">
            {/* Main Content */}
            <motion.main 
              className="col-span-12 md:col-span-8 min-w-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <StudioTabs
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                programCounts={programCounts}
              >
                <TabsContent value="basic" className="mt-0 min-w-0">
                  <BasicInfoTab
                    data={formData}
                    onChange={handleBasicInfoChange}
                    isNew={isNew}
                  />
                </TabsContent>
                
                
                
                <TabsContent value="programs" className="mt-0 min-w-0">
                  {universityId ? (
                    <ProgramsTab universityId={universityId} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <GraduationCap className="h-16 w-16 mx-auto mb-3 opacity-30" />
                      <p className="text-lg">احفظ الجامعة أولاً لإضافة البرامج</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="pricing" className="mt-0 min-w-0">
                  {universityId ? (
                    <PriceGrid universityId={universityId} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <DollarSign className="h-16 w-16 mx-auto mb-3 opacity-30" />
                      <p className="text-lg">احفظ الجامعة أولاً لإدارة الأسعار</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="seo" className="mt-0 min-w-0">
                  {universityId ? (
                    <SeoManager universityId={universityId} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <SearchIcon className="h-16 w-16 mx-auto mb-3 opacity-30" />
                      <p className="text-lg">احفظ الجامعة أولاً لإعدادات SEO</p>
                    </div>
                  )}
                </TabsContent>
                
                {/* CSW Guidance Tab */}
                <TabsContent value="csw" className="mt-0 min-w-0">
                  {universityId ? (
                    <CSWGuidanceEditor 
                      universityId={universityId} 
                      universityName={formData.name || ""} 
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-16 w-16 mx-auto mb-3 opacity-30" />
                      <p className="text-lg">احفظ الجامعة أولاً لإعدادات CSW</p>
                    </div>
                  )}
                </TabsContent>

                {/* UniRanks Tab */}
                <TabsContent value="uniranks" className="mt-0 min-w-0">
                  {universityId ? (
                    <UniRanksPanel universityId={universityId} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <BarChart3 className="h-16 w-16 mx-auto mb-3 opacity-30" />
                      <p className="text-lg">احفظ الجامعة أولاً لعرض بيانات UniRanks</p>
                    </div>
                  )}
                </TabsContent>
              </StudioTabs>
            </motion.main>

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="col-span-12 md:col-span-4"
            >
              <StudioSidebar
                universityId={universityId}
                universityName={formData.name || ""}
                slug={formData.slug}
                seoTitle={formData.seo_title ?? undefined}
                isActive={formData.is_active ?? true}
                isNew={isNew}
                checklistItems={checklistItems}
                progress={progress}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
