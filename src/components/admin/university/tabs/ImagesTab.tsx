import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Home } from "lucide-react";

interface ImagesData {
  logo_url?: string | null;
  hero_image_url?: string | null;
}

interface ImagesTabProps {
  universityId?: string;
  data: ImagesData;
  onChange: (data: ImagesData) => void;
  hasDorm?: boolean;
}

export function ImagesTab({ universityId, data, onChange, hasDorm }: ImagesTabProps) {
  const basePath = universityId || "new";

  return (
    <div className="space-y-6">
      {/* Logo Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">شعار الجامعة</CardTitle>
          <CardDescription>
            يُستخدم في البطاقات وصفحة الجامعة. الحجم الموصى به: 200×200 بكسل (PNG شفاف)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUploader
            value={data.logo_url}
            onChange={(url) => onChange({ ...data, logo_url: url })}
            bucket="universities"
            path={`logos/${basePath}`}
            aspectRatio="square"
            placeholder="اسحب شعار الجامعة هنا"
            className="max-w-[200px]"
          />
        </CardContent>
      </Card>

      {/* Hero Image Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الصورة الرئيسية</CardTitle>
          <CardDescription>
            تظهر كخلفية في صفحة الجامعة. الحجم الموصى به: 1200×600 بكسل
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUploader
            value={data.hero_image_url}
            onChange={(url) => onChange({ ...data, hero_image_url: url })}
            bucket="universities"
            path={`heroes/${basePath}`}
            aspectRatio="wide"
            placeholder="اسحب الصورة الرئيسية هنا"
            className="max-w-[600px]"
          />
        </CardContent>
      </Card>

      {/* Dorm Photos Section - Removed: was not saving data (misleading UI) */}
      {/* TODO: Re-add when university_dorm_images table is created */}

      {/* Tips */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">نصائح لأفضل نتيجة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• استخدم صور بجودة عالية (JPG أو PNG)</p>
          <p>• الشعار يفضل أن يكون بخلفية شفافة (PNG)</p>
          <p>• الصورة الرئيسية يجب أن تمثل الجامعة بشكل احترافي</p>
          <p>• الحد الأقصى لحجم الملف: 9MB</p>
        </CardContent>
      </Card>
    </div>
  );
}
