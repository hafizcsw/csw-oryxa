import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, Package, ArrowRight, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DeliveryDestinationCards, type DeliveryDestination } from './DeliveryDestinationCards';
import { TranslationTimeline, type ProcessingStage } from './TranslationTimeline';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PostPaymentConfirmationProps {
  orderId: string;
  orderNumber: string;
  documentCount: number;
  currentStatus: string;
  initialDeliveryDestination?: DeliveryDestination;
  initialNotificationChannels?: string[];
  onNewOrder: () => void;
}

export function PostPaymentConfirmation({
  orderId,
  orderNumber,
  documentCount,
  currentStatus,
  initialDeliveryDestination,
  initialNotificationChannels = ['email'],
  onNewOrder,
}: PostPaymentConfirmationProps) {
  const { t } = useTranslation('translation');
  const navigate = useNavigate();
  const { toast } = useToast();
  const isRTL = document.documentElement.dir === 'rtl';

  const [deliveryDestination, setDeliveryDestination] = useState<DeliveryDestination | null>(
    initialDeliveryDestination || null
  );
  const [notificationChannels, setNotificationChannels] = useState<string[]>(initialNotificationChannels);
  const [saving, setSaving] = useState(false);

  // Map current order status to processing stage
  const getProcessingStage = (): ProcessingStage => {
    switch (currentStatus) {
      case 'paid':
      case 'processing_ocr':
        return 'processing_ocr';
      case 'processing_extract':
        return 'processing_extract';
      case 'processing_translate':
        return 'processing_translate';
      case 'processing_render':
        return 'processing_render';
      case 'draft_ready':
        return 'notarization';
      case 'notarized_scan_ready':
      case 'delivered':
        return 'delivery';
      default:
        return 'payment_received';
    }
  };

  const handleNotificationToggle = (channel: string) => {
    setNotificationChannels(prev =>
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  const handleSaveDelivery = async () => {
    if (!deliveryDestination) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('portal-translation-update-delivery', {
        body: {
          order_id: orderId,
          delivery_destination: deliveryDestination,
          notification_channels: notificationChannels,
        },
      });

      if (error) throw error;

      toast({
        title: t('postPayment.deliverySaved'),
        variant: 'default',
      });
    } catch (error) {
      console.error('Failed to save delivery:', error);
      toast({
        title: t('errors.processingFailed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Success Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('postPayment.title')}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('postPayment.orderNumber')}: <span className="font-mono font-semibold">{orderNumber}</span>
        </p>
        <p className="text-muted-foreground mt-1">
          {t('postPayment.documentsUploaded', { count: documentCount })}
        </p>
      </motion.div>

      {/* Delivery Destination Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t('postPayment.whereToDeliver')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryDestinationCards
              selected={deliveryDestination}
              onSelect={setDeliveryDestination}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Estimated Time */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t('postPayment.estimatedTime')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div>
                  <p className="font-medium">{t('postPayment.digitalTranslation')}</p>
                  <p className="text-sm text-muted-foreground">24-48 {t('postPayment.hours')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <div>
                  <p className="font-medium">{t('postPayment.notarization')}</p>
                  <p className="text-sm text-muted-foreground">+2-3 {t('postPayment.days')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <div>
                  <p className="font-medium">{t('postPayment.delivery')}</p>
                  <p className="text-sm text-muted-foreground">{t('postPayment.dependsOnDestination')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Processing Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('postPayment.stages')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TranslationTimeline currentStage={getProcessingStage()} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Notification Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('postPayment.notifications')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              {['email', 'whatsapp', 'sms'].map((channel) => (
                <div key={channel} className="flex items-center gap-2">
                  <Checkbox
                    id={`notify-${channel}`}
                    checked={notificationChannels.includes(channel)}
                    onCheckedChange={() => handleNotificationToggle(channel)}
                  />
                  <Label htmlFor={`notify-${channel}`} className="cursor-pointer">
                    {t(`notifications.${channel}`)}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="flex flex-col sm:flex-row gap-4 justify-center"
      >
        {deliveryDestination && (
          <Button
            onClick={handleSaveDelivery}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {t('postPayment.saveDelivery')}
          </Button>
        )}
        
        <Button
          variant="outline"
          onClick={() => navigate('/app/translation/orders')}
          className="gap-2"
        >
          {t('postPayment.trackOrders')}
          {isRTL ? null : <ArrowRight className="w-4 h-4" />}
        </Button>
        
        <Button
          variant="secondary"
          onClick={onNewOrder}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('postPayment.newOrder')}
        </Button>
      </motion.div>
    </div>
  );
}
