import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, FileText, Download } from "lucide-react";
import { requireAdmin } from "@/lib/admin.sso";

interface Application {
  id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
}

interface Document {
  id: string;
  doc_type: string;
  original_name: string;
  status: string;
  file_size: number;
  created_at: string;
  file_path: string;
}

export default function DocumentsReview() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requireAdmin(true);
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("id, full_name, email, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Failed to load applications");
      return;
    }

    setApplications(data || []);
  };

  const fetchDocuments = async (appId: string) => {
    const { data, error } = await supabase
      .from("application_documents")
      .select("*")
      .eq("application_id", appId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load documents");
      return;
    }

    setDocuments(data || []);
    setSelectedApp(appId);
  };

  const handleApproveAll = async () => {
    if (!selectedApp) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("app_docs_approve_all", {
        p_application_id: selectedApp,
        p_reviewer_id: "admin_user"
      });

      if (error) throw error;

      toast.success("All documents approved successfully");
      fetchDocuments(selectedApp);
      fetchApplications();
    } catch (error) {
      console.error("Approve error:", error);
      toast.error("Failed to approve documents");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp || !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("app_docs_reject", {
        p_application_id: selectedApp,
        p_reviewer_id: "admin_user",
        p_reason: rejectReason
      });

      if (error) throw error;

      toast.success("Documents rejected with reason");
      setRejectReason("");
      fetchDocuments(selectedApp);
      fetchApplications();
    } catch (error) {
      console.error("Reject error:", error);
      toast.error("Failed to reject documents");
    } finally {
      setLoading(false);
    }
  };

  const getDocumentUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from("applications")
      .createSignedUrl(filePath, 3600);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Failed to get document URL");
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Documents Review</h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Applications List */}
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">Applications</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {applications.map((app) => (
                <button
                  key={app.id}
                  onClick={() => fetchDocuments(app.id)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    selectedApp === app.id
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted border-border"
                  }`}
                >
                  <div className="font-medium">{app.full_name}</div>
                  <div className="text-sm text-muted-foreground">{app.email}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Status: {app.status} • {new Date(app.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Documents Review */}
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">Documents</h2>
            
            {selectedApp ? (
              <div className="space-y-4">
                {/* Documents List */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {documents.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No documents uploaded yet
                    </p>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{doc.original_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {doc.doc_type} • {(doc.file_size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              doc.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : doc.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {doc.status}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => getDocumentUrl(doc.file_path)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {/* Action Buttons */}
                {documents.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <Button
                      onClick={handleApproveAll}
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve All Documents
                    </Button>

                    <div className="space-y-2">
                      <Textarea
                        placeholder="Rejection reason (required)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <Button
                        onClick={handleReject}
                        disabled={loading || !rejectReason.trim()}
                        variant="destructive"
                        className="w-full"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject with Reason
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Select an application to review documents
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
