import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Trash2, Plus, Eye, MapPin, Image as ImageIcon, Upload } from "lucide-react";
import type { CountryExtended } from "@/types/database-extensions";

type FAQ = { q: string; a: string };

export default function AdminCountries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingCountry, setEditingCountry] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [generatingFaq, setGeneratingFaq] = useState(false);
  const [faqList, setFaqList] = useState<FAQ[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const { data: countries, isLoading } = useQuery<CountryExtended[]>({
    queryKey: ['admin-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .order('name_ar');
      
      if (error) throw error;
      return data as CountryExtended[];
    },
  });

  const handleEdit = (country: any) => {
    setEditingCountry({
      ...country,
      map_embed_url: country.map_embed_url || '',
    });
    setFaqList(Array.isArray(country.faq) ? country.faq : []);
    setUploadedFile(null);
    setIsDialogOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار ملف صورة",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "خطأ",
        description: "حجم الصورة يجب أن يكون أقل من 5 ميجابايت",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingCountry.slug}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('countries')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('countries')
        .getPublicUrl(filePath);

      setEditingCountry({ ...editingCountry, image_url: publicUrl });
      
      toast({
        title: "نجح الرفع",
        description: "تم رفع الصورة بنجاح",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل رفع الصورة",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateFaq = async () => {
    if (!editingCountry) return;
    
    setGeneratingFaq(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-country-faq-generate', {
        body: { slug: editingCountry.slug, locale: 'ar' }
      });

      if (error) throw error;
      
      if (data?.ok && Array.isArray(data.faqs)) {
        setFaqList(data.faqs);
        toast({
          title: "تم التوليد",
          description: `تم توليد ${data.faqs.length} سؤال شائع بنجاح`,
        });
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في توليد الأسئلة",
        variant: "destructive",
      });
    } finally {
      setGeneratingFaq(false);
    }
  };

  const handleAddFaq = () => {
    setFaqList([...faqList, { q: '', a: '' }]);
  };

  const handleRemoveFaq = (index: number) => {
    setFaqList(faqList.filter((_, i) => i !== index));
  };

  const handleFaqChange = (index: number, field: 'q' | 'a', value: string) => {
    const updated = [...faqList];
    updated[index][field] = value;
    setFaqList(updated);
  };

  const handleSave = async () => {
    if (!editingCountry) return;

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('admin-country-seo-set', {
        body: {
          slug: editingCountry.slug,
          seo_title: editingCountry.seo_title,
          seo_description: editingCountry.seo_description,
          seo_h1: editingCountry.seo_h1,
          seo_canonical_url: editingCountry.seo_canonical_url,
          map_embed_url: editingCountry.map_embed_url,
          image_url: editingCountry.image_url,
          display_order: editingCountry.display_order || 999,
        }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['admin-countries'] });
      toast({
        title: "نجح الحفظ",
        description: "تم حفظ إعدادات الدولة بنجاح",
      });
      setIsDialogOpen(false);
      setEditingCountry(null);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في حفظ البيانات",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8">جاري التحميل...</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">إدارة صفحات الدول</h1>
        <p className="text-muted-foreground">إدارة SEO والأسئلة الشائعة والخرائط لصفحات الدول</p>
      </div>

      <div className="grid gap-4">
        {countries?.map((country) => (
          <div key={country.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">{country.name_ar}</h3>
              <p className="text-sm text-muted-foreground">/study-in/{country.slug}</p>
              <p className="text-sm mt-1">{country.seo_title || 'لم يتم تعيين عنوان SEO'}</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(`/study-in/${country.slug}`, '_blank')}
              >
                <Eye className="w-4 h-4 mr-2" />
                معاينة
              </Button>
              <Dialog open={isDialogOpen && editingCountry?.id === country.id} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleEdit(country)}>إدارة SEO</Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>إدارة SEO - {country.name_ar}</DialogTitle>
                  </DialogHeader>
                   {editingCountry && (
                    <div className="space-y-6">
                      {/* Country Image */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <ImageIcon className="w-5 h-5" />
                            صورة الدولة
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {editingCountry.image_url && (
                            <div className="mb-4">
                              <img 
                                src={editingCountry.image_url} 
                                alt={country.name_ar}
                                className="w-full h-48 object-cover rounded-lg"
                              />
                            </div>
                          )}
                          
                          {/* File Upload */}
                          <div>
                            <Label>رفع صورة من جهازك</Label>
                            <div className="mt-2">
                              <label htmlFor="country-image-upload" className="cursor-pointer">
                                <div className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-6 hover:border-primary hover:bg-primary/5 transition-colors">
                                  {uploading ? (
                                    <>
                                      <Loader2 className="w-5 h-5 animate-spin" />
                                      <span>جاري الرفع...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-5 h-5" />
                                      <span>{uploadedFile ? uploadedFile.name : 'اضغط لاختيار صورة'}</span>
                                    </>
                                  )}
                                </div>
                              </label>
                              <input
                                id="country-image-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                                disabled={uploading}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                JPG, PNG, WEBP (بحد أقصى 5 ميجابايت)
                              </p>
                            </div>
                          </div>

                          {/* URL Input (Alternative) */}
                          <div>
                            <Label>أو أدخل رابط صورة (URL)</Label>
                            <Input
                              value={editingCountry.image_url || ''}
                              onChange={(e) => setEditingCountry({ ...editingCountry, image_url: e.target.value })}
                              placeholder="https://example.com/country-image.jpg"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              استخدم رابط صورة من الإنترنت
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Basic SEO */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">معلومات SEO الأساسية</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label>ترتيب العرض في الصفحة الرئيسية</Label>
                            <Input
                              type="number"
                              min="1"
                              value={editingCountry.display_order || 999}
                              onChange={(e) => setEditingCountry({ ...editingCountry, display_order: parseInt(e.target.value) || 999 })}
                              placeholder="999"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              الأرقام الأقل تظهر أولاً (1 للأول، 2 للثاني، إلخ)
                            </p>
                          </div>
                          
                          <div>
                            <Label>عنوان الصفحة (SEO Title) - 60 حرف</Label>
                            <Input
                              value={editingCountry.seo_title || ''}
                              onChange={(e) => setEditingCountry({ ...editingCountry, seo_title: e.target.value })}
                              placeholder={`الدراسة في ${country.name_ar} - الجامعات والبرامج`}
                              maxLength={60}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {editingCountry.seo_title?.length || 0}/60
                            </p>
                          </div>
                          <div>
                            <Label>الوصف (Meta Description) - 160 حرف</Label>
                            <Textarea
                              value={editingCountry.seo_description || ''}
                              onChange={(e) => setEditingCountry({ ...editingCountry, seo_description: e.target.value })}
                              placeholder="وصف موجز يظهر في نتائج البحث"
                              maxLength={160}
                              rows={3}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {editingCountry.seo_description?.length || 0}/160
                            </p>
                          </div>
                          <div>
                            <Label>H1 الرئيسي</Label>
                            <Input
                              value={editingCountry.seo_h1 || ''}
                              onChange={(e) => setEditingCountry({ ...editingCountry, seo_h1: e.target.value })}
                              placeholder={`الدراسة في ${country.name_ar}`}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Map Integration */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            خريطة Google
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div>
                            <Label>رابط Embed الخريطة</Label>
                            <Input
                              value={editingCountry.map_embed_url || ''}
                              onChange={(e) => setEditingCountry({ ...editingCountry, map_embed_url: e.target.value })}
                              placeholder="https://www.google.com/maps/embed?pb=..."
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              احصل على الرابط من Google Maps → Share → Embed a map
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* FAQ Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center justify-between">
                            <span>الأسئلة الشائعة (FAQ)</span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleGenerateFaq}
                                disabled={generatingFaq}
                              >
                                {generatingFaq ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <Sparkles className="w-4 h-4 mr-2" />
                                )}
                                توليد بالذكاء الاصطناعي
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleAddFaq}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                إضافة سؤال
                              </Button>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {faqList.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              لا توجد أسئلة شائعة. اضغط على "توليد بالذكاء الاصطناعي" لإنشائها تلقائيًا.
                            </p>
                          ) : (
                            faqList.map((faq, index) => (
                              <div key={index} className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <Label className="text-sm font-medium">السؤال {index + 1}</Label>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemoveFaq(index)}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                                <Input
                                  value={faq.q}
                                  onChange={(e) => handleFaqChange(index, 'q', e.target.value)}
                                  placeholder="السؤال؟"
                                />
                                <Textarea
                                  value={faq.a}
                                  onChange={(e) => handleFaqChange(index, 'a', e.target.value)}
                                  placeholder="الإجابة..."
                                  rows={2}
                                />
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      {/* Actions */}
                      <div className="flex gap-2 justify-end pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          إلغاء
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                          {saving ? (
                            <>
                              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                              جاري الحفظ...
                            </>
                          ) : (
                            'حفظ التغييرات'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
