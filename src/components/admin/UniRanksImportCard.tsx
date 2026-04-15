import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, ExternalLink, Check, AlertCircle, Zap, ClipboardPaste, Sparkles, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ParsedUniversity {
  name: string;
  slug: string;
  country: string;
  rank: number;
  score: number | null;
  logo_url: string | null;
  is_verified: boolean;
  tier: string | null;
}

interface CrawlJob {
  id: string;
  category: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  current_page: number;
  max_pages: number;
  total_found: number;
  total_imported: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  created_at: string;
}

interface EnrichJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  total_universities: number;
  processed: number;
  enriched: number;
  programs_found: number;
  programs_saved: number;
  errors: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  created_at: string;
}

const CATEGORY_OPTIONS = [
  { slug: "verified-universities", name: "All Verified (14,339)", pages: 150 },
  { slug: "elite", name: "Elite Universities (420)", pages: 10 },
  { slug: "top-world", name: "World TOP (982)", pages: 15 },
  { slug: "united-states-of-america", name: "United States", pages: 50 },
  { slug: "united-kingdom", name: "United Kingdom", pages: 20 },
  { slug: "canada", name: "Canada", pages: 15 },
  { slug: "australia", name: "Australia", pages: 10 },
  { slug: "germany", name: "Germany", pages: 15 },
  { slug: "france", name: "France", pages: 15 },
  { slug: "saudi-arabia", name: "Saudi Arabia", pages: 5 },
  { slug: "united-arab-emirates", name: "UAE", pages: 5 },
  { slug: "egypt", name: "Egypt", pages: 5 },
  { slug: "turkey", name: "Turkey", pages: 10 },
  { slug: "india", name: "India", pages: 30 },
  { slug: "china", name: "China", pages: 40 },
  { slug: "japan", name: "Japan", pages: 15 },
];

