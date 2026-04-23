import { supabase } from "@/integrations/supabase/client";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 2048;

const isHttpUrl = (value: string) => value.startsWith("http://") || value.startsWith("https://");

// Legacy Supabase project hosts whose /storage/ URLs must be rewritten to the
// current project. Old rows still carry full URLs from these deprecated projects.
// NOTE: hlrkyoxwbjsgqbncgzpi (CRM) is the active avatar storage source — DO NOT rewrite it.
const LEGACY_STORAGE_HOST_PATTERN = /^https?:\/\/(csw-world|csw-oryxa)\.supabase\.co\/storage\/v1\/object\/public\/avatars\//i;

function rewriteLegacyAvatarUrl(value: string): string {
  // Match legacy host and extract the storage path after /avatars/
  const match = value.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/i);
  if (!match) return value;
  if (!LEGACY_STORAGE_HOST_PATTERN.test(value)) return value;
  const storagePath = match[1].split("?")[0];
  const { data } = supabase.storage.from("avatars").getPublicUrl(storagePath);
  return data?.publicUrl || value;
}

export function buildAvatarDisplayUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (isHttpUrl(value)) {
    // Rewrite legacy project URLs to current project's storage
    return rewriteLegacyAvatarUrl(value);
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(value);
  return data?.publicUrl || undefined;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("avatar_image_decode_failed"));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg", quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("avatar_image_encode_failed"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function drawScaledImage(img: HTMLImageElement, scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.floor(img.width * scale));
  const height = Math.max(1, Math.floor(img.height * scale));

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("avatar_canvas_context_failed");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  return canvas;
}

function buildOptimizedFile(blob: Blob, originalName: string, type: "image/webp" | "image/jpeg"): File {
  const ext = type === "image/webp" ? "webp" : "jpg";
  const base = originalName.replace(/\.[^/.]+$/, "") || "avatar";
  return new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() });
}

export async function optimizeAvatarForUpload(file: File, maxBytes: number = MAX_AVATAR_BYTES): Promise<File> {
  if (file.size <= maxBytes) return file;

  const img = await loadImage(file);
  const initialScale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(img.width, img.height));
  const mimeTypes: Array<"image/webp" | "image/jpeg"> = ["image/webp", "image/jpeg"];
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34];

  let scale = initialScale;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const canvas = drawScaledImage(img, scale);

    for (const mimeType of mimeTypes) {
      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, mimeType, quality);
        if (blob.size <= maxBytes) {
          return buildOptimizedFile(blob, file.name, mimeType);
        }
      }
    }

    scale *= 0.85;
  }

  throw new Error("avatar_too_large_after_optimization");
}
