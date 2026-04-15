import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AdmissionsVerifyTabProps {
  universityId: string;
}

interface Recommendation {
  university_id: string;
  program_id: string;
  degree_level: string;
  audience: string;
  consensus_min_gpa: number | null;
  consensus_min_ielts: number | null;
  consensus_min_toefl: number | null;
  consensus_other_requirements: any[];
  confidence_score: number;
  observations_count: number;
  observations: any[];
}

export default function AdmissionsVerifyTab({ universityId }: AdmissionsVerifyTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: ["admissions-recommendations", universityId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admissions-compare", {
        body: { university_id: universityId },
      });
      if (error) throw error;
      return data?.recommendations || [];
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (recommendation: Recommendation) => {
      const { data, error } = await supabase.functions.invoke("admissions-accept", {
        body: { recommendation },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "تم قبول الإجماع", description: "تم حفظ متطلبات القبول بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["admissions-recommendations", universityId] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشلت العملية",
      });
    },
  });

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <Badge variant="default">عالية</Badge>;
    if (score >= 0.5) return <Badge variant="secondary">متوسطة</Badge>;
    return <Badge variant="outline">منخفضة</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>التحقق من متطلبات القبول</CardTitle>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد توصيات متاحة</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>البرنامج</TableHead>
                <TableHead>الدرجة</TableHead>
                <TableHead>GPA</TableHead>
                <TableHead>IELTS</TableHead>
                <TableHead>TOEFL</TableHead>
                <TableHead>الثقة</TableHead>
                <TableHead>المشاهدات</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recommendations.map((rec: Recommendation, idx: number) => {
                const rowKey = `${rec.program_id}_${rec.degree_level}_${rec.audience}`;
                return (
                  <Collapsible
                    key={rowKey}
                    open={expandedRow === rowKey}
                    onOpenChange={(open) => setExpandedRow(open ? rowKey : null)}
                    asChild
                  >
                    <>
                      <TableRow>
                        <CollapsibleTrigger asChild>
                          <TableCell className="cursor-pointer hover:bg-muted/50">
                            {rec.program_id?.substring(0, 8)}...
                          </TableCell>
                        </CollapsibleTrigger>
                        <TableCell>{rec.degree_level}</TableCell>
                        <TableCell>{rec.consensus_min_gpa?.toFixed(2) || "—"}</TableCell>
                        <TableCell>{rec.consensus_min_ielts?.toFixed(1) || "—"}</TableCell>
                        <TableCell>{rec.consensus_min_toefl || "—"}</TableCell>
                        <TableCell>{getConfidenceBadge(rec.confidence_score)}</TableCell>
                        <TableCell>{rec.observations_count}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => acceptMutation.mutate(rec)}
                            disabled={acceptMutation.isPending}
                          >
                            {acceptMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 ml-1" />
                            )}
                            قبول
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={8} className="p-0">
                          <CollapsibleContent>
                            <div className="p-4 bg-muted/30">
                              <h4 className="font-semibold mb-2">تفاصيل المشاهدات:</h4>
                              <div className="space-y-2 text-sm">
                                {rec.observations.map((obs: any, i: number) => (
                                  <div key={i} className="border-l-2 border-primary pl-3">
                                    <p>
                                      GPA: {obs.min_gpa || "—"} | IELTS: {obs.min_ielts || "—"} | 
                                      TOEFL: {obs.min_toefl || "—"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      الثقة: {(obs.confidence * 100).toFixed(0)}% | 
                                      موثوقية المصدر: {(obs.source_reliability * 100).toFixed(0)}%
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </TableCell>
                      </TableRow>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
