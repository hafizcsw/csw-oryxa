import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, GraduationCap, DollarSign, FileText, Award } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProgramEditorModalProps {
  open: boolean;
  onClose: () => void;
  universityId: string;
  program?: any;
}

interface ProgramFormData {
  title: string;
  description: string;
  degree_id: string;
  discipline_id: string;
  duration_months: number | null;
  language: string;
  languages: string[];
  study_mode: string;
  intake_months: number[];
  next_intake_date: string | null;
  tuition_is_free: boolean;
  tuition_usd_min: number | null;
  tuition_usd_max: number | null;
  application_fee: number | null;
  is_active: boolean;
  publish_status: string;
  ielts_required: boolean;
  ielts_min_overall: number | null;
  ielts_min_each_section: number | null;
  toefl_required: boolean;
  toefl_min: number | null;
  gpa_required: boolean;
  gpa_min: number | null;
  prep_year_required: boolean;
  interview_required: boolean;
  required_documents: string[];
  additional_requirements: string;
  has_scholarship: boolean;
  scholarship_type: string;
  scholarship_percent_coverage: number | null;
  scholarship_amount_usd: number | null;
  scholarship_monthly_stipend_usd: number | null;
  scholarship_covers_housing: boolean;
  scholarship_covers_insurance: boolean;
  scholarship_notes: string;
}

const REQUIRED_DOCUMENTS_OPTIONS = [
  { value: "passport", key: "passport" },
  { value: "degree_certificate", key: "degree_certificate" },
  { value: "transcript", key: "transcript" },
  { value: "motivation_letter", key: "motivation_letter" },
  { value: "recommendation_letters", key: "recommendation_letters" },
  { value: "cv", key: "cv" },
  { value: "photo", key: "photo" },
  { value: "language_certificate", key: "language_certificate" },
  { value: "portfolio", key: "portfolio" },
  { value: "medical_certificate", key: "medical_certificate" },
];

const LANGUAGES_OPTIONS = [
  { code: "en", key: "en" },
  { code: "ar", key: "ar" },
  { code: "ru", key: "ru" },
  { code: "tr", key: "tr" },
  { code: "de", key: "de" },
  { code: "fr", key: "fr" },
  { code: "zh", key: "zh" },
  { code: "es", key: "es" },
];

const STUDY_MODE_OPTIONS = [
  { value: "on_campus", key: "on_campus" },
  { value: "online", key: "online" },
  { value: "hybrid", key: "hybrid" },
];

const SCHOLARSHIP_TYPE_OPTIONS = [
  { value: "full", key: "full" },
  { value: "partial", key: "partial" },
  { value: "tuition_waiver", key: "tuition_waiver" },
  { value: "stipend", key: "stipend" },
];

const INTAKE_MONTHS_OPTIONS = [
  { value: 1, key: "1" },
  { value: 2, key: "2" },
  { value: 3, key: "3" },
  { value: 4, key: "4" },
  { value: 5, key: "5" },
  { value: 6, key: "6" },
  { value: 7, key: "7" },
  { value: 8, key: "8" },
  { value: 9, key: "9" },
  { value: 10, key: "10" },
  { value: 11, key: "11" },
  { value: 12, key: "12" },
];

