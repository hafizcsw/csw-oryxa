import { useLanguage } from '@/contexts/LanguageContext';
import OryxaLogo from '@/assets/oryxa-logo.png';
import { GraduationCap, Globe, Shield, Sparkles, Star } from 'lucide-react';
import { motion } from 'framer-motion';

export function AuthBranding() {
  const { t } = useLanguage();

  const features = [
    { icon: Globe, key: 'auth.brand.feature1' },
    { icon: GraduationCap, key: 'auth.brand.feature2' },
    { icon: Shield, key: 'auth.brand.feature3' },
    { icon: Sparkles, key: 'auth.brand.feature4' },
  ];

  return (
    <div className="relative flex flex-col justify-between h-full min-h-[600px] bg-secondary text-secondary-foreground rounded-3xl overflow-hidden">
      {/* Rich layered background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gold mesh accents */}
        <div className="absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full bg-primary/6 blur-[80px]" />
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(hsl(var(--secondary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--secondary-foreground)) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">
        {/* Top: Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <img 
            src={OryxaLogo} 
            alt="ORYXA" 
            className="h-12 w-auto object-contain brightness-0 invert opacity-90" 
          />
        </motion.div>

        {/* Center: Hero text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="space-y-5 my-8"
        >
          <h2 className="text-3xl xl:text-4xl font-extrabold leading-[1.15] tracking-tight">
            {t('auth.brand.headline')}
          </h2>
          <p className="text-base xl:text-lg text-secondary-foreground/60 leading-relaxed max-w-[400px]">
            {t('auth.brand.subheadline')}
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-3.5"
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-[18px] h-[18px] text-primary" />
              </div>
              <span className="text-sm font-medium text-secondary-foreground/75">
                {t(feature.key)}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom: Social proof / trust */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-8 pt-6 border-t border-secondary-foreground/8 flex items-center gap-3"
        >
          <div className="flex -space-x-1.5 rtl:space-x-reverse">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 text-primary fill-primary" />
            ))}
          </div>
          <p className="text-xs text-secondary-foreground/40">
            {t('auth.brand.trust')}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
