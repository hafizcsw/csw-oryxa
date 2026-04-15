/** Format seconds into localized duration string */
export function formatDuration(seconds: number, t: (key: string) => string): string {
  if (!seconds || seconds === 0) return "—";
  if (seconds < 60) return `${seconds} ${t("dashboard.time.seconds")}`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}${t("dashboard.time.minutes")} ${s}${t("dashboard.time.seconds")}`;
}
