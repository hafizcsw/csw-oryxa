import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageIcon, GraduationCap, Upload, Trash2, Replace, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StudioMediaCardProps {
  universityId?: string;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  onLogoChange: (url: string | null) => void;
  onHeroChange: (url: string | null) => void;
  className?: string;
}

export function StudioMediaCard({
  universityId,
  logoUrl,
  heroImageUrl,
  onLogoChange,
  onHeroChange,
  className,
}: StudioMediaCardProps) {
  const [heroUploading, setHeroUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [heroProgress, setHeroProgress] = useState(0);
  const [logoProgress, setLogoProgress] = useState(0);
  const [heroDragging, setHeroDragging] = useState(false);
  const [logoDragging, setLogoDragging] = useState(false);
  
  const heroInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (
    file: File, 
    type: 'hero' | 'logo',
    setUploading: (v: boolean) => void,
    setProgress: (v: number) => void,
    onChange: (url: string | null) => void
  ) => {
    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة صالح");
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 9) {
      toast.error("حجم الملف يجب أن يكون أقل من 9MB");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const folder = type === 'hero' ? 'heroes' : 'logos';
      const filePath = `${folder}/${universityId || 'new'}/${fileName}`;

      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(currentProgress + 10, 90);
        setProgress(currentProgress);
      }, 100);

      const { data, error } = await supabase.storage
        .from("universities")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      clearInterval(progressInterval);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("universities")
        .getPublicUrl(data.path);

      setProgress(100);
      onChange(urlData.publicUrl);
      toast.success(type === 'hero' ? "تم رفع صورة الجامعة" : "تم رفع الشعار");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "فشل في رفع الصورة");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [universityId]);

  const handleDrop = (e: React.DragEvent, type: 'hero' | 'logo') => {
    e.preventDefault();
    type === 'hero' ? setHeroDragging(false) : setLogoDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      if (type === 'hero') {
        handleUpload(file, 'hero', setHeroUploading, setHeroProgress, onHeroChange);
      } else {
        handleUpload(file, 'logo', setLogoUploading, setLogoProgress, onLogoChange);
      }
    }
  };

  return (
    <Card className={cn(
      "overflow-hidden border-0 shadow-lg bg-gradient-to-br from-background to-muted/20",
      className
    )}>
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hero Image */}
          <div className="md:col-span-1 order-2 md:order-1">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              صورة الجامعة الرئيسية
            </label>
            <input
              ref={heroInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file, 'hero', setHeroUploading, setHeroProgress, onHeroChange);
                e.target.value = "";
              }}
            />
            
            <motion.div 
              className="relative group"
              whileHover={{ scale: 1.005 }}
              transition={{ type: "spring", stiffness: 300 }}
              onDragOver={(e) => { e.preventDefault(); setHeroDragging(true); }}
              onDragLeave={() => setHeroDragging(false)}
              onDrop={(e) => handleDrop(e, 'hero')}
            >
              <div className={cn(
                "relative rounded-xl overflow-hidden bg-gradient-to-br from-muted to-muted/50 aspect-[4/3] border-2 border-dashed transition-all",
                heroDragging ? "border-primary bg-primary/5" : "border-transparent",
                !heroImageUrl && "border-muted-foreground/25"
              )}>
                <AnimatePresence mode="wait">
                  {heroUploading ? (
                    <motion.div 
                      key="uploading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90 z-10"
                    >
                      <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                      <p className="text-sm font-medium">جاري رفع الصورة...</p>
                      <Progress value={heroProgress} className="w-48 h-2" />
                    </motion.div>
                  ) : heroImageUrl ? (
                    <motion.div 
                      key="image"
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="relative w-full h-full"
                    >
                      <img
                        src={heroImageUrl}
                        alt="صورة الجامعة"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* Action Buttons Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-3">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-2 shadow-lg backdrop-blur-sm bg-white/90 hover:bg-white text-foreground"
                            onClick={() => heroInputRef.current?.click()}
                          >
                            <Replace className="h-4 w-4" />
                            استبدال
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-2 shadow-lg"
                            onClick={() => onHeroChange(null)}
                          >
                            <Trash2 className="h-4 w-4" />
                            حذف
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
                      onClick={() => heroInputRef.current?.click()}
                    >
                      <div className="text-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">اسحب الصورة هنا</p>
                          <p className="text-xs text-muted-foreground">أو انقر للاختيار • PNG, JPG حتى 9MB</p>
                        </div>
                        <Button size="sm" variant="outline" className="gap-2">
                          <Upload className="h-4 w-4" />
                          رفع صورة
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* Logo Upload */}
          <div className="md:col-span-1 order-1 md:order-2">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              شعار الجامعة
            </label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file, 'logo', setLogoUploading, setLogoProgress, onLogoChange);
                e.target.value = "";
              }}
            />
            
            <motion.div 
              className="relative group"
              onDragOver={(e) => { e.preventDefault(); setLogoDragging(true); }}
              onDragLeave={() => setLogoDragging(false)}
              onDrop={(e) => handleDrop(e, 'logo')}
            >
              <div className={cn(
                "relative rounded-xl overflow-hidden bg-gradient-to-br from-muted to-muted/50 aspect-[4/3] border-2 border-dashed transition-all",
                logoDragging ? "border-primary bg-primary/5" : "border-transparent",
                !logoUrl && "border-muted-foreground/25"
              )}>
                <AnimatePresence mode="wait">
                  {logoUploading ? (
                    <motion.div 
                      key="uploading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 z-10"
                    >
                      <div className="w-10 h-10 rounded-full border-3 border-primary border-t-transparent animate-spin" />
                      <Progress value={logoProgress} className="w-3/4 h-1.5" />
                    </motion.div>
                  ) : logoUrl ? (
                    <motion.div 
                      key="image"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative w-full h-full"
                    >
                      <img
                        src={logoUrl}
                        alt="شعار الجامعة"
                        className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Action Buttons Overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-9 w-9 shadow-lg backdrop-blur-sm bg-white/90 hover:bg-white"
                          onClick={() => logoInputRef.current?.click()}
                        >
                          <Replace className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-9 w-9 shadow-lg"
                          onClick={() => onLogoChange(null)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-4"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <div className="text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                          <GraduationCap className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">رفع الشعار</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </Card>
  );
}
