import { Home, Building2, MapPin, CheckCircle2, RefreshCw, Truck, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlassIcon } from "@/components/ui/glass-icon";
import { glassColors, GlassColorVariant } from "@/lib/glass-colors";
import { useLanguage } from "@/contexts/LanguageContext";

interface DeliveryAddress {
  street: string;
  city: string;
  country: string;
  postal_code: string;
}

interface DeliverySelectionCardsProps {
  deliveryType: 'home' | 'work' | 'pickup';
  onTypeChange: (type: 'home' | 'work' | 'pickup') => void;
  address: DeliveryAddress;
  onAddressChange: (address: DeliveryAddress) => void;
  currentStatus?: string;
  onSave: () => void;
  isLoading?: boolean;
}

export function DeliverySelectionCards({
  deliveryType,
  onTypeChange,
  address,
  onAddressChange,
  currentStatus,
  onSave,
  isLoading
}: DeliverySelectionCardsProps) {
  const { t } = useLanguage();
  
  const deliveryOptions = [
    {
      id: 'home' as const,
      labelKey: 'portal.delivery.homeLabel',
      descriptionKey: 'portal.delivery.homeDescription',
      icon: Home,
      variant: 'info' as GlassColorVariant
    },
    {
      id: 'work' as const,
      labelKey: 'portal.delivery.workLabel',
      descriptionKey: 'portal.delivery.workDescription',
      icon: Building2,
      variant: 'purple' as GlassColorVariant
    },
    {
      id: 'pickup' as const,
      labelKey: 'portal.delivery.pickupLabel',
      descriptionKey: 'portal.delivery.pickupDescription',
      icon: MapPin,
      variant: 'success' as GlassColorVariant
    }
  ];

  const statusLabels: Record<string, { labelKey: string; variant: GlassColorVariant }> = {
    delivered: { labelKey: 'portal.delivery.status.delivered', variant: 'success' },
    shipped: { labelKey: 'portal.delivery.status.shipped', variant: 'info' },
    processing: { labelKey: 'portal.delivery.status.processing', variant: 'warning' },
    paid: { labelKey: 'portal.delivery.status.paid', variant: 'purple' },
    requested: { labelKey: 'portal.delivery.status.requested', variant: 'neutral' }
  };

  const needsAddress = deliveryType !== 'pickup';
  const statusInfo = currentStatus ? statusLabels[currentStatus] || statusLabels.requested : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Delivery Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {deliveryOptions.map((option) => {
          const isSelected = deliveryType === option.id;
          const Icon = option.icon;
          const colors = glassColors[option.variant];

          return (
            <motion.button
              key={option.id}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onTypeChange(option.id)}
              className={cn(
                "group relative overflow-hidden rounded-2xl p-6 text-right transition-all duration-500",
                "bg-card/50 backdrop-blur-xl border-2",
                isSelected 
                  ? `${colors.border} shadow-xl ${colors.glow}` 
                  : "border-border/50 hover:border-muted-foreground/30"
              )}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="absolute top-4 left-4"
                >
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center",
                    `bg-gradient-to-br ${colors.gradient}`
                  )}>
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </motion.div>
              )}

              {/* Sparkle for Selected */}
              {isSelected && (
                <motion.div
                  className="absolute top-4 right-4"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </motion.div>
              )}

              {/* Background Gradient */}
              <motion.div 
                className={cn(
                  "absolute inset-0 transition-opacity duration-500",
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-50",
                  `bg-gradient-to-br ${colors.bg}`
                )}
              />

              {/* Shimmer Effect */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <motion.div
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{ translateX: ['100%', '-100%'] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                />
              </div>

              <div className="relative space-y-4">
                {/* Glass Icon */}
                <GlassIcon 
                  icon={Icon}
                  variant={option.variant}
                  size="lg"
                  glow={isSelected}
                />

                {/* Text */}
                <div>
                  <h4 className="font-bold text-foreground text-lg">{t(option.labelKey)}</h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {t(option.descriptionKey)}
                  </p>
                </div>
              </div>

              {/* Bottom Glow Line */}
              <div className={cn(
                "absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 rounded-full transition-opacity duration-300",
                isSelected ? "opacity-100" : "opacity-0",
                `bg-gradient-to-r ${colors.gradient}`
              )} />
            </motion.button>
          );
        })}
      </div>

      {/* Address Form */}
      <AnimatePresence>
        {needsAddress && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-xl border-2 border-border/50 space-y-5">
              <h4 className="font-bold text-foreground flex items-center gap-3 text-lg">
                <GlassIcon icon={MapPin} variant="primary" size="sm" />
                {t('portal.delivery.addressTitle')}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="street" className="text-muted-foreground font-medium">{t('portal.delivery.streetLabel')}</Label>
                  <Input
                    id="street"
                    placeholder={t('portal.delivery.streetPlaceholder')}
                    value={address.street}
                    onChange={(e) => onAddressChange({ ...address, street: e.target.value })}
                    className="bg-background/50 h-12 rounded-xl border-2 focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-muted-foreground font-medium">{t('portal.delivery.cityLabel')}</Label>
                  <Input
                    id="city"
                    placeholder={t('portal.delivery.cityPlaceholder')}
                    value={address.city}
                    onChange={(e) => onAddressChange({ ...address, city: e.target.value })}
                    className="bg-background/50 h-12 rounded-xl border-2 focus:border-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-muted-foreground font-medium">{t('portal.delivery.countryLabel')}</Label>
                  <Input
                    id="country"
                    placeholder={t('portal.delivery.countryPlaceholder')}
                    value={address.country}
                    onChange={(e) => onAddressChange({ ...address, country: e.target.value })}
                    className="bg-background/50 h-12 rounded-xl border-2 focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal" className="text-muted-foreground font-medium">{t('portal.delivery.postalLabel')}</Label>
                  <Input
                    id="postal"
                    placeholder={t('portal.delivery.postalPlaceholder')}
                    value={address.postal_code}
                    onChange={(e) => onAddressChange({ ...address, postal_code: e.target.value })}
                    className="bg-background/50 h-12 rounded-xl border-2 focus:border-primary/50"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status & Save */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {statusInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Badge className={cn(
              "border-2 px-4 py-2 text-sm font-semibold",
              `${glassColors[statusInfo.variant].bg.replace('from-', 'bg-').split(' ')[0]}`,
              glassColors[statusInfo.variant].text,
              glassColors[statusInfo.variant].border
            )}>
              <Truck className="h-4 w-4 mr-2" />
              {t('portal.delivery.statusPrefix')}: {t(statusInfo.labelKey)}
            </Badge>
          </motion.div>
        )}

        <Button
          onClick={onSave}
          disabled={isLoading || (needsAddress && !address.city)}
          className={cn(
            "w-full md:w-auto gap-2 h-12 px-8 rounded-xl text-base font-semibold",
            "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground",
            "shadow-lg hover:shadow-xl hover:shadow-primary/20 transition-all duration-300"
          )}
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" />
              {t('portal.delivery.saving')}
            </>
          ) : (
            <>
              <Package className="h-5 w-5" />
              {t('portal.delivery.saveButton')}
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
