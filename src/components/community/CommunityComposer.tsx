import { useState, useRef } from "react";
import { Image as ImageIcon, X, Send, Smile, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CommunityComposerProps {
  userId: string | null;
  userName: string;
  isAr: boolean;
  onPosted: () => void;
}

const EMOJIS = ["😀","😂","😍","🥰","😎","🤔","👍","🎉","❤️","🔥","💯","🙏","✨","🌟","📚","🎓"];

export function CommunityComposer({ userId, userName, isAr, onPosted }: CommunityComposerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = () => fileRef.current?.click();
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error(isAr ? "الحد الأقصى 5MB" : "Max 5MB");
      return;
    }
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const reset = () => {
    setText(""); setImageFile(null); setPreview(null); setShowEmoji(false); setOpen(false);
  };

  const submit = async () => {
    if (!userId || (!text.trim() && !imageFile)) return;
    setPosting(true);
    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("community-media").upload(path, imageFile);
      if (upErr) {
        toast.error(isAr ? "فشل رفع الصورة" : "Image upload failed");
        setPosting(false);
        return;
      }
      const { data: pub } = supabase.storage.from("community-media").getPublicUrl(path);
      imageUrl = pub.publicUrl;
    }
    const { error } = await supabase.from("community_posts").insert({
      author_type: "student",
      author_user_id: userId,
      content: text.trim(),
      image_url: imageUrl,
    });
    if (error) toast.error(isAr ? "حدث خطأ" : "Something went wrong");
    else { toast.success(isAr ? "تم النشر!" : "Posted!"); reset(); onPosted(); }
    setPosting(false);
  };

  if (!userId) {
    return (
      <div className="rounded-2xl bg-card border border-border p-4 text-center text-sm text-muted-foreground shadow-sm">
        {isAr ? "سجّل دخولك للنشر في المجتمع" : "Sign in to post in the community"}
      </div>
    );
  }

  return (
    <motion.div layout className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
          {userName.charAt(0).toUpperCase()}
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex-1 text-start px-4 py-2.5 rounded-full bg-muted/60 hover:bg-muted text-sm text-muted-foreground transition-colors"
        >
          {isAr ? `بمَ تفكّر يا ${userName.split(" ")[0]}؟` : `What's on your mind, ${userName.split(" ")[0]}?`}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-4 space-y-3">
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={isAr ? "اكتب منشورك..." : "Write your post..."}
                className="min-h-[110px] resize-none border-0 p-0 focus-visible:ring-0 text-base bg-transparent"
                autoFocus
              />

              {preview && (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={preview} alt="" className="w-full max-h-80 object-cover" />
                  <button
                    onClick={() => { setImageFile(null); setPreview(null); }}
                    className="absolute top-2 end-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <AnimatePresence>
                {showEmoji && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-muted/60 border border-border"
                  >
                    {EMOJIS.map(e => (
                      <button
                        key={e}
                        onClick={() => setText(prev => prev + e)}
                        className="text-xl hover:scale-125 transition-transform p-1"
                      >
                        {e}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between rounded-xl border border-border p-2">
                <span className="text-xs font-medium text-muted-foreground px-2">
                  {isAr ? "أضف إلى منشورك" : "Add to your post"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={pickImage}
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                    title={isAr ? "صورة" : "Image"}
                  >
                    <ImageIcon className="w-5 h-5 text-emerald-500" />
                  </button>
                  <button
                    onClick={() => setShowEmoji(s => !s)}
                    className={cn("p-2 rounded-full hover:bg-muted transition-colors", showEmoji && "bg-muted")}
                    title={isAr ? "رموز تعبيرية" : "Emoji"}
                  >
                    <Smile className="w-5 h-5 text-amber-500" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={reset} className="flex-1">
                  {isAr ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  onClick={submit}
                  disabled={posting || (!text.trim() && !imageFile)}
                  className="flex-1 gap-2"
                >
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isAr ? "نشر" : "Post"}
                </Button>
              </div>

              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
