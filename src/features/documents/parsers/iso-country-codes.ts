// ═══════════════════════════════════════════════════════════════
// ISO country code lookup — STUB (legacy table removed)
// ═══════════════════════════════════════════════════════════════
// Real lookups will come from the Mistral pipeline output.
// This stub preserves the import contract for legacy callers.
// ═══════════════════════════════════════════════════════════════

export interface CountryLookupResult {
  alpha2: string | null;
  alpha3: string | null;
  name: string | null;
  name_en: string | null;
}

export function lookupCountry(_codeOrName: string | null | undefined): CountryLookupResult {
  return { alpha2: null, alpha3: null, name: null, name_en: null };
}
