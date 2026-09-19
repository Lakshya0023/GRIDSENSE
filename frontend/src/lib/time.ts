/** Formats all operator-facing timestamps in the control room's local standard. */
export function formatIst(value: string | number | Date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  }).format(new Date(value));
}
