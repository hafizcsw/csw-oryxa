/**
 * Institution Picker Modal for Super Admin Preview Mode
 * Forced LTR layout with full-width search
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useInstitutionPreview } from '@/contexts/InstitutionPreviewContext';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, MapPin, CheckCircle2, Lock, Clock, Ban, ArrowRight, X, Loader2 } from 'lucide-react';
import type { InstitutionAccessState } from '@/types/institution';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface UniversityResult {
  id: string;
  name_en: string | null;
  name_ar: string;
  country_code: string;
  city: string | null;
  logo_url: string | null;
}

const PREVIEW_STATES: { value: InstitutionAccessState; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { value: 'verified', label: 'Verified', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' },
  { value: 'restricted', label: 'Restricted', icon: Lock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800' },
  { value: 'claim_submitted', label: 'Pending', icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800' },
  { value: 'suspended', label: 'Locked', icon: Ban, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800' },
];

export function InstitutionPickerModal() {
  const { showPicker, setShowPicker, startPreview } = useInstitutionPreview();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UniversityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<UniversityResult | null>(null);
  const [previewState, setPreviewState] = useState<InstitutionAccessState>('verified');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => setShowPicker(true);
    window.addEventListener('open-institution-picker', handler);
    return () => window.removeEventListener('open-institution-picker', handler);
  }, [setShowPicker]);

  useEffect(() => {
    if (showPicker && !selected) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [showPicker, selected]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('universities')
        .select('id, name_en, name_ar, country_code, city, logo_url')
        .or(`name_en.ilike.%${q}%,name_ar.ilike.%${q}%`)
        .limit(20);
      setResults((data as UniversityResult[]) || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleConfirm = () => {
    if (!selected) return;
    const stateRoutes: Record<string, string> = {
      verified: '/',
      restricted: '/',
      claim_submitted: '/institution/pending',
      under_review: '/institution/pending',
      suspended: '/institution/locked',
    };
    startPreview({
      institutionId: selected.id,
      institutionName: selected.name_en || selected.name_ar,
      accessState: previewState,
    });
    navigate(stateRoutes[previewState] || '/');
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setShowPicker(false);
      setSelected(null);
      setQuery('');
    }
  };

  const displayName = (uni: UniversityResult) => uni.name_en || uni.name_ar;
  const secondaryName = (uni: UniversityResult) =>
    uni.name_en && uni.name_ar && uni.name_en !== uni.name_ar ? uni.name_ar : null;
  const location = (uni: UniversityResult) =>
    [uni.city, uni.country_code].filter(Boolean).join(', ');

  return (
    <Dialog open={showPicker} onOpenChange={handleClose}>
      <DialogContent
        dir="ltr"
        className="sm:max-w-3xl p-0 gap-0 overflow-hidden border-border/60 shadow-2xl [&>button]:right-4 [&>button]:left-auto [&>button]:top-4"
      >
        <VisuallyHidden><DialogTitle>Institution Picker</DialogTitle></VisuallyHidden>

        {!selected ? (
          <div style={{ direction: 'ltr' }}>
            {/* ── Search Header ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '0 24px',
                borderBottom: '1px solid hsl(var(--border) / 0.4)',
                background: 'hsl(var(--muted) / 0.25)',
              }}
            >
              <Search style={{ width: 20, height: 20, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search by university name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  flex: 1,
                  height: 56,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 16,
                  fontWeight: 500,
                  color: 'hsl(var(--foreground))',
                }}
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); setResults([]); }}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'hsl(var(--muted))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <X style={{ width: 14, height: 14, color: 'hsl(var(--muted-foreground))' }} />
                </button>
              )}
            </div>

            {/* ── Results ── */}
            <div style={{ maxHeight: 460, overflowY: 'auto' }}>
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '80px 0', color: 'hsl(var(--muted-foreground))' }}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span style={{ fontSize: 14 }}>Searching...</span>
                </div>
              )}

              {!loading && query.length < 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', opacity: 0.5 }}>
                  <Building2 style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3, color: 'hsl(var(--muted-foreground))' }} />
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>Search for an institution</p>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 4, opacity: 0.6 }}>Type at least 2 characters</p>
                </div>
              )}

              {!loading && query.length >= 2 && results.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
                  <Search style={{ width: 40, height: 40, color: 'hsl(var(--muted-foreground))', opacity: 0.2, marginBottom: 12 }} />
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>No institutions found</p>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', opacity: 0.5, marginTop: 4 }}>Try a different search term</p>
                </div>
              )}

              {!loading && results.length > 0 && results.map((uni) => (
                <button
                  key={uni.id}
                  onClick={() => setSelected(uni)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 24px',
                    border: 'none',
                    borderBottom: '1px solid hsl(var(--border) / 0.2)',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  className="hover:bg-muted/60"
                >
                  {/* Logo */}
                  {uni.logo_url ? (
                    <img
                      src={uni.logo_url}
                      alt=""
                      style={{
                        width: 44, height: 44, borderRadius: 10,
                        objectFit: 'contain', flexShrink: 0,
                        border: '1px solid hsl(var(--border) / 0.4)',
                        padding: 2, background: 'hsl(var(--background))',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: 'hsl(var(--muted))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Building2 style={{ width: 20, height: 20, color: 'hsl(var(--muted-foreground))', opacity: 0.4 }} />
                    </div>
                  )}

                  {/* Name + Location combined */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 600,
                      color: 'hsl(var(--foreground))',
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                    }}>
                      {displayName(uni)}
                    </div>
                    {secondaryName(uni) && (
                      <div style={{
                        fontSize: 13, color: 'hsl(var(--muted-foreground))',
                        opacity: 0.7, marginTop: 3,
                      }}>
                        {secondaryName(uni)}
                      </div>
                    )}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 12, color: 'hsl(var(--muted-foreground))',
                      opacity: 0.55, marginTop: 4,
                    }}>
                      <MapPin style={{ width: 12, height: 12, flexShrink: 0 }} />
                      <span>{location(uni)}</span>
                    </div>
                  </div>

                  <ArrowRight style={{ width: 16, height: 16, color: 'hsl(var(--muted-foreground))', opacity: 0.2, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Selected + State Picker ── */
          <div style={{ padding: 24, direction: 'ltr' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: 16, borderRadius: 16,
              background: 'hsl(var(--muted) / 0.4)',
              border: '1px solid hsl(var(--border) / 0.5)',
              marginBottom: 20,
            }}>
              {selected.logo_url ? (
                <img src={selected.logo_url} alt="" style={{
                  width: 48, height: 48, borderRadius: 12, objectFit: 'contain',
                  border: '1px solid hsl(var(--border) / 0.4)', padding: 2, background: 'hsl(var(--background))',
                }} />
              ) : (
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'hsl(var(--primary) / 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 style={{ width: 24, height: 24, color: 'hsl(var(--primary))' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                  {displayName(selected)}
                </div>
                {secondaryName(selected) && (
                  <div style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))', opacity: 0.6 }}>
                    {secondaryName(selected)}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <MapPin style={{ width: 12, height: 12 }} />
                  {location(selected)}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelected(null)} className="shrink-0 rounded-lg h-8 text-xs">
                Change
              </Button>
            </div>

            {/* State selector */}
            <div style={{ marginBottom: 20 }}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Preview State</p>
              <div className="grid grid-cols-4 gap-2">
                {PREVIEW_STATES.map((s) => {
                  const Icon = s.icon;
                  const isActive = previewState === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setPreviewState(s.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3.5 rounded-xl text-xs font-semibold border transition-all',
                        isActive
                          ? cn(s.bg, 'ring-1 ring-primary/20')
                          : 'border-border/50 bg-background text-muted-foreground hover:bg-muted/50 hover:border-border'
                      )}
                    >
                      <Icon className={cn('w-5 h-5', isActive ? s.color : 'text-muted-foreground/40')} />
                      <span className={isActive ? 'text-foreground' : ''}>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={handleConfirm} className="w-full h-11 rounded-xl font-semibold gap-2 text-sm">
              Enter Preview Mode
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
