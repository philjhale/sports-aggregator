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
import { headerUrl, parseHeader } from './espn/adapter';
import type { Competition, CompetitionConfig, Result, Sport, WindowDays } from './types';
import { localDateOf, resolveWindow } from './window';

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
      try {
        const response = await deps.fetch(headerUrl(competition.source, window));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const inWindow = new Set(window.dates);
        const results = parseHeader(await response.json(), competition)
          .filter((r) => inWindow.has(localDateOf(new Date(r.kickoff), deps.timeZone)))
          .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
        return results.length > 0 ? { status: 'results', results } : { status: 'empty' };
      } catch {
        return { status: 'error', message: `Couldn't load ${competition.name} results.` };
      }
    },
  };
}
