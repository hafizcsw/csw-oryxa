// ═══════════════════════════════════════════════════════════════
// MRZ Character Recovery — heuristic post-OCR cleanup
// ═══════════════════════════════════════════════════════════════
// Tesseract on camera shots of OCR-B confuses '<' filler with K/(/[/«/{/R
// and confuses 0↔O, 1↔I, 5↔S, 8↔B in digit zones. This module reverses
// those confusions BEFORE handing lines to the strict ICAO parser.
//
// Strategy:
//  1. Tail-filler normalization: any run of K/«/[/(/{/R/space at the end of
//     a line (length ≥2) collapses to '<' fillers.
//  2. Embedded filler runs: K{2,}, R{3,} surrounded by '<' or end-of-line
//     are converted to '<' of equal length.
//  3. Digit-zone repair on TD3 line 2: positions [0..9], [13..19], [21..27]
//     are pure-digit zones — letters O→0, I/L→1, S→5, B→8, Z→2, G→6.
//  4. Pad-end with '<' to expected length.
// ═══════════════════════════════════════════════════════════════

const FILLER_CONFUSIONS = /[K«\[\(\{R]/g;

function digitRepair(zone: string): string {
  return zone
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/Z/g, '2')
    .replace(/G/g, '6')
    .replace(/Q/g, '0');
}

/**
 * Recover an MRZ line that has already passed `cleanMrz` (so contains
 * only [A-Z0-9<]) but may still have OCR confusions.
 *
 * @param line   cleaned MRZ line (uppercase, [A-Z0-9<])
 * @param expectedLength  44 (TD3) | 36 (TD2) | 30 (TD1)
 * @param isLine2 true if this is line 2 of TD3/TD2 (digit-zone repair)
 */
export function recoverMrzLine(
  rawLine: string,
  expectedLength: number,
  isLine2 = false,
): string {
  if (!rawLine) return rawLine;
  let line = rawLine;

  // 1. Tail-filler normalization. Examples:
  //    "...REMA<<<<<KKKK"   → "...REMA<<<<<<<<<"
  //    "...ELSHIKH<<REMA<<KK<<«<" → all trailing non-alnum → '<'
  line = line.replace(/[K«\[\(\{R<\s]{2,}$/g, m =>
    '<'.repeat(m.replace(/\s/g, '').length || m.length),
  );

  // 2. Embedded filler runs of length ≥3 surrounded by name tokens.
  //    Conservative: only collapse runs of K/R that are ≥3 long.
  line = line.replace(/K{3,}/g, m => '<'.repeat(m.length));
  line = line.replace(/R{4,}/g, m => '<'.repeat(m.length));

  // 3. Generic confusion sweep where filler-likely chars sit between '<' fillers
  //    e.g. "<<K<<" or "<K<" → "<<<<<" / "<<<"
  line = line.replace(/<[K«\[\(\{]+</g, m => '<'.repeat(m.length));

  // 4. Digit-zone repair (line 2 of TD3/TD2 only).
  if (isLine2 && line.length >= 28) {
    const padded = line.padEnd(expectedLength, '<');
    const segments = [
      padded.slice(0, 9),                    // [0..9]  passport number (alnum, but mostly digit)
      padded.slice(9, 10),                   // check digit
      padded.slice(10, 13),                  // nationality alpha-3 (letters only)
      digitRepair(padded.slice(13, 19)),     // DOB YYMMDD
      padded.slice(19, 20),                  // check digit
      padded.slice(20, 21),                  // gender M/F/<
      digitRepair(padded.slice(21, 27)),     // expiry YYMMDD
      padded.slice(27, 28),                  // check digit
      padded.slice(28),                      // optional + composite
    ];
    line = segments.join('');
    // Repair check-digit positions individually if they are letters.
    const repairCheck = (s: string, idx: number): string => {
      if (idx >= s.length) return s;
      const c = s[idx];
      if (/\d/.test(c) || c === '<') return s;
      const repaired = digitRepair(c);
      if (repaired === c) return s;
      return s.slice(0, idx) + repaired + s.slice(idx + 1);
    };
    line = repairCheck(line, 9);
    line = repairCheck(line, 19);
    line = repairCheck(line, 27);
  }

  // 5. Pad to expected length.
  if (line.length < expectedLength) {
    line = line.padEnd(expectedLength, '<');
  }

  return line;
}

/**
 * Quick predicate: does this line look like it CONTAINS an MRZ even if
 * OCR mangled the fillers? Used to trigger recovery / second-pass OCR.
 */
export function looksLikeMrzLine(line: string): boolean {
  if (!line || line.length < 20) return false;
  // canonical filler
  if (/<{2,}/.test(line)) return true;
  // filler-confusion: K{4,} run is almost never legitimate text
  if (/K{4,}/.test(line)) return true;
  // document-type marker followed by 3 letters (issuing country)
  if (/[PI][A-Z<][A-Z<]{3}/.test(line)) return true;
  return false;
}
