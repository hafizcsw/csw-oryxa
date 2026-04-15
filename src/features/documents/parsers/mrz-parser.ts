// ═══════════════════════════════════════════════════════════════
// MRZ Parser — Door 3: Machine Readable Zone extraction
// ═══════════════════════════════════════════════════════════════
// Parses MRZ lines from passport text to extract identity fields.
// Pure regex. No external LLM. No AI.
// Supports TD3 (passport) format: 2 lines of 44 characters.
// ═══════════════════════════════════════════════════════════════

export interface MrzResult {
  found: boolean;
  raw_mrz: string | null;
  surname: string | null;
  given_names: string | null;
  passport_number: string | null;
  nationality: string | null;
  date_of_birth: string | null;     // YYYY-MM-DD
  gender: string | null;            // M | F | X
  expiry_date: string | null;       // YYYY-MM-DD
  issuing_country: string | null;
  confidence: number;               // 0.0–1.0
}

/** Country code mapping for common 3-letter codes */
const COUNTRY_CODES: Record<string, string> = {
  'SYR': 'SY', 'IRQ': 'IQ', 'JOR': 'JO', 'LBN': 'LB', 'EGY': 'EG',
  'SAU': 'SA', 'ARE': 'AE', 'TUR': 'TR', 'IRN': 'IR', 'PAK': 'PK',
  'IND': 'IN', 'USA': 'US', 'GBR': 'GB', 'DEU': 'DE', 'FRA': 'FR',
  'RUS': 'RU', 'CHN': 'CN', 'KOR': 'KR', 'JPN': 'JP', 'CAN': 'CA',
  'AUS': 'AU', 'NLD': 'NL', 'ESP': 'ES', 'ITA': 'IT', 'BRA': 'BR',
  'MEX': 'MX', 'KWT': 'KW', 'QAT': 'QA', 'BHR': 'BH', 'OMN': 'OM',
  'YEM': 'YE', 'SDN': 'SD', 'LBY': 'LY', 'MAR': 'MA', 'TUN': 'TN',
  'DZA': 'DZ', 'PSE': 'PS', 'MYS': 'MY', 'IDN': 'ID', 'BGD': 'BD',
  'UKR': 'UA', 'POL': 'PL', 'UZB': 'UZ', 'KAZ': 'KZ', 'AZE': 'AZ',
  'GEO': 'GE', 'ARM': 'AM', 'AFG': 'AF', 'NGA': 'NG', 'KEN': 'KE',
  'GHA': 'GH', 'ETH': 'ET', 'TZA': 'TZ', 'ZAF': 'ZA',
};

function cleanMrz(text: string): string {
  // MRZ uses < as filler — normalize
  return text.replace(/[^A-Z0-9<]/g, '');
}

function parseMrzDate(dateStr: string): string | null {
  // MRZ date format: YYMMDD
  if (dateStr.length !== 6 || !/^\d{6}$/.test(dateStr)) return null;
  const yy = parseInt(dateStr.slice(0, 2));
  const mm = dateStr.slice(2, 4);
  const dd = dateStr.slice(4, 6);
  // Heuristic: years > 30 are 1900s, else 2000s
  const century = yy > 30 ? '19' : '20';
  return `${century}${dateStr.slice(0, 2)}-${mm}-${dd}`;
}

function parseName(nameField: string): { surname: string; given_names: string } {
  const parts = nameField.split('<<');
  const surname = (parts[0] || '').replace(/</g, ' ').trim();
  const given = (parts[1] || '').replace(/</g, ' ').trim();
  return { surname, given_names: given };
}

/**
 * Attempt to find and parse MRZ lines from document text.
 * Returns structured passport data if MRZ is found.
 */
export function parseMrz(text: string): MrzResult {
  const empty: MrzResult = {
    found: false, raw_mrz: null, surname: null, given_names: null,
    passport_number: null, nationality: null, date_of_birth: null,
    gender: null, expiry_date: null, issuing_country: null, confidence: 0,
  };

  if (!text || text.length < 44) return empty;

  // Find MRZ-like lines (44+ chars with < and uppercase)
  const lines = text.split(/\n|\r/).map(l => l.trim()).filter(l => l.length >= 40);
  
  // Look for TD3 passport pattern: line starting with P<
  let line1 = '';
  let line2 = '';

  for (let i = 0; i < lines.length; i++) {
    const cleaned = cleanMrz(lines[i]);
    if (cleaned.length >= 44 && /^P[A-Z<]/.test(cleaned)) {
      line1 = cleaned.slice(0, 44);
      // Next line with 44+ chars
      for (let j = i + 1; j < lines.length; j++) {
        const nextCleaned = cleanMrz(lines[j]);
        if (nextCleaned.length >= 44 && /^[A-Z0-9<]{44}/.test(nextCleaned)) {
          line2 = nextCleaned.slice(0, 44);
          break;
        }
      }
      if (line2) break;
    }
  }

  if (!line1 || !line2) return empty;

  // Parse Line 1: P<ISSUING_COUNTRY<SURNAME<<GIVEN_NAMES<<<...
  const issuingCode3 = line1.slice(2, 5).replace(/</g, '');
  const nameField = line1.slice(5);
  const { surname, given_names } = parseName(nameField);

  // Parse Line 2: PASSPORT_NUMBER<CHECK DOB CHECK GENDER EXPIRY CHECK ...
  const passportNumber = line2.slice(0, 9).replace(/</g, '');
  const nationality3 = line2.slice(10, 13).replace(/</g, '');
  const dobRaw = line2.slice(13, 19);
  const genderChar = line2.slice(20, 21);
  const expiryRaw = line2.slice(21, 27);

  const dob = parseMrzDate(dobRaw);
  const expiry = parseMrzDate(expiryRaw);
  const gender = genderChar === 'M' ? 'M' : genderChar === 'F' ? 'F' : genderChar === '<' ? null : 'X';

  const issuingCountry = COUNTRY_CODES[issuingCode3] || issuingCode3 || null;
  const nationality = COUNTRY_CODES[nationality3] || nationality3 || null;

  // Calculate confidence based on how many fields we got
  let fieldCount = 0;
  if (surname) fieldCount++;
  if (given_names) fieldCount++;
  if (passportNumber && passportNumber.length >= 5) fieldCount++;
  if (nationality) fieldCount++;
  if (dob) fieldCount++;
  if (gender) fieldCount++;
  if (expiry) fieldCount++;
  if (issuingCountry) fieldCount++;

  const confidence = Math.min(fieldCount / 8, 1.0);

  return {
    found: true,
    raw_mrz: `${line1}\n${line2}`,
    surname,
    given_names,
    passport_number: passportNumber || null,
    nationality,
    date_of_birth: dob,
    gender,
    expiry_date: expiry,
    issuing_country: issuingCountry,
    confidence,
  };
}
