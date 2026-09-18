export const WORKSPACE_TIMEZONE = "Asia/Kolkata";

export function calendarDay(at = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WORKSPACE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
