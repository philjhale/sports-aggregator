/**
 * The ESPN adapter: the only place that knows ESPN URLs and JSON shapes.
 * It turns ESPN responses into Results, tolerantly: a malformed event is
 * skipped, never fatal. An unparseable body throws `EspnParseError`.
 *
 * Two shapes are understood:
 * - the scoreboard header (`sports[0].leagues[0].events`), fetched once per Window;
 * - the site scoreboard (`events[].competitions[0]`), fetched once per day as a fallback.
 */
import type {
  Competition,
  EspnSource,
  LocalDate,
  ResolvedWindow,
  Result,
  TeamResult,
  Winner,
} from '../types';
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

/** One site-scoreboard request for a single local date. It rejects ranges. */
export function siteScoreboardUrl(source: EspnSource, date: LocalDate, timeZone: string): string {
  const params = new URLSearchParams({ dates: compactDate(date), tz: timeZone });
  return `https://site.api.espn.com/apis/site/v2/sports/${source.sport}/${source.league}/scoreboard?${params}`;
}

/** Parse the scoreboard header shape (`sports[0].leagues[0].events`). */
export function parseHeader(body: unknown, competition: Competition): Result[] {
  const events = at(body, 'sports', 0, 'leagues', 0, 'events');
  if (!Array.isArray(events)) throw new EspnParseError('Unexpected ESPN header response');
  return parseEvents(events, competition, (event) => ({
    id: str(at(event, 'id')),
    kickoff: str(at(event, 'date')),
    statusType: at(event, 'fullStatus', 'type'),
    state: str(at(event, 'status')),
    summary: str(at(event, 'summary')),
    competitors: list(at(event, 'competitors'))?.map((c) => ({
      homeAway: at(c, 'homeAway'),
      name: str(at(c, 'displayName')),
      shortName: str(at(c, 'shortDisplayName')),
      logoUrl: str(at(c, 'logo')),
      score: scoreText(at(c, 'score')),
    })),
    link: str(at(event, 'link')) ?? webLink(at(event, 'links')),
  }));
}

/** Parse the site scoreboard shape (`events[].competitions[0]`). */
export function parseSiteScoreboard(body: unknown, competition: Competition): Result[] {
  const events = at(body, 'events');
  if (!Array.isArray(events)) throw new EspnParseError('Unexpected ESPN scoreboard response');
  return parseEvents(events, competition, (event) => {
    const statusType =
      at(event, 'competitions', 0, 'status', 'type') ?? at(event, 'status', 'type');
    return {
      id: str(at(event, 'id')),
      kickoff: str(at(event, 'date')) ?? str(at(event, 'competitions', 0, 'date')),
      statusType,
      state: str(at(statusType, 'state')),
      competitors: list(at(event, 'competitions', 0, 'competitors'))?.map((c) => ({
        homeAway: at(c, 'homeAway'),
        name: str(at(c, 'team', 'displayName')),
        shortName: str(at(c, 'team', 'shortDisplayName')),
        logoUrl: str(at(c, 'team', 'logo')) ?? str(at(c, 'team', 'logos', 0, 'href')),
        score: scoreText(at(c, 'score')),
      })),
      link: webLink(at(event, 'links')),
    };
  });
}

/** An event read out of either ESPN shape, not yet validated. */
interface RawEvent {
  id: string | undefined;
  kickoff: string | undefined;
  statusType: unknown;
  /** `pre`, `in` or `post`. */
  state: string | undefined;
  summary?: string | undefined;
  competitors: RawCompetitor[] | undefined;
  link: string | undefined;
}

interface RawCompetitor {
  homeAway: unknown;
  name: string | undefined;
  shortName: string | undefined;
  logoUrl: string | undefined;
  score: string | undefined;
}

function parseEvents(
  events: unknown[],
  competition: Competition,
  read: (event: unknown) => RawEvent,
): Result[] {
  return events.flatMap((event) => {
    const result = toResult(read(event), competition);
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

function toResult(event: RawEvent, competition: Competition): Result | undefined {
  const { id, kickoff, statusType } = event;
  if (!id || !kickoff || Number.isNaN(Date.parse(kickoff))) return undefined;
  if (!isFinished(statusType, event.state)) return undefined;

  const home = team(event.competitors?.find((c) => c.homeAway === 'home'));
  const away = team(event.competitors?.find((c) => c.homeAway === 'away'));
  if (!home || !away) return undefined;

  const extraTime = extraTimeMarker(str(at(statusType, 'detail')) ?? event.summary);
  return {
    id,
    competitionId: competition.id,
    kickoff: new Date(kickoff).toISOString(),
    home,
    away,
    ...(extraTime ? { extraTime } : {}),
    matchDetailsUrl: event.link ?? fallbackMatchDetailsUrl(competition.source, id),
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

function team(competitor: RawCompetitor | undefined): TeamResult | undefined {
  const name = competitor?.name;
  const score = Number.parseFloat(competitor?.score ?? '');
  if (!competitor || !name || !Number.isFinite(score)) return undefined;
  return {
    name,
    shortName: competitor.shortName ?? name,
    ...(competitor.logoUrl ? { logoUrl: competitor.logoUrl } : {}),
    score,
  };
}

/** ESPN sends scores as strings; tolerate a bare number too. */
function scoreText(score: unknown): string | undefined {
  return typeof score === 'number' ? String(score) : str(score);
}

/** The event's ESPN web page: its desktop summary ("Gamecast") link. */
function webLink(links: unknown): string | undefined {
  const rels = (link: unknown) => list(at(link, 'rel')) ?? [];
  const summary = list(links)?.find(
    (link) => rels(link).includes('summary') && rels(link).includes('desktop'),
  );
  return str(at(summary, 'href'));
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

/**
 * ESPN's match page built from the event id, for events without a web link.
 * Soccer and rugby pages live under the sport (`/soccer/match/…`, rugby also
 * naming its numeric league); US sports live under the league (`/nba/game/…`).
 */
function fallbackMatchDetailsUrl(source: EspnSource, id: string): string {
  const base = 'https://www.espn.com';
  switch (source.sport) {
    case 'soccer':
      return `${base}/soccer/match/_/gameId/${id}`;
    case 'rugby':
      return `${base}/rugby/match/_/gameId/${id}/league/${source.league}`;
    default:
      return `${base}/${source.league}/game/_/gameId/${id}`;
  }
}

function at(value: unknown, ...path: (string | number)[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function list(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}
