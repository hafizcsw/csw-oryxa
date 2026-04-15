import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ProgramModalProps {
  open: boolean;
  onClose: () => void;
  universityId: string;
  program?: any; // Existing program for edit mode
}

interface ProgramFormData {
  title: string;
  description?: string;
  degree_id: string;
  duration_months?: number;
  annual_tuition?: number;
  currency_code?: string;
  language?: string;
  application_fee?: number;
  intake_months?: string;
}

export default function ProgramModal({ 
  open, 
  onClose, 
  universityId,
  program 
}: ProgramModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = !!program;
  
  // ❌ BLOCK CREATE MODE: Only allow edit mode
  useEffect(() => {
    if (open && !isEditMode) {
      toast({
        title: "⚠️ مسار محظور",
        description: "يرجى استخدام University Studio لإنشاء البرامج",
        variant: "destructive",
      });
      onClose();
      navigate(`/admin/university/${universityId}/studio?tab=programs`);
    }
  }, [open, isEditMode, universityId, navigate, toast, onClose]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProgramFormData>({
    defaultValues: program || {
      title: "",
      description: "",
      degree_id: "",
      duration_months: undefined,
      annual_tuition: undefined,
      currency_code: "USD",
      language: "en",
      application_fee: undefined,
      intake_months: "",
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: ProgramFormData) => {
      const endpoint = isEditMode 
        ? "admin-programs-update"
        : "admin-programs-create";

      const payload = isEditMode
        ? { id: program.id, ...data }
        : { ...data, university_id: universityId };

      const { data: result, error } = await supabase.functions.invoke(endpoint, {
        body: payload,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({
        title: isEditMode ? "تم التحديث" : "تم الإنشاء",
        description: isEditMode 
          ? "تم تحديث البرنامج بنجاح" 
          : "تم إنشاء البرنامج بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ["university-programs", universityId] });
      reset();
      onClose();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشلت العملية",
      });
    },
  });

  const onSubmit = (data: ProgramFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "تعديل برنامج" : "إضافة برنامج جديد"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "قم بتحديث معلومات البرنامج الأكاديمي" 
              : "أضف برنامج أكاديمي جديد للجامعة"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">عنوان البرنامج *</Label>
            <Input
              id="title"
              {...register("title", { required: "العنوان مطلوب" })}
              placeholder="مثال: بكالوريوس علوم الحاسوب"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="وصف موجز للبرنامج..."
              rows={3}
            />
          </div>

          {/* Degree Level */}
          <div className="space-y-2">
            <Label htmlFor="degree_id">الدرجة العلمية *</Label>
            <Select
              onValueChange={(value) => register("degree_id").onChange({ target: { value } })}
              defaultValue={program?.degree_id}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الدرجة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bachelor">بكالوريوس</SelectItem>
                <SelectItem value="master">ماجستير</SelectItem>
                <SelectItem value="phd">دكتوراه</SelectItem>
                <SelectItem value="diploma">دبلوم</SelectItem>
              </SelectContent>
            </Select>
            {errors.degree_id && (
              <p className="text-sm text-destructive">{errors.degree_id.message}</p>
            )}
          </div>

          {/* Duration & Tuition */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration_months">المدة (شهور)</Label>
              <Input
                id="duration_months"
                type="number"
                {...register("duration_months", { valueAsNumber: true })}
                placeholder="36"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="annual_tuition">الرسوم السنوية</Label>
              <Input
                id="annual_tuition"
                type="number"
                {...register("annual_tuition", { valueAsNumber: true })}
                placeholder="10000"
              />
            </div>
          </div>

          {/* Currency & Language */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency_code">العملة</Label>
              <Select
                onValueChange={(value) => register("currency_code").onChange({ target: { value } })}
                defaultValue={program?.currency_code || "USD"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">لغة الدراسة</Label>
              <Input
                id="language"
                {...register("language")}
                placeholder="en, ar"
              />
            </div>
          </div>

          {/* Application Fee & Intake */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="application_fee">رسوم التقديم</Label>
              <Input
                id="application_fee"
                type="number"
                {...register("application_fee", { valueAsNumber: true })}
                placeholder="50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intake_months">شهور القبول</Label>
              <Input
                id="intake_months"
                {...register("intake_months")}
                placeholder="Sept, Jan, May"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {isEditMode ? "حفظ التعديلات" : "إنشاء البرنامج"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
