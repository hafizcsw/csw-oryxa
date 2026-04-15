import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Eye, Clock, AlertCircle, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Enrollment {
  id: string;
  user_id: string;
  language_key: string;
  course_type: string;
  price_usd: number;
  payment_method: string;
  proof_url: string | null;
  proof_uploaded_at: string | null;
  request_status: string;
  payment_proof_status: string;
  admin_note: string | null;
  approved_at: string | null;
  activation_status: string;
  created_at: string;
  cohort_id: string | null;
  // joined
  user_email?: string;
  user_name?: string;
  cohort_start?: string;
  product_name?: string;
}

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  draft: { variant: "outline", label: "Draft" },
  submitted: { variant: "secondary", label: "Submitted" },
  under_review: { variant: "default", label: "Under Review" },
  approved: { variant: "default", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

export default function LanguageEnrollments() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");

  const loadEnrollments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("language_course_enrollments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load enrollments");
      setLoading(false);
      return;
    }

    // Enrich with user info
    const enriched: Enrollment[] = [];
    for (const row of (data || []) as any[]) {
      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", row.user_id)
        .maybeSingle();

      enriched.push({
        ...row,
        user_email: profile?.email || "",
        user_name: profile?.full_name || "",
      });
    }

    setEnrollments(enriched);
    setLoading(false);
  };

  useEffect(() => { loadEnrollments(); }, []);

  const getProofSignedUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(path, 600);
    return data?.signedUrl || null;
  };

  const openDetail = async (e: Enrollment) => {
    setSelectedId(e.id);
    setAdminNote(e.admin_note || "");
    if (e.proof_url) {
      const url = await getProofSignedUrl(e.proof_url);
      setProofUrl(url);
    } else {
      setProofUrl(null);
    }
  };

  const handleAction = async (action: "approve" | "reject") => {
    if (!selectedId) return;
    setProcessing(true);

    const { data: { session } } = await supabase.auth.getSession();

    const updates: Record<string, any> = {
      admin_note: adminNote || null,
    };

    if (action === "approve") {
      updates.request_status = "approved";
      updates.payment_proof_status = "proof_accepted";
      updates.activation_status = "active";
      updates.approved_by = session?.user?.id || null;
      updates.approved_at = new Date().toISOString();
    } else {
      updates.request_status = "rejected";
      updates.payment_proof_status = "proof_rejected";
      updates.rejected_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("language_course_enrollments")
      .update(updates as any)
      .eq("id", selectedId);

    if (error) {
      toast.error("Action failed: " + error.message);
    } else {
      toast.success(action === "approve" ? "Enrollment approved!" : "Enrollment rejected");
      setSelectedId(null);
      loadEnrollments();
    }
    setProcessing(false);
  };

  const selected = enrollments.find(e => e.id === selectedId);

  const filterByTab = (tab: string) => {
    if (tab === "pending") return enrollments.filter(e => ["submitted", "under_review", "draft"].includes(e.request_status));
    if (tab === "approved") return enrollments.filter(e => e.request_status === "approved");
    if (tab === "rejected") return enrollments.filter(e => e.request_status === "rejected");
    return enrollments;
  };

  const pendingCount = enrollments.filter(e => ["submitted", "under_review"].includes(e.request_status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Language Course Enrollments</h1>
          <p className="text-sm text-muted-foreground">Manage course purchase requests and payment proofs</p>
        </div>
        <Badge variant={pendingCount > 0 ? "destructive" : "secondary"}>
          {pendingCount} pending
        </Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Pending {pendingCount > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-1.5">
              <XCircle className="w-3.5 h-3.5" />
              Rejected
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          {["pending", "approved", "rejected", "all"].map(tab => (
            <TabsContent key={tab} value={tab}>
              <div className="space-y-3">
                {filterByTab(tab).length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No enrollments in this category
                    </CardContent>
                  </Card>
                ) : (
                  filterByTab(tab).map(e => (
                    <Card key={e.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openDetail(e)}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">🇷🇺</div>
                            <div>
                              <p className="font-semibold text-foreground text-sm">{e.user_name || e.user_email || e.user_id.slice(0, 8)}</p>
                              <p className="text-xs text-muted-foreground">{e.user_email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-end">
                              <p className="font-bold text-foreground">${e.price_usd}</p>
                              <p className="text-xs text-muted-foreground capitalize">{e.course_type.replace("_", " ")}</p>
                            </div>
                            <Badge variant={STATUS_BADGE[e.request_status]?.variant || "outline"}>
                              {STATUS_BADGE[e.request_status]?.label || e.request_status}
                            </Badge>
                            {e.proof_url && (
                              <Badge variant="outline" className="gap-1">
                                <Eye className="w-3 h-3" />
                                Proof
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={(v) => !v && setSelectedId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enrollment Detail</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Student</p>
                  <p className="font-semibold">{selected.user_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-semibold">{selected.user_email || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Language</p>
                  <p className="font-semibold capitalize">{selected.language_key}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Course Type</p>
                  <p className="font-semibold capitalize">{selected.course_type.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Price</p>
                  <p className="font-bold text-primary">${selected.price_usd}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Method</p>
                  <p className="font-semibold capitalize">{selected.payment_method.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={STATUS_BADGE[selected.request_status]?.variant || "outline"}>
                    {STATUS_BADGE[selected.request_status]?.label || selected.request_status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-semibold text-xs">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Payment Proof */}
              {proofUrl && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Payment Proof</p>
                  <div className="border rounded-xl overflow-hidden">
                    <img src={proofUrl} alt="Payment proof" className="w-full max-h-[300px] object-contain bg-muted" />
                  </div>
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary mt-2 hover:underline">
                    <Download className="w-3 h-3" /> Open full size
                  </a>
                </div>
              )}

              {!selected.proof_url && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  No payment proof uploaded yet
                </div>
              )}

              {/* Admin Note */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Admin Note</label>
                <Textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  placeholder="Add a note (optional)"
                  rows={3}
                />
              </div>

              {/* Actions */}
              {selected.request_status !== "approved" && selected.request_status !== "rejected" && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAction("approve")}
                    disabled={processing}
                    className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve & Activate
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleAction("reject")}
                    disabled={processing}
                    className="flex-1 gap-1.5"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Reject
                  </Button>
                </div>
              )}

              {selected.request_status === "approved" && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  Approved on {selected.approved_at ? new Date(selected.approved_at).toLocaleString() : "—"}
                </div>
              )}

              {selected.request_status === "rejected" && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <XCircle className="w-4 h-4" />
                  Rejected{selected.admin_note ? `: ${selected.admin_note}` : ""}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
