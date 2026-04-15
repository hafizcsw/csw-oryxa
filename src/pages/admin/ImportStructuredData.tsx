import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, CheckCircle, XCircle, FileText, Code } from 'lucide-react';
import { parseStructuredUniversityData } from '@/utils/parseStructuredUniversityData';

export default function ImportStructuredData() {
  const [jsonData, setJsonData] = useState('');
  const [textData, setTextData] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'json'>('text');

  const handleConvertText = () => {
    try {
      const parsed = parseStructuredUniversityData(textData);
      setJsonData(JSON.stringify(parsed, null, 2));
      setActiveTab('json');
      toast.success(`تم تحويل ${parsed.length} برنامج`);
    } catch (e: any) {
      toast.error('فشل تحويل النص: ' + e.message);
    }
  };

  const handleImport = async () => {
    let programs;
    
    try {
      if (activeTab === 'text' && textData.trim()) {
        programs = parseStructuredUniversityData(textData);
      } else if (jsonData.trim()) {
        programs = JSON.parse(jsonData);
      } else {
        toast.error('الرجاء إدخال البيانات');
        return;
      }
    } catch (e: any) {
      toast.error('خطأ في تنسيق البيانات: ' + e.message);
      return;
    }

    try {
      setLoading(true);
      setResults(null);

      const { data, error } = await supabase.functions.invoke('admin-import-structured-data', {
        body: { programs }
      });

      if (error) throw error;

      if (data.ok) {
        toast.success(data.message);
        setResults(data.results);
      } else {
        toast.error(data.error || 'حدث خطأ');
      }
    } catch (e: any) {
      console.error('Import error:', e);
      toast.error(e.message || 'فشل الاستيراد');
    } finally {
      setLoading(false);
    }
  };

  const exampleData = [
    {
      university_name: "American University",
      program_name: "MSc Computer Science",
      degree_level: "ماجستير",
      tuition_fee: 40000,
      currency: "USD",
      academic_year: "2025",
      language: "الإنجليزية",
      ielts_requirement: "7.0",
      academic_requirements: "غير محدد",
      pathway_available: "نعم عبر Shorelight",
      country: "الولايات المتحدة"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">استيراد بيانات منظمة</h1>
        <p className="text-muted-foreground mt-2">
          استورد البرامج والجامعات من بيانات JSON منظمة
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إدخال البيانات</CardTitle>
          <CardDescription>
            يمكنك لصق النص المنظم مباشرة أو إدخال JSON
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'text' | 'json')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" className="gap-2">
                <FileText className="h-4 w-4" />
                نص منظم
              </TabsTrigger>
              <TabsTrigger value="json" className="gap-2">
                <Code className="h-4 w-4" />
                JSON
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="text" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">الصق النص المنظم هنا:</label>
                <Textarea
                  value={textData}
                  onChange={(e) => setTextData(e.target.value)}
                  placeholder={`مثال:\n\n# الولايات المتحدة\n\n**American University**\n\n* MSc Computer Science — ماجستير — 40,000 USD (2025) — الإنجليزية — IELTS 7.0`}
                  className="min-h-[400px] font-mono text-sm"
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleConvertText} variant="outline" disabled={!textData.trim()}>
                  تحويل إلى JSON
                </Button>
                <Button onClick={handleImport} disabled={loading || !textData.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الاستيراد...
                    </>
                  ) : (
                    <>
                      <Upload className="ml-2 h-4 w-4" />
                      استيراد مباشرة
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="json" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">مثال على تنسيق JSON:</label>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                  {JSON.stringify(exampleData, null, 2)}
                </pre>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">البيانات بصيغة JSON:</label>
                <Textarea
                  value={jsonData}
                  onChange={(e) => setJsonData(e.target.value)}
                  placeholder="أدخل البيانات بصيغة JSON..."
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>

              <Button onClick={handleImport} disabled={loading || !jsonData.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الاستيراد...
                  </>
                ) : (
                  <>
                    <Upload className="ml-2 h-4 w-4" />
                    استيراد البيانات
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>نتائج الاستيراد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-sm text-muted-foreground">نجح</div>
                  <div className="text-2xl font-bold">{results.success}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <div className="text-sm text-muted-foreground">فشل</div>
                  <div className="text-2xl font-bold">{results.failed}</div>
                </div>
              </div>
            </div>

            {results.errors && results.errors.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">الأخطاء:</h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {results.errors.map((err: string, idx: number) => (
                    <div key={idx} className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
