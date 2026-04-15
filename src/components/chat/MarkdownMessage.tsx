import React from "react";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Sparkles, 
  FileCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  Target,
  Calendar,
  User
} from "lucide-react";

// ==========================================
// Status Card Component - بطاقة حالة الملف
// ==========================================

interface FileStatusData {
  title?: string;
  name?: string;
  stage?: string;
  progress?: number;
  docsCount?: number;
  deadline?: string;
  isUrgent?: boolean;
}

/**
 * Parses a block of text to extract file status information
 */
function parseFileStatusBlock(lines: string[]): FileStatusData | null {
  const data: FileStatusData = {};
  let hasData = false;

  for (const line of lines) {
    // Title: 📊 حالة ملفك يا [name]
    const titleMatch = line.match(/📊\s*حالة ملفك(?:\s+يا\s+)?(.+)?[:\s]*/);
    if (titleMatch) {
      data.title = 'حالة ملفك';
      data.name = titleMatch[1]?.trim();
      hasData = true;
      continue;
    }

    // Stage: 📍 المرحلة: ready_to_submit
    const stageMatch = line.match(/📍\s*المرحلة[:\s]+(\S+)/);
    if (stageMatch) {
      data.stage = stageMatch[1];
      hasData = true;
      continue;
    }

    // Progress: 📈 التقدم: [███████░░░] 70%
    const progressMatch = line.match(/📈\s*التقدم[:\s]*(?:\[.+\])?\s*(\d+)%?/);
    if (progressMatch) {
      data.progress = parseInt(progressMatch[1], 10);
      hasData = true;
      continue;
    }

    // Docs count: ⏳ 44 مستند قيد المراجعة
    const docsMatch = line.match(/⏳\s*(\d+)\s*مستند/);
    if (docsMatch) {
      data.docsCount = parseInt(docsMatch[1], 10);
      hasData = true;
      continue;
    }

    // Deadline: 🚨 الموعد النهائي اليوم!
    const deadlineMatch = line.match(/🚨\s*الموعد النهائي\s*(.+?)!?$/);
    if (deadlineMatch) {
      data.deadline = deadlineMatch[1].trim();
      data.isUrgent = true;
      hasData = true;
      continue;
    }
  }

  return hasData ? data : null;
}

/**
 * Get stage display info
 */
function getStageInfo(stage: string): { label: string; color: string; icon: React.ReactNode } {
  const stageMap: Record<string, { label: string; color: string }> = {
    'new_inquiry': { label: 'استفسار جديد', color: 'text-blue-500' },
    'docs_pending': { label: 'بانتظار المستندات', color: 'text-amber-500' },
    'docs_review': { label: 'مراجعة المستندات', color: 'text-purple-500' },
    'ready_to_submit': { label: 'جاهز للتقديم', color: 'text-primary' },
    'submitted': { label: 'تم التقديم', color: 'text-cyan-500' },
    'accepted': { label: 'مقبول', color: 'text-accent' },
    'enrolled': { label: 'مسجل', color: 'text-accent' },
  };

  const info = stageMap[stage] || { label: stage, color: 'text-muted-foreground' };
  return {
    ...info,
    icon: <Target className={`w-4 h-4 ${info.color}`} />
  };
}

/**
 * Beautiful Status Card Component
 */
