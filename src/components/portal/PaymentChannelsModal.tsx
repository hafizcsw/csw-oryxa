import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePaymentChannels, PaymentChannel } from "@/hooks/usePaymentChannels";
import { Building2, CreditCard, Wallet, Send, Link2, HelpCircle, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface PaymentChannelsModalProps {
  open: boolean;
  onClose: () => void;
  countryCode?: string;
}

const channelIcons: Record<string, React.ElementType> = {
  bank_transfer: Building2,
  paypal: CreditCard,
  usdt: Wallet,
  wise: Send,
  payment_link: Link2,
  other: HelpCircle,
};

const channelColors: Record<string, string> = {
  bank_transfer: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  paypal: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  usdt: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  wise: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  payment_link: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  other: 'bg-muted text-muted-foreground border-border',
};

export function PaymentChannelsModal({ open, onClose, countryCode }: PaymentChannelsModalProps) {
  const { channels, loading, error } = usePaymentChannels(countryCode);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast({ title: "تم النسخ", description: `تم نسخ ${fieldName}` });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast({ title: "خطأ", description: "فشل النسخ", variant: "destructive" });
    }
  };

  const renderChannelDetails = (channel: PaymentChannel) => {
    if (!channel.details) return null;

    return (
      <div className="mt-3 space-y-2">
        {Object.entries(channel.details).map(([key, value]) => (
          <div 
            key={key} 
            className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
          >
            <span className="text-muted-foreground">{key}:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-foreground" dir="ltr">{value}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => copyToClipboard(value, key)}
              >
                {copiedField === key ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            طرق الدفع المتاحة
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <HelpCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">لا توجد قنوات دفع متاحة حالياً</p>
            <p className="text-sm text-muted-foreground mt-2">
              تواصل معنا عبر واتساب لترتيب الدفع
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {channels.map((channel) => {
              const Icon = channelIcons[channel.channel_type] || HelpCircle;
              const colorClass = channelColors[channel.channel_type] || channelColors.other;

              return (
                <Card key={channel.id} className={`border ${colorClass.split(' ')[2]}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-3 text-base">
                      <div className={`p-2 rounded-lg border ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <span>{channel.display_name}</span>
                        {channel.currency && (
                          <span className="text-xs text-muted-foreground mr-2">
                            ({channel.currency})
                          </span>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                      {channel.instructions}
                    </div>
                    {renderChannelDetails(channel)}
                  </CardContent>
                </Card>
              );
            })}

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-sm">
              <p className="text-amber-700 dark:text-amber-400 font-medium mb-1">
                ⚠️ ملاحظة مهمة
              </p>
              <p className="text-muted-foreground">
                بعد إتمام الدفع، قم برفع إثبات الدفع (صورة أو PDF) من خلال زر "رفعت الإثبات" 
                وسيتم مراجعته خلال 24-48 ساعة.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
