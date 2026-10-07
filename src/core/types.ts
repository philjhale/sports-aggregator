/** Domain types. Terms follow GLOSSARY.md. No React here. */

export interface Sport {
  id: string;
  name: string;
  /** Lower comes first. */
  order: number;
}

/** Where a Competition's Results come from. Only ESPN for now. */
export interface EspnSource {
  kind: 'espn';
  /** ESPN sport slug, e.g. `basketball`. */
  sport: string;
  /** ESPN league slug or id, e.g. `nba` or `267979`. */
  league: string;
}

export type CompetitionSource = EspnSource;

export interface Competition {
  id: string;
  sportId: string;
  name: string;
  source: CompetitionSource;
}

export interface CompetitionConfig {
  sports: Sport[];
  competitions: Competition[];
}

export interface Team {
  name: string;
  shortName: string;
  logoUrl?: string;
  score: number;
}

export type Winner = 'home' | 'away' | 'draw';

export interface Result {
  id: string;
  competitionId: string;
  /** Kick-off instant, ISO 8601 UTC. */
  kickoff: string;
  home: Team;
  away: Team;
  /** E.g. `OT`, `2OT`, `AET`, as given by the source. */
  extraTime?: string;
  matchDetailsUrl: string;
  winner: Winner;
}

export const WINDOW_DAYS = [1, 3, 7, 14] as const;
export type WindowDays = (typeof WINDOW_DAYS)[number];
export const DEFAULT_WINDOW: WindowDays = 3;

/** A calendar date in the viewer's timezone, `YYYY-MM-DD`. */
export type LocalDate = string;

/** A Window resolved against a "now" and timezone. */
export interface ResolvedWindow {
  days: WindowDays;
  timeZone: string;
  /** Oldest first; the last entry is today. */
  dates: LocalDate[];
  start: LocalDate;
  end: LocalDate;
}
