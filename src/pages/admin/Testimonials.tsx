import { useState, useEffect } from 'react';
import { verifyAdminSSOFromURL, requireAdmin } from '@/lib/admin.sso';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';

type Testimonial = {
  id: string;
  student_name: string;
  video_url: string;
  thumbnail_url: string | null;
  quote: string | null;
  order: number;
  featured: boolean;
};

export default function AdminTestimonials() {
  const [ok, setOk] = useState(false);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    student_name: '',
    video_url: '',
    thumbnail_url: '',
    quote: '',
    order: 0,
    featured: false
  });

  useEffect(() => {
    (async () => {
      const { ok } = await verifyAdminSSOFromURL();
      setOk(ok);
      requireAdmin(ok);
      if (ok) refresh();
    })();
  }, []);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('testimonials')
      .select('*')
      .order('order', { ascending: true });
    setTestimonials((data || []) as Testimonial[]);
    setLoading(false);
  };

  const handleSubmit = async () => {
    const token = localStorage.getItem('csw_admin_sso')!;
    
    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('testimonials')
          .update(formData)
          .eq('id', editingId);
        
        if (error) throw error;
        toast.success('Testimonial updated successfully');
      } else {
        // Create
        const { error } = await supabase
          .from('testimonials')
          .insert([formData]);
        
        if (error) throw error;
        toast.success('Testimonial created successfully');
      }
      
      setDialogOpen(false);
      resetForm();
      refresh();
    } catch (error) {
      console.error('Error saving testimonial:', error);
      toast.error('Failed to save testimonial');
    }
  };

  const handleEdit = (testimonial: Testimonial) => {
    setEditingId(testimonial.id);
    setFormData({
      student_name: testimonial.student_name,
      video_url: testimonial.video_url,
      thumbnail_url: testimonial.thumbnail_url || '',
      quote: testimonial.quote || '',
      order: testimonial.order,
      featured: testimonial.featured
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;
    
    try {
      const { error } = await supabase
        .from('testimonials')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Testimonial deleted successfully');
      refresh();
    } catch (error) {
      console.error('Error deleting testimonial:', error);
      toast.error('Failed to delete testimonial');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      student_name: '',
      video_url: '',
      thumbnail_url: '',
      quote: '',
      order: 0,
      featured: false
    });
  };

  if (!ok) return null;

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Manage Video Testimonials</h1>
          <div className="flex gap-2">
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Testimonial
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? 'Edit Testimonial' : 'Add New Testimonial'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Student Name *</label>
                    <Input
                      value={formData.student_name}
                      onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                      placeholder="Ahmed Al-Sayed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Video URL * (YouTube/Vimeo)</label>
                    <Input
                      value={formData.video_url}
                      onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Thumbnail Image URL</label>
                    <Input
                      value={formData.thumbnail_url}
                      onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                      placeholder="https://... or leave empty to use video thumbnail"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Quote/Summary</label>
                    <Textarea
                      value={formData.quote}
                      onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                      placeholder="Brief quote from the student..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Display Order</label>
                      <Input
                        type="number"
                        value={formData.order}
                        onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    
                    <div className="flex items-end">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.featured}
                          onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">Featured</span>
                      </label>
                    </div>
                  </div>
                  
                  <Button onClick={handleSubmit} className="w-full">
                    {editingId ? 'Update Testimonial' : 'Create Testimonial'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900 flex items-center">
              ← Back to Admin
            </a>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : testimonials.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No testimonials yet. Add your first one!</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Testimonial
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.id} className="overflow-hidden">
                {testimonial.thumbnail_url && (
                  <img
                    src={testimonial.thumbnail_url}
                    alt={testimonial.student_name}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{testimonial.student_name}</h3>
                      {testimonial.featured && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                          Featured
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Order: {testimonial.order}
                    </span>
                  </div>
                  
                  {testimonial.quote && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                      {testimonial.quote}
                    </p>
                  )}
                  
                  <div className="text-xs text-muted-foreground mb-3 truncate">
                    🎥 {testimonial.video_url}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(testimonial)}
                      className="flex-1"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(testimonial.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
