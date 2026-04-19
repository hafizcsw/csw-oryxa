#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Foundation Privacy Guard — Build-time check
# ═══════════════════════════════════════════════════════════════
# Greps src/features/documents/foundation/ for any reference to
# known external doc/OCR/LLM endpoints. Fails the build if found.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

DIR="src/features/documents/foundation"
PATTERNS=(
  "api\\.openai\\.com"
  "api\\.anthropic\\.com"
  "api\\.mistral\\.ai"
  "generativelanguage\\.googleapis\\.com"
  "cognitiveservices\\.azure\\.com"
  "api\\.cognitive\\.microsoft\\.com"
  "documentai\\.googleapis\\.com"
  "vision\\.googleapis\\.com"
  "textract\\.amazonaws\\.com"
  "api\\.deepseek\\.com"
)

FAIL=0
for pat in "${PATTERNS[@]}"; do
  # Exclude privacy-guard.ts itself — it legitimately lists these hosts.
  if grep -RIn --include='*.ts' --exclude='privacy-guard.ts' -E "$pat" "$DIR" 2>/dev/null; then
    echo "❌ Foundation references forbidden external endpoint: $pat"
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo "❌ Foundation privacy guard FAILED."
  exit 1
fi

echo "✅ Foundation privacy guard passed (no external raw doc paths)."
