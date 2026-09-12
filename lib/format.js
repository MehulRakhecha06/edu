/**
 * Deterministic date/time formatting — ALWAYS use these in UI components.
 *
 * Why not `new Date(x).toLocaleDateString()`?
 * The server (Node) and the browser may use different locales/timezones, so
 * the SAME date renders as "9/10/2026" on the server and "10/09/2026" in the
 * browser → React hydration error ("server rendered text didn't match the
 * client"). These helpers format with a FIXED format and FIXED timezone, so
 * server and client always produce identical strings.
 *
 * Display timezone: Nepal (UTC+5:45) — the app's audience. Nepal has no
 * daylight saving, so a fixed offset is exact. Change OFFSET_MINUTES if the
 * app is ever deployed for another country.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const OFFSET_MINUTES = 5 * 60 + 45; // Nepal Standard Time, no DST

function toParts(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const local = new Date(d.getTime() + OFFSET_MINUTES * 60 * 1000);
  return {
    day: String(local.getUTCDate()).padStart(2, '0'),
    month: MONTHS[local.getUTCMonth()],
    year: local.getUTCFullYear(),
    hours: local.getUTCHours(),
    minutes: String(local.getUTCMinutes()).padStart(2, '0'),
  };
}

/** "10 Sep 2026" */
export function formatDate(iso) {
  const p = toParts(iso);
  return p ? `${p.day} ${p.month} ${p.year}` : '';
}

/** "10 Sep 2026, 3:45 PM" */
export function formatDateTime(iso) {
  const p = toParts(iso);
  if (!p) return '';
  const h12 = p.hours % 12 || 12;
  const ampm = p.hours >= 12 ? 'PM' : 'AM';
  return `${p.day} ${p.month} ${p.year}, ${h12}:${p.minutes} ${ampm}`;
}
