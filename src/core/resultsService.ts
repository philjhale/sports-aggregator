/**
 * Results service: the domain core's entry point for the UI.
 *
 * - `layout` gives the visible Sports (config order) and their Competitions.
 * - `loadCompetition` fetches one Competition's Results for a Window. Each
 *   Competition loads independently, so the UI can render them as they arrive
 *   and retry one without touching the others.
 *
 * The outside world (fetch, clock, timezone, storage) is injected.
 */
import { loadWithPastDayCache } from './cache';
import {
  headerUrl,
  parseHeader,
  parseSiteScoreboard,
  siteScoreboardUrl,
} from './espn/adapter';
import type {
  Competition,
  CompetitionConfig,
  LocalDate,
  ResolvedWindow,
  Result,
  Sport,
  WindowDays,
} from './types';
import { resolveWindow } from './window';

export type CompetitionOutcome =
  | { status: 'results'; results: Result[] }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export interface SportSection {
  sport: Sport;
  competitions: Competition[];
}

export interface ResultsServiceDeps {
  fetch: typeof fetch;
  now: () => Date;
  timeZone: string;
  storage?: Storage;
}

export interface ResultsService {
  layout(config: CompetitionConfig, hidden?: ReadonlySet<string>): SportSection[];
  /** Load (or, for Retry, reload) one Competition. Never rejects. */
  loadCompetition(competition: Competition, days: WindowDays): Promise<CompetitionOutcome>;
}

export function createResultsService(deps: ResultsServiceDeps): ResultsService {
  return {
    layout(config, hidden = new Set()) {
      return [...config.sports]
        .sort((a, b) => a.order - b.order)
        .map((sport) => ({
          sport,
          competitions: config.competitions.filter(
            (c) => c.sportId === sport.id && !hidden.has(c.id),
          ),
        }))
        .filter((section) => section.competitions.length > 0);
    },

    async loadCompetition(competition, days) {
      const window = resolveWindow(days, deps.now(), deps.timeZone);
      const fetchSpan = (dates: LocalDate[]): Promise<Result[]> => {
        const span: ResolvedWindow = { ...window, dates, start: dates[0] ?? window.end };
        return fetchCompetitionResults(deps.fetch, competition, span);
      };
      try {
        const results = (
          await loadWithPastDayCache(window.dates, fetchSpan, {
            storage: deps.storage,
            competitionId: competition.id,
            timeZone: deps.timeZone,
            today: window.end,
          })
        ).sort((a, b) => b.kickoff.localeCompare(a.kickoff));
        return results.length > 0 ? { status: 'results', results } : { status: 'empty' };
      } catch {
        return { status: 'error', message: `Couldn't load ${competition.name} results.` };
      }
    },
  };
}

/**
 * Fetch one Competition's Results for a Window from ESPN.
 *
 * Primary: one scoreboard-header request for the whole Window. If that fails
 * (non-2xx, network error or unparseable body), fall back to one site-scoreboard
 * request per Window day. Rejects only if the fallback fails too.
 */
async function fetchCompetitionResults(
  fetchFn: typeof fetch,
  competition: Competition,
  window: ResolvedWindow,
): Promise<Result[]> {
  const { source } = competition;
  try {
    return parseHeader(await getJson(fetchFn, headerUrl(source, window)), competition);
  } catch {
    const days = await Promise.all(
      window.dates.map(async (date) =>
        parseSiteScoreboard(
          await getJson(fetchFn, siteScoreboardUrl(source, date, window.timeZone)),
          competition,
        ),
      ),
    );
    return dedupe(days.flat());
  }
}

async function getJson(fetchFn: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

/** Per-day responses can overlap; keep the first Result for each id. */
function dedupe(results: Result[]): Result[] {
  const seen = new Set<string>();
  return results.filter((r) => !seen.has(r.id) && seen.add(r.id));
}
