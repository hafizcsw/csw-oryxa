import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { Loader2, CheckCircle, Clock, XCircle, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface StatusEvent {
  id: string;
  status: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

interface Document {
  id: string;
  doc_type: string;
  original_name: string;
  file_size: number;
  status: string;
  created_at: string;
}

interface Application {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  payment_status?: string;
  docs_status?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  new: { label: 'جديد', color: 'bg-blue-100 text-blue-800', icon: Clock },
  in_review: { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  docs_required: { label: 'مطلوب مستندات', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  submitted: { label: 'تم الإرسال', color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
  accepted: { label: 'مقبول', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'مرفوض', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function Status() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const visitorId = localStorage.getItem('visitor_id') || '';

  useEffect(() => {
    if (!id || !visitorId) {
      toast.error('معرف الطلب أو الزائر مفقود');
      navigate('/');
      return;
    }

    loadStatus();
    track('status_viewed', { application_id: id });
  }, [id, visitorId]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('application-status', {
        body: { application_id: id },
        headers: {
          'x-visitor-id': visitorId
        }
      });

      if (error) throw error;

      if (data?.ok) {
        setApplication(data.application);
        setEvents(data.events || []);
        setDocuments(data.documents || []);
      } else {
        throw new Error('فشل في تحميل البيانات');
      }
    } catch (error: any) {
      console.error('Load status error:', error);
      toast.error(error.message || 'فشل في تحميل حالة الطلب');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!application) {
    return (
      <Layout>
        <div className="container py-12">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>الطلب غير موجود</AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  const currentStatus = STATUS_CONFIG[application.status] || STATUS_CONFIG.new;
  const StatusIcon = currentStatus.icon;

  return (
    <Layout>
      <div className="container py-12 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">حالة الطلب</h1>
            <p className="text-muted-foreground">
              طلب رقم: {id?.slice(0, 8)}...
            </p>
          </div>
          <Badge className={`${currentStatus.color} flex items-center gap-2`}>
            <StatusIcon className="h-4 w-4" />
            {currentStatus.label}
          </Badge>
        </div>

        {/* Application Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>معلومات الطلب</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">الاسم</div>
              <div>{application.full_name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">البريد الإلكتروني</div>
              <div>{application.email}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">الهاتف</div>
              <div>{application.phone}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">تاريخ التقديم</div>
              <div>{format(new Date(application.created_at), 'PPP')}</div>
            </div>
            {application.payment_status && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">حالة الدفع</div>
                <Badge variant="outline">{application.payment_status}</Badge>
              </div>
            )}
            {application.docs_status && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">حالة الوثائق</div>
                <Badge variant="outline">{application.docs_status}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>خط الزمن</CardTitle>
            <CardDescription>تتبع مراحل طلبك</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.map((event, index) => {
                const config = STATUS_CONFIG[event.status] || STATUS_CONFIG.new;
                const EventIcon = config.icon;
                return (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`rounded-full p-2 ${config.color}`}>
                        <EventIcon className="h-4 w-4" />
                      </div>
                      {index < events.length - 1 && (
                        <div className="w-0.5 h-full bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">{config.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(event.created_at), 'PPp')}
                        </div>
                      </div>
                      {event.note && (
                        <div className="text-sm text-muted-foreground">{event.note}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        بواسطة: {event.created_by}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>المستندات المرفوعة ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <div>
                        <div className="font-medium text-sm">{doc.original_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {doc.doc_type} • {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    <Badge variant={doc.status === 'uploaded' ? 'default' : 'secondary'}>
                      {doc.status === 'uploaded' ? 'تم الرفع' : doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                لم يتم رفع مستندات بعد
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => window.open(`https://wa.me/${application.phone.replace(/\+/g, '')}?text=استفسار عن الطلب: ${id}`, '_blank')}
          >
            تواصل عبر واتساب
          </Button>
          <Button variant="outline" onClick={() => navigate('/apply')}>
            رفع مستندات إضافية
          </Button>
        </div>
      </div>
    </Layout>
  );
}
