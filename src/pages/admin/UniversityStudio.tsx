import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import UniversityActions from "@/components/admin/UniversityActions";
import ScholarshipsTab from "@/components/admin/ScholarshipsTab";
import FeesVerifyTab from "@/components/admin/FeesVerifyTab";
import AdmissionsVerifyTab from "@/components/admin/AdmissionsVerifyTab";
import ProgramModal from "@/components/admin/ProgramModal";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Image as ImageIcon,
  DollarSign,
  FileText,
  Award,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Simplified types (new tables not in types.ts yet)
type University = any;
type Program = any;
type TuitionConsensus = any;
type MediaAsset = any;

export default function UniversityStudio() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [harvestType, setHarvestType] = useState<string>("");
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set());

  // Fetch university
  const { data: university, isLoading: loadingUni } = useQuery({
    queryKey: ["university", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universities")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch programs
  const { data: programs = [], isLoading: loadingPrograms } = useQuery({
    queryKey: ["university-programs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("university_id", id);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch tuition consensus
  const { data: tuition } = useQuery({
    queryKey: ["university-tuition", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tuition_consensus")
        .select(`
          *,
          tuition_snapshots (
            amount,
            currency,
            source_url,
            academic_year
          )
        `)
        .eq("university_id", id)
        .order("academic_year", { ascending: false })
        .limit(1)
        .single();
      if (error) return null;
      return data;
    },
  });

  // Fetch media assets
  const { data: mediaAssets = [] } = useQuery({
    queryKey: ["university-media", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("media_assets")
        .select("*")
        .eq("owner_type", "university")
        .eq("owner_id", id);
      if (error) return [];
      return data || [];
    },
  });

  // Harvest mutation
  const harvestMutation = useMutation({
    mutationFn: async (kind: string) => {
      const { data, error } = await supabase.functions.invoke("harvest-start", {
        body: {
          kind,
          university_id: id,
          audience: "international",
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, kind) => {
      toast({
        title: "حصاد بدأ",
        description: `تم بدء حصاد ${kind === 'fees' ? 'الرسوم' : kind === 'media' ? 'الوسائط' : 'القبول'}`,
      });
      queryClient.invalidateQueries({ queryKey: ["university-tuition", id] });
      queryClient.invalidateQueries({ queryKey: ["university-media", id] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل الحصاد",
      });
    },
  });

  if (loadingUni) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!university) {
    return (
      <div className="container mx-auto p-6">
        <p>الجامعة غير موجودة</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/universities-admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{university.name}</h1>
            <p className="text-muted-foreground">{university.city}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const { data, error } = await supabase.functions.invoke("report-university-pdf", {
                  body: { university_id: id }
                });
                if (error) throw error;
                if (data?.url) {
                  window.open(data.url, '_blank');
                  toast({ title: "تم التصدير", description: "تم إنشاء التقرير بنجاح" });
                }
              } catch (error: any) {
                toast({ variant: "destructive", title: "خطأ", description: error.message });
              }
            }}
          >
            <FileText className="w-4 h-4 ml-2" />
            تصدير PDF
          </Button>
          <UniversityActions
            university={university}
            onRunStarted={setActiveRunId}
          />
          {university?.website && (
            <Button variant="outline" asChild>
              <a href={university.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 ml-2" />
                الموقع الرسمي
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <Card>
        <CardContent className="p-0">
          {university.hero_image_url ? (
            <img
              src={university.hero_image_url}
              alt={university.name}
              className="w-full h-64 object-cover rounded-t-lg"
            />
          ) : (
            <div className="w-full h-64 bg-muted flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
          <div className="p-6 flex items-start gap-6">
            {university.logo_url ? (
              <img
                src={university.logo_url}
                alt={`${university.name} logo`}
                className="w-24 h-24 object-contain border rounded"
              />
            ) : (
              <div className="w-24 h-24 bg-muted rounded flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2">{university.name}</h2>
              <p className="text-muted-foreground">{university.description}</p>
              {university.ranking && (
                <Badge variant="secondary" className="mt-2">
                  التصنيف: #{university.ranking}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="programs" dir="rtl">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="programs">البرامج ({programs.length})</TabsTrigger>
          <TabsTrigger value="fees">الرسوم</TabsTrigger>
          <TabsTrigger value="fees-verify">تحقق الرسوم</TabsTrigger>
          <TabsTrigger value="admissions">القبول</TabsTrigger>
          <TabsTrigger value="media">الوسائط ({mediaAssets.length})</TabsTrigger>
          <TabsTrigger value="scholarships">المنح</TabsTrigger>
          <TabsTrigger value="harvest">الحصاد</TabsTrigger>
        </TabsList>

        {/* Programs Tab */}
        <TabsContent value="programs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>البرامج الأكاديمية</CardTitle>
                <div className="flex gap-2">
                  {selectedPrograms.size > 0 && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={async () => {
                          try {
                            await supabase.functions.invoke("admin-programs-bulk", {
                              body: { 
                                action: "publish", 
                                program_ids: Array.from(selectedPrograms) 
                              }
                            });
                            toast({ title: "تم النشر", description: `تم نشر ${selectedPrograms.size} برنامج` });
                            queryClient.invalidateQueries({ queryKey: ["university-programs", id] });
                            setSelectedPrograms(new Set());
                          } catch (error: any) {
                            toast({ variant: "destructive", title: "خطأ", description: error.message });
                          }
                        }}
                      >
                        نشر المحدد
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={async () => {
                          try {
                            await supabase.functions.invoke("admin-programs-bulk", {
                              body: { 
                                action: "unpublish", 
                                program_ids: Array.from(selectedPrograms) 
                              }
                            });
                            toast({ title: "تم الإخفاء", description: `تم إخفاء ${selectedPrograms.size} برنامج` });
                            queryClient.invalidateQueries({ queryKey: ["university-programs", id] });
                            setSelectedPrograms(new Set());
                          } catch (error: any) {
                            toast({ variant: "destructive", title: "خطأ", description: error.message });
                          }
                        }}
                      >
                        إخفاء المحدد
                      </Button>
                    </>
                  )}
                  <Button 
                    size="sm"
                    onClick={() => {
                      setSelectedProgram(null);
                      setProgramModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة برنامج
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPrograms ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : programs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد برامج</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedPrograms.size === programs.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPrograms(new Set(programs.map(p => p.id)));
                            } else {
                              setSelectedPrograms(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>الدرجة</TableHead>
                      <TableHead>اللغات</TableHead>
                      <TableHead>الرسوم</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {programs.map((program) => (
                      <TableRow key={program.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedPrograms.has(program.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedPrograms);
                              if (e.target.checked) {
                                newSet.add(program.id);
                              } else {
                                newSet.delete(program.id);
                              }
                              setSelectedPrograms(newSet);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{program.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{program.degree_id}</Badge>
                        </TableCell>
                        <TableCell>{program.languages?.join(", ")}</TableCell>
                        <TableCell>
                          {(program as any).annual_tuition || (program as any).tuition_fee
                            ? `${((program as any).annual_tuition || (program as any).tuition_fee).toLocaleString()} ${program.currency_code || 'USD'}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => {
                                setSelectedProgram(program);
                                setProgramModalOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fees Tab */}
        <TabsContent value="fees">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>الرسوم الدراسية</CardTitle>
                <Button
                  size="sm"
                  onClick={() => harvestMutation.mutate("fees")}
                  disabled={harvestMutation.isPending}
                >
                  {harvestMutation.isPending ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 ml-2" />
                  )}
                  تحديث الرسوم
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tuition ? (
                  <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">الرسوم السنوية</p>
                      <p className="text-2xl font-bold">
                        {tuition?.tuition_snapshots?.amount?.toLocaleString()} {tuition?.tuition_snapshots?.currency}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tuition?.tuition_snapshots?.academic_year} • {tuition?.audience || 'international'}
                      </p>
                    </div>
                    {tuition?.tuition_snapshots?.source_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={tuition.tuition_snapshots.source_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 ml-2" />
                          المصدر
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد بيانات رسوم. اضغط "تحديث الرسوم" لحصاد البيانات.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fees Verify Tab */}
        <TabsContent value="fees-verify">
          <FeesVerifyTab universityId={id!} />
        </TabsContent>

        {/* Admissions Tab */}
        <TabsContent value="admissions">
          <AdmissionsVerifyTab universityId={id!} />
        </TabsContent>

        {/* Media Tab */}
        <TabsContent value="media">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>الوسائط</CardTitle>
                <Button
                  size="sm"
                  onClick={() => harvestMutation.mutate("media")}
                  disabled={harvestMutation.isPending}
                >
                  {harvestMutation.isPending ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 ml-2" />
                  )}
                  تحديث الوسائط
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {mediaAssets.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد وسائط</p>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {mediaAssets.map((asset) => (
                    <div key={asset.id} className="border rounded-lg p-4">
                      <img
                        src={asset.url}
                        alt={asset.kind}
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                      <Badge variant="outline" className="mb-2">
                        {asset.kind}
                      </Badge>
                      {asset.license && (
                        <p className="text-xs text-muted-foreground">{asset.license}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scholarships Tab */}
        <TabsContent value="scholarships">
          <ScholarshipsTab universityId={id!} />
        </TabsContent>

        {/* Harvest Tab */}
        <TabsContent value="harvest">
          <Card>
            <CardHeader>
              <CardTitle>عمليات الحصاد</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-32 flex flex-col gap-2"
                  onClick={() => harvestMutation.mutate("fees")}
                  disabled={harvestMutation.isPending}
                >
                  <DollarSign className="w-8 h-8" />
                  <span>حصاد الرسوم</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-32 flex flex-col gap-2"
                  onClick={() => harvestMutation.mutate("admissions")}
                  disabled={harvestMutation.isPending}
                >
                  <FileText className="w-8 h-8" />
                  <span>حصاد متطلبات القبول</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-32 flex flex-col gap-2"
                  onClick={() => harvestMutation.mutate("media")}
                  disabled={harvestMutation.isPending}
                >
                  <ImageIcon className="w-8 h-8" />
                  <span>حصاد الوسائط</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Program Modal */}
      <ProgramModal
        open={programModalOpen}
        onClose={() => {
          setProgramModalOpen(false);
          setSelectedProgram(null);
        }}
        universityId={id!}
        program={selectedProgram}
      />
    </div>
  );
}