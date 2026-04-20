// ═══════════════════════════════════════════════════════════════
// ISO country code lookup — STUB (legacy table removed)
// ═══════════════════════════════════════════════════════════════
// The real lookup table is no longer needed in the client; the
// Mistral pipeline returns ISO-3166 alpha-2 directly. This stub
// keeps the import contract for any remaining callers.
// ═══════════════════════════════════════════════════════════════

export interface CountryLookupResult {
  alpha2: string | null;
  alpha3: string | null;
  name: string | null;
}

export function lookupCountry(_codeOrName: string | null | undefined): CountryLookupResult {
  return { alpha2: null, alpha3: null, name: null };
}
