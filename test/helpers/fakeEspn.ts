import gallagherPremiershipHeader from '../fixtures/espn/gallagher-premiership-header.json';
import nbaHeader from '../fixtures/espn/nba-header.json';
import nflHeader from '../fixtures/espn/nfl-header.json';
import premierLeagueHeader from '../fixtures/espn/premier-league-header.json';
import premierLeague20261005 from '../fixtures/espn/premier-league-scoreboard-20261005.json';
import premierLeague20261006 from '../fixtures/espn/premier-league-scoreboard-20261006.json';
import premierLeague20261007 from '../fixtures/espn/premier-league-scoreboard-20261007.json';

/**
 * A fake `fetch` that answers ESPN URLs from fixtures.
 *
 * - Header requests (`/apis/v2/scoreboard/header?sport=&league=`) are answered
 *   from `header["sport/league"]`.
 * - Site scoreboard requests (`/apis/site/v2/sports/{sport}/{league}/scoreboard?dates=`)
 *   are answered from `scoreboard["sport/league/YYYYMMDD"]`.
 * - Anything else, or a URL matched by `failWhen`, gets an HTTP 500.
 *
 * Every requested URL is recorded in `requests` (parsed), in order.
 */
export interface FakeEspnOptions {
  header?: Record<string, unknown>;
  scoreboard?: Record<string, unknown>;
}

export interface FakeEspn {
  fetch: typeof fetch;
  requests: URL[];
  headerRequests(): URL[];
  failWhen(predicate: (url: URL) => boolean): void;
  stopFailing(): void;
}

export const defaultHeaderFixtures: Record<string, unknown> = {
  'basketball/nba': nbaHeader,
  'football/nfl': nflHeader,
  'soccer/eng.1': premierLeagueHeader,
  'rugby/267979': gallagherPremiershipHeader,
};

export const defaultScoreboardFixtures: Record<string, unknown> = {
  'soccer/eng.1/20261005': premierLeague20261005,
  'soccer/eng.1/20261006': premierLeague20261006,
  'soccer/eng.1/20261007': premierLeague20261007,
};

export function createFakeEspn(options: FakeEspnOptions = {}): FakeEspn {
  const header = options.header ?? defaultHeaderFixtures;
  const scoreboard = options.scoreboard ?? defaultScoreboardFixtures;
  const requests: URL[] = [];
  let failing: ((url: URL) => boolean) | undefined;

  function answer(url: URL): Response {
    if (failing?.(url)) return new Response('fake failure', { status: 500 });

    if (url.pathname === '/apis/v2/scoreboard/header') {
      const key = `${url.searchParams.get('sport')}/${url.searchParams.get('league')}`;
      const body = header[key];
      if (body !== undefined) return json(body);
    }

    const site = url.pathname.match(/^\/apis\/site\/v2\/sports\/([^/]+)\/([^/]+)\/scoreboard$/);
    if (site) {
      const body = scoreboard[`${site[1]}/${site[2]}/${url.searchParams.get('dates')}`];
      if (body !== undefined) return json(body);
    }

    return new Response('not found', { status: 404 });
  }

  const fakeFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url);
    // Yield so callers observe a genuinely asynchronous response.
    await Promise.resolve();
    return answer(url);
  };

  return {
    fetch: fakeFetch as typeof fetch,
    requests,
    headerRequests: () => requests.filter((u) => u.pathname === '/apis/v2/scoreboard/header'),
    failWhen(predicate) {
      failing = predicate;
    },
    stopFailing() {
      failing = undefined;
    },
  };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
