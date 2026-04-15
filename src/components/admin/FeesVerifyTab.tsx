import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle, DollarSign, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface FeesVerifyTabProps {
  universityId: string;
}

interface Recommendation {
  university_id: string;
  program_id: string | null;
  degree_level: string | null;
  audience: string;
  consensus_amount: number;
  currency_code: string;
  confidence_score: number;
  observation_count: number;
  observations: Array<{
    amount: number;
    source_type: string;
    observed_at: string;
    confidence: number;
  }>;
}

export default function FeesVerifyTab({ universityId }: FeesVerifyTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);

  // Fetch recommendations
  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: ["price-recommendations", universityId],
    queryFn: async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prices-compare?university_id=${universityId}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      const data = await response.json();
      return data?.recommendations || [];
    },
  });

  // Accept recommendation mutation
  const acceptMutation = useMutation({
    mutationFn: async (recommendation: Recommendation) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prices-accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recommendation }),
        }
      );
      if (!response.ok) throw new Error("Failed to accept recommendation");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "تم القبول",
        description: "تم تثبيت الإجماع السعري بنجاح",
      });
      setSelectedRec(null);
      queryClient.invalidateQueries({ queryKey: ["price-recommendations", universityId] });
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
    if (score >= 0.8) return <Badge variant="default">عالية ({(score * 100).toFixed(0)}%)</Badge>;
    if (score >= 0.6) return <Badge variant="secondary">متوسطة ({(score * 100).toFixed(0)}%)</Badge>;
    return <Badge variant="destructive">منخفضة ({(score * 100).toFixed(0)}%)</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>التحقق من الرسوم الدراسية</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد توصيات سعرية</p>
            <p className="text-sm text-muted-foreground mt-2">قم بتشغيل harvest الرسوم أولاً</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المستوى</TableHead>
                  <TableHead>الجمهور</TableHead>
                  <TableHead>السعر المقترح</TableHead>
                  <TableHead>الثقة</TableHead>
                  <TableHead>المشاهدات</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.map((rec: Recommendation, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      {rec.degree_level || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {rec.audience === "international" ? "دولي" : "محلي"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold">
                          {rec.consensus_amount.toLocaleString()} {rec.currency_code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getConfidenceBadge(rec.confidence_score)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{rec.observation_count} مصدر</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedRec(rec);
                          acceptMutation.mutate(rec);
                        }}
                        disabled={acceptMutation.isPending && selectedRec === rec}
                      >
                        {acceptMutation.isPending && selectedRec === rec ? (
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 ml-2" />
                        )}
                        قبول
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Observation details */}
            {selectedRec && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-sm">تفاصيل المشاهدات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedRec.observations.map((obs, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <div>
                          <span className="font-medium">{obs.amount} {selectedRec.currency_code}</span>
                          <Badge variant="outline" className="mr-2">
                            {obs.source_type}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(obs.observed_at), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
