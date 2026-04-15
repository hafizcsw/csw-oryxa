import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle, XCircle, Calendar, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface ScholarshipsTabProps {
  universityId: string;
}

export default function ScholarshipsTab({ universityId }: ScholarshipsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch scholarships for this university
  const { data: scholarships = [], isLoading } = useQuery({
    queryKey: ["scholarships", universityId],
    queryFn: async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-scholarships-list?university_id=${universityId}&status=draft`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch scholarships");
      const data = await response.json();
      return data?.scholarships || [];
    },
    refetchInterval: 10000,
  });

  // Publish/Reject mutation
  const publishMutation = useMutation({
    mutationFn: async (action: 'publish' | 'reject') => {
      const { data, error } = await supabase.functions.invoke(
        "admin-scholarships-publish",
        {
          body: { ids: selectedIds, action },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data, action) => {
      toast({
        title: action === 'publish' ? "تم النشر" : "تم الرفض",
        description: `تم ${action === 'publish' ? 'نشر' : 'رفض'} ${data.updated} منحة`,
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["scholarships", universityId] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشلت العملية",
      });
    },
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === scholarships.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(scholarships.map((s: any) => s.id));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: "secondary", label: "مسودة" },
      published: { variant: "default", label: "منشور" },
      archived: { variant: "outline", label: "مؤرشف" },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>المنح الدراسية</CardTitle>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <>
                <Button
                  size="sm"
                  onClick={() => publishMutation.mutate('publish')}
                  disabled={publishMutation.isPending}
                >
                  {publishMutation.isPending ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 ml-2" />
                  )}
                  نشر ({selectedIds.length})
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => publishMutation.mutate('reject')}
                  disabled={publishMutation.isPending}
                >
                  {publishMutation.isPending ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 ml-2" />
                  )}
                  رفض ({selectedIds.length})
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : scholarships.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد منح</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === scholarships.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الموعد النهائي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ الحصاد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scholarships.map((scholarship: any) => (
                <TableRow key={scholarship.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(scholarship.id)}
                      onCheckedChange={() => toggleSelection(scholarship.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {scholarship.title}
                  </TableCell>
                  <TableCell>
                    {scholarship.amount ? (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {scholarship.amount.toLocaleString()} {scholarship.currency_code}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {scholarship.deadline ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(scholarship.deadline).toLocaleDateString('ar-SA')}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(scholarship.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {scholarship.harvested_at
                      ? formatDistanceToNow(new Date(scholarship.harvested_at), {
                          addSuffix: true,
                          locale: ar,
                        })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
