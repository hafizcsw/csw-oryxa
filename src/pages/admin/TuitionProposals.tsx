import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, ExternalLink, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function TuitionProposals() {
  const queryClient = useQueryClient();

  const { data: proposals, isLoading } = useQuery({
    queryKey: ["tuition-proposals"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-tuition-proposals-list");
      if (error) throw error;
      return data;
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (proposalId: number) => {
      const { data, error } = await supabase.functions.invoke("admin-tuition-proposal-approve", {
        body: { proposal_id: proposalId, action: "approve" }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("تمت الموافقة على التغيير");
      queryClient.invalidateQueries({ queryKey: ["tuition-proposals"] });
    },
    onError: (error) => {
      toast.error(`خطأ: ${error.message}`);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (proposalId: number) => {
      const { data, error } = await supabase.functions.invoke("admin-tuition-proposal-approve", {
        body: { proposal_id: proposalId, action: "reject" }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("تم رفض التغيير");
      queryClient.invalidateQueries({ queryKey: ["tuition-proposals"] });
    },
    onError: (error) => {
      toast.error(`خطأ: ${error.message}`);
    }
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      auto_approved: "default",
      approved: "default",
      rejected: "destructive"
    };
    
    const labels: Record<string, string> = {
      pending: "قيد الانتظار",
      auto_approved: "موافق تلقائياً",
      approved: "موافق",
      rejected: "مرفوض"
    };

    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      official_changed: "تغيير رسمي",
      aux_conflict: "تعارض مع المصادر الثانوية",
      stale_year: "سنة قديمة",
      initial_capture: "التقاط أولي"
    };
    return labels[reason] || reason;
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">مقترحات تغيير الرسوم</h1>
        <Badge variant="secondary">
          {proposals?.proposals?.filter((p: any) => p.status === "pending").length || 0} قيد الانتظار
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الجامعة</TableHead>
                <TableHead className="text-right">السعر القديم</TableHead>
                <TableHead className="text-right">السعر الجديد</TableHead>
                <TableHead className="text-right">الفارق</TableHead>
                <TableHead className="text-right">السبب</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : proposals?.proposals?.length ? (
                proposals.proposals.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.university_name}</TableCell>
                    <TableCell>
                      {p.old_amount ? `${p.old_amount} ${p.old_currency}` : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        {p.new_amount} {p.new_currency}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.diff_percent > 15 ? "destructive" : "secondary"}>
                        {p.diff_percent > 0 ? "+" : ""}{p.diff_percent.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell>{getReasonLabel(p.reason)}</TableCell>
                    <TableCell>{getStatusBadge(p.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => approveMutation.mutate(p.id)}
                              disabled={approveMutation.isPending}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectMutation.mutate(p.id)}
                              disabled={rejectMutation.isPending}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {p.new_source_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={p.new_source_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    لا توجد مقترحات
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
