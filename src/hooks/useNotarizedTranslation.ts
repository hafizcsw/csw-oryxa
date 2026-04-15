import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface Order {
  id: string;
  status: string;
  delivery_mode: string;
  doc_slots: string[];
  created_at: string;
  updated_at: string;
}

interface Job {
  id: string;
  doc_slot: string;
  status: string;
  original_path?: string | null;
  original_meta?: Record<string, unknown> | null;
  quality_score: number | null;
  quality_flags: string[] | null;
  rejection_code: string | null;
  rejection_reasons: string[] | null;
  fix_tips: string[] | null;
  doc_type_guess: string | null;
  draft_pdf_path: string | null;
  draft_docx_path: string | null;
  scan_pdf_path: string | null;
  created_at: string;
  updated_at: string;
}

interface Event {
  id: string;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
  meta: Record<string, unknown> | null;
}

interface OrderStatus {
  order: Order;
  jobs: Job[];
  events: Event[];
}

export function useNotarizedTranslation() {
  const { t } = useTranslation('translation');
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const createOrder = useCallback(async (
    docSlots: string[],
    deliveryMode: string = 'digital',
    notifyChannels: string[] = ['email']
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portal-translation-order-create', {
        body: {
          doc_slots: docSlots,
          delivery_mode: deliveryMode,
          notify_channels: notifyChannels
        }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);

      toast({
        title: t('success.orderCreated'),
      });

      return { orderId: data.order_id, jobIds: data.job_ids };
    } catch (err) {
      toast({
        title: t('errors.orderNotFound'),
        description: String(err),
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const getPresignedUploadUrl = useCallback(async (
    orderId: string,
    jobId: string,
    fileExtension: string,
    contentType: string
  ) => {
    const { data, error } = await supabase.functions.invoke('portal-translation-presign-upload', {
      body: {
        order_id: orderId,
        job_id: jobId,
        ext: fileExtension,
        content_type: contentType
      }
    });

    if (error) throw error;
    if (!data.ok) throw new Error(data.error);

    return {
      signedUrl: data.signed_url,
      token: data.token,
      objectPath: data.object_path,
      bucket: data.bucket
    };
  }, []);

  const markUploadComplete = useCallback(async (
    jobId: string,
    originalPath: string,
    meta: Record<string, unknown> = {}
  ) => {
    const { data, error } = await supabase.functions.invoke('portal-translation-upload-complete', {
      body: {
        job_id: jobId,
        original_path: originalPath,
        original_meta: meta
      }
    });

    if (error) throw error;
    if (!data.ok) throw new Error(data.error);

    toast({
      title: t('upload.success'),
    });

    return true;
  }, [t, toast]);

  const runPrecheck = useCallback(async (jobId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portal-translation-precheck', {
        body: { job_id: jobId }
      });

      if (error) throw error;

      if (data.precheck_result === 'pass') {
        toast({
          title: t('precheck.passed'),
        });
      } else {
        toast({
          title: t('precheck.failed'),
          description: data.rejection_reasons?.[0] || t('rejection.' + data.rejection_code),
          variant: 'destructive',
        });
      }

      return data;
    } catch (err) {
      toast({
        title: t('errors.precheckFailed'),
        description: String(err),
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const startProcessing = useCallback(async (orderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portal-translation-start-processing', {
        body: { order_id: orderId }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);

      toast({
        title: t('success.processingStarted'),
      });

      return data;
    } catch (err) {
      toast({
        title: t('errors.processingFailed'),
        description: String(err),
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const getOrderStatus = useCallback(async (orderId: string): Promise<OrderStatus> => {
    // Use supabase.functions.invoke for clean invocation
    const { data, error } = await supabase.functions.invoke('portal-translation-order-status', {
      body: { order_id: orderId }
    });

    if (error) throw error;
    if (!data.ok && data.error) throw new Error(data.error);

    return {
      order: data.order,
      jobs: data.jobs,
      events: data.events
    };
  }, []);

  const getDownloadUrl = useCallback(async (
    jobId: string,
    type: 'draft_pdf' | 'draft_docx' | 'scan_pdf'
  ) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-translation-download?job_id=${jobId}&type=${type}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    toast({
      title: t('success.downloadReady'),
    });

    return data.download_url;
  }, [t, toast]);

  const getOriginalUrl = useCallback(async (jobId: string) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-translation-original-url?job_id=${jobId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (!data.ok) throw new Error(data.error || 'Failed to get original URL');

    return data.signed_url as string;
  }, []);

  const uploadFile = useCallback(async (
    orderId: string,
    jobId: string,
    file: File
  ) => {
    setLoading(true);
    try {
      // Get file extension
      const ext = file.name.split('.').pop() || 'jpg';
      
      // Get presigned URL with token
      const { signedUrl, token, objectPath, bucket } = await getPresignedUploadUrl(
        orderId,
        jobId,
        ext,
        file.type
      );

      // Use Supabase uploadToSignedUrl for proper signed upload flow
      // The signedUrl from createSignedUploadUrl already includes the token
      // We need to use the storage client's uploadToSignedUrl method
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(objectPath, token, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: true
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new Error(uploadError.message || 'Upload failed');
      }

      // Mark upload complete
      await markUploadComplete(jobId, objectPath, {
        filename: file.name,
        size: file.size,
        type: file.type
      });

      // Run precheck
      const precheckResult = await runPrecheck(jobId);

      return precheckResult;
    } catch (err) {
      toast({
        title: t('errors.uploadFailed'),
        description: String(err),
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getPresignedUploadUrl, markUploadComplete, runPrecheck, t, toast]);

  const createQuote = useCallback(async (orderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portal-translation-quote-create', {
        body: { order_id: orderId }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);

      toast({
        title: t('success.orderCreated'),
      });

      return data;
    } catch (err) {
      toast({
        title: t('errors.processingFailed'),
        description: String(err),
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const acceptQuote = useCallback(async (quoteId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portal-translation-quote-accept', {
        body: { quote_id: quoteId }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);

      toast({
        title: t('pricing.quoteAccepted'),
      });

      return data;
    } catch (err) {
      toast({
        title: t('errors.processingFailed'),
        description: String(err),
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const getQuote = useCallback(async (orderId: string) => {
    const { data, error } = await supabase.functions.invoke('portal-translation-quote', {
      body: { order_id: orderId },
    });

    if (error) throw error;
    if (!data) throw new Error('No quote found');
    if ((data as any)?.ok === false) throw new Error((data as any)?.error || 'No quote found');
    if (!(data as any)?.quote_id) throw new Error('No quote found');

    return data;
  }, []);

  const startPayment = useCallback(async (quoteId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portal-translation-payment-start', {
        body: { quote_id: quoteId }
      });

      if (error) throw error;
      if (!data.ok && data.error) throw new Error(data.error);

      return data;
    } catch (err) {
      toast({
        title: t('errors.processingFailed'),
        description: String(err),
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const simulatePayment = useCallback(async (paymentId: string, status: 'succeeded' | 'failed' = 'succeeded') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portal-translation-payment-simulate', {
        body: { 
          payment_id: paymentId,
          simulate_status: status
        }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);

      toast({
        title: status === 'succeeded' ? t('success.paymentConfirmed') : t('errors.paymentFailed'),
      });

      return data;
    } catch (err) {
      toast({
        title: t('errors.processingFailed'),
        description: String(err),
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  const updateJobDocSlot = useCallback(async (jobId: string, docSlot: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('portal-translation-job-update-slot', {
        body: { job_id: jobId, doc_slot: docSlot }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.error);

      return data;
    } catch (err) {
      toast({
        title: t('errors.processingFailed'),
        description: String(err),
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  // Add a job to an existing order for a slot that doesn't have one
  const addJobToOrder = useCallback(async (orderId: string, docSlot: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('portal-translation-add-job', {
      body: { order_id: orderId, doc_slot: docSlot }
    });

    if (error) throw error;
    if (!data.ok) throw new Error(data.error);

    return data.job_id;
  }, []);

  return {
    loading,
    createOrder,
    uploadFile,
    runPrecheck,
    startProcessing,
    getOrderStatus,
    getDownloadUrl,
    getOriginalUrl,
    createQuote,
    acceptQuote,
    getQuote,
    startPayment,
    simulatePayment,
    updateJobDocSlot,
    addJobToOrder,
  };
}

