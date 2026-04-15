import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Diff = {
  university_action: "create" | "match";
  university_id?: string | null;
  programs: any[];
  stats: { create: number; update: number; noop: number };
};

export default function UnisIngestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string>("");
  const [diff, setDiff] = useState<Diff | null>(null);
  const [selections, setSelections] = useState<any>({ university: "create", programs: [] });
  const [log, setLog] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function upload() {
    if (!file) return;
    setLoading(true);
    
    try {
      // Init upload
      const { data: init, error: e1 } = await supabase.functions.invoke("admin-unis-ingest-upload-init", {
        body: { filename: file.name, mime_type: file.type }
      });
      
      if (e1) throw e1;
      
      setJobId(init.job_id);
      setLog(l => l + `\nUploaded: ${init.path}`);

      // Upload file
      await fetch(init.upload_url, {
        method: "PUT",
        headers: { "x-upsert": "true" },
        body: file
      });

      toast({
        title: "File Uploaded",
        description: "File uploaded successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  async function extract() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-unis-ingest-extract-text", {
        body: { job_id: jobId }
      });
      
      if (error) throw error;
      
      setLog(l => l + `\nExtracted chars=${data.chars}`);
      toast({ title: "Text Extracted", description: `${data.chars} characters extracted` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function parse() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-unis-ingest-parse", {
        body: { job_id: jobId }
      });
      
      if (error) throw error;
      
      setLog(l => l + `\nParsed programs=${data.programs_count}`);
      toast({ title: "Data Parsed", description: `${data.programs_count} programs found` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function doDiff() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-unis-ingest-diff", {
        body: { job_id: jobId }
      });
      
      if (error) throw error;
      
      setDiff(data.diff);
      
      // Pre-select create/update actions
      const preSel = {
        university: data.diff.university_action,
        programs: data.diff.programs
          .filter((p: any) => p.action === "create" || p.action === "update")
          .map((p: any) =>
            p.action === "create"
              ? { action: "create", normalized_key: p.normalized_key }
              : { action: "update", program_id: p.program_id }
          )
      };
      setSelections(preSel);
      
      toast({
        title: "Diff Generated",
        description: `${data.diff.stats.create} new, ${data.diff.stats.update} updates`
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-unis-ingest-apply", {
        body: { job_id: jobId, selections }
      });
      
      if (error) throw error;
      
      setLog(l => l + `\nApplied: ${JSON.stringify(data)}`);
      toast({ title: "Changes Applied", description: "Data successfully imported" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">استيراد جامعات (PDF/DOCX)</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload & Process</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm border rounded p-2"
          />
          
          <div className="flex gap-2 flex-wrap">
            <Button onClick={upload} disabled={!file || loading}>
              1) Upload
            </Button>
            <Button onClick={extract} disabled={!jobId || loading} variant="secondary">
              2) Extract
            </Button>
            <Button onClick={parse} disabled={!jobId || loading} variant="secondary">
              3) Parse
            </Button>
            <Button onClick={doDiff} disabled={!jobId || loading} variant="secondary">
              4) Diff
            </Button>
            <Button onClick={apply} disabled={!diff || loading} variant="default">
              5) Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {diff && (
        <Card>
          <CardHeader>
            <CardTitle>Diff Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <strong>University action:</strong> {diff.university_action}
            </div>
            <div>
              <strong>Programs:</strong> create {diff.stats.create} | update {diff.stats.update} | noop {diff.stats.noop}
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diff.programs.map((p: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{p.action}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.normalized_key || p.program_id}
                    </TableCell>
                    <TableCell>
                      <pre className="text-xs">{JSON.stringify(p.diff || {}, null, 2)}</pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Log</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded">
            {log || "No logs yet"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
