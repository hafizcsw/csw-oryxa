import { forwardRef, useState, useRef } from "react";
import { Image as ImageIcon, Video, Smile, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSocialAuth } from "@/hooks/social/useSocialAuth";
import { useCreateSocialPost } from "@/hooks/social/useSocialPost";
import { initials } from "./utils";
import { useNavigate } from "react-router-dom";

const MAX = 280;

interface PostComposerProps {
  onPosted?: () => void;
}

export const PostComposer = forwardRef<HTMLDivElement, PostComposerProps>(
  ({ onPosted }, ref) => {
    const { user, isAuthed } = useSocialAuth();
    const meta: any = user?.user_metadata ?? {};
    const [text, setText] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);
    const create = useCreateSocialPost();
    const navigate = useNavigate();

    const onFiles = (list: FileList | null) => {
      if (!list) return;
      const arr = Array.from(list).slice(0, 4);
      setFiles(arr);
      setPreviews(arr.map((f) => URL.createObjectURL(f)));
    };

    const removeFile = (i: number) => {
      setFiles((x) => x.filter((_, idx) => idx !== i));
      setPreviews((x) => x.filter((_, idx) => idx !== i));
    };

    const submit = async () => {
      if (!isAuthed) return navigate("/auth");
      if (!text.trim() && files.length === 0) return;
      await create.mutateAsync({ userId: user!.id, content: text.trim(), files });
      setText("");
      setFiles([]);
      setPreviews([]);
      onPosted?.();
    };

    return (
      <div ref={ref} className="border-b border-[hsl(var(--social-border))] p-4 flex gap-3">
        <Avatar className="w-12 h-12 shrink-0">
          <AvatarImage src={meta.avatar_url} />
          <AvatarFallback>{initials(meta.full_name || user?.email || "?")}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            placeholder="ماذا يحدث؟"
            autoResize
            maxHeight={300}
            dir="auto"
            className="min-h-[60px] text-xl border-0 bg-transparent placeholder:text-[hsl(var(--social-muted))] focus-visible:ring-0 px-0 py-2 resize-none"
          />

          {previews.length > 0 && (
            <div className={`grid gap-2 mb-3 rounded-2xl overflow-hidden ${previews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {previews.map((p, i) => (
                <div key={i} className="relative">
                  {files[i].type.startsWith("video") ? (
                    <video src={p} className="w-full max-h-80 object-cover rounded-2xl" />
                  ) : (
                    <img src={p} className="w-full max-h-80 object-cover rounded-2xl" />
                  )}
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1.5 hover:bg-black"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-[hsl(var(--social-border))] pt-3">
            <div className="flex items-center gap-1 text-[hsl(var(--social-accent))]">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/*"
                hidden
                onChange={(e) => onFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="p-2 rounded-full hover:bg-[hsl(var(--social-accent))]/10"
                aria-label="إرفاق صورة"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="p-2 rounded-full hover:bg-[hsl(var(--social-accent))]/10"
                aria-label="إرفاق فيديو"
              >
                <Video className="w-5 h-5" />
              </button>
              <button type="button" className="p-2 rounded-full hover:bg-[hsl(var(--social-accent))]/10">
                <Smile className="w-5 h-5" />
              </button>
              <button type="button" className="p-2 rounded-full hover:bg-[hsl(var(--social-accent))]/10">
                <MapPin className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {text.length > 0 && (
                <span className={`text-xs ${text.length > MAX - 20 ? "text-orange-400" : "text-[hsl(var(--social-muted))]"}`}>
                  {MAX - text.length}
                </span>
              )}
              <Button
                onClick={submit}
                disabled={create.isPending || (!text.trim() && files.length === 0)}
                className="rounded-full px-6 font-bold bg-[hsl(var(--social-accent))] hover:bg-[hsl(var(--social-accent))]/90 text-white"
              >
                {create.isPending ? "جارٍ النشر..." : "نشر"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PostComposer.displayName = "PostComposer";
