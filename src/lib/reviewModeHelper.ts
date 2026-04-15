/**
 * Review Mode has been removed from the website runtime.
 *
 * This helper remains as a compatibility shim so merge targets that still
 * reference it do not reintroduce review-only suppression behavior.
 */

export function isTrackingDisabled(): boolean {
  return false;
}

export function getReviewMode(): string {
  return "normal";
}
