import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, GripVertical } from "lucide-react";
import ProtectedRoute from "@/components/admin/ProtectedRoute";

interface SliderItem {
  id?: number;
  university_id: string;
  image_url: string | null;
  alt_text: string | null;
  locale: string;
  weight: number;
  start_at: string | null;
  end_at: string | null;
  published: boolean;
  universities?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

export default function SliderPage() {
  const [locale, setLocale] = useState<'ar' | 'en'>('ar');
  const [items, setItems] = useState<SliderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<SliderItem | null>(null);
  const [universities, setUniversities] = useState<any[]>([]);

  useEffect(() => {
    loadSlides();
    loadUniversities();
  }, [locale]);

  async function loadSlides() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-slider-list', { body: { locale } });
      if (error) throw error;
      setItems(data?.data || []);
    } catch (e: any) {
      toast.error('Failed to load slides: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadUniversities() {
    const { data } = await supabase
      .from('universities')
      .select('id, name, logo_url')
      .eq('is_active', true)
      .order('name');
    setUniversities(data || []);
  }

  async function saveSlide(item: SliderItem) {
    try {
      const { data, error } = await supabase.functions.invoke('admin-slider-upsert', { body: item });
      if (error) throw error;
      toast.success(item.id ? 'Slide updated' : 'Slide created');
      loadSlides();
      setEditItem(null);
    } catch (e: any) {
      toast.error('Failed to save: ' + e.message);
    }
  }

  async function togglePublish(id: number, published: boolean) {
    try {
      const { error } = await supabase.functions.invoke('admin-slider-toggle', { body: { id, published } });
      if (error) throw error;
      toast.success(published ? 'Published' : 'Unpublished');
      loadSlides();
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    }
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Hero Slider</h1>
            <p className="text-muted-foreground">Manage homepage carousel</p>
          </div>
          <div className="flex gap-2">
            <Button variant={locale === 'ar' ? 'default' : 'outline'} onClick={() => setLocale('ar')}>العربية</Button>
            <Button variant={locale === 'en' ? 'default' : 'outline'} onClick={() => setLocale('en')}>English</Button>
            <Button onClick={() => setEditItem({ university_id: '', image_url: null, alt_text: null, locale, weight: items.length, start_at: null, end_at: null, published: false })}>
              <Plus className="w-4 h-4 mr-2" />
              Add Slide
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">No slides yet. Add your first one!</Card>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-center gap-4">
                  <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
                  <img src={item.image_url || item.universities?.logo_url || '/placeholder.svg'} alt={item.alt_text || ''} className="w-24 h-16 object-cover rounded" />
                  <div className="flex-1">
                    <h3 className="font-medium">{item.universities?.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.alt_text}</p>
                  </div>
                  <Switch checked={item.published} onCheckedChange={(checked) => togglePublish(item.id!, checked)} />
                  <Button variant="outline" size="sm" onClick={() => setEditItem(item)}>Edit</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {editItem && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">{editItem.id ? 'Edit Slide' : 'New Slide'}</h2>
            <div className="space-y-4">
              <div>
                <Label>University</Label>
                <select className="w-full border rounded p-2" value={editItem.university_id} onChange={(e) => setEditItem({ ...editItem, university_id: e.target.value })}>
                  <option value="">Select University</option>
                  {universities.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
                </select>
              </div>
              <div>
                <Label>Image URL (optional)</Label>
                <Input value={editItem.image_url || ''} onChange={(e) => setEditItem({ ...editItem, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>Alt Text</Label>
                <Input value={editItem.alt_text || ''} onChange={(e) => setEditItem({ ...editItem, alt_text: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editItem.published} onCheckedChange={(checked) => setEditItem({ ...editItem, published: checked })} />
                <Label>Published</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveSlide(editItem)}>Save</Button>
                <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
