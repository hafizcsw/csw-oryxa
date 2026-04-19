// ═══════════════════════════════════════════════════════════════
// Vite plugin — Foundation Privacy Guard (build-time enforcement)
// ═══════════════════════════════════════════════════════════════
// Greps src/features/documents/foundation/ for any reference to
// known external doc/OCR/LLM endpoints. Fails the build if found.
// Runs at config-resolve time (every dev-start, every build, every
// vitest run) — so the script is wired into the actual build, not
// just an orphan file.
// ═══════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const FOUNDATION_DIR = 'src/features/documents/foundation';
const ALLOW_FILE = 'privacy-guard.ts'; // legitimately lists the hostnames

const FORBIDDEN = [
  /api\.openai\.com/i,
  /api\.anthropic\.com/i,
  /api\.mistral\.ai/i,
  /generativelanguage\.googleapis\.com/i,
  /cognitiveservices\.azure\.com/i,
  /api\.cognitive\.microsoft\.com/i,
  /documentai\.googleapis\.com/i,
  /vision\.googleapis\.com/i,
  /textract\.amazonaws\.com/i,
  /api\.deepseek\.com/i,
];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walk(p, out);
    else if (e.endsWith('.ts') && e !== ALLOW_FILE) out.push(p);
  }
  return out;
}

export function foundationPrivacyGuardPlugin(): Plugin {
  return {
    name: 'foundation-privacy-guard',
    enforce: 'pre',
    configResolved() {
      const violations: string[] = [];
      for (const file of walk(FOUNDATION_DIR)) {
        const content = readFileSync(file, 'utf8');
        for (const re of FORBIDDEN) {
          if (re.test(content)) {
            violations.push(`${file} → ${re.source}`);
          }
        }
      }
      if (violations.length) {
        const msg =
          '[foundation-privacy-guard] BUILD BLOCKED — external raw doc paths found:\n  ' +
          violations.join('\n  ');
        // eslint-disable-next-line no-console
        console.error(msg);
        throw new Error(msg);
      }
      // eslint-disable-next-line no-console
      console.log('[foundation-privacy-guard] ✅ no external raw doc paths in foundation/');
    },
  };
}
