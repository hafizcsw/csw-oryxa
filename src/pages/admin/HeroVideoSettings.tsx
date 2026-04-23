/**
 * HeroVideoSettings — Super-admin page to upload the hero reveal video.
 *
 * - Upload up to 200 MB (covers a 17s 2K H.264 clip comfortably).
 * - Stores files in the `hero-videos` storage bucket (public read,
 *   admin-only write enforced by RLS).
 * - Active video URL is persisted in `feature_settings.hero_reveal_video`,
 *   which the homepage HeroRevealStage reads to play the clip in the background.
 * - Access is gated through the existing CRM admin SSO flow.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { verifyAdminSSOFromURL } from "@/lib/admin.sso";
import { DSButton } from "@/components/design-system/DSButton";
import { Upload, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const FEATURE_KEY = "hero_reveal_video";
const BUCKET = "hero-videos";
const MAX_BYTES = 200 * 1024 * 1024; // 200 MB

interface HeroVideoSettingsValue {
  enabled: boolean;
  url: string | null;
  poster_url: string | null;
  updated_at: string | null;
}

export default function HeroVideoSettings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<HeroVideoSettingsValue>({
    enabled: false,
    url: null,
    poster_url: null,
    updated_at: null,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Auth gate
  useEffect(() => {
    (async () => {
      const { ok } = await verifyAdminSSOFromURL();
      if (!ok) {
        window.location.href = "/";
        return;
      }
      setAuthChecked(true);
      await load();
    })();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("feature_settings")
      .select("value")
      .eq("key", FEATURE_KEY)
      .maybeSingle();
    if (error) {
      toast({
        title: "Error loading settings",
        description: error.message,
        variant: "destructive",
      });
    } else if (data?.value) {
      setSettings({
        enabled: !!(data.value as any).enabled,
        url: (data.value as any).url ?? null,
        poster_url: (data.value as any).poster_url ?? null,
        updated_at: (data.value as any).updated_at ?? null,
      });
    }
    setLoading(false);
  }

  async function persist(next: HeroVideoSettingsValue) {
    const { error } = await supabase
      .from("feature_settings")
      .upsert(
        { key: FEATURE_KEY, value: { ...next, updated_at: new Date().toISOString() } },
        { onConflict: "key" }
      );
    if (error) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
    setSettings({ ...next, updated_at: new Date().toISOString() });
    return true;
  }

  async function handleUpload(file: File) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({
        title: "Unsupported file",
        description: "Please upload an MP4, WebM or MOV video file.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: "File too large",
        description: `Max ${Math.round(MAX_BYTES / 1024 / 1024)} MB. Re-encode at 2K H.264 to fit.`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const ext = file.name.split(".").pop() || "mp4";
    const path = `hero-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "604800",
        upsert: false,
        contentType: file.type,
      });

    if (uploadErr) {
      setUploading(false);
      toast({
        title: "Upload failed",
        description: uploadErr.message,
        variant: "destructive",
      });
      return;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = pub?.publicUrl ?? null;

    const ok = await persist({
      enabled: true,
      url,
      poster_url: settings.poster_url,
      updated_at: new Date().toISOString(),
    });

    setUploading(false);
    setUploadProgress(0);
    if (ok) {
      toast({ title: "Hero video uploaded and activated" });
    }
  }

  async function toggleEnabled(value: boolean) {
    await persist({ ...settings, enabled: value });
  }

  async function clearVideo() {
    if (!confirm("Remove the active hero video?")) return;
    await persist({ enabled: false, url: null, poster_url: null, updated_at: null });
    toast({ title: "Hero video cleared" });
  }

  if (!authChecked || loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Hero Reveal Video</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload the cinematic background that plays inside the homepage hero
          sticky reveal stage. Recommended: H.264 MP4, up to 2K (2560×1440), 17s,
          under 200 MB.
        </p>
      </header>

      {/* Active video preview */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Active video</h2>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
              settings.enabled && settings.url
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {settings.enabled && settings.url ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> Live
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" /> Inactive
              </>
            )}
          </span>
        </div>

        {settings.url ? (
          <video
            src={settings.url}
            controls
            playsInline
            muted
            className="w-full rounded-lg border border-border bg-black aspect-video"
          />
        ) : (
          <div className="aspect-video rounded-lg border border-dashed border-border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
            No video uploaded yet
          </div>
        )}

        {settings.url && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => toggleEnabled(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-foreground">Show on homepage</span>
            </label>
            <DSButton
              variant="ghost"
              onClick={clearVideo}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Remove
            </DSButton>
          </div>
        )}

        {settings.updated_at && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(settings.updated_at).toLocaleString()}
          </p>
        )}
      </section>

      {/* Upload */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Upload new video</h2>
        <p className="text-xs text-muted-foreground">
          Accepted: MP4, WebM, MOV. Max 200 MB. Uploading replaces the active
          video immediately.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }}
          aria-label="Hero video file"
        />

        <DSButton
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading{uploadProgress ? ` ${uploadProgress}%` : "..."}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload video (up to 2K)
            </>
          )}
        </DSButton>
      </section>
    </div>
  );
}
