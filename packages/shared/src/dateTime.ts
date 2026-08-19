/**
 * Formats a date/time for display with FIXED locale + options, for the same reason
 * `formatAmount` (see currency.ts) pins its number grouping: a bare `.toLocaleString()` with no
 * arguments renders using whatever locale the viewer's browser/OS happens to be set to --
 * DD/MM vs MM/DD ordering, 24h vs 12h clock, comma placement -- so the identical timestamp can
 * read differently to two admins looking at the same record on different machines.
 */
export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
