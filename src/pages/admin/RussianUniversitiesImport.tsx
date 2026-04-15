import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { russianUniversities } from "@/utils/russian-universities-data";
import { Loader2, CheckCircle2, Upload } from "lucide-react";

const RussianUniversitiesImport = () => {
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);

  const handleImport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'admin-universities-bulk-create',
        {
          body: { universities: russianUniversities }
        }
      );

      if (error) throw error;

      if (data.ok) {
        toast.success(`تم إضافة ${data.count} جامعة روسية بنجاح!`);
        setImported(true);
      } else {
        throw new Error(data.error || 'فشل الإضافة');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`خطأ: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">استيراد الجامعات الروسية</h2>
        <p className="text-muted-foreground">إضافة 30 جامعة طبية روسية مرموقة</p>
      </div>
      
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-6 w-6" />
              استيراد 30 جامعة روسية للطب
            </CardTitle>
            <CardDescription>
              هذه الأداة ستضيف 30 جامعة طبية روسية مرموقة إلى قاعدة البيانات
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">الجامعات التي سيتم إضافتها:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border rounded-lg p-4">
                {russianUniversities.map((uni, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">{uni.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {uni.name_en} - {uni.city}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-semibold">معلومات هامة:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>سيتم إضافة 30 جامعة طبية روسية</li>
                <li>تشمل الجامعات أعرق المؤسسات الطبية في روسيا</li>
                <li>جميع الجامعات معترف بها من منظمة الصحة العالمية</li>
                <li>تغطي مختلف المدن الروسية من موسكو إلى سيبيريا</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleImport}
                disabled={loading || imported}
                size="lg"
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    جاري الإضافة...
                  </>
                ) : imported ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    تم الإضافة بنجاح
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    إضافة الجامعات الآن
                  </>
                )}
              </Button>
            </div>

            {imported && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">
                  ✅ تم إضافة الجامعات بنجاح! يمكنك الآن الانتقال إلى صفحة الجامعات لمشاهدتها.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RussianUniversitiesImport;
