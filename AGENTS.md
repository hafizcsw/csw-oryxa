# CSW Oryxa — Agent Rules

GitHub is the source of truth for code.

Supabase project ref: `pkivavsxbvwtnkgxaufa`.

## Crawler v2 ITMO target

- run_id: `f67313a4-883d-4074-90cd-a68f047cb495`
- run_item_id: `0098a363-e2cd-4493-ba92-bf234b2227fa`
- university_id: `055a0d4b-f0a2-404a-a064-2c0f4e40e302`
- website: `https://itmo.ru/`

## Closed runtime

1A, 1B, 1C, 1D, Order 3 AI Extract.

## Safety

No Run All. No country crawl. No publish. Do not call `publish_item` or `rpc_v2_publish_run_item`.
Do not mutate canonical tables: `universities`, `programs`, `university_media`, `orx_scores`.
Do not invoke legacy OSC / crawl-runner / website-enrichment.

## Crawler language rule

Crawler is language-agnostic. Detect source language per page/evidence. Preserve original evidence quote.
No 12-locale crawler logic. UI labels only use i18n if visible.

## Smoke test

Use `.github/workflows/crawler-v2-itmo-smoke.yml` and `scripts/crawler-v2-itmo-smoke.mjs`.
