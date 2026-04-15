/**
 * Institution Search Page
 * Search for existing institutions to claim
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, Building2, MapPin, ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { InstitutionSearchResult } from '@/types/institution';
import { motion } from 'framer-motion';

export default function InstitutionSearch() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InstitutionSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      // Search universities table
      const { data, error } = await supabase
        .from('universities')
        .select('id, name, country_code, city')
        .or(`name.ilike.%${query}%,name_ar.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;

      setResults((data || []).map(u => ({
        id: u.id,
        name: u.name || '',
        country: u.country_code || '',
        city: u.city || '',
        claimed: false, // Will be resolved by backend
      })));
    } catch (err) {
      console.error('[InstitutionSearch] Error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/institution/onboarding')}
          className="gap-2 text-muted-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Button>

        <h1 className="text-xl font-bold text-foreground mb-2">
          {t('institution.search.title')}
        </h1>
        <p className="text-muted-foreground mb-6">
          {t('institution.search.description')}
        </p>

        {/* Search Bar */}
        <div className="flex gap-2 mb-6">
          <Input
            placeholder={t('institution.search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-12 rounded-xl"
          />
          <Button onClick={handleSearch} disabled={loading} className="h-12 px-6 rounded-xl">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
          </Button>
        </div>

        {/* Results */}
        {loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            {t('common.searching')}
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">{t('institution.search.noResults')}</p>
            <Button
              onClick={() => navigate('/institution/claim', { state: { mode: 'new', prefill: { institution_name: query } } })}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('institution.search.requestAdd')}
            </Button>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((inst, i) => (
              <motion.div
                key={inst.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{inst.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {inst.city ? `${inst.city}, ` : ''}{inst.country}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/institution/claim', { state: { mode: 'claim', institution: inst } })}
                >
                  {t('institution.search.claimThis')}
                </Button>
              </motion.div>
            ))}

            <div className="text-center pt-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/institution/claim', { state: { mode: 'new', prefill: { institution_name: query } } })}
                className="gap-2 text-muted-foreground"
              >
                <Plus className="w-4 h-4" />
                {t('institution.search.notFound')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
