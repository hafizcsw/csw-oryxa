import { useEffect, useRef, useState } from "react";
import { DSButton } from "@/components/design-system/DSButton";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Mic, MicOff, Send, X, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { sendChatMessage } from "@/lib/chat/gateway";
import { getSessionIdentifiers } from "@/lib/chat/session";
import { buildUiContextV1 } from "@/lib/uiContext";
import { useLocation, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

type Filters = {
  q?: string;
  country?: string;
  degree?: string;
  certificate?: string;
  subject?: string;
  language?: string;
  fees_max?: number;
  living_max?: number;
};

type Props = {
  initial: Filters;
  onUpdates: (u: Partial<Filters>) => void;
  onLead?: (phone: string) => void;
};

export default function AssistantPanel({ initial, onUpdates, onLead }: Props) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    { role: 'assistant', text: 'مرحباً! 👋 أنا ملاك، مساعدك الذكي. قل لي: ما هي وجهة أحلامك؟' }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // 🔥 Malak Bot Integration
  const [userName, setUserName] = useState<string | undefined>();
  const [userPhone, setUserPhone] = useState<string | undefined>();
  const visitorIdRef = useRef<string>("");
  
  // React Router hooks for UI context
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();

  useEffect(() => {
    const v = localStorage.getItem("malak_visitor_id") || crypto.randomUUID();
    localStorage.setItem("malak_visitor_id", v);
    visitorIdRef.current = v;
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    setChat(s => [...s, { role: 'user', text }]);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let name = userName;
      let phone = userPhone;

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          name = profile.full_name || name;
          phone = profile.phone || phone;
        }
      }

      // ✅ ORDER #1: Use Gateway for all CRM calls
      const sessionIds = getSessionIdentifiers();
      const ui_context = buildUiContextV1({
        pathname: location.pathname,
        tab: searchParams.get('tab'),
        lang: language,
      });

      const response = await sendChatMessage({
        text,
        visitor_id: visitorIdRef.current,
        session_id: sessionIds.session_id,
        web_user_id: user?.id,
        name,
        phone,
        locale: 'ar',
        ui_context,
      });

      if (!response.ok) {
        console.error('[AssistantPanel] Gateway error:', response.error);
        throw new Error(response.error || 'فشل الاتصال بالمساعد');
      }

      const data = response.data;
      setChat(s => [...s, { role: 'assistant', text: data.reply }]);

      if (data.need_name && text.trim() && !userName) {
        setUserName(text.trim());
      }
      if (data.need_phone && text.trim() && !userPhone) {
        setUserPhone(text.trim());
        if (onLead) onLead(text.trim());
      }

    } catch (err) {
      console.error('[AssistantPanel] Error:', err);
      setChat(s => [...s, { 
        role: 'assistant', 
        text: 'عذراً، حدث خطأ مؤقت. الرجاء المحاولة مرة أخرى.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);

  const startVoice = () => {
    try {
      // @ts-ignore
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        alert("الميكروفون غير مدعوم في هذا المتصفح");
        return;
      }
      const r = new SR();
      r.lang = "ar-SA";
      r.interimResults = false;
      r.onresult = (e: any) => {
        const text = e.results[0][0].transcript || "";
        send(text);
      };
      r.onend = () => setListening(false);
      recRef.current = r;
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stopVoice = () => {
    try {
      recRef.current?.stop();
    } catch { }
    setListening(false);
  };

  return (
    <>
      <div className="flex justify-center">
        <button
          onClick={() => setOpen(true)}
          className="group relative flex items-center gap-3 px-8 py-5 rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-white font-semibold text-lg shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all duration-300"
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
          <span>تحدّث مع ملاك 🤖</span>
          <Sparkles className="w-5 h-5 animate-pulse" />
        </button>
      </div>

      {open && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" 
          onClick={() => setOpen(false)}
        >
          <Card
            className="w-full max-w-2xl max-h-[600px] flex flex-col shadow-2xl animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-primary/10 to-accent/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-lg">AI Assistant</div>
                  <div className="text-sm text-muted-foreground">مساعدك الذكي للدراسة بالخارج</div>
                </div>
              </div>
              <button 
                className="w-10 h-10 rounded-full hover:bg-muted transition-colors flex items-center justify-center" 
                onClick={() => setOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-auto p-6 space-y-4 bg-muted/30">
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div
                    className={`max-w-[80%] px-5 py-3 rounded-2xl shadow-sm ${
                      m.role === 'assistant'
                        ? 'bg-card border border-border text-foreground rounded-tl-none'
                        : 'bg-gradient-to-br from-primary to-primary-glow text-white rounded-tr-none'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{m.text}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start animate-fade-in">
                  <div className="bg-card border border-border px-5 py-3 rounded-2xl rounded-tl-none">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t bg-card">
              <div className="flex gap-3">
                <input
                  className="flex-1 rounded-xl border-2 border-input px-4 py-3 text-sm bg-background focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all outline-none"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="اكتب رسالتك هنا…"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  disabled={isLoading}
                />
                <button
                  onClick={() => send(input)}
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 rounded-xl bg-gradient-to-br from-primary to-primary-glow text-white font-semibold hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <Send className="w-5 h-5" />
                </button>
                {!listening ? (
                  <button
                    onClick={startVoice}
                    disabled={isLoading}
                    className="px-6 py-3 rounded-xl border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all duration-300 disabled:opacity-50"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={stopVoice}
                    className="px-6 py-3 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all animate-pulse"
                  >
                    <MicOff className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                💡 المساعد الذكي يساعدك في إيجاد البرنامج المثالي بناءً على تفضيلاتك
              </p>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
