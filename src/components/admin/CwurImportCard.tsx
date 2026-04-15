import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Pause, Play, CheckCircle2, XCircle } from "lucide-react";

interface ImportStats {
  total_parsed: number;
  batch_start: number;
  batch_end: number;
  inserted: number;
  updated: number;
  errors: number;
}

export function CwurImportCard() {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentRank, setCurrentRank] = useState(1);
  const [totalParsed, setTotalParsed] = useState(2000);
  const [stats, setStats] = useState({ inserted: 0, updated: 0, errors: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);
  const pauseRef = useRef(false);
  const { toast } = useToast();

  const progress = totalParsed > 0 ? Math.round((currentRank / totalParsed) * 100) : 0;

  async function runImport() {
    setIsRunning(true);
    setIsPaused(false);
    setIsDone(false);
    pauseRef.current = false;
    
    let startRank = 1;
    const batchSize = 100;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const allLogs: string[] = [];
    const allErrors: string[] = [];

    try {
      while (true) {
        // Check if paused
        if (pauseRef.current) {
          setIsPaused(true);
          toast({
            title: "تم الإيقاف المؤقت",
            description: `توقف عند الترتيب ${startRank}. اضغط استمرار للمتابعة.`
          });
          return;
        }

        const { data, error } = await supabase.functions.invoke("admin-cwur-import", {
          body: { startRank, batchSize, forceUpdate: true }
        });

        if (error) {
          allErrors.push(`Batch error at ${startRank}: ${error.message}`);
          totalErrors++;
          // Continue to next batch
          startRank += batchSize;
          if (startRank > 2000) break;
          continue;
        }

        if (data.stats) {
          totalInserted += data.stats.inserted || 0;
          totalUpdated += data.stats.updated || 0;
          totalErrors += data.stats.errors || 0;
          setTotalParsed(data.stats.total_parsed || 2000);
        }

        if (data.logs) {
          allLogs.push(...data.logs);
        }

        if (data.errors) {
          allErrors.push(...data.errors);
        }

        setCurrentRank(data.nextStartRank || startRank + batchSize);
        setStats({ inserted: totalInserted, updated: totalUpdated, errors: totalErrors });
        setLogs(allLogs.slice(-10));
        setErrors(allErrors.slice(-10));

        if (data.done) {
          setIsDone(true);
          toast({
            title: "✅ اكتمل الاستيراد!",
            description: `تم تحديث ${totalUpdated} جامعة، إضافة ${totalInserted} جديدة، أخطاء: ${totalErrors}`
          });
          break;
        }

        startRank = data.nextStartRank;
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast({
        title: "خطأ في الاستيراد",
        description: errMsg,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  }

  function pauseImport() {
    pauseRef.current = true;
  }

  function resumeImport() {
    setIsPaused(false);
    pauseRef.current = false;
    // Resume from current rank
    runImportFrom(currentRank);
  }

  async function runImportFrom(startRank: number) {
    setIsRunning(true);
    setIsPaused(false);
    
    const batchSize = 100;
    let currentStart = startRank;
    let totalInserted = stats.inserted;
    let totalUpdated = stats.updated;
    let totalErrors = stats.errors;
    const allLogs: string[] = [...logs];
    const allErrors: string[] = [...errors];

    try {
      while (true) {
        if (pauseRef.current) {
          setIsPaused(true);
          toast({
            title: "تم الإيقاف المؤقت",
            description: `توقف عند الترتيب ${currentStart}`
          });
          return;
        }

        const { data, error } = await supabase.functions.invoke("admin-cwur-import", {
          body: { startRank: currentStart, batchSize, forceUpdate: true }
        });

        if (error) {
          allErrors.push(`Batch error at ${currentStart}: ${error.message}`);
          totalErrors++;
          currentStart += batchSize;
          if (currentStart > 2000) break;
          continue;
        }

        if (data.stats) {
          totalInserted += data.stats.inserted || 0;
          totalUpdated += data.stats.updated || 0;
          totalErrors += data.stats.errors || 0;
        }

        if (data.logs) {
          allLogs.push(...data.logs);
        }

        if (data.errors) {
          allErrors.push(...data.errors);
        }

        setCurrentRank(data.nextStartRank || currentStart + batchSize);
        setStats({ inserted: totalInserted, updated: totalUpdated, errors: totalErrors });
        setLogs(allLogs.slice(-10));
        setErrors(allErrors.slice(-10));

        if (data.done) {
          setIsDone(true);
          toast({
            title: "✅ اكتمل الاستيراد!",
            description: `تم تحديث ${totalUpdated} جامعة، إضافة ${totalInserted} جديدة`
          });
          break;
        }

        currentStart = data.nextStartRank;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast({
        title: "خطأ",
        description: errMsg,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  }

  function reset() {
    setCurrentRank(1);
    setStats({ inserted: 0, updated: 0, errors: 0 });
    setLogs([]);
    setErrors([]);
    setIsDone(false);
    setIsRunning(false);
    setIsPaused(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          استيراد CWUR 2025
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>التقدم: {currentRank} / {totalParsed}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
            <div className="text-xs text-green-600 dark:text-green-400">تم التحديث</div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">{stats.updated}</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-xs text-blue-600 dark:text-blue-400">إضافة جديدة</div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.inserted}</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg border border-red-200 dark:border-red-800">
            <div className="text-xs text-red-600 dark:text-red-400">أخطاء</div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300">{stats.errors}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isRunning && !isPaused && !isDone && (
            <Button onClick={runImport} className="flex-1">
              <Play className="h-4 w-4 me-2" />
              بدء الاستيراد
            </Button>
          )}
          
          {isRunning && !isPaused && (
            <Button onClick={pauseImport} variant="secondary" className="flex-1">
              <Pause className="h-4 w-4 me-2" />
              إيقاف مؤقت
            </Button>
          )}
          
          {isPaused && (
            <Button onClick={resumeImport} className="flex-1">
              <Play className="h-4 w-4 me-2" />
              استمرار
            </Button>
          )}
          
          {isDone && (
            <Button onClick={reset} variant="outline" className="flex-1">
              <RefreshCw className="h-4 w-4 me-2" />
              إعادة
            </Button>
          )}
        </div>

        {/* Status Indicator */}
        {isDone && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 p-3 rounded-lg">
            <CheckCircle2 className="h-5 w-5" />
            <span>تم استيراد جميع بيانات CWUR 2025 بنجاح!</span>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">السجلات الأخيرة:</div>
            <div className="bg-muted p-3 rounded-lg max-h-32 overflow-auto text-xs font-mono space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-muted-foreground">{log}</div>
              ))}
            </div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-2 text-red-600 flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              الأخطاء:
            </div>
            <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg max-h-32 overflow-auto text-xs space-y-1">
              {errors.map((err, i) => (
                <div key={i} className="text-red-600 dark:text-red-400">{err}</div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
