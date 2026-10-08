/**
 * Past-day cache: a layer around "fetch Results for these local dates".
 *
 * Days before yesterday are complete, so their Results are stored in browser
 * storage, one entry per Competition, timezone and local date. On a load,
 * cached days are reused and the wrapped fetch is asked only for the uncached
 * dates, from the oldest uncached date to today (today and yesterday are never
 * cached, so they are always included). That keeps it to one request per
 * Competition.
 *
 * Empty days are not stored, so a bad empty response is retried next load.
 * Entries older than the largest Window are deleted on each load.
 *
 * Tolerant by design: unavailable or full storage, bad JSON, a wrong shape or
 * another schema version never throws; the day is just treated as uncached.
 * Fetch failures are not swallowed: they propagate to the caller.
 */
import { WINDOW_DAYS } from './types';
import type { LocalDate, Result } from './types';
import { addDays, localDateOf } from './window';

const CACHE_VERSION = 1;
const KEY_PREFIX = `sports-aggregator:cache:v${CACHE_VERSION}`;

/** Fetch the Results kicking off on `dates` (oldest first, contiguous, ending today). */
export type FetchDates = (dates: LocalDate[]) => Promise<Result[]>;

export interface PastDayCacheOptions {
  storage: Storage | undefined;
  competitionId: string;
  timeZone: string;
  /** The viewer's local today. */
  today: LocalDate;
}

interface CacheEnvelope {
  version: number;
  results: Result[];
}

/** The storage key for one Competition's Results on one local date. */
export function cacheKey(competitionId: string, timeZone: string, date: LocalDate): string {
  return `${KEY_PREFIX}:${competitionId}:${timeZone}:${date}`;
}

/** The stored form of one day's Results. */
export function cacheValue(results: Result[]): string {
  const envelope: CacheEnvelope = { version: CACHE_VERSION, results };
  return JSON.stringify(envelope);
}

/**
 * Results for `dates` (oldest first, ending today), from the cache where it
 * can, and from one `fetchDates` call for the rest. Unordered.
 */
export async function loadWithPastDayCache(
  dates: LocalDate[],
  fetchDates: FetchDates,
  { storage, competitionId, timeZone, today }: PastDayCacheOptions,
): Promise<Result[]> {
  const yesterday = addDays(today, -1);
  const cacheable = (date: LocalDate) => date < yesterday;
  const key = (date: LocalDate) => cacheKey(competitionId, timeZone, date);

  const cached: Result[] = [];
  let firstUncached = dates.length;
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]!;
    const hit = cacheable(date) ? read(storage, key(date)) : undefined;
    if (hit === undefined) {
      firstUncached = i;
      break;
    }
    cached.push(...hit);
  }

  const uncachedDates = dates.slice(firstUncached);
  if (uncachedDates.length === 0) return cached;

  const requested = new Set(uncachedDates);
  const fetched = (await fetchDates(uncachedDates)).filter((r) =>
    requested.has(localDateOf(new Date(r.kickoff), timeZone)),
  );

  for (const date of uncachedDates.filter(cacheable)) {
    const day = fetched.filter((r) => localDateOf(new Date(r.kickoff), timeZone) === date);
    if (day.length > 0) write(storage, key(date), cacheValue(day));
  }
  prune(storage, addDays(today, -Math.max(...WINDOW_DAYS)));

  return [...cached, ...fetched];
}

function read(storage: Storage | undefined, key: string): Result[] | undefined {
  try {
    const raw = storage?.getItem(key);
    if (raw == null) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) return undefined;
    return parsed.results;
  } catch {
    return undefined;
  }
}

/** Delete cache entries for dates before `oldest` (any Competition or timezone). */
function prune(storage: Storage | undefined, oldest: LocalDate): void {
  try {
    if (!storage) return;
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      // Keys end in `:YYYY-MM-DD`.
      if (key?.startsWith(`${KEY_PREFIX}:`) && key.slice(-10) < oldest) stale.push(key);
    }
    stale.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage blocked: nothing to prune.
  }
}

function write(storage: Storage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage full or blocked: carry on without caching.
  }
}

function isEnvelope(value: unknown): value is CacheEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const { version, results } = value as Record<string, unknown>;
  return version === CACHE_VERSION && Array.isArray(results) && results.every(isResultLike);
}

function isResultLike(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  const team = (t: unknown) =>
    typeof t === 'object' &&
    t !== null &&
    typeof (t as Record<string, unknown>).name === 'string' &&
    typeof (t as Record<string, unknown>).score === 'number';
  return (
    typeof r.id === 'string' &&
    typeof r.competitionId === 'string' &&
    typeof r.kickoff === 'string' &&
    !Number.isNaN(Date.parse(r.kickoff)) &&
    (r.winner === 'home' || r.winner === 'away' || r.winner === 'draw') &&
    typeof r.matchDetailsUrl === 'string' &&
    team(r.home) &&
    team(r.away)
  );
}
