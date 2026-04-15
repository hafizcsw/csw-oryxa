/**
 * Dynamic Translation Keys Whitelist
 * 
 * These keys are called dynamically via t(variable) and MUST NOT be deleted
 * during dead-key cleanup, even if static analysis doesn't find literal usage.
 * 
 * Categories:
 * - Payment statuses
 * - Document statuses  
 * - Customer stages (CRM)
 * - Month names (charts)
 * - Config-driven labels
 */

// ========== Payment Statuses ==========
export const PAYMENT_STATUS_KEYS = [
  'Pending',
  'Paid', 
  'Failed',
  'Requested',
  'Cancelled',
  'Refunded',
  'Processing',
  'payment.pending',
  'payment.paid',
  'payment.failed',
  'payment.requested',
] as const;

// ========== Document Statuses ==========
export const DOCUMENT_STATUS_KEYS = [
  'Received',
  'Verified',
  'Rejected',
  'Pending',
  'Missing',
  'Expired',
  'document.received',
  'document.verified',
  'document.rejected',
  'document.pending',
  'document.missing',
] as const;

// ========== Customer Stages (CRM) ==========
export const CUSTOMER_STAGE_KEYS = [
  'new_lead',
  'visitor',
  'qualified',
  'contacted',
  'applicant',
  'enrolled',
  'rejected',
  'inactive',
  'stage.new_lead',
  'stage.visitor',
  'stage.qualified',
  'stage.contacted',
  'stage.applicant',
  'stage.enrolled',
] as const;

// ========== Month Names (Arabic) ==========
export const MONTH_KEYS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// ========== Application Statuses ==========
export const APPLICATION_STATUS_KEYS = [
  'draft',
  'submitted',
  'under_review',
  'accepted',
  'rejected',
  'withdrawn',
  'shortlisted',
  'app.draft',
  'app.submitted',
  'app.under_review',
  'app.accepted',
  'app.rejected',
] as const;

// ========== Service Types (from home_icons table) ==========
export const SERVICE_TYPE_KEYS = [
  'accommodation',
  'airport',
  'bank',
  'course',
  'health',
  'sim',
  'transfer',
  'visa',
  'csw',
  'services.accommodation.title',
  'services.airport.title',
  'services.bank.title',
  'services.course.title',
  'services.health.title',
  'services.sim.title',
  'services.transfer.title',
  'services.visa.title',
] as const;

// ========== Bot / Chat Keys ==========
export const BOT_KEYS = [
  'bot.name',
  'bot.welcome',
  'bot.intro',
  'bot.typing',
  'bot.searching',
  'bot.thinking_ack',
  'bot.searching_ack',
] as const;

// ========== Aggregate Whitelist ==========
export const DYNAMIC_WHITELIST = [
  ...PAYMENT_STATUS_KEYS,
  ...DOCUMENT_STATUS_KEYS,
  ...CUSTOMER_STAGE_KEYS,
  ...MONTH_KEYS,
  ...APPLICATION_STATUS_KEYS,
  ...SERVICE_TYPE_KEYS,
  ...BOT_KEYS,
] as const;

export type DynamicKey = typeof DYNAMIC_WHITELIST[number];

/**
 * Check if a key is in the dynamic whitelist
 */
export function isWhitelistedKey(key: string): boolean {
  return DYNAMIC_WHITELIST.includes(key as DynamicKey);
}

/**
 * Get all whitelisted keys as a Set for faster lookup
 */
export function getWhitelistSet(): Set<string> {
  return new Set(DYNAMIC_WHITELIST);
}
