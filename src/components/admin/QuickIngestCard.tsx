import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invokeWithDetails, formatError } from '@/lib/invokeWithDetails';
import { Loader2, FileText, Upload, Check, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DiffStats {
  create: number;
  update: number;
  noop: number;
}

interface DiffResult {
  university_action?: string;
  programs?: Array<{
    action: string;
    normalized_key?: string;
    program_id?: string;
    flags?: string[];
    name?: string;
  }>;
  stats?: DiffStats;
}

export function QuickIngestCard() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string>("");
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [autoApply, setAutoApply] = useState(false);
  const [evidenceMode, setEvidenceMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string>("");
  const [log, setLog] = useState<string>("");
  const pushLog = (line: string) => setLog(l => (l ? l + "\n" : "") + line);

  const analyzeText = async () => {
    setLoading(true);
    setDiff(null);
    setLastError("");
    setLog("");
    
    try {
      pushLog("→ from-text: start");
      const resp = await invokeWithDetails("admin-unis-ingest-from-text", {
        text,
        evidence_mode: evidenceMode,
      });
      pushLog("✓ from-text: OK");

      setJobId(resp.job_id);
      setDiff(resp.diff);
      const programsCount = resp?.parsed?.programs_count ?? resp?.diff?.programs?.length ?? 0;
      toast.success(`تم التحليل: ${programsCount} برنامج`);

      if (autoApply && resp.diff) {
        await doApply(resp.job_id, resp.diff);
      }
    } catch (e: any) {
      const msg = formatError(e);
      console.error(e);
      setLastError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const analyzePdf = async () => {
    if (!file) return;
    setLoading(true);
    setDiff(null);
    setLastError("");
    setLog("");
    
    try {
      pushLog("→ upload-init");
      const init = await invokeWithDetails("admin-unis-ingest-upload-init", {
        filename: file.name,
        mime_type: file.type,
      });
      setJobId(init.job_id);
      pushLog(`✓ upload-init: path=${init.path}`);

      await fetch(init.upload_url, {
        method: "PUT",
        headers: { "x-upsert": "true" },
        body: file,
      });
      pushLog("✓ storage upload");

      await invokeWithDetails("admin-unis-ingest-finalize", { job_id: init.job_id });
      pushLog("✓ finalize (sha256)");

      await invokeWithDetails("admin-unis-ingest-extract-text", { job_id: init.job_id });
      pushLog("✓ extract-text");

      await invokeWithDetails("admin-unis-ingest-parse", {
        job_id: init.job_id,
        evidence_mode: evidenceMode,
      });
      pushLog("✓ parse");

      const diffRes = await invokeWithDetails("admin-unis-ingest-diff", { job_id: init.job_id });
      setDiff(diffRes.diff);
      const stats = diffRes.diff?.stats || { create: 0, update: 0, noop: 0 };
      toast.success(`Diff جاهز: ${stats.create} إنشاء | ${stats.update} تحديث | ${stats.noop} بدون تغيير`);
      pushLog("✓ diff");

      if (autoApply && diffRes.diff) {
        await doApply(init.job_id, diffRes.diff);
      }
    } catch (e: any) {
      const msg = formatError(e);
      console.error(e);
      setLastError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const doApply = async (job_id: string, diffData: DiffResult) => {
    try {
      // Filter safe items only (no AI flags, with valid evidence)
      const safePrograms = (diffData.programs || [])
        .filter(p => 
          (p.action === "create" || p.action === "update") && 
          !(p.flags || []).length
        )
        .map(p => 
          p.action === "create"
            ? { action: "create", normalized_key: p.normalized_key }
            : { action: "update", program_id: p.program_id }
        );

      const selections = {
        university: diffData.university_action,
        programs: safePrograms
      };

      const data = await invokeWithDetails("admin-unis-ingest-apply", {
        job_id,
        selections,
      });

      toast.success(`تم التطبيق بنجاح: university_id=${data.university_id}`);
      
      // Refresh diff to show applied changes
      const { data: newDiff } = await supabase.functions.invoke('admin-unis-ingest-diff', {
        body: { job_id }
      });
      
      if (newDiff?.diff) {
        setDiff(newDiff.diff);
      }
    } catch (e: any) {
      console.error('Apply error:', e);
      const errorMsg = e?.context?.error || e?.message || e?.error || 'فشل التطبيق';
      toast.error(errorMsg);
    }
  };

  const flaggedItems = diff?.programs?.filter(p => (p.flags || []).length > 0) || [];
  const safeItems = diff?.programs?.filter(p => !(p.flags || []).length) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Quick Ingest (Text / PDF)
        </CardTitle>
        <CardDescription>
          الصق نص أو ارفع PDF لتحليله وإضافة الجامعات والبرامج تلقائياً
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Options */}
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id="auto-apply"
              checked={autoApply}
              onCheckedChange={(checked) => setAutoApply(!!checked)}
            />
            <Label htmlFor="auto-apply" className="cursor-pointer">
              تطبيق تلقائي (للعناصر الآمنة فقط)
            </Label>
          </div>
          
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id="evidence-mode"
              checked={evidenceMode}
              onCheckedChange={(checked) => setEvidenceMode(!!checked)}
            />
            <Label htmlFor="evidence-mode" className="cursor-pointer">
              Evidence Mode (التحقق المزدوج)
            </Label>
          </div>
        </div>

        {/* Text Input */}
        <div className="space-y-2">
          <Label>النص الخام</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ألصق مواصفات الجامعة والبرامج هنا..."
            className="min-h-[150px] font-mono text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={analyzeText}
            disabled={loading || text.length < 50}
          >
            {loading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التحليل...
              </>
            ) : (
              <>
                <FileText className="ml-2 h-4 w-4" />
                تحليل النص
              </>
            )}
          </Button>

          <div className="flex gap-2 items-center">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <Button
              onClick={analyzePdf}
              disabled={loading || !file}
              variant="secondary"
            >
              {loading ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="ml-2 h-4 w-4" />
              )}
              رفع وتحليل PDF
            </Button>
          </div>
        </div>

        {lastError && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm whitespace-pre-wrap">
            <div className="font-semibold mb-1 text-destructive">خطأ تفصيلي</div>
            <div className="text-destructive/90">{lastError}</div>
          </div>
        )}

        {log && (
          <div className="mt-3 rounded-md border border-muted bg-muted/50 p-3 text-xs whitespace-pre-wrap font-mono">
            <div className="font-semibold mb-1">Log</div>
            <div className="opacity-80">{log}</div>
          </div>
        )}

        {/* Diff Results */}
        {diff && (
          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">نتائج المقارنة</h3>
              {!autoApply && safeItems.length > 0 && (
                <Button onClick={() => doApply(jobId, diff)} size="sm">
                  <Check className="ml-2 h-4 w-4" />
                  تطبيق العناصر الآمنة ({safeItems.length})
                </Button>
              )}
            </div>

            {/* Stats */}
            {diff.stats && (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">
                      {diff.stats.create}
                    </div>
                    <p className="text-sm text-muted-foreground">إنشاء جديد</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">
                      {diff.stats.update}
                    </div>
                    <p className="text-sm text-muted-foreground">تحديث</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-gray-600">
                      {diff.stats.noop}
                    </div>
                    <p className="text-sm text-muted-foreground">بدون تغيير</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Flagged Items Warning */}
            {flaggedItems.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  يوجد {flaggedItems.length} عنصر يحتاج مراجعة يدوية (اختلاف بين AI أو أدلة ناقصة)
                </AlertDescription>
              </Alert>
            )}

            {/* Programs List */}
            {diff.programs && diff.programs.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">البرامج ({diff.programs.length})</h4>
                <div className="max-h-[400px] overflow-auto space-y-2">
                  {diff.programs.map((prog, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded border text-sm ${
                        (prog.flags || []).length > 0
                          ? 'bg-red-50 border-red-200 dark:bg-red-900/20'
                          : 'bg-green-50 border-green-200 dark:bg-green-900/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{prog.name || prog.normalized_key}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {prog.action === 'create' ? '✨ إنشاء جديد' : 
                             prog.action === 'update' ? '🔄 تحديث' : '➡️ بدون تغيير'}
                          </div>
                        </div>
                        {(prog.flags || []).length > 0 && (
                          <div className="text-xs text-red-600 font-medium">
                            {prog.flags?.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw Diff (collapsible) */}
            <details className="text-xs">
              <summary className="cursor-pointer font-medium mb-2">
                عرض Diff الكامل (JSON)
              </summary>
              <pre className="bg-muted p-3 rounded overflow-auto max-h-[300px]">
                {JSON.stringify(diff, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
