import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X, Image, Star, Sparkles, Loader2, Globe, Zap, CheckCheck, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MediaReview() {
  const [selectedTab, setSelectedTab] = useState('pending');
  const [selectedQuality, setSelectedQuality] = useState('high');
  const [selectedMediaType, setSelectedMediaType] = useState('both');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<any>(null);
  const [analyzingMedia, setAnalyzingMedia] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    status: 'idle' | 'searching' | 'generating' | 'uploading' | 'complete';
    stage: string;
    university: string;
  }>({ status: 'idle', stage: '', university: '' });
  const queryClient = useQueryClient();

  // Fetch pending suggestions
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['media-suggestions', selectedTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('university_media_suggestions')
        .select(`
          *,
          universities:university_id (
            id,
            name,
            country_id
          )
        `)
        .eq('status', selectedTab)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Fetch universities needing media
  const { data: needsMedia = [], isLoading: loadingNeeds } = useQuery({
    queryKey: ['universities-needs-media'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('id, name, country_id, city, main_image_url, logo_url')
        .or('main_image_url.is.null,logo_url.is.null')
        .order('name')
        .limit(50);
      
      if (error) throw error;
      
      // Filter out universities that already have local or external images
      return (data || []).filter(uni => {
        const needsMainImage = !uni.main_image_url || 
          (!uni.main_image_url.startsWith('/') && 
           !uni.main_image_url.startsWith('http://') && 
           !uni.main_image_url.startsWith('https://') &&
           !uni.main_image_url.startsWith('data:'));
        
        const needsLogo = !uni.logo_url || 
          (!uni.logo_url.startsWith('/') && 
           !uni.logo_url.startsWith('http://') && 
           !uni.logo_url.startsWith('https://') &&
           !uni.logo_url.startsWith('data:'));
        
        return needsMainImage || needsLogo;
      });
    }
  });

  // Generate media mutation
  const generateMutation = useMutation({
    mutationFn: async ({ universityId, mediaType, quality, universityName }: { 
      universityId: string; 
      mediaType: string;
      quality: string;
      universityName?: string;
    }) => {
      console.log('Generating media for university:', { universityId, mediaType, quality });
      
      // Update progress: searching
      setGenerationProgress({
        status: 'searching',
        stage: 'جاري البحث عن صور حقيقية...',
        university: universityName || universityId
      });
      
      const { data, error } = await supabase.functions.invoke('admin-generate-university-media', {
        body: { 
          university_id: universityId,
          media_type: mediaType,
          quality 
        }
      });
      
      console.log('Generation response:', { data, error });
      
      // Update progress: complete
      setGenerationProgress({
        status: 'complete',
        stage: 'تم بنجاح!',
        university: universityName || universityId
      });
      
      // Clear progress after 2 seconds
      setTimeout(() => {
        setGenerationProgress({ status: 'idle', stage: '', university: '' });
      }, 2000);
      
      if (error) {
        console.error('Generation error:', error);
        setGenerationProgress({ status: 'idle', stage: '', university: '' });
        throw error;
      }
      
      if (!data?.ok) {
        console.error('Generation failed:', data);
        throw new Error(data?.error || 'فشل إنشاء الصور');
      }
      
      return data;
    },
    onSuccess: (data) => {
      console.log('Generation successful:', data);
      toast.success(`تم إنشاء ${data.suggestions?.length || 0} صورة وإضافتها إلى قائمة المراجعة`);
      queryClient.invalidateQueries({ queryKey: ['media-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['universities-needs-media'] });
    },
    onError: (error: any) => {
      console.error('Generation mutation error:', error);
      toast.error(error.message || "فشل إنشاء الصور. يرجى التحقق من السجلات.");
    }
  });

  // Approve suggestion mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, media_type, university_id }: any) => {
      // Get the suggestion with image data
      const { data: suggestion, error: fetchError } = await supabase
        .from('university_media_suggestions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !suggestion) throw new Error('Suggestion not found');

      // Update university with the image
      const updateData: any = {};
      if (media_type === 'main_image') {
        updateData.main_image_url = suggestion.image_url || suggestion.image_data;
      } else if (media_type === 'logo') {
        updateData.logo_url = suggestion.image_url || suggestion.image_data;
      }

      const { error: updateError } = await supabase
        .from('universities')
        .update(updateData)
        .eq('id', university_id);

      if (updateError) throw updateError;

      // Mark suggestion as approved
      const { error: approveError } = await supabase
        .from('university_media_suggestions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (approveError) throw approveError;
    },
    onSuccess: () => {
      toast.success('تمت الموافقة على الصورة');
      queryClient.invalidateQueries({ queryKey: ['media-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['universities-needing-media'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في الموافقة');
    }
  });

  // Reject suggestion mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from('university_media_suggestions')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم رفض الصورة');
      queryClient.invalidateQueries({ queryKey: ['media-suggestions'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في الرفض');
    }
  });

  // Batch approve mutation
  const batchApproveMutation = useMutation({
    mutationFn: async () => {
      const pendingSuggestions = suggestions?.filter(s => s.status === 'pending') || [];
      
      for (const suggestion of pendingSuggestions) {
        const updateData: any = {};
        if (suggestion.media_type === 'main_image') {
          updateData.main_image_url = suggestion.image_url || suggestion.image_data;
        } else if (suggestion.media_type === 'logo') {
          updateData.logo_url = suggestion.image_url || suggestion.image_data;
        }

        await supabase
          .from('universities')
          .update(updateData)
          .eq('id', suggestion.university_id);

        await supabase
          .from('university_media_suggestions')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString()
          })
          .eq('id', suggestion.id);
      }

      return pendingSuggestions.length;
    },
    onSuccess: (count) => {
      toast.success(`تمت الموافقة على ${count} صورة`);
      queryClient.invalidateQueries({ queryKey: ['media-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['universities-needing-media'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في الموافقة الجماعية');
    }
  });

  // Batch reject mutation
  const batchRejectMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      const pendingSuggestions = suggestions?.filter(s => s.status === 'pending') || [];
      
      for (const suggestion of pendingSuggestions) {
        await supabase
          .from('university_media_suggestions')
          .update({
            status: 'rejected',
            rejection_reason: reason,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', suggestion.id);
      }

      return pendingSuggestions.length;
    },
    onSuccess: (count) => {
      toast.success(`تم رفض ${count} صورة`);
      queryClient.invalidateQueries({ queryKey: ['media-suggestions'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل في الرفض الجماعي');
    }
  });

  // Batch generate mutation
  const batchGenerateMutation = useMutation({
    mutationFn: async ({ university_ids }: { university_ids: string[] }) => {
      const { data, error } = await supabase.functions.invoke('batch-generate-university-media', {
        body: { 
          university_ids,
          media_type: selectedMediaType,
          quality: selectedQuality 
        }
      });
      
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'فشل التوليد الجماعي');
      
      return data;
    },
    onSuccess: (data) => {
      toast.success(`تم معالجة ${data.processed} جامعة. نجح ${data.successful} وفشل ${data.failed}`);
      setBatchProgress(null);
      queryClient.invalidateQueries({ queryKey: ['media-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['universities-needs-media'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل التوليد الجماعي");
      setBatchProgress(null);
    }
  });

  const handleGenerate = (universityId: string, universityName?: string) => {
    console.log('Generate button clicked for university:', universityId);
    setGeneratingFor(universityId);
    generateMutation.mutate({
      universityId,
      mediaType: selectedMediaType,
      quality: selectedQuality,
      universityName
    });
  };

  const handleBatchGenerate = () => {
    if (!needsMedia || needsMedia.length === 0) {
      toast.error('لا توجد جامعات تحتاج إلى صور');
      return;
    }

    const universityIds = needsMedia.map(uni => uni.id);
    setBatchProgress({ total: universityIds.length, processed: 0 });
    batchGenerateMutation.mutate({ university_ids: universityIds });
  };

  const handleBatchApprove = () => {
    const pendingCount = suggestions?.filter(s => s.status === 'pending').length || 0;
    if (pendingCount === 0) {
      toast.error('لا توجد صور قيد المراجعة');
      return;
    }
    
    if (confirm(`هل أنت متأكد من الموافقة على جميع الصور (${pendingCount})؟`)) {
      batchApproveMutation.mutate();
    }
  };

  const handleBatchReject = () => {
    const pendingCount = suggestions?.filter(s => s.status === 'pending').length || 0;
    if (pendingCount === 0) {
      toast.error('لا توجد صور قيد المراجعة');
      return;
    }
    
    const reason = prompt(`أدخل سبب رفض جميع الصور (${pendingCount}):`);
    if (reason && reason.trim()) {
      batchRejectMutation.mutate({ reason: reason.trim() });
    }
  };

  const analyzeExistingMedia = async () => {
    setAnalyzingMedia(true);
    try {
      // تحليل الصور المعلقة فقط (pending suggestions)
      const pendingSuggestions = suggestions?.filter(s => s.status === 'pending') || [];
      
      if (pendingSuggestions.length === 0) {
        toast.error('لا توجد صور معلقة للتحليل');
        setAnalyzingMedia(false);
        return;
      }

      let analyzed = 0;
      let issuesFound = 0;

      for (const suggestion of pendingSuggestions) {
        try {
          const { data: aiAnalysis, error: analysisError } = await supabase.functions.invoke(
            'analyze-university-image',
            {
              body: {
                image_url: suggestion.image_data || suggestion.image_url,
                university_name: suggestion.universities?.name,
                media_type: suggestion.media_type
              }
            }
          );

          analyzed++;

          if (analysisError || !aiAnalysis?.analysis?.is_valid || aiAnalysis.analysis.confidence < 70) {
            issuesFound++;
            
            // تحديث الملاحظات مع نتائج التحليل
            await supabase
              .from('university_media_suggestions')
              .update({
                notes: `تحليل ذكي: ${aiAnalysis?.analysis?.reasoning || 'فشل التحليل'}\nالمحتوى المكتشف: ${aiAnalysis?.analysis?.detected_content || 'غير معروف'}\nالثقة: ${aiAnalysis?.analysis?.confidence || 0}%`,
                confidence_score: (aiAnalysis?.analysis?.confidence || 0) / 100
              } as any)
              .eq('id', suggestion.id);
          } else {
            // تحديث الملاحظات للصور الصحيحة
            await supabase
              .from('university_media_suggestions')
              .update({
                notes: `✓ تحليل ذكي: الصورة صحيحة\n${aiAnalysis?.analysis?.reasoning || ''}\nالثقة: ${aiAnalysis?.analysis?.confidence || 0}%`,
                confidence_score: (aiAnalysis?.analysis?.confidence || 0) / 100
              } as any)
              .eq('id', suggestion.id);
          }
        } catch (err) {
          console.error(`خطأ في تحليل الصورة:`, err);
        }
      }

      toast.success(`تم تحليل ${analyzed} صورة. تم العثور على ${issuesFound} صورة تحتاج مراجعة.`);
      queryClient.invalidateQueries({ queryKey: ['media-suggestions'] });
    } catch (error: any) {
      console.error('خطأ في تحليل الصور:', error);
      toast.error(error.message || 'فشل تحليل الصور');
    } finally {
      setAnalyzingMedia(false);
    }
  };

  const analyzeSingleImage = async (suggestion: any) => {
    try {
      toast.info('جاري تحليل الصورة...');
      
      const { data: aiAnalysis, error: analysisError } = await supabase.functions.invoke(
        'analyze-university-image',
        {
          body: {
            image_url: suggestion.image_data || suggestion.image_url,
            university_name: suggestion.universities?.name,
            media_type: suggestion.media_type
          }
        }
      );

      if (analysisError) {
        toast.error('فشل تحليل الصورة');
        return;
      }

      const isValid = aiAnalysis?.analysis?.is_valid && aiAnalysis.analysis.confidence >= 70;
      
      // تحديث الملاحظات
      await supabase
        .from('university_media_suggestions')
        .update({
          notes: `${isValid ? '✓' : '⚠️'} تحليل ذكي: ${aiAnalysis?.analysis?.reasoning || ''}\nالمحتوى المكتشف: ${aiAnalysis?.analysis?.detected_content || ''}\nالثقة: ${aiAnalysis?.analysis?.confidence || 0}%`,
          confidence_score: (aiAnalysis?.analysis?.confidence || 0) / 100
        } as any)
        .eq('id', suggestion.id);

      if (isValid) {
        toast.success('الصورة صحيحة ✓');
      } else {
        toast.warning(`مشكلة في الصورة: ${aiAnalysis?.analysis?.reasoning || 'صورة غير مناسبة'}`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['media-suggestions'] });
    } catch (error: any) {
      console.error('خطأ في تحليل الصورة:', error);
      toast.error('فشل تحليل الصورة');
    }
  };


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مراجعة صور الجامعات</h1>
          <p className="text-muted-foreground">توليد ومراجعة الصور والشعارات للجامعات</p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="pending">قيد المراجعة ({suggestions?.filter(s => s.status === 'pending').length || 0})</TabsTrigger>
          <TabsTrigger value="approved">موافق عليها</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة</TabsTrigger>
          <TabsTrigger value="generate">توليد جديد</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium">نوع الصورة</label>
                  <Select value={selectedMediaType} onValueChange={setSelectedMediaType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">الصورة الرئيسية والشعار</SelectItem>
                      <SelectItem value="main_image">الصورة الرئيسية فقط</SelectItem>
                      <SelectItem value="logo">الشعار فقط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium">الجودة</label>
                  <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">عالية (HD)</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="low">منخفضة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleBatchGenerate}
                  disabled={batchGenerateMutation.isPending || !needsMedia || needsMedia.length === 0}
                  size="lg"
                  className="flex-1"
                >
                  {batchGenerateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      جاري التوليد للكل...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      توليد للكل ({needsMedia?.length || 0})
                    </>
                  )}
                </Button>
              </div>
              {batchProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>جاري المعالجة...</span>
                    <span>{batchProgress.processed}/{batchProgress.total}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(batchProgress.processed / batchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="grid gap-4">
            {/* Progress indicator */}
            {generationProgress.status !== 'idle' && (
              <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      {generationProgress.university}
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {generationProgress.stage}
                    </p>
                  </div>
                </div>
              </Card>
            )}
            
            {loadingNeeds && <div className="text-center py-8">جاري تحميل الجامعات...</div>}
            {!loadingNeeds && needsMedia.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                جميع الجامعات لديها صور
              </div>
            )}
            {!loadingNeeds && needsMedia.map((uni) => {
              const needsMainImage = !uni.main_image_url || 
                (!uni.main_image_url.startsWith('/') && 
                 !uni.main_image_url.startsWith('http://') && 
                 !uni.main_image_url.startsWith('https://') &&
                 !uni.main_image_url.startsWith('data:'));
              const needsLogo = !uni.logo_url || 
                (!uni.logo_url.startsWith('/') && 
                 !uni.logo_url.startsWith('http://') && 
                 !uni.logo_url.startsWith('https://') &&
                 !uni.logo_url.startsWith('data:'));
              
              return (
                <div key={uni.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                  <div className="flex-1">
                    <p className="font-medium">{uni.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {uni.city}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {needsMainImage && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          يحتاج صورة رئيسية
                        </span>
                      )}
                      {needsLogo && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          يحتاج شعار
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleGenerate(uni.id, uni.name)}
                    disabled={generateMutation.isPending || generationProgress.status !== 'idle'}
                    size="sm"
                  >
                    {generateMutation.isPending && generatingFor === uni.id ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        جاري الإنشاء...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        إنشاء الصور
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : suggestions && suggestions.length > 0 ? (
            <>
              <div className="flex gap-2 mb-4 flex-wrap">
                <Button
                  onClick={handleBatchApprove}
                  disabled={batchApproveMutation.isPending}
                  variant="default"
                  size="sm"
                >
                  {batchApproveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      جاري الموافقة...
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4 mr-2" />
                      الموافقة على الكل ({suggestions?.filter(s => s.status === 'pending').length})
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleBatchReject}
                  disabled={batchRejectMutation.isPending}
                  variant="destructive"
                  size="sm"
                >
                  {batchRejectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      جاري الرفض...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      رفض الكل ({suggestions?.filter(s => s.status === 'pending').length})
                    </>
                  )}
                </Button>
                <Button
                  onClick={analyzeExistingMedia}
                  disabled={analyzingMedia}
                  variant="secondary"
                  size="sm"
                >
                  {analyzingMedia ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      جاري التحليل...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      🔍 تحليل الصور الموجودة
                    </>
                  )}
                </Button>
              </div>
              <div className="grid gap-4">
                {suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApprove={() => approveMutation.mutate({
                      id: suggestion.id,
                      media_type: suggestion.media_type,
                      university_id: suggestion.university_id
                    })}
                    onReject={(reason) => rejectMutation.mutate({
                      id: suggestion.id,
                      reason
                    })}
                    onAnalyze={() => analyzeSingleImage(suggestion)}
                  />
                ))}
              </div>
            </>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">لا توجد اقتراحات قيد المراجعة</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="approved">
          <div className="grid gap-4">
            {suggestions?.map((suggestion) => (
              <Card key={suggestion.id} className="p-4">
                <div className="flex items-start gap-4">
                  <img
                    src={suggestion.image_data || suggestion.image_url}
                    alt={suggestion.media_type}
                    className="w-32 h-32 object-cover rounded"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">{suggestion.universities?.name}</h3>
                    <Badge className="mt-2" variant="outline">
                      {suggestion.media_type === 'main_image' ? 'صورة رئيسية' : 'شعار'}
                    </Badge>
                    <Badge className="mt-2 mr-2">{suggestion.quality}</Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      تمت الموافقة في {new Date(suggestion.reviewed_at).toLocaleDateString('ar')}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rejected">
          <div className="grid gap-4">
            {suggestions?.map((suggestion) => (
              <Card key={suggestion.id} className="p-4">
                <div className="flex items-start gap-4">
                  <img
                    src={suggestion.image_data || suggestion.image_url}
                    alt={suggestion.media_type}
                    className="w-32 h-32 object-cover rounded opacity-50"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">{suggestion.universities?.name}</h3>
                    <Badge className="mt-2" variant="destructive">مرفوض</Badge>
                    {suggestion.rejection_reason && (
                      <p className="text-sm text-muted-foreground mt-2">
                        السبب: {suggestion.rejection_reason}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SuggestionCard({ suggestion, onApprove, onReject, onAnalyze }: any) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const imageSource = suggestion.source || 'ai_generated';
  const isWebSearch = imageSource === 'web_search';

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div 
          className="relative group cursor-pointer"
          onClick={() => setIsZoomed(true)}
        >
          <img
            src={suggestion.image_data || suggestion.image_url}
            alt={suggestion.media_type}
            className="w-48 h-48 object-cover rounded border-2 border-border transition-transform group-hover:scale-105"
          />
          {/* Source badge */}
          <div className="absolute top-2 left-2">
            <Badge variant={isWebSearch ? "default" : "secondary"} className="text-xs">
              {isWebSearch ? 'صورة حقيقية' : 'AI'}
            </Badge>
          </div>
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
            <div className="text-white text-sm text-center">
              <Image className="w-8 h-8 mx-auto mb-1" />
              <p>انقر للتكبير</p>
            </div>
          </div>
        </div>
        
        {isZoomed && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setIsZoomed(false)}
          >
            <img 
              src={suggestion.image_data || suggestion.image_url} 
              alt={`${suggestion.universities?.name} - ${suggestion.media_type}`}
              className="max-w-full max-h-full object-contain"
            />
            <button 
              className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(false);
              }}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-bold text-lg">{suggestion.universities?.name}</h3>
            {isWebSearch && suggestion.original_url && (
              <a 
                href={suggestion.original_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline mt-1 block"
              >
                عرض المصدر الأصلي ↗
              </a>
            )}
            {isWebSearch && suggestion.search_query && (
              <p className="text-xs text-muted-foreground mt-1">
                استعلام البحث: "{suggestion.search_query}"
              </p>
            )}
            {suggestion.confidence_score && (
              <p className="text-xs text-muted-foreground mt-1">
                معدل الثقة: {(suggestion.confidence_score * 100).toFixed(0)}%
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Badge variant="outline">
              {suggestion.media_type === 'main_image' ? 'صورة رئيسية' : 'شعار'}
            </Badge>
            <Badge variant={isWebSearch ? "default" : "secondary"}>
              {isWebSearch ? 'بحث ويب' : 'ذكاء اصطناعي'}
            </Badge>
            <Badge variant="outline">
              <Star className="w-3 h-3 mr-1" />
              {suggestion.quality}
            </Badge>
            <Badge variant="outline">
              {suggestion.width} x {suggestion.height}
            </Badge>
          </div>

          {suggestion.notes && (
            <div className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">
              {suggestion.notes}
            </div>
          )}

          {!showRejectForm ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={onApprove}
                  variant="default"
                  className="flex-1"
                >
                  <Check className="w-4 h-4 mr-2" />
                  موافقة وإضافة للجامعة
                </Button>
                <Button
                  onClick={() => setShowRejectForm(true)}
                  variant="destructive"
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  رفض
                </Button>
              </div>
              <Button
                onClick={onAnalyze}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                🔍 تحليل هذه الصورة بالذكاء الاصطناعي
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder="سبب الرفض..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    onReject(rejectionReason);
                    setShowRejectForm(false);
                    setRejectionReason('');
                  }}
                  variant="destructive"
                  disabled={!rejectionReason.trim()}
                >
                  تأكيد الرفض
                </Button>
                <Button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason('');
                  }}
                  variant="outline"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}