import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNotarizedTranslation } from '@/hooks/useNotarizedTranslation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { TranslationDocumentSlot, type SlotId, type SlotUI } from './TranslationDocumentSlot';
import { TranslationQuoteEnhanced } from './TranslationQuoteEnhanced';
import { TranslationPaymentSection } from './TranslationPaymentSection';
import { PostPaymentConfirmation } from './PostPaymentConfirmation';
import type { DeliveryDestination } from './DeliveryDestinationCards';

const DOC_SLOTS: SlotId[] = [
  'passport', 'certificate', 'transcript', 'residence',
  'birth_certificate', 'diploma', 'medical'
];

const DELIVERY_MODES = ['digital', 'physical', 'both'] as const;

interface UnifiedState {
  orderId: string | null;
  selectedSlot: SlotId | null;
  slots: Record<SlotId, SlotUI>;
  deliveryMode: 'digital' | 'physical' | 'both';
  quote: {
    quoteId: string;
    subtotalMinor: number;  // ✅ NEW: Subtotal before VAT
    vatMinor: number;       // ✅ NEW: VAT amount
    vatRate: number;        // ✅ NEW: VAT rate (e.g., 0.05 = 5%)
    totalMinor: number;
    currency: string;
    lineItems: Array<{
      doc_slot: SlotId;
      page_count: number;
      base_fee: number;
      extra_pages_fee: number;
      extra_pages: number;
      line_total: number;
      currency: string;
    }>;
    status: string;
  } | null;
  payment: {
    paymentId: string;
    provider: 'mock' | 'stripe';
    amountMinor: number;
    currency: string;
    status: string;
  } | null;
  orderStatus: string;
}

const initialSlots: Record<SlotId, SlotUI> = DOC_SLOTS.reduce((acc, id) => {
  acc[id] = { status: 'idle' };
  return acc;
}, {} as Record<SlotId, SlotUI>);

