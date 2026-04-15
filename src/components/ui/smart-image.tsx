interface SmartImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  quality?: number;
  format?: "webp" | "avif";
}

export function SmartImage({
  src,
  alt,
  width = 1200,
  height = 630,
  className = "",
  quality = 80,
  format = "webp",
}: SmartImageProps) {
  // Check if it's a Supabase storage URL
  const isSupabaseUrl = src.includes("supabase.co/storage");
  
  // Build optimized URL for Supabase images
  const optimizedUrl = isSupabaseUrl
    ? `${src}?width=${width}&height=${height}&format=${format}&quality=${quality}`
    : src;

  return (
    <img
      src={optimizedUrl}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      alt={alt}
      className={className}
    />
  );
}
