/**
 * Institution Onboarding Page
 * First screen after institution signup - guides to claim/search
 */
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Building2, Search, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function InstitutionOnboarding() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Building2 className="w-8 h-8 text-primary" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('institution.onboarding.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('institution.onboarding.description')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-8">
            {/* Search existing */}
            <button
              onClick={() => navigate('/institution/search')}
              className="p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-right"
            >
              <Search className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">
                {t('institution.onboarding.searchExisting')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('institution.onboarding.searchExistingDesc')}
              </p>
            </button>

            {/* Request new */}
            <button
              onClick={() => navigate('/institution/claim', { state: { mode: 'new' } })}
              className="p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-right"
            >
              <Plus className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">
                {t('institution.onboarding.requestNew')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('institution.onboarding.requestNewDesc')}
              </p>
            </button>
          </div>

          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.backToHome')}
          </Button>
        </motion.div>
      </div>
    </Layout>
  );
}