export function UnifiedTranslationOrder() {
  const { t } = useTranslation('translation');
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRTL = document.documentElement.dir === 'rtl';
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  // Session check
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  // Hook functions
  const {
    loading,
    createOrder,
    uploadFile,
    getOrderStatus,
    getOriginalUrl,
    createQuote,
    acceptQuote,
    getQuote,
    startPayment,
    simulatePayment,
    startProcessing,
    updateJobDocSlot,
    addJobToOrder,
  } = useNotarizedTranslation();

  // State
  const [state, setState] = useState<UnifiedState>({
    orderId: searchParams.get('orderId'),
    selectedSlot: null,
    slots: initialSlots,
    deliveryMode: 'digital',
    quote: null,
    payment: null,
    orderStatus: 'draft',
  });

  const [localPreviews, setLocalPreviews] = useState<Record<SlotId, string>>({} as Record<SlotId, string>);
  const [isProcessing, setIsProcessing] = useState(false);

  const buildQuoteState = useCallback((quoteData: any): UnifiedState['quote'] => {
    const currency = (quoteData?.currency || 'USD') as string;
    // ✅ NEW: Extract VAT info from breakdown or top-level
    const breakdown = quoteData.breakdown || {};
    const subtotalMinor = Number(breakdown.subtotal_minor ?? quoteData.subtotal_minor ?? 0);
    const vatMinor = Number(breakdown.vat_minor ?? quoteData.vat_minor ?? 0);
    const vatRate = Number(breakdown.vat_rate ?? quoteData.vat_rate ?? 0.05);
    
    return {
      quoteId: String(quoteData.quote_id || ''),
      subtotalMinor,
      vatMinor,
      vatRate,
      totalMinor: Number(quoteData.total_amount ?? 0),
      currency,
      lineItems: (breakdown.line_items || []).map((li: any) => ({
        doc_slot: li.doc_slot as SlotId,
        page_count: Number(li.page_count ?? 1),
        base_fee: Number(li.base_fee ?? 0),
        extra_pages_fee: Number(li.extra_pages_fee ?? 0),
        extra_pages: Number(li.extra_pages ?? 0),
        line_total: Number(li.line_total ?? 0),
        currency,
      })),
      status: String(quoteData.status || 'quoted'),
    };
  }, []);

  // Load existing order if orderId in URL
  const loadOrder = useCallback(async (orderId: string) => {
    try {
      const data = await getOrderStatus(orderId);
      const newSlots = { ...initialSlots };

      // Map jobs to slots
      data.jobs.forEach((job: any) => {
        const slotId = job.doc_slot as SlotId;
        if (DOC_SLOTS.includes(slotId)) {
          newSlots[slotId] = {
            jobId: job.id,
            status: mapJobStatusToSlotStatus(job.status),
            precheck: job.quality_score !== null ? {
              score: job.quality_score,
              pages: job.quality_flags?.page_count || 1,
              rejectionCode: job.rejection_code,
              fixTips: job.fix_tips,
            } : undefined,
            fileName: job.original_meta?.filename,
          };
        }
      });

      // Parse delivery mode safely
      const rawDeliveryMode = data.order.delivery_mode || 'digital';
      const deliveryMode: 'digital' | 'physical' | 'both' = 
        rawDeliveryMode === 'physical' ? 'physical' :
        rawDeliveryMode === 'both' ? 'both' : 'digital';

      setState(prev => ({
        ...prev,
        orderId,
        slots: newSlots,
        deliveryMode,
        orderStatus: data.order.status,
      }));

      // Hydrate signed preview URLs for uploaded originals (so previews persist after refresh)
      const jobsWithOriginals = (data.jobs || [])
        .filter((j: any) => !!j.original_path)
        .map((j: any) => ({ jobId: j.id as string, slotId: j.doc_slot as SlotId, fileName: j.original_meta?.filename as string | undefined }));

      if (jobsWithOriginals.length > 0) {
        try {
          const signed = await Promise.all(
            jobsWithOriginals.map(async (j) => {
              try {
                const url = await getOriginalUrl(j.jobId);
                return { ...j, url };
              } catch {
                return { ...j, url: null as string | null };
              }
            }),
          );

          setState(prev => {
            if (prev.orderId !== orderId) return prev;
            const slots = { ...prev.slots };
            for (const s of signed) {
              if (!DOC_SLOTS.includes(s.slotId)) continue;
              if (s.url) {
                slots[s.slotId] = {
                  ...slots[s.slotId],
                  uploadedPreviewUrl: s.url,
                  fileName: slots[s.slotId].fileName || s.fileName,
                };
              }
            }
            return { ...prev, slots };
          });
        } catch {
          // Ignore preview hydration failures
        }
      }

      // Try to get quote if order is in quoted status
      if (['awaiting_quote', 'quoted', 'pending_payment'].includes(data.order.status)) {
        const hasReadyDocs = Object.values(newSlots).some((s: any) => s?.status === 'ready' && !!s?.jobId);

        try {
          const quoteData = await getQuote(orderId);
          setState(prev => ({
            ...prev,
            quote: buildQuoteState(quoteData),
            orderStatus: 'quoted',
          }));
        } catch {
          // If the user refreshed while we're still awaiting a quote, trigger quote creation.
          if (data.order.status === 'awaiting_quote' && hasReadyDocs) {
            try {
              await createQuote(orderId);
              const quoteData = await getQuote(orderId);
              setState(prev => ({
                ...prev,
                quote: buildQuoteState(quoteData),
                orderStatus: 'quoted',
              }));
            } catch {
              // Quote still might not be ready yet
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load order:', error);
      toast({
        title: t('errors.orderNotFound'),
        variant: 'destructive',
      });
    }
  }, [getOrderStatus, getQuote, getOriginalUrl, createQuote, buildQuoteState, t, toast]);

  // Initial load
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId) {
      loadOrder(orderId);
    }
  }, []);

  // Cleanup local previews on unmount
  useEffect(() => {
    return () => {
      Object.values(localPreviews).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [localPreviews]);

  // Helper to map job status to slot status
  const mapJobStatusToSlotStatus = (jobStatus: string): SlotUI['status'] => {
    switch (jobStatus) {
      case 'awaiting_upload':
        return 'idle';
      case 'uploaded':
      case 'pending_precheck':
        return 'checking';
      case 'precheck_pass':
      case 'awaiting_quote':
      case 'quoted':
      case 'paid':
      case 'processing_ocr':
      case 'processing_translate':
      case 'processing_render':
      case 'draft_ready':
      case 'delivered':
        return 'ready';
      case 'precheck_rejected':
        return 'rejected';
      default:
        return 'idle';
    }
  };

  // Ensure order exists for a specific slot - returns BOTH orderId AND jobId
  // ✅ FIX: Create order with ALL DOC_SLOTS upfront so all slots have jobIds from start
  const ensureOrderForSlot = useCallback(async (slotId: SlotId): Promise<{ orderId: string; jobId: string }> => {
    // If we already have order and job for this slot, return them directly
    if (state.orderId && state.slots[slotId]?.jobId) {
      console.log('[UT:UPLOAD] ensureOrderForSlot: using existing', { orderId: state.orderId, jobId: state.slots[slotId]!.jobId! });
      return { orderId: state.orderId, jobId: state.slots[slotId]!.jobId! };
    }

    // ✅ FIX: If order exists but this slot doesn't have a jobId, ADD a new job dynamically
    if (state.orderId) {
      console.log('[UT:UPLOAD] ensureOrderForSlot: order exists but slot has no jobId, trying to add job', { orderId: state.orderId, slotId });
      
      // First try reload to see if job already exists in DB
      await loadOrder(state.orderId);
      
      // Check again after reload - use functional approach to get latest state
      let existingJobId: string | undefined;
      setState(prev => {
        existingJobId = prev.slots[slotId]?.jobId;
        return prev; // No changes, just reading
      });
      
      // Need a small delay for state to settle, then read directly
      const freshData = await getOrderStatus(state.orderId);
      const jobFromDb = freshData.jobs.find(j => j.doc_slot === slotId);
      
      if (jobFromDb?.id) {
        console.log('[UT:UPLOAD] ensureOrderForSlot: found job in DB after reload', { orderId: state.orderId, slotId, jobId: jobFromDb.id });
        // Update state with the found job
        setState(prev => ({
          ...prev,
          slots: {
            ...prev.slots,
            [slotId]: {
              ...prev.slots[slotId],
              jobId: jobFromDb.id,
            }
          }
        }));
        return { orderId: state.orderId, jobId: jobFromDb.id };
      }
      
      // ✅ No job exists - ADD a new one via the new endpoint
      console.log('[UT:UPLOAD] ensureOrderForSlot: adding new job to existing order', { orderId: state.orderId, slotId });
      try {
        const newJobId = await addJobToOrder(state.orderId, slotId);
        console.log('[UT:UPLOAD] ensureOrderForSlot: new job added', { orderId: state.orderId, slotId, jobId: newJobId });
        
        // Update state with the new job
        setState(prev => ({
          ...prev,
          slots: {
            ...prev.slots,
            [slotId]: {
              ...prev.slots[slotId],
              jobId: newJobId,
              status: 'idle',
            }
          }
        }));
        
        return { orderId: state.orderId, jobId: newJobId };
      } catch (addError) {
        console.error('[UT:ERROR]', { step: 'addJobToOrder', message: String(addError), slotId, orderId: state.orderId });
        throw new Error(`Failed to add job for slot ${slotId}. Please try again.`);
      }
    }

    console.log('[UT:UPLOAD] ensureOrderForSlot: creating new order with ALL slots', { slotId, deliveryMode: state.deliveryMode, allSlots: DOC_SLOTS });

    // Check session directly (don't rely on react-query cache)
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.user) {
      console.error('[UT:ERROR]', { step: 'ensureOrder', message: 'Not authenticated' });
      navigate('/auth');
      throw new Error('Not authenticated');
    }

    try {
      // ✅ FIX: Create order with ALL DOC_SLOTS, not just the current one
      const result = await createOrder(DOC_SLOTS, state.deliveryMode);
      const newOrderId = result.orderId;
      
      // Find the jobId for the requested slotId from the returned jobIds
      // The backend returns job_ids in the same order as doc_slots
      const slotIndex = DOC_SLOTS.indexOf(slotId);
      const jobId = result.jobIds?.[slotIndex];

      console.log('[UT:UPLOAD] createOrder result (all slots)', { 
        orderId: newOrderId, 
        requestedSlot: slotId,
        slotIndex,
        jobId, 
        totalJobIds: result.jobIds?.length 
      });

      if (!jobId) {
        console.error('[UT:ERROR]', { step: 'ensureOrder', message: 'job_id_missing_for_slot', slotId, slotIndex, result });
        throw new Error('job_id_missing_from_createOrder');
      }

      // Update URL
      setSearchParams({ orderId: newOrderId });

      // ✅ Update state with ALL jobIds mapped to their slots
      setState(prev => {
        const newSlots = { ...prev.slots };
        DOC_SLOTS.forEach((slot, index) => {
          const jid = result.jobIds?.[index];
          if (jid) {
            newSlots[slot] = {
              ...newSlots[slot],
              jobId: jid,
              status: newSlots[slot].status || 'idle',
            };
          }
        });
        return {
          ...prev,
          orderId: newOrderId,
          slots: newSlots,
        };
      });

      // Return the values directly - don't wait for state update
      return { orderId: newOrderId, jobId };
    } catch (error) {
      console.error('[UT:ERROR]', { step: 'ensureOrder', message: String(error), raw: error });
      throw error;
    }
  }, [state.orderId, state.deliveryMode, state.slots, createOrder, navigate, setSearchParams, loadOrder, getOrderStatus, addJobToOrder]);

  // State for quote loading
  const [quoteLoading, setQuoteLoading] = useState(false);

  // ✅ FIX: maybeCreateQuote MUST be defined BEFORE handleFileUpload to avoid hoisting issues
  // Quote is recalculated every time a slot becomes ready - backend is idempotent
  const maybeCreateQuote = useCallback(async (orderId: string, slots: Record<SlotId, SlotUI>) => {
    const readySlots = Object.entries(slots).filter(
      ([_, slot]) => slot.status === 'ready' && slot.jobId
    );

    console.log('[UT:QUOTE] maybeCreateQuote start', { 
      orderId, 
      readySlotsCount: readySlots.length, 
      readySlotIds: readySlots.map(([id]) => id),
    });

    if (readySlots.length === 0) {
      console.log('[UT:QUOTE] No ready slots, skipping quote creation');
      return;
    }

    try {
      setQuoteLoading(true);
      console.log('[UT:QUOTE] calling createQuote (refresh)', { orderId, readyCount: readySlots.length });
      
      const quoteData = await createQuote(orderId);
      console.log('[UT:QUOTE] createQuote result', quoteData);
      
      if (quoteData?.quote_id) {
        console.log('[UT:QUOTE] calling getQuote', { orderId });

        const fetchQuoteWithRetry = async (attempts = 5) => {
          let lastErr: unknown = null;
          for (let i = 0; i < attempts; i++) {
            try {
              return await getQuote(orderId);
            } catch (e) {
              lastErr = e;
              await new Promise((r) => setTimeout(r, 350 * (i + 1)));
            }
          }
          throw lastErr;
        };

        const fullQuote = await fetchQuoteWithRetry();
        console.log('[UT:QUOTE] getQuote result', fullQuote);
        
        if (fullQuote?.quote_id) {
          console.log('[UT:QUOTE] quote ready (refreshed)', { 
            quoteId: fullQuote.quote_id,
            totalAmount: fullQuote.total_amount,
            currency: fullQuote.currency,
            breakdownCount: fullQuote.breakdown?.line_items?.length || 0,
          });
          
          setState(prev => ({
            ...prev,
            quote: buildQuoteState(fullQuote),
            orderStatus: 'quoted',
          }));
        } else {
          console.warn('[UT:QUOTE] Quote data missing from response:', fullQuote);
          toast({
            title: t('errors.quoteGenerationFailed'),
            description: 'Quote data was empty',
            variant: 'destructive',
          });
        }
      } else {
        console.warn('[UT:QUOTE] createQuote returned no quote_id:', quoteData);
      }
    } catch (error) {
      console.error('[UT:ERROR]', { step: 'createQuote', message: String(error), raw: error });
      toast({
        title: t('errors.quoteGenerationFailed'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setQuoteLoading(false);
    }
  }, [createQuote, getQuote, buildQuoteState, t, toast]);

  // Handle file upload for a slot
  const handleFileUpload = useCallback(async (slotId: SlotId, file: File) => {
    console.log('[UT:UPLOAD] start', { 
      slotId, 
      fileName: file.name, 
      size: file.size, 
      type: file.type, 
      hasOrderId: !!state.orderId, 
      hasJobId: !!state.slots[slotId]?.jobId 
    });
    
    setIsProcessing(true);

    // Create local preview immediately
    const localUrl = URL.createObjectURL(file);
    setLocalPreviews(prev => ({ ...prev, [slotId]: localUrl }));

    setState(prev => ({
      ...prev,
      selectedSlot: slotId,
      slots: {
        ...prev.slots,
        [slotId]: {
          ...prev.slots[slotId],
          status: 'uploading',
          fileName: file.name,
          localPreviewUrl: localUrl,
        },
      },
    }));

    try {
      // ✅ FIX: Get orderId AND jobId directly from ensureOrderForSlot
      const { orderId, jobId } = await ensureOrderForSlot(slotId);

      console.log('[UT:UPLOAD] ensured', { orderId, jobId });

      setState(prev => ({
        ...prev,
        slots: {
          ...prev.slots,
          [slotId]: { ...prev.slots[slotId], status: 'checking' },
        },
      }));

      console.log('[UT:UPLOAD] calling uploadFile', { orderId, jobId, fileName: file.name });

      // Upload file and run precheck
      const precheckResult = await uploadFile(orderId, jobId, file);

      console.log('[UT:UPLOAD] uploadFile result', { 
        precheck_result: precheckResult.precheck_result, 
        quality_score: precheckResult.quality_score, 
        page_count: precheckResult.page_count, 
        rejection_code: precheckResult.rejection_code 
      });

      // ✅ FIX: Build updated slots OUTSIDE setState, call async functions AFTER setState
      const isPassed = precheckResult.precheck_result === 'pass';
      const updatedSlotData: SlotUI = {
        ...state.slots[slotId],
        jobId,
        status: isPassed ? 'ready' as const : 'rejected' as const,
        precheck: {
          score: precheckResult.quality_score,
          pages: precheckResult.page_count || 1,
          rejectionCode: precheckResult.rejection_code,
          fixTips: precheckResult.fix_tips,
        },
      };
      
      // ✅ Update state synchronously (no async side-effects inside setState)
      const updatedSlots = { ...state.slots, [slotId]: updatedSlotData };
      setState(prev => ({
        ...prev,
        slots: {
          ...prev.slots,
          [slotId]: updatedSlotData,
        },
      }));

      // ✅ FIX: Call maybeCreateQuote AFTER setState, with computed slots
      if (isPassed) {
        console.log('[UT:UPLOAD] precheck passed, triggering maybeCreateQuote');
        maybeCreateQuote(orderId, updatedSlots);
      } else {
        console.log('[UT:UPLOAD] precheck rejected', { rejectionCode: precheckResult.rejection_code });
      }

    } catch (error) {
      console.error('[UT:ERROR]', { step: 'handleFileUpload', message: String(error), raw: error });
      toast({
        title: t('errors.uploadFailed'),
        description: String(error),
        variant: 'destructive',
      });
      setState(prev => ({
        ...prev,
        slots: {
          ...prev.slots,
          [slotId]: { ...prev.slots[slotId], status: 'idle' },
        },
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [ensureOrderForSlot, uploadFile, maybeCreateQuote, t, toast, state.orderId, state.slots]);


  // Handle accept quote
  const handleAcceptQuote = useCallback(async () => {
    if (!state.quote?.quoteId) return;
    await acceptQuote(state.quote.quoteId);
    setState(prev => ({ ...prev, orderStatus: 'quote_accepted' }));
  }, [state.quote, acceptQuote]);

  // Handle start payment
  const handleStartPayment = useCallback(async () => {
    if (!state.quote?.quoteId) return;
    const paymentData = await startPayment(state.quote.quoteId);
    setState(prev => ({
      ...prev,
      payment: {
        paymentId: paymentData.payment_id,
        provider: paymentData.provider,
        amountMinor: paymentData.amount_minor,
        currency: paymentData.currency,
        status: 'pending',
      },
      orderStatus: 'pending_payment',
    }));
  }, [state.quote, startPayment]);

  // Handle simulate payment
  // ✅ FIX: After successful payment, automatically start processing
  const handleSimulatePayment = useCallback(async (status: 'succeeded' | 'failed') => {
    if (!state.payment?.paymentId || !state.orderId) return;
    
    console.log('[UT:PAYMENT] simulatePayment start', { paymentId: state.payment.paymentId, status });
    await simulatePayment(state.payment.paymentId, status);
    
    setState(prev => ({
      ...prev,
      payment: prev.payment ? { ...prev.payment, status } : null,
      orderStatus: status === 'succeeded' ? 'paid' : 'payment_failed',
    }));

    // ✅ FIX: Automatically start processing after successful payment
    if (status === 'succeeded') {
      console.log('[UT:PAYMENT] Payment succeeded, auto-starting processing', { orderId: state.orderId });
      try {
        await startProcessing(state.orderId);
        console.log('[UT:PAYMENT] startProcessing succeeded');
        setState(prev => ({ ...prev, orderStatus: 'processing' }));
        
        // Reload order to get updated job statuses
        await loadOrder(state.orderId!);
      } catch (error) {
        console.error('[UT:PAYMENT] startProcessing failed', error);
        toast({
          title: t('errors.processingFailed'),
          description: String(error),
          variant: 'destructive',
        });
      }
    }
  }, [state.payment, state.orderId, simulatePayment, startProcessing, loadOrder, t, toast]);

  // Handle start processing (manual trigger)
  const handleStartProcessing = useCallback(async () => {
    if (!state.orderId) return;
    console.log('[UT:PROCESSING] Manual startProcessing', { orderId: state.orderId });
    await startProcessing(state.orderId);
    setState(prev => ({ ...prev, orderStatus: 'processing' }));
    // Reload to get updated statuses
    await loadOrder(state.orderId);
  }, [state.orderId, startProcessing, loadOrder]);

  // Handle slot selection
  const handleSelectSlot = useCallback((slotId: SlotId) => {
    setState(prev => ({ ...prev, selectedSlot: slotId }));
  }, []);

  // Handle doc slot change (user changes document type)
  const handleDocSlotChange = useCallback(async (slotId: SlotId, newDocSlot: SlotId) => {
    const slot = state.slots[slotId];
    if (!slot?.jobId || !state.orderId) return;

    try {
      setIsProcessing(true);
      
      // Update in backend
      await updateJobDocSlot(slot.jobId, newDocSlot);
      
      // Update local state
      setState(prev => ({
        ...prev,
        slots: {
          ...prev.slots,
          [slotId]: {
            ...prev.slots[slotId],
            docSlotOverride: newDocSlot,
          },
        },
        quote: null, // Clear quote so it gets regenerated
      }));

      // Regenerate quote with new doc_slot pricing
      const quoteData = await createQuote(state.orderId);
      if (quoteData?.quote_id) {
        const fullQuote = await getQuote(state.orderId);
        if (fullQuote?.quote_id) {
          setState(prev => ({
            ...prev,
            quote: buildQuoteState(fullQuote),
            orderStatus: 'quoted',
          }));
        }
      }
    } catch (error) {
      console.error('[UT:DOC_SLOT_CHANGE] Error:', error);
      toast({
        title: t('errors.processingFailed'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [state.slots, state.orderId, updateJobDocSlot, createQuote, getQuote, buildQuoteState, t, toast]);

  // Handle upload click from preview panel
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // File input change handler
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && state.selectedSlot) {
      handleFileUpload(state.selectedSlot, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [state.selectedSlot, handleFileUpload]);

  // Computed values
  const selectedSlotData = state.selectedSlot ? {
    ...state.slots[state.selectedSlot],
    localPreviewUrl: localPreviews[state.selectedSlot] || state.slots[state.selectedSlot].localPreviewUrl,
  } : null;

  const readyCount = useMemo(() => 
    Object.values(state.slots).filter(s => s.status === 'ready').length,
    [state.slots]
  );

  const activeCount = useMemo(() =>
    Object.values(state.slots).filter(s => s.status !== 'idle').length,
    [state.slots]
  );

  // ✅ FIX: Show quote panel when we have ready documents (not just when quote exists)
  const shouldShowQuotePanel = readyCount > 0;
  const quoteReady = readyCount > 0 && state.quote !== null;
  
  // Check if we should show the post-payment confirmation screen
  const isPostPayment = ['paid', 'processing', 'processing_ocr', 'processing_extract', 'processing_translate', 'processing_render', 'draft_ready', 'notarized_scan_ready', 'delivered'].includes(state.orderStatus);

  // Start a fresh order (clear URL and state)
  const handleNewOrder = useCallback(() => {
    // Clear local previews
    Object.values(localPreviews).forEach(url => {
      URL.revokeObjectURL(url);
    });
    setLocalPreviews({} as Record<SlotId, string>);
    
    // Reset state
    setState({
      orderId: null,
      selectedSlot: null,
      slots: initialSlots,
      deliveryMode: 'digital',
      quote: null,
      payment: null,
      orderStatus: 'draft',
    });
    
    // Clear URL
    setSearchParams({});
  }, [localPreviews, setSearchParams]);

  // ✅ Show PostPaymentConfirmation screen after payment
  if (isPostPayment && state.orderId) {
    return (
      <PostPaymentConfirmation
        orderId={state.orderId}
        orderNumber={`CSW-${state.orderId.substring(0, 8).toUpperCase()}`}
        documentCount={Object.values(state.slots).filter(s => s.status === 'ready' || s.jobId).length}
        currentStatus={state.orderStatus}
        onNewOrder={handleNewOrder}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/services/translation_russia')}
          >
            <BackArrow className="w-4 h-4 mr-2" />
            {t('actions.back')}
          </Button>
          
          {/* New Order Button - show when there's an existing order */}
          {state.orderId && (
            <Button
              variant="outline"
              onClick={handleNewOrder}
              className="gap-2"
            >
              {t('unified.newOrder')}
            </Button>
          )}
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('unified.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('unified.subtitle')}
        </p>
      </div>

      {/* Delivery Mode Selection */}
      {!state.orderId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t('delivery.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={state.deliveryMode}
              onValueChange={(value) => setState(prev => ({ 
                ...prev, 
                deliveryMode: value as 'digital' | 'physical' | 'both' 
              }))}
              className="flex flex-wrap gap-4"
            >
              {DELIVERY_MODES.map((mode) => (
                <div key={mode} className="flex items-center space-x-2">
                  <RadioGroupItem value={mode} id={mode} />
                  <Label htmlFor={mode}>{t(`delivery.${mode}`)}</Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Document Slots Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">{t('unified.documentsTitle')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOC_SLOTS.map((slotId) => (
            <TranslationDocumentSlot
              key={slotId}
              slotId={slotId}
              slot={{
                ...state.slots[slotId],
                localPreviewUrl: localPreviews[slotId],
              }}
              isSelected={state.selectedSlot === slotId}
              onSelect={() => handleSelectSlot(slotId)}
              onFileSelect={(file) => handleFileUpload(slotId, file)}
              onDocSlotChange={(newSlot) => handleDocSlotChange(slotId, newSlot)}
              onReplace={() => {
                // Trigger file input for this slot
                const slotElement = document.querySelector(`[data-slot-id="${slotId}"] input[type="file"]`) as HTMLInputElement;
                slotElement?.click();
              }}
              onDelete={() => {
                // Clear the slot
                if (localPreviews[slotId]) {
                  URL.revokeObjectURL(localPreviews[slotId]);
                }
                setLocalPreviews(prev => {
                  const newPreviews = { ...prev };
                  delete newPreviews[slotId];
                  return newPreviews;
                });
                setState(prev => ({
                  ...prev,
                  slots: {
                    ...prev.slots,
                    [slotId]: { status: 'idle' },
                  },
                }));
              }}
              disabled={isProcessing}
              locked={state.orderStatus === 'quote_accepted' || state.orderStatus === 'paid'}
            />
          ))}
        </div>
      </div>

      {/* Dialog removed - actions now on thumbnail overlay */}

      {/* Quote + Payment Section - ✅ FIX: Show when we have ready documents */}
      {shouldShowQuotePanel && (
        <div className="space-y-4">
          <TranslationQuoteEnhanced
            quote={state.quote}
            readyCount={readyCount}
            totalCount={activeCount}
            loading={quoteLoading || loading}
            paymentReady={quoteReady}
            onProceedToPayment={handleAcceptQuote}
          />
          <TranslationPaymentSection
            quoteReady={quoteReady}
            quote={state.quote ? {
              quoteId: state.quote.quoteId,
              totalMinor: state.quote.totalMinor,
              currency: state.quote.currency,
            } : null}
            payment={state.payment}
            orderStatus={state.orderStatus}
            onAcceptQuote={handleAcceptQuote}
            onStartPayment={handleStartPayment}
            onSimulatePayment={handleSimulatePayment}
            onStartProcessing={handleStartProcessing}
            loading={loading || isProcessing}
          />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
}
