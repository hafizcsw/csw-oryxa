import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Loader2, X } from "lucide-react";

type PhotosGalleryProps = {
  universityId: string;
};

type Photo = {
  id: string;
  media_type: string;
  file_path: string;
  display_order: number;
  alt_text: string | null;
  created_at: string;
};

export default function PhotosGallery({ universityId }: PhotosGalleryProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadPhotos();
  }, [universityId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const loadPhotos = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("university_media")
      .select("*")
      .eq("university_id", universityId)
      .eq("media_type", "image")
      .order("display_order");

    if (!error && data) {
      setPhotos(data);
    }
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 9MB)
    if (file.size > 9 * 1024 * 1024) {
      toast({
        title: t("admin.photos.error"),
        description: t("admin.photos.fileSizeError"),
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: t("admin.photos.error"),
        description: t("admin.photos.fileTypeError"),
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${universityId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("universities")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("universities")
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await (supabase as any)
        .from("university_media")
        .insert({
          university_id: universityId,
          media_type: "image",
          file_path: urlData.publicUrl,
          display_order: photos.length + 1,
        });

      if (dbError) throw dbError;

      toast({ title: t("admin.photos.uploadSuccess") });
      setSelectedFile(null);
      setPreviewUrl(null);
      loadPhotos();
    } catch (error: any) {
      toast({
        title: t("admin.photos.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm(t("admin.photos.confirmDelete"))) return;

    try {
      // Extract file path from URL
      const urlParts = photo.file_path.split("/universities/");
      const filePath = urlParts[1];

      if (filePath) {
        // Delete from storage
        await supabase.storage.from("universities").remove([filePath]);
      }

      // Delete from database
      const { error } = await (supabase as any)
        .from("university_media")
        .delete()
        .eq("id", photo.id);

      if (error) throw error;

      toast({ title: t("admin.photos.deleted") });
      loadPhotos();
    } catch (error: any) {
      toast({
        title: t("admin.photos.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-4">{t("admin.photos.loading")}</div>;
  }

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Upload Section */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">{t("admin.photos.uploadTitle")}</h3>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="photo-upload">{t("admin.photos.selectPhoto")}</Label>
            <Input
              id="photo-upload"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("admin.photos.maxSize")}
            </p>
          </div>

          {previewUrl && (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-64 object-contain rounded-lg border"
              />
              <Button
                variant="ghost"
                size="icon"
                className={`absolute top-2 ${language === 'ar' ? 'left-2' : 'right-2'} bg-background/80`}
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'} animate-spin`} />
                {t("admin.photos.uploading")}
              </>
            ) : (
              <>
                <Upload className={`h-4 w-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                {t("admin.photos.uploadPhoto")}
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Gallery Grid */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">
          {t("admin.photos.galleryTitle")} ({photos.length})
        </h3>

        {photos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {t("admin.photos.noPhotos")}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group aspect-square rounded-lg overflow-hidden border"
              >
                <img
                  src={photo.file_path}
                  alt={photo.alt_text || "University photo"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deletePhoto(photo)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