function FileStatusCard({ data }: { data: FileStatusData }) {
  const stageInfo = data.stage ? getStageInfo(data.stage) : null;
  const progress = data.progress ?? 0;
  const isComplete = progress >= 100;
  const isHigh = progress >= 70;

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/20">
            <FileCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">📊 {data.title || 'حالة ملفك'}</h3>
            {data.name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                {data.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Stage */}
        {stageInfo && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {stageInfo.icon}
              <span>المرحلة</span>
            </div>
            <span className={`font-semibold text-sm ${stageInfo.color}`}>
              {stageInfo.label}
            </span>
          </div>
        )}

        {/* Progress */}
        {data.progress !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isComplete ? (
                  <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-primary" />
                )}
                <span>التقدم</span>
              </div>
              <span className={`font-bold text-lg ${
                isComplete ? 'text-accent' : isHigh ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {progress}%
              </span>
            </div>
            <div className="relative">
              <Progress 
                value={progress} 
                className={`h-3 ${
                  isComplete ? '[&>div]:bg-accent' : 
                  isHigh ? '[&>div]:bg-primary' : 
                  '[&>div]:bg-muted-foreground'
                }`}
              />
              <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/10 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>
        )}

        {/* Docs Count */}
        {data.docsCount !== undefined && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-secondary-foreground" />
              <span>قيد المراجعة</span>
            </div>
            <span className="font-semibold text-secondary-foreground">
              {data.docsCount} مستند
            </span>
          </div>
        )}

        {/* Deadline */}
        {data.deadline && (
          <div className={`flex items-center justify-between p-3 rounded-xl ${
            data.isUrgent ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/50'
          }`}>
            <div className="flex items-center gap-2 text-sm">
              {data.isUrgent ? (
                <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
              ) : (
                <Calendar className="w-4 h-4 text-muted-foreground" />
              )}
              <span className={data.isUrgent ? 'text-destructive' : 'text-muted-foreground'}>
                الموعد النهائي
              </span>
            </div>
            <span className={`font-semibold ${data.isUrgent ? 'text-destructive' : 'text-foreground'}`}>
              {data.deadline}!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Simple Progress Bar (for inline progress)
// ==========================================

function ProgressBar({ value, label }: { value: number; label?: string }) {
  const isComplete = value >= 100;
  const isHigh = value >= 70;
  const isMedium = value >= 40;
  
  const getColorClass = () => {
    if (isComplete) return 'text-accent';
    if (isHigh) return 'text-primary';
    if (isMedium) return 'text-secondary-foreground';
    return 'text-muted-foreground';
  };

  const getProgressClass = () => {
    if (isComplete) return '[&>div]:bg-accent';
    if (isHigh) return '[&>div]:bg-primary';
    if (isMedium) return '[&>div]:bg-secondary';
    return '[&>div]:bg-muted';
  };
  
  return (
    <div className="my-3 p-3 rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <Sparkles className="w-4 h-4 text-accent animate-pulse" />
          ) : (
            <TrendingUp className="w-4 h-4 text-primary" />
          )}
          <span className="text-sm font-medium text-foreground/80">
            {label || 'التقدم'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-lg font-bold ${getColorClass()}`}>
            {value}%
          </span>
        </div>
      </div>
      
      <div className="relative">
        <Progress 
          value={value} 
          className={`h-3 ${getProgressClass()}`}
        />
        <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/10 to-transparent animate-shimmer" />
        </div>
      </div>
      
      <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/60">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

/**
 * Detects progress patterns in text
 */
function parseProgressLine(line: string): { value: number; label?: string } | null {
  // Skip if it's part of a status block (has 📈)
  if (line.includes('📈')) return null;
  
  const arabicPattern = /[%📊]\s*التقدم[:\s]*(\d+)/;
  const englishPattern = /Progress[:\s]*(\d+)%?/i;
  
  let match = line.match(arabicPattern);
  if (match) {
    return { value: parseInt(match[1], 10), label: 'التقدم' };
  }
  
  match = line.match(englishPattern);
  if (match) {
    return { value: parseInt(match[1], 10), label: 'Progress' };
  }
  
  return null;
}

function Inline({ text }: { text: string }) {
  // Split by **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        // Bold
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }

        // Split by `code`
        const pieces = part.split(/(`[^`]+`)/g);

        return (
          <React.Fragment key={i}>
            {pieces.map((p, j) => {
              if (p.startsWith("`") && p.endsWith("`")) {
                return (
                  <code
                    key={`${i}-${j}`}
                    className="rounded bg-muted px-1 py-0.5 text-xs"
                  >
                    {p.slice(1, -1)}
                  </code>
                );
              }
              return <React.Fragment key={`${i}-${j}`}>{p}</React.Fragment>;
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  const lines = (content || "").split("\n");
  const out: React.ReactNode[] = [];

  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;

    if (list.type === "ul") {
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 mr-5 list-disc space-y-1.5 text-[15px]">
          {list.items.map((it, i) => (
            <li key={i} className="leading-7 text-foreground">
              <Inline text={it} />
            </li>
          ))}
        </ul>
      );
    } else {
      out.push(
        <ol key={`ol-${out.length}`} className="my-2 mr-5 list-decimal space-y-1.5 text-[15px]">
          {list.items.map((it, i) => (
            <li key={i} className="leading-7 text-foreground">
              <Inline text={it} />
            </li>
          ))}
        </ol>
      );
    }

    list = null;
  };

  // ✅ First pass: Check if this is a File Status Block (📊 حالة ملفك)
  const hasStatusBlock = lines.some(l => l.includes('📊') && l.includes('حالة ملفك'));
  
  if (hasStatusBlock) {
    const statusData = parseFileStatusBlock(lines);
    if (statusData) {
      return (
        <div className="space-y-2">
          <FileStatusCard data={statusData} />
        </div>
      );
    }
  }

  // Normal parsing
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for progress bar pattern
    const progressData = parseProgressLine(line);
    if (progressData) {
      flush();
      out.push(
        <ProgressBar 
          key={`progress-${i}`} 
          value={progressData.value} 
          label={progressData.label}
        />
      );
      continue;
    }

    if (line.startsWith("### ")) {
      flush();
      out.push(
        <h3 key={`h3-${i}`} className="mt-4 mb-1 text-[15px] font-semibold text-foreground">
          <Inline text={line.slice(4)} />
        </h3>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flush();
      out.push(
        <h2 key={`h2-${i}`} className="mt-5 mb-1.5 text-base font-bold text-foreground">
          <Inline text={line.slice(3)} />
        </h2>
      );
      continue;
    }

    if (line.startsWith("# ")) {
      flush();
      out.push(
        <h1 key={`h1-${i}`} className="mt-5 mb-2 text-lg font-bold text-foreground">
          <Inline text={line.slice(2)} />
        </h1>
      );
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      if (!list || list.type !== "ul") flush();
      list = list ?? { type: "ul", items: [] };
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      if (!list || list.type !== "ol") flush();
      list = list ?? { type: "ol", items: [] };
      list.items.push(numbered[1]);
      continue;
    }

    if (line.trim() === "") {
      flush();
      out.push(<div key={`sp-${i}`} className="h-3" />);
      continue;
    }

    flush();
    out.push(
      <p key={`p-${i}`} className="leading-7 text-foreground">
        <Inline text={line} />
      </p>
    );
  }

  flush();
  return <div className="space-y-2">{out}</div>;
}
