import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLookups } from "@/hooks/useLookups";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, ExternalLink } from "lucide-react";

const universitySchema = z.object({
  name: z.string().min(3, "اسم الجامعة مطلوب (3 أحرف على الأقل)"),
  country_id: z.string().min(1, "الدولة مطلوبة"),
  city: z.string().optional(),
  logo_url: z.string().url("رابط غير صالح").optional().or(z.literal("")),
  website: z.string().url("رابط غير صالح").optional().or(z.literal("")),
  annual_fees: z.number().min(0).optional(),
  monthly_living: z.number().min(0).optional(),
  ranking: z.number().min(1).optional(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

type UniversityFormData = z.infer<typeof universitySchema>;

interface UniversityFormAdvancedProps {
  universityId?: string;
  initialData?: Partial<UniversityFormData>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function UniversityFormAdvanced({
  universityId,
  initialData,
  onSuccess,
  onCancel,
}: UniversityFormAdvancedProps) {
  const { toast } = useToast();
  const { countries } = useLookups();
  const isEditing = !!universityId;

  const form = useForm<UniversityFormData>({
    resolver: zodResolver(universitySchema),
    defaultValues: {
      name: "",
      is_active: true,
      ...initialData,
    },
  });

  const onSubmit = async (data: UniversityFormData) => {
    try {
      const payload = {
        name: data.name,
        country_id: data.country_id,
        city: data.city || null,
        logo_url: data.logo_url || null,
        website: data.website || null,
        annual_fees: data.annual_fees || null,
        monthly_living: data.monthly_living || null,
        ranking: data.ranking || null,
        description: data.description || null,
        is_active: data.is_active,
      };

      let error;
      if (isEditing) {
        const { error: updateError } = await supabase
          .from("universities")
          .update(payload)
          .eq("id", universityId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("universities")
          .insert(payload);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: isEditing ? "تم التحديث بنجاح" : "تمت الإضافة بنجاح",
        description: `تم ${isEditing ? "تحديث" : "إضافة"} الجامعة بنجاح`,
      });

      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error.message,
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">المعلومات الأساسية</h3>
          
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>اسم الجامعة *</FormLabel>
                <FormControl>
                  <Input placeholder="University of..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="country_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الدولة *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الدولة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المدينة</FormLabel>
                  <FormControl>
                    <Input placeholder="London" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Media & Links */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">الروابط والصور</h3>

          <FormField
            control={form.control}
            name="logo_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>رابط الشعار</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  {field.value && (
                    <img
                      src={field.value}
                      alt="Logo preview"
                      className="h-10 w-10 object-contain rounded border"
                    />
                  )}
                </div>
                <FormDescription>
                  <Upload className="w-3 h-3 inline ml-1" />
                  رابط مباشر للشعار (يفضل PNG أو SVG بخلفية شفافة)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الموقع الإلكتروني</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  {field.value && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(field.value, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Financial Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">المعلومات المالية</h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="annual_fees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الرسوم السنوية (متوسط)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="19000"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormDescription>بالدولار الأمريكي</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="monthly_living"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تكلفة المعيشة الشهرية (متوسط)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="1200"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormDescription>بالدولار الأمريكي</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Additional Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">معلومات إضافية</h3>

          <FormField
            control={form.control}
            name="ranking"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الترتيب العالمي</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="100"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormDescription>
                  الترتيب حسب QS World University Rankings
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الوصف</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="وصف مختصر عن الجامعة..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <div className="mr-3">
                  <FormLabel className="font-normal">جامعة نشطة</FormLabel>
                  <FormDescription>
                    ستظهر في نتائج البحث
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              إلغاء
            </Button>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            )}
            {isEditing ? "حفظ التغييرات" : "إضافة الجامعة"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
