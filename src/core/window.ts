import type { LocalDate, ResolvedWindow, WindowDays } from './types';

/** The calendar date of `instant` in `timeZone`, as `YYYY-MM-DD`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Shift a calendar date by whole days (timezone-free arithmetic). */
export function addDays(date: LocalDate, delta: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Today and the N-1 calendar days before it, in the viewer's timezone. */
export function resolveWindow(days: WindowDays, now: Date, timeZone: string): ResolvedWindow {
  const today = localDateOf(now, timeZone);
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)));
  return { dates, end: today };
}

/** `YYYY-MM-DD` → `YYYYMMDD`, the form ESPN's `dates` parameter takes. */
export function compactDate(date: LocalDate): string {
  return date.replaceAll('-', '');
}
