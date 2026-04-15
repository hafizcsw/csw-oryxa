import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, RotateCcw, Eye, ShieldCheck, AlertTriangle, Globe } from "lucide-react";

interface PreviewData {
  to_delete: Record<string, number>;
  to_preserve: Record<string, number | string>;
  universities_affected?: number;
}

interface ResetResult {
  deleted: Record<string, number>;
  preserved: Record<string, number>;
  canonical_touched: false;
}

interface CrawlPurgePanelProps {
  universityId?: string;
  universityName?: string;
  scope?: "single" | "global";
  onPurgeComplete?: () => void;
}

const TABLE_LABELS: Record<string, string> = {
  observations: "الملاحظات",
  crawl_rows: "صفوف الزحف",
  crawl_jobs: "مهام الزحف",
  program_drafts: "مسودات البرامج",
  file_artifacts: "ملفات مكتشفة",
  storage_files: "ملفات التخزين",
  canonical_tables: "جداول النشر الأساسية",
};

const GLOBAL_CONFIRMATION_PHRASE = "حذف شامل";

export function CrawlPurgePanel({ universityId, universityName, scope = "single", onPurgeComplete }: CrawlPurgePanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState("");

  const isGlobal = scope === "global";
  const label = isGlobal ? "جميع الجامعات (غير المنشورة فقط)" : (universityName ?? universityId ?? "");
  const confirmationValid = !isGlobal || typedConfirmation === GLOBAL_CONFIRMATION_PHRASE;

  const handlePreview = async () => {
    setLoading(true);
    setResetResult(null);
    try {
      const body: any = { mode: "preview" };
      if (isGlobal) {
        body.scope = "global";
      } else {
        body.university_id = universityId;
      }
      const { data, error } = await supabase.functions.invoke("admin-crawl-purge", { body });
      if (error) throw error;
      setPreview({
        to_delete: data.to_delete,
        to_preserve: data.to_preserve,
        universities_affected: data.universities_affected,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!confirmationValid) return;
    setConfirmOpen(false);
    setTypedConfirmation("");
    setLoading(true);
    try {
      const body: any = { mode: "execute" };
      if (isGlobal) {
        body.scope = "global";
      } else {
        body.university_id = universityId;
      }
      const { data, error } = await supabase.functions.invoke("admin-crawl-purge", { body });
      if (error) throw error;
      setResetResult({ deleted: data.deleted, preserved: data.preserved, canonical_touched: data.canonical_touched });
      setPreview(null);
      toast({ title: "تم إعادة التعيين", description: "تم مسح البيانات غير المنشورة بنجاح" });
      onPurgeComplete?.();
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const numericDeletes = preview
    ? Object.entries(preview.to_delete).filter(([, v]) => typeof v === "number")
    : [];
  const totalToDelete = numericDeletes.reduce((a, [, b]) => a + (b as number), 0);

  return (
    <Card className={isGlobal ? "border-destructive/40 bg-destructive/5" : "border-amber-500/30"}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {isGlobal ? <Globe className="w-4 h-4 text-destructive" /> : <RotateCcw className="w-4 h-4 text-amber-600" />}
          {isGlobal ? "إعادة تعيين شامل للبيانات غير المنشورة" : "إعادة تعيين البيانات غير المنشورة"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{isGlobal ? "النطاق: جميع الجامعات" : `الجامعة: ${label}`}</p>
        {isGlobal && (
          <div className="flex items-center gap-1.5 mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <p className="text-[11px] text-destructive font-medium">
              تحذير: هذا الإجراء سيحذف جميع البيانات غير المنشورة من كل الجامعات. يتطلب تأكيد كتابي.
            </p>
          </div>
        )}
        <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1">
          <ShieldCheck className="w-3 h-3" />
          البيانات المنشورة والجداول الأساسية محمية دائمًا
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!preview && !resetResult && (
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Eye className="w-4 h-4 ml-2" />}
            معاينة ما سيتم مسحه
          </Button>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">
                سيتم مسح {totalToDelete} سجل غير منشور
                {preview.universities_affected != null && ` من ${preview.universities_affected} جامعة`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-600">سيتم المسح:</p>
                {numericDeletes.map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{TABLE_LABELS[key] ?? key}</span>
                    <Badge variant={(val as number) > 0 ? "destructive" : "secondary"} className="text-[10px] h-4">
                      {val as number}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-600">محفوظ (منشور):</p>
                {Object.entries(preview.to_preserve).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{TABLE_LABELS[key] ?? key}</span>
                    <Badge variant="outline" className="text-[10px] h-4 border-emerald-500 text-emerald-600">
                      {typeof val === "number" ? val : "✓"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={() => { setTypedConfirmation(""); setConfirmOpen(true); }} disabled={loading || totalToDelete === 0}>
                <RotateCcw className="w-4 h-4 ml-2" />
                تنفيذ إعادة التعيين
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>إلغاء</Button>
            </div>
          </div>
        )}

        {resetResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-600">تم إعادة التعيين بنجاح</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium">تم مسحه:</p>
                {Object.entries(resetResult.deleted).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{TABLE_LABELS[key] ?? key}</span>
                    <Badge variant="secondary" className="text-[10px] h-4">{val}</Badge>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">محفوظ (منشور):</p>
                {Object.entries(resetResult.preserved).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{TABLE_LABELS[key] ?? key}</span>
                    <Badge variant="outline" className="text-[10px] h-4 border-emerald-500 text-emerald-600">{val}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <ShieldCheck className="w-3 h-3" />
              الجداول الأساسية (جامعات، برامج، مكاتب) لم تُمس
            </div>
            <Button variant="outline" size="sm" onClick={() => { setResetResult(null); handlePreview(); }}>معاينة مرة أخرى</Button>
          </div>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); if (!open) setTypedConfirmation(""); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد إعادة التعيين{isGlobal ? " الشامل" : ""}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    سيتم مسح {totalToDelete} سجل غير منشور {isGlobal ? "من جميع الجامعات" : <>لجامعة <strong>{label}</strong></>}.
                  </p>
                  <p className="text-emerald-600 font-medium">✓ البيانات المنشورة والأدلة المرتبطة بها محمية</p>
                  <p className="text-emerald-600 font-medium">✓ الجداول الأساسية (جامعات، برامج، مكاتب) لن تتأثر</p>
                  {isGlobal && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-destructive font-medium text-sm">
                        للتأكيد، اكتب: <code className="bg-destructive/10 px-2 py-0.5 rounded font-bold">{GLOBAL_CONFIRMATION_PHRASE}</code>
                      </p>
                      <Input
                        value={typedConfirmation}
                        onChange={(e) => setTypedConfirmation(e.target.value)}
                        placeholder={`اكتب "${GLOBAL_CONFIRMATION_PHRASE}" هنا...`}
                        className="text-sm"
                        dir="rtl"
                      />
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs">هذا الإجراء لا يمكن التراجع عنه.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleExecute}
                disabled={loading || !confirmationValid}
              >
                {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RotateCcw className="w-4 h-4 ml-2" />}
                تأكيد إعادة التعيين
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