export function UniRanksImportCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [category, setCategory] = useState("verified-universities");
  const [importTab, setImportTab] = useState<"auto" | "manual">("auto");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeEnrichJobId, setActiveEnrichJobId] = useState<string | null>(null);

  const ENRICH_JOB_STORAGE_KEY = "uniranks_active_enrich_job_id";

  // Restore enrich job after refresh/navigation so UI doesn't "freeze" while backend keeps running
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ENRICH_JOB_STORAGE_KEY);
      if (saved) setActiveEnrichJobId(saved);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (activeEnrichJobId) localStorage.setItem(ENRICH_JOB_STORAGE_KEY, activeEnrichJobId);
      else localStorage.removeItem(ENRICH_JOB_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [activeEnrichJobId]);
  
  // Manual import state
  const [markdownContent, setMarkdownContent] = useState("");
  const [parsedData, setParsedData] = useState<ParsedUniversity[]>([]);
  const [parseStatus, setParseStatus] = useState<"idle" | "parsing" | "parsed" | "error">("idle");

  // Poll for job status when there's an active job
  const { data: jobStatus, refetch: refetchJobStatus } = useQuery({
    queryKey: ["uniranks-job-status", activeJobId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("firecrawl-uniranks", {
        body: { action: "status", job_id: activeJobId },
      });
      
      if (error) throw error;
      return data as { ok: boolean; job?: CrawlJob; latest_job?: CrawlJob; total_staged?: number };
    },
    enabled: !!activeJobId,
    refetchInterval: (data) => {
      const job = data?.state.data?.job || data?.state.data?.latest_job;
      // Stop polling when job is completed or failed
      if (job?.status === 'completed' || job?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // Get staging status
  const { data: stagingStatus } = useQuery({
    queryKey: ["uniranks-staging-status"],
    queryFn: async () => {
      const { count } = await supabase
        .from("university_import_staging")
        .select("*", { count: "exact", head: true })
        .eq("source", "uniranks");
      return { total: count || 0 };
    },
    refetchInterval: activeJobId ? 5000 : 30000,
  });

  // Poll for enrich job status
  const { data: enrichJobStatus, refetch: refetchEnrichJobStatus } = useQuery({
    queryKey: ["uniranks-enrich-job-status", activeEnrichJobId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("uniranks-enrich-batch", {
        body: { action: "status", job_id: activeEnrichJobId },
      });
      
      if (error) throw error;
      return data as { ok: boolean; job?: EnrichJob; latest_job?: EnrichJob };
    },
    enabled: !!activeEnrichJobId,
    refetchInterval: (query) => {
      const job = query.state.data?.job || query.state.data?.latest_job;
      if (job?.status === 'completed' || job?.status === 'failed') {
        return false;
      }
      return 3000; // Poll every 3 seconds
    },
  });

  // If we don't have an active job id (e.g., after refresh), detect the latest running/paused job and attach to it
  const { data: latestEnrichStatus } = useQuery({
    queryKey: ["uniranks-enrich-job-latest"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("uniranks-enrich-batch", {
        body: { action: "status" },
      });
      if (error) throw error;
      return data as { ok: boolean; latest_job?: EnrichJob };
    },
    enabled: !activeEnrichJobId,
    refetchInterval: 6000,
  });

  useEffect(() => {
    if (activeEnrichJobId) return;
    const job = latestEnrichStatus?.latest_job;
    if (!job) return;
    if (job.status === 'processing' || job.status === 'paused') {
      setActiveEnrichJobId(job.id);
    }
  }, [latestEnrichStatus, activeEnrichJobId]);

  // Live count of universities in system
  const { data: inSystemCount } = useQuery({
    queryKey: ["universities-in-system-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('universities')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 10000,
  });

  // Handle job completion
  useEffect(() => {
    const job = jobStatus?.job || jobStatus?.latest_job;
    if (job?.status === 'completed' && activeJobId) {
      toast({
        title: "Crawl Completed!",
        description: `Imported ${job.total_imported.toLocaleString()} universities from ${job.current_page} pages.`,
      });
      setActiveJobId(null);
      queryClient.invalidateQueries({ queryKey: ["staging-universities"] });
      queryClient.invalidateQueries({ queryKey: ["uniranks-staging-status"] });
    } else if ((job?.status === 'failed' || job?.status === 'paused') && activeJobId) {
      toast({
        variant: "destructive",
        title: job?.status === 'paused' ? "Crawl Paused" : "Crawl Failed",
        description: job.error_message || "Unknown error occurred. You can resume.",
      });
      // Don't clear activeJobId for paused jobs so we can show resume button
      if (job?.status === 'failed') {
        setActiveJobId(null);
      }
    }
  }, [jobStatus, activeJobId, toast, queryClient]);

  // Handle enrich job completion
  useEffect(() => {
    const job = enrichJobStatus?.job || enrichJobStatus?.latest_job;
    if (job?.status === 'completed' && activeEnrichJobId) {
      toast({
        title: "Enrichment Completed!",
        description: `Enriched ${job.enriched} universities, saved ${job.programs_saved} programs.`,
      });
      setActiveEnrichJobId(null);
      queryClient.invalidateQueries({ queryKey: ["staging-universities"] });
    } else if ((job?.status === 'failed' || job?.status === 'paused') && activeEnrichJobId) {
      toast({
        variant: "destructive",
        title: job?.status === 'paused' ? "Enrichment Paused" : "Enrichment Failed",
        description: job.error_message || "Unknown error occurred. You can resume.",
      });
      if (job?.status === 'failed') {
        setActiveEnrichJobId(null);
      }
    }
  }, [enrichJobStatus, activeEnrichJobId, toast, queryClient]);

  // Resume crawl mutation
  const resumeCrawlMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("firecrawl-uniranks", {
        body: { action: "resume", job_id: jobId },
      });
      
      if (error) throw error;
      if (!data.ok) throw new Error(data.error || "Resume failed");
      
      return data as { ok: boolean; message: string; resume_page: number };
    },
    onSuccess: (data) => {
      toast({
        title: "Crawl Resumed",
        description: data.message,
      });
      refetchJobStatus();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Resume",
        description: error.message,
      });
    },
  });

  // Start crawl mutation (returns immediately with job_id)
  const startCrawlMutation = useMutation({
    mutationFn: async ({ category, maxPages }: { category: string; maxPages: number }) => {
      const { data, error } = await supabase.functions.invoke("firecrawl-uniranks", {
        body: { action: "crawl", category, max_pages: maxPages },
      });
      
      if (error) throw error;
      if (!data.ok) throw new Error(data.error || "Crawl failed");
      
      return data as { ok: boolean; job_id: string; message: string };
    },
    onSuccess: (data) => {
      setActiveJobId(data.job_id);
      toast({
        title: "Crawl Started",
        description: "Background crawl initiated. Progress will be shown below.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Start Crawl",
        description: error.message,
      });
    },
  });

  // Test crawl mutation
  const testCrawlMutation = useMutation({
    mutationFn: async (category: string) => {
      const { data, error } = await supabase.functions.invoke("firecrawl-uniranks", {
        body: { action: "test", category },
      });
      
      if (error) throw error;
      if (!data.ok) throw new Error(data.error || "Test failed");
      
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Test Successful",
        description: `Found ${data.count} universities on first page`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Test Error",
        description: error.message,
      });
    },
  });

  // Parse markdown content (manual mode)
  const parseMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase.functions.invoke("uniranks-scraper", {
        body: { action: "parse", markdown_content: content },
      });
      
      if (error) throw error;
      if (!data.ok) throw new Error(data.error || "Parse failed");
      
      return data.universities as ParsedUniversity[];
    },
    onSuccess: (data) => {
      setParsedData(data);
      setParseStatus("parsed");
      toast({
        title: "Parse Successful",
        description: `Found ${data.length} universities`,
      });
    },
    onError: (error: Error) => {
      setParseStatus("error");
      toast({
        variant: "destructive",
        title: "Parse Error",
        description: error.message,
      });
    },
  });

  // Publish batch to main system (with deduplication)
  const publishBatchMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("uniranks-publish-batch", {
        body: {},
      });
      
      if (error) throw error;
      if (!data.ok) throw new Error(data.error || "Publish failed");
      
      return data as {
        ok: boolean;
        summary: {
          total_staged: number;
          imported: number;
          duplicates: number;
          errors: number;
          existing_in_system: number;
          total_after_import: number;
        };
        message: string;
      };
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Universities Published Successfully!",
        description: `Imported: ${data.summary.imported} | Duplicates merged: ${data.summary.duplicates} | Errors: ${data.summary.errors}`,
      });
      queryClient.invalidateQueries({ queryKey: ["uniranks-staging-status"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Publish",
        description: error.message,
      });
    },
  });

  // Start enrich batch mutation
  const startEnrichMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("uniranks-enrich-batch", {
        body: { action: "start", source: "staging" },
      });
      
      if (error) throw error;
      if (!data.ok) throw new Error(data.error || "Enrich failed");
      
      return data as { ok: boolean; job_id: string; message: string; total: number };
    },
    onSuccess: (data) => {
      setActiveEnrichJobId(data.job_id);
      toast({
        title: "Enrichment Started",
        description: `Processing ${data.total} universities for logos and programs.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Start Enrichment",
        description: error.message,
      });
    },
  });

  // Resume enrich mutation
  const resumeEnrichMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("uniranks-enrich-batch", {
        body: { action: "resume", job_id: jobId },
      });
      
      if (error) throw error;
      if (!data.ok) throw new Error(data.error || "Resume failed");
      
      return data as { ok: boolean; message: string };
    },
    onSuccess: (data) => {
      toast({
        title: "Enrichment Resumed",
        description: data.message,
      });
      refetchEnrichJobStatus();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Resume Enrichment",
        description: error.message,
      });
    },
  });

  // Pause/stop enrich mutation
  const pauseEnrichMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("uniranks-enrich-batch", {
        body: { action: "pause", job_id: jobId },
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error || "Pause failed");

      return data as { ok: boolean; message: string };
    },
    onSuccess: (data) => {
      toast({
        title: "Enrichment Paused",
        description: data.message,
      });
      refetchEnrichJobStatus();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Pause Enrichment",
        description: error.message,
      });
    },
  });

  // Import to staging (manual mode)
  const importMutation = useMutation({
    mutationFn: async (universities: ParsedUniversity[]) => {
      const { data, error } = await supabase.functions.invoke("uniranks-scraper", {
        body: { action: "import", universities },
      });
      
      if (error) throw error;
      if (!data.ok) throw new Error(data.error || "Import failed");
      
      return data.imported as number;
    },
    onSuccess: (count) => {
      toast({
        title: "Import Successful",
        description: `Imported ${count} universities to staging`,
      });
      queryClient.invalidateQueries({ queryKey: ["staging-universities"] });
      queryClient.invalidateQueries({ queryKey: ["uniranks-staging-status"] });
      setParsedData([]);
      setMarkdownContent("");
      setParseStatus("idle");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Import Error",
        description: error.message,
      });
    },
  });

  const handleParse = () => {
    if (!markdownContent.trim()) {
      toast({
        variant: "destructive",
        title: "No Content",
        description: "Please paste the markdown content first",
      });
      return;
    }
    
    setParseStatus("parsing");
    parseMutation.mutate(markdownContent);
  };

  const handleManualImport = () => {
    if (parsedData.length === 0) return;
    importMutation.mutate(parsedData);
  };

  const handleAutoCrawl = () => {
    const selectedCategory = CATEGORY_OPTIONS.find(c => c.slug === category);
    const maxPages = selectedCategory?.pages || 50;
    startCrawlMutation.mutate({ category, maxPages });
  };

  const handleTestCrawl = () => {
    testCrawlMutation.mutate(category);
  };

  const handlePublishBatch = () => {
    publishBatchMutation.mutate();
  };

  const sourceUrl = `https://www.uniranks.com/ranking/${category}`;
  const isAutoLoading = startCrawlMutation.isPending || testCrawlMutation.isPending || !!activeJobId;
  
  const currentJob = jobStatus?.job || jobStatus?.latest_job;
  const progressPercent = currentJob 
    ? Math.round((currentJob.current_page / currentJob.max_pages) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              UniRanks Import
            </CardTitle>
            <CardDescription>
              Import universities from uniranks.com rankings
            </CardDescription>
          </div>
          {stagingStatus && stagingStatus.total > 0 && (
            <Badge variant="secondary" className="text-sm">
              {stagingStatus.total.toLocaleString()} in staging
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category Selection */}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              Category
            </label>
            <Select value={category} onValueChange={setCategory} disabled={isAutoLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.slug} value={opt.slug}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button variant="outline" asChild>
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 me-2" />
              Open Source
            </a>
          </Button>
        </div>

        {/* Import Mode Tabs */}
        <Tabs value={importTab} onValueChange={(v) => setImportTab(v as "auto" | "manual")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Automatic (Background)
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4" />
              Manual (Paste)
            </TabsTrigger>
          </TabsList>

          {/* Automatic Import Tab */}
          <TabsContent value="auto" className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
              <p className="font-medium">Background Crawling</p>
              <p className="text-muted-foreground">
                Crawls all pages incrementally in the background. Results are saved as each page is processed. 
                This avoids timeout issues and can handle thousands of universities.
              </p>
            </div>

            {/* Progress indicator during crawl */}
            {activeJobId && currentJob && (
              <div className="space-y-3 p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-2">
                    {currentJob.status === 'paused' ? (
                      <AlertCircle className="h-4 w-4 text-warning" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {currentJob.status === 'paused' ? 'Crawl Paused' : 'Crawling in progress...'}
                  </span>
                  <span className="text-muted-foreground">
                    Page {currentJob.current_page} / {currentJob.max_pages}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Found: {currentJob.total_found.toLocaleString()}</span>
                  <span>Imported: {currentJob.total_imported.toLocaleString()}</span>
                </div>
                
                {/* Error message and resume button */}
                {currentJob.error_message && (
                  <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    {currentJob.error_message}
                  </div>
                )}
                
                {currentJob.status === 'paused' && (
                  <Button 
                    onClick={() => resumeCrawlMutation.mutate(activeJobId)}
                    disabled={resumeCrawlMutation.isPending}
                    className="w-full"
                  >
                    {resumeCrawlMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                        Resuming...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 me-2" />
                        Resume from Page {currentJob.current_page + 1}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleTestCrawl}
                disabled={isAutoLoading}
              >
                {testCrawlMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test First Page"
                )}
              </Button>
              
              <Button
                onClick={handleAutoCrawl}
                disabled={isAutoLoading}
                className="flex-1"
              >
                {startCrawlMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    Starting...
                  </>
                ) : activeJobId ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    Crawling... ({progressPercent}%)
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 me-2" />
                    Start Background Import
                  </>
                )}
              </Button>
            </div>

            {/* Test results */}
            {testCrawlMutation.data && !activeJobId && (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    Test Result: {testCrawlMutation.data.count} universities
                  </span>
                </div>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-1">
                    {testCrawlMutation.data.sample?.map((uni: ParsedUniversity, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm p-1 rounded hover:bg-muted/50">
                        <span className="text-muted-foreground w-8">#{uni.rank}</span>
                        <span className="font-medium">{uni.name}</span>
                        <span className="text-muted-foreground">({uni.country})</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          {/* Manual Import Tab */}
          <TabsContent value="manual" className="space-y-4">
            {/* Instructions */}
            <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
              <p className="font-medium">How to use:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Click 'Open Source' to visit the UniRanks page</li>
                <li>Scroll down to load all universities you want</li>
                <li>Select all content (Ctrl+A) and copy (Ctrl+C)</li>
                <li>Paste below and click 'Parse Content'</li>
              </ol>
            </div>

            {/* Content Input */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Pasted Content
              </label>
              <Textarea
                placeholder="Paste the page content here..."
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
                className="min-h-[200px] font-mono text-xs"
                disabled={parseMutation.isPending}
              />
            </div>

            {/* Parse Button */}
            <div className="flex gap-2">
              <Button
                onClick={handleParse}
                disabled={parseMutation.isPending || !markdownContent.trim()}
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  "Parse Content"
                )}
              </Button>
              
              {parseStatus === "parsed" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {parsedData.length} universities
                </Badge>
              )}
              
              {parseStatus === "error" && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Parse failed
                </Badge>
              )}
            </div>

            {/* Parsed Results Preview */}
            {parsedData.length > 0 && (
              <div className="border rounded-lg">
                <div className="p-3 border-b bg-muted/30">
                  <span className="font-medium">
                    Preview ({parsedData.length})
                  </span>
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-2 space-y-1">
                    {parsedData.slice(0, 50).map((uni) => (
                      <div
                        key={uni.slug}
                        className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                      >
                        <span className="text-muted-foreground text-sm w-8">
                          #{uni.rank}
                        </span>
                        {uni.logo_url && (
                          <img
                            src={uni.logo_url}
                            alt=""
                            className="w-6 h-6 object-contain"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{uni.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {uni.country}
                            {uni.score && ` • Score: ${uni.score}`}
                          </p>
                        </div>
                        {uni.is_verified && (
                          <Badge variant="outline" className="text-xs">
                            <Check className="h-3 w-3 me-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    ))}
                    {parsedData.length > 50 && (
                      <p className="text-center text-sm text-muted-foreground py-2">
                        ... and {parsedData.length - 50} more
                      </p>
                    )}
                  </div>
                </ScrollArea>
                
                {/* Import Button */}
                <div className="p-3 border-t">
                  <Button
                    className="w-full"
                    onClick={handleManualImport}
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 me-2" />
                        Import {parsedData.length} Universities to Staging
                      </>
                    )}
                  </Button>
                </div>
              </div>
             )}
          </TabsContent>
        </Tabs>

        {/* 🎯 PUBLISH BATCH SECTION */}
        {stagingStatus?.total && stagingStatus.total > 0 && (
          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning" />
              Step 3: Publish to Main System
            </h3>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add Universities to Catalog</CardTitle>
                <CardDescription>
                  {stagingStatus.total} universities staged for import. Smart deduplication will prevent duplicates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-sm text-primary">Staged Universities</div>
                    <div className="text-2xl font-bold text-primary">{stagingStatus.total}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border border-secondary">
                    <div className="text-sm text-secondary-foreground">In System</div>
                    <div className="text-2xl font-bold text-foreground">{inSystemCount?.toLocaleString() ?? '...'}</div>
                  </div>
                </div>

                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                  <p className="text-sm text-warning-foreground">
                    ⚠️ <strong>Deduplication Active:</strong> System will skip universities already in catalog and merge ranking data. No duplicates will be created.
                  </p>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => publishBatchMutation.mutate()}
                  disabled={publishBatchMutation.isPending}
                >
                  {publishBatchMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 me-2" />
                      Publish {stagingStatus.total} Universities Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 🌟 ENRICH DETAILS SECTION */}
        {stagingStatus?.total && stagingStatus.total > 0 && (
          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Step 4: Enrich Details (Logos & Programs)
            </h3>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Fetch Programs & Logos
                </CardTitle>
                <CardDescription>
                  Scrape each university page to extract logos and academic programs with details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
                  <p className="font-medium">What this does:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Fetches university logos from UniRanks CDN</li>
                    <li>Extracts programs (Bachelor, Master, PhD)</li>
                    <li>Captures duration, tuition fees, and languages</li>
                    <li>Maps to existing degrees & disciplines</li>
                    <li>Saves as drafts for review</li>
                  </ul>
                </div>

                {/* Enrich Progress Indicator */}
                {activeEnrichJobId && (enrichJobStatus?.job || enrichJobStatus?.latest_job) && (
                  <div className="space-y-3 p-4 border rounded-lg bg-card">
                    {(() => {
                      const job = enrichJobStatus.job || enrichJobStatus.latest_job;
                      if (!job) return null;

                      const progressPercent = job.total_universities > 0 
                        ? Math.round((job.processed / job.total_universities) * 100)
                        : 0;

                      const lastActivityMs = job.last_activity_at ? new Date(job.last_activity_at).getTime() : null;
                      const isStale = lastActivityMs ? (Date.now() - lastActivityMs > 45_000) : false;

                      return (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium flex items-center gap-2">
                              {job.status === 'paused' ? (
                                <AlertCircle className="h-4 w-4 text-warning" />
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                              {job.status === 'paused' ? 'Enrichment Paused' : 'Enriching universities...'}
                            </span>
                            <span className="text-muted-foreground">
                              {job.processed} / {job.total_universities}
                            </span>
                          </div>

                          <Progress value={progressPercent} className="h-2" />

                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Enriched: {job.enriched}</span>
                            <span>Programs Found: {job.programs_found}</span>
                            <span>Saved: {job.programs_saved}</span>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Last activity: {job.last_activity_at ? new Date(job.last_activity_at).toLocaleTimeString() : '—'}
                            {isStale ? ' • Seems stalled (you can resume)' : ''}
                          </div>

                          {job.error_message && (
                            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                              {job.error_message}
                            </div>
                          )}

                          {/* Controls */}
                          {job.status === 'processing' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Button
                                variant="destructive"
                                onClick={() => activeEnrichJobId && pauseEnrichMutation.mutate(activeEnrichJobId)}
                                disabled={pauseEnrichMutation.isPending || !activeEnrichJobId}
                              >
                                {pauseEnrichMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                    Pausing...
                                  </>
                                ) : (
                                  '⏹️ Stop'
                                )}
                              </Button>

                              <Button
                                variant="outline"
                                onClick={() => activeEnrichJobId && resumeEnrichMutation.mutate(activeEnrichJobId)}
                                disabled={resumeEnrichMutation.isPending || !activeEnrichJobId || !isStale}
                                title={isStale ? 'Kick the job if it stopped updating' : 'Enabled only when stalled'}
                              >
                                {resumeEnrichMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                    Resuming...
                                  </>
                                ) : (
                                  '↻ Resume (if stalled)'
                                )}
                              </Button>
                            </div>
                          )}

                          {job.status === 'paused' && (
                            <Button 
                              onClick={() => activeEnrichJobId && resumeEnrichMutation.mutate(activeEnrichJobId)}
                              disabled={resumeEnrichMutation.isPending || !activeEnrichJobId}
                              className="w-full"
                            >
                              {resumeEnrichMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                  Resuming...
                                </>
                              ) : (
                                <>
                                  <Zap className="h-4 w-4 me-2" />
                                  Resume Enrichment
                                </>
                              )}
                            </Button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => startEnrichMutation.mutate()}
                  disabled={startEnrichMutation.isPending || !!activeEnrichJobId}
                >
                  {startEnrichMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                      Starting...
                    </>
                  ) : activeEnrichJobId ? (
                    <>
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                      Enriching in progress...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 me-2" />
                      Start Enrichment
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
