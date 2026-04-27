# Crawler v2 Agent Handoff

Use the GitHub Action **Crawler v2 ITMO Smoke** for runtime checks. Do not use browser Console or manual SQL.

## Required GitHub Secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN` only needed if deploying functions

## Current runtime status

Closed: 1A, 1B, 1C, 1D, Order 3 AI Extract.

Remaining: 4 Draft Writer, 5 ORX Mapper, 6 Verify/Publish gate, 1E Review Surface, 2 Queue Controls.

## Rules

Do not publish. Do not run all universities. Do not run country crawl. Do not mutate canonical data.
The workflow writes `crawler-v2-itmo-smoke-report.json` as artifact.
