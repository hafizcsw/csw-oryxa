# Edge Function Security Inventory (configured functions)

| Class | Function | verify_jwt |
|---|---|---|
| admin/service only | `admin-crawl-dashboard-metrics` | `true` |
| admin/service only | `admin-crawl-reset-data` | `true` |
| admin/service only | `admin-crawl-set-paused` | `true` |
| admin/service only | `admin-cwur-import` | `true` |
| admin/service only | `admin-dashboard-summary` | `true` |
| admin/service only | `admin-events-recent` | `true` |
| admin/service only | `admin-flags-get` | `true` |
| admin/service only | `admin-flags-set` | `true` |
| admin/service only | `admin-generate-university-media` | `true` |
| admin/service only | `admin-programs-bulk` | `true` |
| admin/service only | `admin-scholarships-list` | `true` |
| admin/service only | `admin-scholarships-publish` | `true` |
| admin/service only | `admin-scholarships-upsert` | `true` |
| admin/service only | `admin-settings-get` | `true` |
| admin/service only | `admin-settings-save` | `true` |
| admin/service only | `admin-tuition-list` | `true` |
| admin/service only | `admin-tuition-proposal-approve` | `true` |
| admin/service only | `admin-tuition-proposals-list` | `true` |
| admin/service only | `crm-callback` | `false` |
| admin/service only | `crm-webhook-receiver` | `false` |
| admin/service only | `get-telemetry-dashboard` | `true` |
| admin/service only | `orx-beta-approve` | `true` |
| admin/service only | `orx-beta-gate` | `true` |
| admin/service only | `portal-admin-services-pricing` | `true` |
| admin/service only | `portal-translation-payment-webhook` | `false` |
| admin/service only | `website-webhook` | `false` |
| admin/service only | `whatsapp-webhook` | `false` |
| authenticated user | `account-link-visitor` | `true` |
| authenticated user | `account-upsert-profile` | `true` |
| authenticated user | `admissions-accept` | `true` |
| authenticated user | `admissions-compare` | `true` |
| authenticated user | `admissions-staleness-scan` | `true` |
| authenticated user | `alerts-heartbeat` | `true` |
| authenticated user | `analyze-university-image` | `true` |
| authenticated user | `backfill-name-ar` | `true` |
| authenticated user | `batch-generate-university-media` | `true` |
| authenticated user | `bridge-emit` | `true` |
| authenticated user | `bridge-flush` | `true` |
| authenticated user | `chat-sync` | `true` |
| authenticated user | `contract-list` | `true` |
| authenticated user | `contract-prepare` | `true` |
| authenticated user | `contract-sign` | `true` |
| authenticated user | `contract-signed-url` | `true` |
| authenticated user | `crawl-extract-worker` | `true` |
| authenticated user | `crawl-fetch-worker` | `true` |
| authenticated user | `crawl-orchestrator` | `true` |
| authenticated user | `crawl-verify-publish` | `true` |
| authenticated user | `crm-dispatch` | `true` |
| authenticated user | `crm-pull-portal-shortlist` | `true` |
| authenticated user | `data-quality-report` | `true` |
| authenticated user | `data-quality-scan` | `true` |
| authenticated user | `events-processor` | `true` |
| authenticated user | `fetch-university-logos` | `true` |
| authenticated user | `firecrawl-uniranks` | `true` |
| authenticated user | `link-visitor-phone` | `true` |
| authenticated user | `logos-fetch` | `true` |
| authenticated user | `notify-email` | `true` |
| authenticated user | `notify-whatsapp` | `true` |
| authenticated user | `orx-evidence-ingest` | `true` |
| authenticated user | `orx-pilot-closeout` | `true` |
| authenticated user | `orx-program-evidence-pilot` | `true` |
| authenticated user | `orx-real-entity-proof` | `true` |
| authenticated user | `orx-real-evidence-pilot` | `true` |
| authenticated user | `orx-score-aggregate` | `true` |
| authenticated user | `outbox-dispatch-now` | `true` |
| authenticated user | `portal-translation-download` | `true` |
| authenticated user | `portal-translation-job-update-slot` | `true` |
| authenticated user | `portal-translation-order-create` | `true` |
| authenticated user | `portal-translation-order-status` | `true` |
| authenticated user | `portal-translation-original-url` | `true` |
| authenticated user | `portal-translation-payment-simulate` | `true` |
| authenticated user | `portal-translation-payment-start` | `true` |
| authenticated user | `portal-translation-precheck` | `true` |
| authenticated user | `portal-translation-presign-upload` | `true` |
| authenticated user | `portal-translation-quote` | `true` |
| authenticated user | `portal-translation-quote-accept` | `true` |
| authenticated user | `portal-translation-quote-create` | `true` |
| authenticated user | `portal-translation-start-processing` | `true` |
| authenticated user | `portal-translation-update-delivery` | `true` |
| authenticated user | `portal-translation-upload-complete` | `true` |
| authenticated user | `prices-accept` | `true` |
| authenticated user | `prices-compare` | `true` |
| authenticated user | `prices-staleness-scan` | `true` |
| authenticated user | `qs-page-acquisition` | `true` |
| authenticated user | `report-university-pdf` | `true` |
| authenticated user | `search-university-images` | `true` |
| authenticated user | `translation-list` | `true` |
| authenticated user | `translation-signed-url` | `true` |
| authenticated user | `tuition-refresh-run` | `true` |
| authenticated user | `uniranks-approve-draft` | `true` |
| authenticated user | `uniranks-data-repair` | `true` |
| authenticated user | `uniranks-publish-batch` | `true` |
| authenticated user | `uniranks-qa-dashboard` | `true` |
| authenticated user | `wa-provider-health` | `true` |
| authenticated user | `website-enrich-orchestrator` | `true` |
| authenticated user | `website-enrich-worker` | `true` |
| authenticated user | `whatsapp-dispatch` | `true` |
| public | `ai-compare-programs` | `false` |
| public | `application-status` | `false` |
| public | `apply-doc-attach` | `false` |
| public | `apply-init` | `false` |
| public | `apply-submit` | `false` |
| public | `apply-submit-v2` | `false` |
| public | `apply-upload-url` | `false` |
| public | `assistant-process` | `false` |
| public | `assistant-process-stream` | `false` |
| public | `code-verify` | `false` |
| public | `exchange-rates` | `false` |
| public | `export-shortlist-pdf` | `false` |
| public | `get-program-details` | `false` |
| public | `get-settings` | `false` |
| public | `get-university-details` | `false` |
| public | `health` | `false` |
| public | `list-lookups` | `false` |
| public | `log-event` | `false` |
| public | `portal-auth` | `false` |
| public | `portal-programs-search` | `false` |
| public | `portal-verify` | `false` |
| public | `recommend-programs` | `false` |
| public | `refresh-popularity` | `false` |
| public | `search-events` | `false` |
| public | `search-programs` | `false` |
| public | `search-rollup-popularity` | `false` |
| public | `search-scholarships` | `false` |
| public | `search-track-click` | `false` |
| public | `search-universities` | `false` |
| public | `shortlist-list` | `false` |
| public | `shortlist-sync` | `false` |
| public | `shortlist-upsert` | `false` |
| public | `student-portal-api` | `false` |
| public | `telemetry-capture` | `false` |
| public | `track-event` | `false` |
| public | `translate-ticker` | `false` |
| public | `voice-to-text` | `false` |
| public | `web-application-submit` | `false` |
