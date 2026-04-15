/**
 * Super Admin Institution Preview Context
 * Allows admins to preview any institution's dashboard without logging in as that institution.
 * Stored in sessionStorage for persistence across page navigations within same tab.
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { InstitutionAccessState, InstitutionRole } from '@/types/institution';

interface PreviewContext {
  active: boolean;
  institutionId: string | null;
  institutionName: string | null;
  accessState: InstitutionAccessState;
  role: InstitutionRole;
  allowedModules: string[];
}

interface InstitutionPreviewContextValue {
  preview: PreviewContext;
  isPreviewActive: boolean;
  startPreview: (opts: {
    institutionId: string;
    institutionName: string;
    accessState?: InstitutionAccessState;
    role?: InstitutionRole;
    allowedModules?: string[];
  }) => void;
  updatePreviewState: (state: InstitutionAccessState) => void;
  switchInstitution: () => void;
  exitPreview: () => void;
  /** Opens the institution picker */
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
}

const STORAGE_KEY = 'institution_preview_ctx';

const defaultPreview: PreviewContext = {
  active: false,
  institutionId: null,
  institutionName: null,
  accessState: 'verified',
  role: 'owner',
  allowedModules: [],
};

const InstitutionPreviewCtx = createContext<InstitutionPreviewContextValue | null>(null);

function loadFromStorage(): PreviewContext {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultPreview;
}

function saveToStorage(ctx: PreviewContext) {
  try {
    if (ctx.active) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export function InstitutionPreviewProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<PreviewContext>(loadFromStorage);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    saveToStorage(preview);
  }, [preview]);

  const startPreview = useCallback((opts: {
    institutionId: string;
    institutionName: string;
    accessState?: InstitutionAccessState;
    role?: InstitutionRole;
    allowedModules?: string[];
  }) => {
    setPreview({
      active: true,
      institutionId: opts.institutionId,
      institutionName: opts.institutionName,
      accessState: opts.accessState || 'verified',
      role: opts.role || 'owner',
      allowedModules: opts.allowedModules || [],
    });
    setShowPicker(false);
  }, []);

  const updatePreviewState = useCallback((state: InstitutionAccessState) => {
    setPreview(prev => ({ ...prev, accessState: state }));
  }, []);

  const switchInstitution = useCallback(() => {
    setShowPicker(true);
  }, []);

  const exitPreview = useCallback(() => {
    setPreview(defaultPreview);
    setShowPicker(false);
  }, []);

  return (
    <InstitutionPreviewCtx.Provider value={{
      preview,
      isPreviewActive: preview.active,
      startPreview,
      updatePreviewState,
      switchInstitution,
      exitPreview,
      showPicker,
      setShowPicker,
    }}>
      {children}
    </InstitutionPreviewCtx.Provider>
  );
}

export function useInstitutionPreview() {
  const ctx = useContext(InstitutionPreviewCtx);
  if (!ctx) throw new Error('useInstitutionPreview must be used within InstitutionPreviewProvider');
  return ctx;
}
