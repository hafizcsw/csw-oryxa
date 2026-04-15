// استخراج معلومات الرسوم من النص
import { pageHasNumbersCurrency } from "./extract-utils.ts";

export interface TuitionData {
  amount: number | null;
  currency: string | null;
  academic_year: string | null;
  confidence: number;
}

// كلمات دالة على الرسوم بلغات مختلفة
const FEE_KEYWORDS: Record<string, string[]> = {
  en: ["tuition", "fee", "fees", "cost", "costs", "tuition fee", "annual fee", "yearly fee"],
  ar: ["رسوم", "تكلفة", "الرسوم الدراسية", "المصاريف"],
  de: ["Studiengebühren", "Gebühren", "Kosten"],
  es: ["matrícula", "tasas", "costos", "costes"],
  fr: ["frais", "coût", "frais de scolarité"],
  ru: ["плата", "стоимость", "оплата"]
};

// أنماط للسنة الأكاديمية
const YEAR_PATTERNS = [
  /20\d{2}[\/-]20?\d{2}/g,  // 2024/25, 2024-2025
  /20\d{2}[\/-]\d{2}/g,      // 2024/25
  /academic year 20\d{2}/gi,  // academic year 2024
  /for 20\d{2}/gi            // for 2024
];

/**
 * استخراج معلومات الرسوم من نص HTML أو عادي
 */
export function extractTuitionFromText(
  text: string,
  expectedCurrency?: string,
  lang = "en"
): TuitionData {
  // تنظيف النص
  const cleanText = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  // استخراج السنة الأكاديمية
  const academic_year = extractAcademicYear(text);

  // استخراج المبلغ والعملة
  const { amount, currency, confidence } = extractAmountAndCurrency(
    cleanText,
    expectedCurrency,
    lang
  );

  return {
    amount,
    currency,
    academic_year,
    confidence
  };
}

/**
 * استخراج السنة الأكاديمية من النص
 */
function extractAcademicYear(text: string): string | null {
  for (const pattern of YEAR_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * استخراج المبلغ والعملة
 */
function extractAmountAndCurrency(
  text: string,
  expectedCurrency?: string,
  lang = "en"
): { amount: number | null; currency: string | null; confidence: number } {
  // أنماط العملات الشائعة
  const currencyPatterns: Record<string, RegExp> = {
    GBP: /£\s*([\d,]+(?:\.\d{2})?)/g,
    USD: /\$\s*([\d,]+(?:\.\d{2})?)/g,
    EUR: /€\s*([\d,]+(?:\.\d{2})?)/g,
    AUD: /AU?\$\s*([\d,]+(?:\.\d{2})?)/g,
    CAD: /CA?\$\s*([\d,]+(?:\.\d{2})?)/g
  };

  // إضافة نمط العملة المتوقعة إذا لم يكن موجوداً
  if (expectedCurrency && !currencyPatterns[expectedCurrency]) {
    currencyPatterns[expectedCurrency] = new RegExp(
      `${expectedCurrency}\\s*([\\d,]+(?:\\.\\d{2})?)`,
      "g"
    );
  }

  const amounts: Array<{ amount: number; currency: string; context: string }> = [];

  // البحث عن المبالغ مع سياقها
  for (const [curr, pattern] of Object.entries(currencyPatterns)) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amountStr = match[1].replace(/,/g, "");
      const amount = parseFloat(amountStr);
      
      if (!isNaN(amount) && amount > 0) {
        // استخراج السياق (50 حرف قبل وبعد)
        const start = Math.max(0, match.index - 50);
        const end = Math.min(text.length, match.index + match[0].length + 50);
        const context = text.substring(start, end);
        
        amounts.push({ amount, currency: curr, context });
      }
    }
  }

  if (amounts.length === 0) {
    return { amount: null, currency: null, confidence: 0 };
  }

  // تصفية المبالغ بناءً على السياق
  const keywords = FEE_KEYWORDS[lang] || FEE_KEYWORDS.en;
  const relevantAmounts = amounts.filter((item) =>
    keywords.some((kw) => item.context.includes(kw))
  );

  if (relevantAmounts.length === 0) {
    // إذا لم نجد مبالغ مع كلمات مفتاحية، نأخذ أعلى مبلغ (غالباً الرسوم)
    const highest = amounts.reduce((max, item) =>
      item.amount > max.amount ? item : max
    );
    return { ...highest, confidence: 0.3 };
  }

  // نأخذ المبلغ الأكثر ذكراً في سياق الرسوم
  const mostRelevant = relevantAmounts.reduce((best, item) => {
    const score = keywords.filter((kw) => item.context.includes(kw)).length;
    const bestScore = keywords.filter((kw) => best.context.includes(kw)).length;
    return score > bestScore ? item : best;
  });

  return { ...mostRelevant, confidence: 0.8 };
}

/**
 * التحقق من صحة البيانات المستخرجة
 */
export function validateTuitionData(
  data: TuitionData,
  minConfidence = 0.5
): boolean {
  return (
    data.amount !== null &&
    data.amount > 0 &&
    data.currency !== null &&
    data.confidence >= minConfidence
  );
}

/**
 * دالة مساعدة لحساب hash
 */
export async function computeHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
