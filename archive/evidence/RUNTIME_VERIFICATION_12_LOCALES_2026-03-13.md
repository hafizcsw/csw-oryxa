# Runtime Verification — 12 Locale Rollout (2026-03-13)

## Scope
Runtime-only verification against publicly reachable runtime at `https://cswworld.com`.

## Environment blockers (local runtime)
- `npm install` is blocked by registry `403 Forbidden` errors, so local app startup and local re-verification were not possible in this environment.
- Browser runtime checks were executed against production URL with Playwright Firefox.

## Runtime evidence collected

### A) Locale routing checks (`/<locale>/universities`)
Playwright Firefox runtime output:

```json
{"locales": [{"locale": "en", "status": 200, "requested": "https://cswworld.com/en/universities", "final_url": "https://cswworld.com/en/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "ar", "status": 200, "requested": "https://cswworld.com/ar/universities", "final_url": "https://cswworld.com/ar/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "fr", "status": 200, "requested": "https://cswworld.com/fr/universities", "final_url": "https://cswworld.com/fr/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "ru", "status": 200, "requested": "https://cswworld.com/ru/universities", "final_url": "https://cswworld.com/ru/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "es", "status": 200, "requested": "https://cswworld.com/es/universities", "final_url": "https://cswworld.com/es/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "zh", "status": 200, "requested": "https://cswworld.com/zh/universities", "final_url": "https://cswworld.com/zh/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "hi", "status": 200, "requested": "https://cswworld.com/hi/universities", "final_url": "https://cswworld.com/hi/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "bn", "status": 200, "requested": "https://cswworld.com/bn/universities", "final_url": "https://cswworld.com/bn/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "pt", "status": 200, "requested": "https://cswworld.com/pt/universities", "final_url": "https://cswworld.com/pt/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "ja", "status": 200, "requested": "https://cswworld.com/ja/universities", "final_url": "https://cswworld.com/ja/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "de", "status": 200, "requested": "https://cswworld.com/de/universities", "final_url": "https://cswworld.com/de/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}, {"locale": "ko", "status": 200, "requested": "https://cswworld.com/ko/universities", "final_url": "https://cswworld.com/ko/universities", "title": "csw world - Your Gateway to Global Education", "canonical": "https://cswworld.com/", "alt_count": 0}]}
```

Additional runtime body check for 3 prefixed locales:

```json
[{"url": "https://cswworld.com/en/universities", "h1": "404", "body_snippet": "404\n\nOops! Page not found\n\nReturn to Home"}, {"url": "https://cswworld.com/ar/universities", "h1": "404", "body_snippet": "404\n\nOops! Page not found\n\nReturn to Home"}, {"url": "https://cswworld.com/fr/universities", "h1": "404", "body_snippet": "404\n\nOops! Page not found\n\nReturn to Home"}]
```

Screenshot artifact showing prefixed locale route rendering 404 UI:
- `browser:/tmp/codex_browser_invocations/cc5824fd5348a147/artifacts/artifacts/check-2.png`

### B) Listing/search surface (`/universities`)
Runtime output:

```json
{"url": "https://cswworld.com/universities", "title": "Search Universities, Programs & Scholarships | CSW Student Portal", "h1": null, "snippet": "Community\nNews and articles\nEvents\nFind us\nv131712\nToggle theme\nEN\nStudy destinations\nFind a university\nIELTS\nStudent Es"}
```

Screenshot artifact showing working listing cards/filter shell:
- `browser:/tmp/codex_browser_invocations/a065510ede657462/artifacts/artifacts/lang-menu.png`

### C) University/program details surface
Attempt via fixed IDs:

```json
[{"url": "https://cswworld.com/university/1", "title": "csw world - Your Gateway to Global Education", "h1": null, "snippet": "Community\nNews and articles\nEvents\nFind us\nv131712\nToggle theme\nEN\nStudy destinations\nFind a university\nIELTS\nStudent Es"}, {"url": "https://cswworld.com/program/1", "title": "csw world - Your Gateway to Global Education", "h1": null, "snippet": "Loading..."}]
```

This does not prove populated detail rendering for representative entities; only proves routes do not hard-crash the shell for these specific IDs.

### D) SEO runtime checks (representative locales)
Playwright runtime output:

```json
[{"url": "https://cswworld.com/fr/universities", "title": "csw world - Your Gateway to Global Education", "meta_desc": "Search and compare universities worldwide. Find programs in Russia, Germany, UK, Canada, Turkey, Australia, and more. Budget filters, AI guidance, and comprehensive student services.", "canonical": "https://cswworld.com/", "x_default": 0, "hreflangs": 0}, {"url": "https://cswworld.com/ja/universities", "title": "csw world - Your Gateway to Global Education", "meta_desc": "Search and compare universities worldwide. Find programs in Russia, Germany, UK, Canada, Turkey, Australia, and more. Budget filters, AI guidance, and comprehensive student services.", "canonical": "https://cswworld.com/", "x_default": 0, "hreflangs": 0}, {"url": "https://cswworld.com/ar/universities", "title": "csw world - Your Gateway to Global Education", "meta_desc": "Search and compare universities worldwide. Find programs in Russia, Germany, UK, Canada, Turkey, Australia, and more. Budget filters, AI guidance, and comprehensive student services.", "canonical": "https://cswworld.com/", "x_default": 0, "hreflangs": 0}]
```

Observation: canonical is root (`https://cswworld.com/`) and hreflang alternates are absent on tested locale URLs.

### E) Lane B graceful behavior
Not runtime-verifiable in this environment for this turn:
- Could not execute local app/function runtime due dependency installation blocker (registry 403).
- No authenticated/staging control surface was available here to deterministically toggle/force provider states (`disabled`, `missing key`, `unsupported provider`, `provider unavailable`) and capture runtime logs/responses.

## Exact runtime blockers detected
1. **Localized prefixed routing renders NotFound UI**
   - Surface: `/<locale>/universities` including `en`, `ar`, and new locales.
   - Symptom: visible `404 Oops! Page not found` in rendered app.
   - Evidence: Playwright body/h1 extraction + screenshot artifact above.

2. **Locale SEO alternates/canonical mismatch on prefixed locales**
   - Surface: locale-prefixed university listing URLs.
   - Symptom: canonical resolves to root; hreflang/x-default alternates absent (`0`).
   - Evidence: Playwright metadata extraction JSON above.

No code patch applied in this turn (runtime verification/evidence pass only).
