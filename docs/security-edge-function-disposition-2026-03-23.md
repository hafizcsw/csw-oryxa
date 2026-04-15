# Edge Function Security Disposition

| Function | verify_jwt | Disposition | Proof model |
|---|---|---|---|
| `account-link-visitor` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `account-upsert-profile` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-crawl-dashboard-metrics` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-crawl-reset-data` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-crawl-set-paused` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-cwur-import` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-dashboard-summary` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-events-recent` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-flags-get` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-flags-set` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-generate-university-media` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-programs-bulk` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-scholarships-list` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-scholarships-publish` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-scholarships-upsert` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-settings-get` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-settings-save` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-tuition-list` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-tuition-proposal-approve` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admin-tuition-proposals-list` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admissions-accept` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admissions-compare` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `admissions-staleness-scan` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `ai-compare-programs` | `false` | B: keep false | public compare helper |
| `alerts-heartbeat` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `analyze-university-image` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `application-status` | `false` | B: keep false | public status lookup |
| `apply-doc-attach` | `false` | B: keep false | public application upload flow |
| `apply-init` | `false` | B: keep false | public application bootstrap |
| `apply-submit` | `false` | B: keep false | public application submission |
| `apply-submit-v2` | `false` | B: keep false | public application submission |
| `apply-upload-url` | `false` | B: keep false | public application upload flow |
| `assistant-process` | `false` | B: keep false | guest + authenticated chat with per-request token handling |
| `assistant-process-stream` | `false` | B: keep false | guest + authenticated chat with per-request token handling |
| `backfill-name-ar` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `batch-generate-university-media` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `bridge-emit` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `bridge-flush` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `chat-sync` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `code-verify` | `false` | B: keep false | public code verification |
| `contract-list` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `contract-prepare` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `contract-sign` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `contract-signed-url` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `crawl-extract-worker` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `crawl-fetch-worker` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `crawl-orchestrator` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `crawl-verify-publish` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `crm-callback` | `false` | B: keep false | HMAC via x-csw-signature |
| `crm-dispatch` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `crm-pull-portal-shortlist` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `crm-webhook-receiver` | `false` | B: keep false | shared-secret header x-webhook-secret |
| `data-quality-report` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `data-quality-scan` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `events-processor` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `exchange-rates` | `false` | B: keep false | public exchange-rate read |
| `export-shortlist-pdf` | `false` | B: keep false | guest shortlist export |
| `fetch-university-logos` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `firecrawl-uniranks` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `get-program-details` | `false` | B: keep false | public detail read |
| `get-settings` | `false` | B: keep false | public settings read |
| `get-telemetry-dashboard` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `get-university-details` | `false` | B: keep false | public detail read |
| `health` | `false` | B: keep false | public healthcheck |
| `link-visitor-phone` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `list-lookups` | `false` | B: keep false | public lookup catalog |
| `log-event` | `false` | B: keep false | public browser telemetry ingest |
| `logos-fetch` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `notify-email` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `notify-whatsapp` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `orx-beta-approve` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `orx-beta-gate` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `orx-evidence-ingest` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `orx-pilot-closeout` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `orx-program-evidence-pilot` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `orx-real-entity-proof` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `orx-real-evidence-pilot` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `orx-score-aggregate` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `outbox-dispatch-now` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-admin-services-pricing` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-auth` | `false` | B: keep false | public OTP auth proxy |
| `portal-programs-search` | `false` | B: keep false | public portal search |
| `portal-translation-download` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-job-update-slot` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-order-create` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-order-status` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-original-url` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-payment-simulate` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-payment-start` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-payment-webhook` | `false` | B: keep false | Stripe signature verified webhook |
| `portal-translation-precheck` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-presign-upload` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-quote` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-quote-accept` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-quote-create` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-start-processing` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-update-delivery` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-translation-upload-complete` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `portal-verify` | `false` | B: keep false | public token verification proxy with allowlisted redirect origin |
| `prices-accept` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `prices-compare` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `prices-staleness-scan` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `qs-page-acquisition` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `recommend-programs` | `false` | B: keep false | public recommendation read |
| `refresh-popularity` | `false` | B: keep false | public popularity refresh |
| `report-university-pdf` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `search-events` | `false` | B: keep false | public search API |
| `search-programs` | `false` | B: keep false | public search API |
| `search-rollup-popularity` | `false` | B: keep false | public popularity rollup trigger |
| `search-scholarships` | `false` | B: keep false | public search API |
| `search-track-click` | `false` | B: keep false | public search click tracking |
| `search-universities` | `false` | B: keep false | public search API |
| `search-university-images` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `shortlist-list` | `false` | B: keep false | guest shortlist support |
| `shortlist-sync` | `false` | B: keep false | guest shortlist support |
| `shortlist-upsert` | `false` | B: keep false | guest shortlist support |
| `student-portal-api` | `false` | B: keep false | mixed endpoint; code-enforced PUBLIC_ACTIONS + JWT for protected actions |
| `telemetry-capture` | `false` | B: keep false | public telemetry ingest |
| `track-event` | `false` | B: keep false | public analytics ingest |
| `translate-ticker` | `false` | B: keep false | public ticker helper |
| `translation-list` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `translation-signed-url` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `tuition-refresh-run` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `uniranks-approve-draft` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `uniranks-data-repair` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `uniranks-publish-batch` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `uniranks-qa-dashboard` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `voice-to-text` | `false` | B: keep false | public voice utility |
| `wa-provider-health` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `web-application-submit` | `false` | B: keep false | public lead/application intake |
| `website-enrich-orchestrator` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `website-enrich-worker` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `website-webhook` | `false` | B: keep false | HMAC via x-oryxa-timestamp + x-oryxa-signature |
| `whatsapp-dispatch` | `true` | A: verify_jwt=true | runtime JWT gate in config |
| `whatsapp-webhook` | `false` | B: keep false | HMAC via x-webhook-signature |
