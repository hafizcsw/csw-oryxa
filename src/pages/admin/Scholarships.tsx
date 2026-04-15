import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

export default function AdminScholarships() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newScholarship, setNewScholarship] = useState<any>({
    title: '',
    amount: '',
    currency: 'USD',
    deadline: '',
    url: '',
    status: 'published',
  });

  const { data: scholarships, isLoading } = useQuery({
    queryKey: ['admin-scholarships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scholarships')
        .select(`
          *,
          countries(name_ar, slug),
          universities(name),
          degrees(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: countries } = useQuery({
    queryKey: ['countries-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('id, name_ar')
        .order('name_ar');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (scholarship: any) => {
      const { error } = await supabase
        .from('scholarships')
        .insert([{
          title: scholarship.title,
          country_id: scholarship.country_id || null,
          amount: scholarship.amount ? parseFloat(scholarship.amount) : null,
          currency: scholarship.currency,
          deadline: scholarship.deadline || null,
          url: scholarship.url || null,
          status: scholarship.status,
        }] as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-scholarships'] });
      toast({
        title: "Success",
        description: "Scholarship created successfully",
      });
      setIsCreateOpen(false);
      setNewScholarship({
        title: '',
        amount: '',
        currency: 'USD',
        deadline: '',
        url: '',
        status: 'published',
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scholarships')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-scholarships'] });
      toast({
        title: "Success",
        description: "Scholarship deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!newScholarship.title) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newScholarship);
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scholarships</h1>
          <p className="text-muted-foreground">Manage scholarship listings</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Scholarship
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Scholarship</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={newScholarship.title}
                  onChange={(e) => setNewScholarship({ ...newScholarship, title: e.target.value })}
                  placeholder="Scholarship name"
                />
              </div>
              <div>
                <Label>Country</Label>
                <Select
                  value={newScholarship.country_id || ''}
                  onValueChange={(value) => setNewScholarship({ ...newScholarship, country_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries?.map((country) => (
                      <SelectItem key={country.id} value={country.id}>
                        {country.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={newScholarship.amount}
                    onChange={(e) => setNewScholarship({ ...newScholarship, amount: e.target.value })}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select
                    value={newScholarship.currency}
                    onValueChange={(value) => setNewScholarship({ ...newScholarship, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={newScholarship.deadline}
                  onChange={(e) => setNewScholarship({ ...newScholarship, deadline: e.target.value })}
                />
              </div>
              <div>
                <Label>URL</Label>
                <Input
                  value={newScholarship.url}
                  onChange={(e) => setNewScholarship({ ...newScholarship, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Country</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Deadline</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {scholarships?.map((scholarship: any) => (
              <tr key={scholarship.id} className="border-t">
                <td className="p-3">{scholarship.title}</td>
                <td className="p-3">{scholarship.countries?.name_ar || '-'}</td>
                <td className="p-3">
                  {scholarship.amount ? `${scholarship.currency} ${scholarship.amount.toLocaleString()}` : '-'}
                </td>
                <td className="p-3">
                  {scholarship.deadline ? new Date(scholarship.deadline).toLocaleDateString() : '-'}
                </td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-1 rounded ${
                    scholarship.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {scholarship.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(scholarship.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
