/** Today as YYYY-MM-DD in the browser's local timezone -- the format (and
 * the zone) <input type="date"> works in. */
export function todayISO(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