export default function ProgramEditorModal({ 
  open, 
  onClose, 
  universityId,
  program 
}: ProgramEditorModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isEditMode = !!program;
  const [activeTab, setActiveTab] = useState("basic");

  const { data: degrees = [] } = useQuery({
    queryKey: ["degrees"],
    queryFn: async () => {
      const { data } = await supabase.from("degrees").select("id, name, slug").order("name");
      return data || [];
    },
  });

  const { data: disciplines = [] } = useQuery({
    queryKey: ["disciplines"],
    queryFn: async () => {
      const { data } = await supabase.from("disciplines").select("id, name_ar, slug").order("name_ar");
      return data || [];
    },
  });

  const { data: programLanguages = [] } = useQuery({
    queryKey: ["program-languages", program?.id],
    queryFn: async () => {
      if (!program?.id) return [];
      const { data } = await supabase
        .from("program_languages")
        .select("language_code")
        .eq("program_id", program.id);
      return data?.map(l => l.language_code) || [];
    },
    enabled: !!program?.id,
  });

  const numericToBool = (val: any): boolean => Boolean(val && val > 0);
  
  const defaultValues: ProgramFormData = {
    title: program?.title || "",
    description: program?.description || "",
    degree_id: program?.degree_id || "",
    discipline_id: program?.discipline_id || "",
    duration_months: program?.duration_months || null,
    language: program?.language || "en",
    languages: programLanguages,
    study_mode: program?.study_mode ?? "",
    intake_months: program?.intake_months ?? [],
    next_intake_date: program?.next_intake_date || null,
    tuition_is_free: program?.tuition_is_free || false,
    tuition_usd_min: program?.tuition_usd_min || null,
    tuition_usd_max: program?.tuition_usd_max || null,
    application_fee: program?.application_fee || null,
    is_active: program?.is_active ?? true,
    publish_status: program?.publish_status || "draft",
    ielts_required: numericToBool(program?.ielts_required),
    ielts_min_overall: program?.ielts_min_overall || null,
    ielts_min_each_section: program?.ielts_min_each_section || null,
    toefl_required: program?.toefl_required || false,
    toefl_min: program?.toefl_min || null,
    gpa_required: numericToBool(program?.gpa_required),
    gpa_min: program?.gpa_min || null,
    prep_year_required: program?.prep_year_required || false,
    interview_required: program?.interview_required || false,
    required_documents: program?.required_documents || [],
    additional_requirements: program?.additional_requirements || "",
    has_scholarship: program?.has_scholarship ?? false,
    scholarship_type: program?.scholarship_type ?? "",
    scholarship_percent_coverage: program?.scholarship_percent_coverage ?? null,
    scholarship_amount_usd: program?.scholarship_amount_usd ?? null,
    scholarship_monthly_stipend_usd: program?.scholarship_monthly_stipend_usd ?? null,
    scholarship_covers_housing: program?.scholarship_covers_housing ?? false,
    scholarship_covers_insurance: program?.scholarship_covers_insurance ?? false,
    scholarship_notes: program?.scholarship_notes ?? "",
  };

  const { register, handleSubmit, control, watch, setValue, formState: { errors, dirtyFields }, reset } = useForm<ProgramFormData>({
    defaultValues,
  });

  useEffect(() => {
    if (programLanguages.length > 0) {
      setValue("languages", programLanguages);
    }
  }, [programLanguages, setValue]);

  const watchTuitionFree = watch("tuition_is_free");
  const watchIeltsRequired = watch("ielts_required");
  const watchToeflRequired = watch("toefl_required");
  const watchGpaRequired = watch("gpa_required");
  const watchLanguages = watch("languages") || [];
  const watchRequiredDocs = watch("required_documents") || [];

  const mutation = useMutation({
    mutationFn: async (data: ProgramFormData) => {
      const shouldWrite = (field: keyof ProgramFormData) => Boolean((dirtyFields as any)?.[field]);

      const programPayload: Record<string, any> = {
        university_id: universityId,
        title: data.title,
        description: data.description || null,
        degree_id: data.degree_id || null,
        discipline_id: data.discipline_id || null,
        duration_months: data.duration_months,
        language: data.language || data.languages?.[0] || "en",
        tuition_is_free: data.tuition_is_free,
        tuition_usd_min: data.tuition_is_free ? null : data.tuition_usd_min,
        tuition_usd_max: data.tuition_is_free ? null : data.tuition_usd_max,
        tuition_yearly: null,
        currency_code: data.tuition_is_free ? null : "USD",
        application_fee: data.application_fee,
        is_active: data.is_active,
        publish_status: data.publish_status,
        ielts_required: data.ielts_required ? 1 : 0,
        ielts_min_overall: data.ielts_required ? data.ielts_min_overall : null,
        ielts_min_each_section: data.ielts_required ? data.ielts_min_each_section : null,
        toefl_required: data.toefl_required,
        toefl_min: data.toefl_required ? data.toefl_min : null,
        gpa_required: data.gpa_required ? 1 : 0,
        gpa_min: data.gpa_required ? data.gpa_min : null,
        prep_year_required: data.prep_year_required,
        interview_required: data.interview_required,
        required_documents: data.required_documents,
        additional_requirements: data.additional_requirements || null,
      };

      if (shouldWrite("study_mode")) {
        programPayload.study_mode = data.study_mode ? data.study_mode : null;
      }
      if (shouldWrite("intake_months")) {
        programPayload.intake_months = data.intake_months?.length > 0 ? data.intake_months : null;
      }
      if (shouldWrite("next_intake_date")) {
        programPayload.next_intake_date = data.next_intake_date || null;
      }
      if (shouldWrite("has_scholarship")) {
        programPayload.has_scholarship = data.has_scholarship;
        if (!data.has_scholarship) {
          programPayload.scholarship_type = null;
          programPayload.scholarship_percent_coverage = null;
          programPayload.scholarship_amount_usd = null;
          programPayload.scholarship_monthly_stipend_usd = null;
          programPayload.scholarship_covers_housing = false;
          programPayload.scholarship_covers_insurance = false;
          programPayload.scholarship_notes = null;
        }
      }
      if (shouldWrite("scholarship_type") || shouldWrite("has_scholarship")) {
        programPayload.scholarship_type = data.has_scholarship ? (data.scholarship_type || null) : null;
      }
      if (data.has_scholarship) {
        if (shouldWrite("scholarship_percent_coverage")) {
          programPayload.scholarship_percent_coverage = data.scholarship_percent_coverage;
        }
        if (shouldWrite("scholarship_amount_usd")) {
          programPayload.scholarship_amount_usd = data.scholarship_amount_usd;
        }
        if (shouldWrite("scholarship_monthly_stipend_usd")) {
          programPayload.scholarship_monthly_stipend_usd = data.scholarship_monthly_stipend_usd;
        }
        if (shouldWrite("scholarship_covers_housing")) {
          programPayload.scholarship_covers_housing = data.scholarship_covers_housing;
        }
        if (shouldWrite("scholarship_covers_insurance")) {
          programPayload.scholarship_covers_insurance = data.scholarship_covers_insurance;
        }
        if (shouldWrite("scholarship_notes")) {
          programPayload.scholarship_notes = data.scholarship_notes || null;
        }
      }

      let programId = program?.id;

      if (isEditMode) {
        const { error } = await supabase
          .from("programs")
          .update(programPayload as any)
          .eq("id", program.id);
        if (error) throw error;
      } else {
        const { data: newProgram, error } = await supabase
          .from("programs")
          .insert(programPayload as any)
          .select("id")
          .single();
        if (error) throw error;
        programId = newProgram.id;
      }

      if (programId && data.languages?.length > 0) {
        await supabase
          .from("program_languages")
          .delete()
          .eq("program_id", programId);

        const languageRows = data.languages.map(langCode => ({
          program_id: programId,
          language_code: langCode,
        }));
        await supabase.from("program_languages").insert(languageRows);
      }

      return { programId };
    },
    onSuccess: () => {
      toast({
        title: isEditMode ? t("programEditor.toast.updated") : t("programEditor.toast.created"),
        description: isEditMode 
          ? t("programEditor.toast.programUpdated") 
          : t("programEditor.toast.programCreated"),
      });
      queryClient.invalidateQueries({ queryKey: ["university-programs", universityId] });
      reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t("programEditor.toast.error"),
        description: error.message || t("programEditor.toast.operationFailed"),
      });
    },
  });

  const onSubmit = (data: ProgramFormData) => {
    mutation.mutate(data);
  };

  const toggleLanguage = (code: string) => {
    const current = watchLanguages || [];
    if (current.includes(code)) {
      setValue("languages", current.filter(c => c !== code));
    } else {
      setValue("languages", [...current, code]);
    }
  };

  const toggleDocument = (value: string) => {
    const current = watchRequiredDocs || [];
    if (current.includes(value)) {
      setValue("required_documents", current.filter(d => d !== value));
    } else {
      setValue("required_documents", [...current, value]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-lg">
            {isEditMode ? t("programEditor.editProgram") : t("programEditor.addProgram")}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isEditMode 
              ? t("programEditor.updateInfo") 
              : t("programEditor.addToUniversity")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 px-6 pt-4">
            <TabsList className="w-full grid grid-cols-3 h-10 mb-4 bg-muted/50 flex-shrink-0">
              <TabsTrigger value="basic" className="gap-1.5 text-sm">
                <GraduationCap className="h-4 w-4" />
                {t("programEditor.tabs.basic")}
              </TabsTrigger>
              <TabsTrigger value="fees" className="gap-1.5 text-sm">
                <DollarSign className="h-4 w-4" />
                {t("programEditor.tabs.fees")}
              </TabsTrigger>
              <TabsTrigger value="requirements" className="gap-1.5 text-sm">
                <FileText className="h-4 w-4" />
                {t("programEditor.tabs.requirements")}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 pr-3">
              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-3 mt-0">
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("programEditor.basic.title")}</Label>
                  <Input
                    {...register("title", { required: t("programEditor.basic.titleRequired") })}
                    placeholder={t("programEditor.basic.titlePlaceholder")}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">{t("programEditor.basic.description")}</Label>
                  <Textarea
                    {...register("description")}
                    placeholder={t("programEditor.basic.descriptionPlaceholder")}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("programEditor.basic.degree")}</Label>
                    <Controller
                      name="degree_id"
                      control={control}
                      rules={{ required: t("programEditor.basic.degreeRequired") }}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("programEditor.basic.selectDegree")} />
                          </SelectTrigger>
                          <SelectContent>
                            {degrees.map((d: any) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.degree_id && (
                      <p className="text-sm text-destructive">{errors.degree_id.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("programEditor.basic.discipline")}</Label>
                    <Controller
                      name="discipline_id"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("programEditor.basic.selectDiscipline")} />
                          </SelectTrigger>
                          <SelectContent>
                            {disciplines.map((d: any) => (
                              <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("programEditor.basic.duration")}</Label>
                    <Input
                      type="number"
                      {...register("duration_months", { valueAsNumber: true })}
                      placeholder="48"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("programEditor.basic.studyMode")}</Label>
                    <Controller
                      name="study_mode"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("programEditor.basic.selectMode")} />
                          </SelectTrigger>
                          <SelectContent>
                            {STUDY_MODE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {t(`programEditor.studyModes.${opt.key}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">{t("programEditor.basic.deadline")}</Label>
                    <Input
                      type="date"
                      {...register("next_intake_date")}
                      className="text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">{t("programEditor.basic.intakeMonths")}</Label>
                  <Controller
                    name="intake_months"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/30">
                        {INTAKE_MONTHS_OPTIONS.map((month) => {
                          const selected = (field.value || []).includes(month.value);
                          return (
                            <Badge
                              key={month.value}
                              variant={selected ? "default" : "outline"}
                              className="cursor-pointer transition-colors text-xs"
                              onClick={() => {
                                const current = field.value || [];
                                if (selected) {
                                  field.onChange(current.filter((m: number) => m !== month.value));
                                } else {
                                  field.onChange([...current, month.value].sort((a, b) => a - b));
                                }
                              }}
                            >
                              {t(`monthName.${month.key}`)}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">{t("programEditor.basic.languages")}</Label>
                  <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/30">
                    {LANGUAGES_OPTIONS.map((lang) => (
                      <Badge
                        key={lang.code}
                        variant={watchLanguages.includes(lang.code) ? "default" : "outline"}
                        className="cursor-pointer transition-colors text-xs"
                        onClick={() => toggleLanguage(lang.code)}
                      >
                        {t(`programEditor.languages.${lang.key}`)}
                      </Badge>
                    ))}
                  </div>
                  {watchLanguages.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t("programEditor.basic.selectOneLanguage")}</p>
                  )}
                </div>
              </TabsContent>

              {/* Fees Tab */}
              <TabsContent value="fees" className="space-y-3 mt-0">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Controller
                    name="tuition_is_free"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="shrink-0"
                      />
                    )}
                  />
                  <Label className="text-sm">{t("programEditor.fees.isFree")}</Label>
                </div>

                {!watchTuitionFree && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">{t("programEditor.fees.annualFeesUsd")}</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t("programEditor.fees.min")}</Label>
                          <Input
                            type="number"
                            {...register("tuition_usd_min", { valueAsNumber: true })}
                            placeholder="5000"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{t("programEditor.fees.max")}</Label>
                          <Input
                            type="number"
                            {...register("tuition_usd_max", { valueAsNumber: true })}
                            placeholder="8000"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label className="text-sm">{t("programEditor.fees.applicationFee")}</Label>
                  <Input
                    type="number"
                    {...register("application_fee", { valueAsNumber: true })}
                    placeholder="50"
                    className="max-w-[200px]"
                  />
                </div>
              </TabsContent>

              {/* Requirements Tab */}
              <TabsContent value="requirements" className="space-y-3 mt-0">
                <div className="grid grid-cols-3 gap-3">
                  {/* IELTS */}
                  <div className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Controller
                        name="ielts_required"
                        control={control}
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} className="shrink-0" />
                        )}
                      />
                      <Label className="text-sm font-semibold">{t("programEditor.requirements.ielts")}</Label>
                    </div>
                    {watchIeltsRequired && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{t("programEditor.requirements.overall")}</Label>
                          <Input
                            type="number"
                            step="0.5"
                            {...register("ielts_min_overall", { valueAsNumber: true })}
                            placeholder="6.0"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("programEditor.requirements.eachSection")}</Label>
                          <Input
                            type="number"
                            step="0.5"
                            {...register("ielts_min_each_section", { valueAsNumber: true })}
                            placeholder="5.5"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TOEFL */}
                  <div className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Controller
                        name="toefl_required"
                        control={control}
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} className="shrink-0" />
                        )}
                      />
                      <Label className="text-sm font-semibold">{t("programEditor.requirements.toefl")}</Label>
                    </div>
                    {watchToeflRequired && (
                      <div className="mt-2 space-y-1">
                        <Label className="text-xs">{t("programEditor.requirements.minimum")}</Label>
                        <Input
                          type="number"
                          {...register("toefl_min", { valueAsNumber: true })}
                          placeholder="80"
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* GPA */}
                  <div className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Controller
                        name="gpa_required"
                        control={control}
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} className="shrink-0" />
                        )}
                      />
                      <Label className="text-sm font-semibold">{t("programEditor.requirements.gpa")}</Label>
                    </div>
                    {watchGpaRequired && (
                      <div className="mt-2 space-y-1">
                        <Label className="text-xs">{t("programEditor.requirements.minimum")}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register("gpa_min", { valueAsNumber: true })}
                          placeholder="2.50"
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2.5 border rounded-lg">
                    <Controller
                      name="prep_year_required"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} className="shrink-0" />
                      )}
                    />
                    <Label className="text-xs">{t("programEditor.requirements.prepYear")}</Label>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 border rounded-lg">
                    <Controller
                      name="interview_required"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} className="shrink-0" />
                      )}
                    />
                    <Label className="text-xs">{t("programEditor.requirements.interview")}</Label>
                  </div>
                </div>

                {/* Scholarship Section */}
                <div className="p-4 border-2 rounded-xl bg-success/5 border-success/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-success" />
                      <Label className="text-base font-bold">{t("programEditor.requirements.scholarship")}</Label>
                    </div>
                    <Controller
                      name="has_scholarship"
                      control={control}
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>

                  {watch("has_scholarship") && (
                    <div className="space-y-4 pt-2 border-t border-success/20">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t("programEditor.requirements.scholarshipType")}</Label>
                        <Controller
                          name="scholarship_type"
                          control={control}
                          render={({ field }) => (
                            <div className="grid grid-cols-2 gap-2">
                              {SCHOLARSHIP_TYPE_OPTIONS.map((opt) => (
                                <div
                                  key={opt.value}
                                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                                    field.value === opt.value
                                      ? "bg-success/20 border-success ring-1 ring-success"
                                      : "hover:bg-muted/50"
                                  }`}
                                  onClick={() => field.onChange(opt.value)}
                                >
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    field.value === opt.value ? "border-success" : "border-muted-foreground"
                                  }`}>
                                    {field.value === opt.value && (
                                      <div className="w-2 h-2 rounded-full bg-success" />
                                    )}
                                  </div>
                                  <span className="text-sm font-medium">{t(`programEditor.scholarshipTypes.${opt.key}`)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        />
                      </div>

                      {watch("scholarship_type") === "partial" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-sm">{t("programEditor.requirements.coveragePercent")}</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              {...register("scholarship_percent_coverage", { valueAsNumber: true })}
                              placeholder="75"
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm">{t("programEditor.requirements.amountUsd")}</Label>
                            <Input
                              type="number"
                              {...register("scholarship_amount_usd", { valueAsNumber: true })}
                              placeholder="5000"
                              className="h-9"
                            />
                          </div>
                        </div>
                      )}

                      {watch("scholarship_type") === "stipend" && (
                        <div className="space-y-1.5">
                          <Label className="text-sm">{t("programEditor.requirements.monthlyStipend")}</Label>
                          <Input
                            type="number"
                            {...register("scholarship_monthly_stipend_usd", { valueAsNumber: true })}
                            placeholder="500"
                            className="h-9"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 p-2.5 border rounded-lg">
                          <Controller
                            name="scholarship_covers_housing"
                            control={control}
                            render={({ field }) => (
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-4 w-4"
                              />
                            )}
                          />
                          <Label className="text-sm cursor-pointer">{t("programEditor.requirements.coversHousing")}</Label>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 border rounded-lg">
                          <Controller
                            name="scholarship_covers_insurance"
                            control={control}
                            render={({ field }) => (
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                className="h-4 w-4"
                              />
                            )}
                          />
                          <Label className="text-sm cursor-pointer">{t("programEditor.requirements.coversInsurance")}</Label>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm">{t("programEditor.requirements.notes")}</Label>
                        <Textarea
                          {...register("scholarship_notes")}
                          placeholder={t("programEditor.requirements.notesPlaceholder")}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Required Documents */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("programEditor.requirements.requiredDocs")}</Label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {REQUIRED_DOCUMENTS_OPTIONS.map((doc) => (
                      <div
                        key={doc.value}
                        className={`flex items-center gap-1.5 p-2 border rounded cursor-pointer transition-colors ${
                          watchRequiredDocs.includes(doc.value) 
                            ? "bg-primary/10 border-primary" 
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleDocument(doc.value)}
                      >
                        <Checkbox checked={watchRequiredDocs.includes(doc.value)} className="h-3.5 w-3.5" />
                        <span className="text-xs">{t(`programEditor.documents.${doc.key}`)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Requirements */}
                <div className="space-y-1.5">
                  <Label className="text-sm">{t("programEditor.requirements.additionalReqs")}</Label>
                  <Textarea
                    {...register("additional_requirements")}
                    placeholder={t("programEditor.requirements.additionalReqsPlaceholder")}
                    rows={2}
                  />
                </div>
              </TabsContent>

            </ScrollArea>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t flex-shrink-0 mt-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t("programEditor.actions.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {isEditMode ? t("programEditor.actions.save") : t("programEditor.actions.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
