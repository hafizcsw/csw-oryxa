import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, RotateCcw, UserPlus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { buildCrmHeaders } from '@/lib/crmHeaders';
import { getSessionIdentifiers } from '@/lib/chat/session';
import { resolveGatewayAuthorization } from '@/lib/chat/gateway';
import { buildEnvelopeV12 } from '@/lib/chat/envelopeV12';

interface Props {
  programs: any[];
  isAuthenticated: boolean;
}

export function AICompareAnalysis({ programs, isAuthenticated }: Props) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const runAnalysis = useCallback(async () => {
    if (!isAuthenticated) return;

    setAnalysis('');
    setLoading(true);
    setDone(false);

    try {
      // Build comparison message for the CRM bot
      const programSummary = programs.map((p: any, i: number) => {
        const parts = [`${i + 1}. ${p.program_name || 'برنامج'}`];
        if (p.university_name) parts.push(`الجامعة: ${p.university_name}`);
        if (p.city) parts.push(`المدينة: ${p.city}`);
        if (p.country_name) parts.push(`الدولة: ${p.country_name}`);
        if (p.fees_yearly) parts.push(`الرسوم: $${p.fees_yearly}/سنة`);
        if (p.duration_months) parts.push(`المدة: ${Math.round(p.duration_months / 12 * 10) / 10} سنة`);
        if (p.monthly_living_usd) parts.push(`المعيشة: $${p.monthly_living_usd}/شهر`);
        if (p.degree_name) parts.push(`الدرجة: ${p.degree_name}`);
        return parts.join(' | ');
      }).join('\n');

      const message = `قارن لي هذه البرامج وأخبرني أيهم الأفضل من حيث السعر والمستقبل الوظيفي وجودة التعليم، وقدم لي نصيحتك:\n\n${programSummary}`;

      const { data: { session } } = await supabase.auth.getSession();
      const ids = getSessionIdentifiers(true);
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const traceId = crypto.randomUUID().substring(0, 8);

      const body = buildEnvelopeV12({
        envelope_type: 'chat_message',
        payload: { message, text: message },
        session_id: ids.session_id,
        session_type: 'authenticated',
        locale: 'ar',
        output_locale: 'ar',
        trace_id: traceId,
        retry_key: `compare:${ids.session_id}:${Date.now()}`,
        customer_id: ids.customer_id || undefined,
      });

      const authorization = resolveGatewayAuthorization('authenticated', session?.access_token, SUPABASE_KEY);
      const headers: Record<string, string> = {
        ...buildCrmHeaders({ traceId }),
      };
      if (authorization) {
        headers.Authorization = authorization;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/portal-chat-proxy-stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      if (!response.body) throw new Error('لا يوجد بيانات من الخادم');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            // CRM streaming sends delta text
            const delta = parsed.delta || parsed.text || '';
            if (delta) {
              accumulated += delta;
              setAnalysis(accumulated);
            }
            // Also check for reply field (final response)
            if (parsed.reply && !accumulated) {
              accumulated = parsed.reply;
              setAnalysis(accumulated);
            }
          } catch {
            continue;
          }
        }
      }

      setDone(true);
    } catch (err: any) {
      console.error('AI compare analysis error:', err);
      toast({
        title: 'خطأ في التحليل',
        description: err.message || 'حدث خطأ أثناء التحليل',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [programs, isAuthenticated, toast]);

  // Not authenticated - show create account prompt
  if (!isAuthenticated) {
    return (
      <div className="flex justify-center py-8">
        <Card className="max-w-md text-center p-6 border-primary/20">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-bold text-lg mb-2">تحليل ذكي بالذكاء الاصطناعي</h3>
          <p className="text-muted-foreground text-sm mb-4">
            أنشئ حساباً لاستخدام المميزات المتقدمة مثل التحليل الذكي ومقارنة البرامج بالذكاء الاصطناعي
          </p>
          <Button onClick={() => navigate('/auth')} className="gap-2">
            <UserPlus className="w-4 h-4" />
            إنشاء حساب
          </Button>
        </Card>
      </div>
    );
  }

  if (!analysis && !loading) {
    return (
      <div className="flex justify-center py-8">
        <Button
          size="lg"
          onClick={runAnalysis}
          className="gap-3 text-base px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
          disabled={programs.length < 2}
        >
          <Sparkles className="w-5 h-5" />
          تحليل بالذكاء الاصطناعي - أيهم الأفضل؟
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 shadow-lg overflow-hidden">
      <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent px-6 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg">تحليل الذكاء الاصطناعي</h3>
            <p className="text-sm text-muted-foreground">مقارنة وتوصية ذكية لبرامجك المفضلة</p>
          </div>
        </div>
        {done && (
          <Button variant="ghost" size="sm" onClick={runAnalysis} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            إعادة التحليل
          </Button>
        )}
      </div>
      <CardContent className="p-6">
        {loading && !analysis && (
          <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>جاري تحليل البرامج...</span>
          </div>
        )}
        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground" dir="rtl">
          <ReactMarkdown>{analysis}</ReactMarkdown>
        </div>
        {loading && analysis && (
          <div className="flex items-center gap-2 text-primary mt-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">جاري الكتابة...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
