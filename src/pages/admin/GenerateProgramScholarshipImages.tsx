import { useState, useEffect } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Image, Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function GenerateProgramScholarshipImages() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({
    programs: { total: 0, withImages: 0, withoutImages: 0 },
    scholarships: { total: 0, withImages: 0, withoutImages: 0 }
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"programs" | "scholarships">("programs");

  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin]);

  const loadStats = async () => {
    try {
      // Programs stats
      const { count: totalPrograms } = await supabase
        .from('programs')
        .select('*', { count: 'exact', head: true });
      
      const { count: programsWithImages } = await supabase
        .from('programs')
        .select('*', { count: 'exact', head: true })
        .not('image_url', 'is', null);

      // Scholarships stats
      const { count: totalScholarships } = await supabase
        .from('scholarships')
        .select('*', { count: 'exact', head: true });
      
      const { count: scholarshipsWithImages } = await supabase
        .from('scholarships')
        .select('*', { count: 'exact', head: true })
        .not('image_url', 'is', null);

      setStats({
        programs: {
          total: totalPrograms || 0,
          withImages: programsWithImages || 0,
          withoutImages: (totalPrograms || 0) - (programsWithImages || 0)
        },
        scholarships: {
          total: totalScholarships || 0,
          withImages: scholarshipsWithImages || 0,
          withoutImages: (totalScholarships || 0) - (scholarshipsWithImages || 0)
        }
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const generateImages = async (type: 'programs' | 'scholarships') => {
    setIsGenerating(true);
    setProgress(0);
    setLogs([]);

    try {
      const table = type === 'programs' ? 'programs' : 'scholarships';
      const { data: items, error } = await supabase
        .from(table)
        .select('*')
        .is('image_url', null)
        .limit(50);

      if (error) throw error;
      if (!items || items.length === 0) {
        toast({
          title: "لا توجد عناصر",
          description: `جميع ${type === 'programs' ? 'البرامج' : 'المنح'} لديها صور بالفعل`,
        });
        setIsGenerating(false);
        return;
      }

      addLog(`بدء توليد الصور لـ ${items.length} ${type === 'programs' ? 'برنامج' : 'منحة'}...`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemName = type === 'programs' 
          ? (item as any).title || (item as any).program_name
          : (item as any).title;

        try {
          addLog(`[${i + 1}/${items.length}] توليد صورة لـ: ${itemName}`);

          const metadata = type === 'programs' 
            ? {
                subject: (item as any).subject_name || 'general',
                university: (item as any).university_name
              }
            : {
                provider: (item as any).provider_name || (item as any).university_name,
                country: (item as any).country_name
              };

          const { data, error: generateError } = await supabase.functions.invoke(
            'generate-program-scholarship-images',
            {
              body: {
                type: type === 'programs' ? 'program' : 'scholarship',
                id: item.id,
                name: itemName,
                metadata
              }
            }
          );

          if (generateError) throw generateError;

          if (data?.ok) {
            addLog(`✓ تم توليد الصورة: ${itemName}`);
          } else {
            addLog(`✗ فشل توليد الصورة: ${itemName}`);
          }

          setProgress(((i + 1) / items.length) * 100);
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error: any) {
          addLog(`✗ خطأ في ${itemName}: ${error.message}`);
        }
      }

      addLog('✓ اكتمل توليد جميع الصور!');
      toast({
        title: "تم بنجاح",
        description: `تم توليد الصور لـ ${items.length} ${type === 'programs' ? 'برنامج' : 'منحة'}`,
      });

      await loadStats();

    } catch (error: any) {
      console.error('Error generating images:', error);
      addLog(`✗ خطأ: ${error.message}`);
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar')}] ${message}`]);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>غير مصرح</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Image className="w-8 h-8" />
        <div>
          <h1 className="text-3xl font-bold">توليد صور البرامج والمنح</h1>
          <p className="text-muted-foreground">توليد صور عالية الجودة باستخدام AI</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="programs">البرامج</TabsTrigger>
          <TabsTrigger value="scholarships">المنح</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>إجمالي البرامج</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{stats.programs.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مع صور</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-green-500">
                  {stats.programs.withImages}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>بدون صور</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-orange-500">
                  {stats.programs.withoutImages}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>توليد الصور</CardTitle>
              <CardDescription>
                توليد صور للبرامج التي لا تحتوي على صور (حد أقصى 50 برنامج)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => generateImages('programs')}
                disabled={isGenerating || stats.programs.withoutImages === 0}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    جارٍ التوليد...
                  </>
                ) : (
                  <>
                    <Image className="mr-2 w-4 h-4" />
                    توليد صور البرامج
                  </>
                )}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    {Math.round(progress)}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scholarships" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>إجمالي المنح</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{stats.scholarships.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مع صور</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-green-500">
                  {stats.scholarships.withImages}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>بدون صور</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-orange-500">
                  {stats.scholarships.withoutImages}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>توليد الصور</CardTitle>
              <CardDescription>
                توليد صور للمنح التي لا تحتوي على صور (حد أقصى 50 منحة)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => generateImages('scholarships')}
                disabled={isGenerating || stats.scholarships.withoutImages === 0}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    جارٍ التوليد...
                  </>
                ) : (
                  <>
                    <Image className="mr-2 w-4 h-4" />
                    توليد صور المنح
                  </>
                )}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    {Math.round(progress)}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>السجل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-secondary rounded-lg p-4 max-h-96 overflow-y-auto space-y-1 font-mono text-sm">
              {logs.map((log, index) => (
                <div key={index} className="text-foreground">
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
