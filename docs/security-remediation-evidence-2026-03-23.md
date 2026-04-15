# Security Remediation Evidence - 2026-03-23

## Hidden 1 Error extracted from repo state
- `supabase/config.toml` contained 16 function stanzas for functions that do not exist under `supabase/functions/`.
- Those stale entries were removed from the config so the configured function inventory now matches the checked-in Edge Function tree.

## verify_jwt contradiction resolution
- Remaining `verify_jwt = false` entries are now limited to either:
  - explicitly public endpoints, or
  - non-JWT webhook endpoints with an explicit signature/shared-secret model.
- Exact per-function disposition is recorded in `docs/security-edge-function-disposition-2026-03-23.md`.

## Hosted-scan evidence gap still external to repo
- The repo snapshot itself does not contain the hosted Security Advisor export for the hidden ignored findings list.
- Repo-local remediation therefore focuses on eliminating stale config errors, tightening JWT coverage, and documenting every checked-in function disposition.

## Dependency remediation status in this checkout
- `node_modules` are not present in the repository checkout.
- Registry-backed `npm audit` / install / build proof could not be completed from this checkout alone.
