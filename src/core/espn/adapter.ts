/**
 * The ESPN adapter: the only place that knows ESPN URLs and JSON shapes.
 * It turns ESPN responses into Results, tolerantly: a malformed event is
 * skipped, never fatal. An unparseable body throws `EspnParseError`.
 */
import type { Competition, EspnSource, ResolvedWindow, Result, TeamResult, Winner } from '../types';
import { compactDate } from '../window';

export class EspnParseError extends Error {}

/** One scoreboard-header request covering the whole Window. */
export function headerUrl(source: EspnSource, window: ResolvedWindow): string {
  const params = new URLSearchParams({
    sport: source.sport,
    league: source.league,
    dates: `${compactDate(window.start)}-${compactDate(window.end)}`,
    tz: window.timeZone,
    limit: '1000',
  });
  return `https://site.web.api.espn.com/apis/v2/scoreboard/header?${params}`;
}

/** Parse the scoreboard header shape (`sports[0].leagues[0].events`). */
export function parseHeader(body: unknown, competition: Competition): Result[] {
  const events = at(body, 'sports', 0, 'leagues', 0, 'events');
  if (!Array.isArray(events)) throw new EspnParseError('Unexpected ESPN header response');
  return events.flatMap((event) => {
    const result = parseHeaderEvent(event, competition);
    return result ? [result] : [];
  });
}

const DROPPED_STATUSES = new Set([
  'STATUS_POSTPONED',
  'STATUS_CANCELED',
  'STATUS_CANCELLED',
  'STATUS_SUSPENDED',
  'STATUS_ABANDONED',
  'STATUS_DELAYED',
  'STATUS_FORFEIT',
]);

function parseHeaderEvent(event: unknown, competition: Competition): Result | undefined {
  const id = str(at(event, 'id'));
  const kickoff = str(at(event, 'date'));
  const statusType = at(event, 'fullStatus', 'type');
  if (!id || !kickoff || Number.isNaN(Date.parse(kickoff))) return undefined;
  if (!isFinished(statusType, str(at(event, 'status')))) return undefined;

  const competitors = at(event, 'competitors');
  if (!Array.isArray(competitors)) return undefined;
  const home = team(competitors.find((c) => at(c, 'homeAway') === 'home'));
  const away = team(competitors.find((c) => at(c, 'homeAway') === 'away'));
  if (!home || !away) return undefined;

  const extraTime = extraTimeMarker(str(at(statusType, 'detail')) ?? str(at(event, 'summary')));
  return {
    id,
    competitionId: competition.id,
    kickoff: new Date(kickoff).toISOString(),
    home,
    away,
    ...(extraTime ? { extraTime } : {}),
    matchDetailsUrl: str(at(event, 'link')) ?? fallbackMatchDetailsUrl(competition, id),
    winner: winnerOf(home, away),
  };
}

function isFinished(statusType: unknown, state: string | undefined): boolean {
  const name = str(at(statusType, 'name'));
  if (name && DROPPED_STATUSES.has(name)) return false;
  const completed = at(statusType, 'completed');
  if (typeof completed === 'boolean') return completed;
  return state === 'post';
}

function team(competitor: unknown): TeamResult | undefined {
  const name = str(at(competitor, 'displayName'));
  const score = Number.parseFloat(str(at(competitor, 'score')) ?? '');
  if (!name || !Number.isFinite(score)) return undefined;
  const logoUrl = str(at(competitor, 'logo'));
  return {
    name,
    shortName: str(at(competitor, 'shortDisplayName')) ?? name,
    ...(logoUrl ? { logoUrl } : {}),
    score,
  };
}

function winnerOf(home: TeamResult, away: TeamResult): Winner {
  if (home.score === away.score) return 'draw';
  return home.score > away.score ? 'home' : 'away';
}

/** "Final/OT" → "OT", "Final/2OT" → "2OT", "AET" → "AET". */
function extraTimeMarker(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const suffix = detail.match(/\/\s*(\w+)\s*$/);
  if (suffix) return suffix[1];
  return /^AET$/i.test(detail.trim()) ? 'AET' : undefined;
}

function fallbackMatchDetailsUrl(competition: Competition, id: string): string {
  return `https://www.espn.com/${competition.source.league}/game/_/gameId/${id}`;
}

function at(value: unknown, ...path: (string | number)[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}
