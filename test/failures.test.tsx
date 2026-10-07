import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeEspn, defaultHeaderFixtures, defaultScoreboardFixtures } from './helpers/fakeEspn';
import type { FakeEspn } from './helpers/fakeEspn';
import { createMemoryStorage } from './helpers/memoryStorage';
import premierLeagueScoreboard20260920 from './fixtures/espn/premier-league-scoreboard-20260920.json';
import { withScoreboardEvent } from './helpers/patchEspn';
import { PREMIER_LEAGUE_NOW, renderApp } from './helpers/renderApp';
import { cacheKey, cacheValue } from '../src/core/cache';
import type { Result } from '../src/core/types';

const isHeader = (url: URL) => url.pathname === '/apis/v2/scoreboard/header';
const isPremierLeague = (url: URL) =>
  url.searchParams.get('league') === 'eng.1' || url.pathname.includes('/soccer/eng.1/');

function region(name: string) {
  return screen.findByRole('region', { name });
}

async function rowsIn(name: string) {
  return within(await region(name)).findAllByRole('listitem');
}

/** A Competition that has finished loading, whether or not it has Results. */
async function settled(name: string) {
  const competition = within(await region(name));
  await waitFor(() => expect(competition.queryByRole('status')).not.toBeInTheDocument());
}

function siteScoreboardRequests(espn: FakeEspn) {
  return espn.requests.filter((u) => u.pathname.endsWith('/scoreboard'));
}

describe('Per-day fallback when the header request fails', () => {
  it('requests the site scoreboard once per Window day for that Competition only', async () => {
    const espn = createFakeEspn();
    espn.failWhen((url) => isHeader(url) && isPremierLeague(url));
    renderApp({ espn, now: PREMIER_LEAGUE_NOW });

    await rowsIn('Premier League');
    const fallback = siteScoreboardRequests(espn);
    expect(fallback.map((u) => u.pathname)).toEqual(
      Array(3).fill('/apis/site/v2/sports/soccer/eng.1/scoreboard'),
    );
    expect(fallback.map((u) => u.hostname)).toEqual(Array(3).fill('site.api.espn.com'));
    expect(fallback.map((u) => u.searchParams.get('dates')).sort()).toEqual([
      '20260918',
      '20260919',
      '20260920',
    ]);
    expect(fallback.map((u) => u.searchParams.get('tz'))).toEqual(Array(3).fill('Europe/London'));
  });

  it('still shows the Competition’s finished Results, newest first', async () => {
    const espn = createFakeEspn();
    espn.failWhen((url) => isHeader(url) && isPremierLeague(url));
    renderApp({ espn, now: PREMIER_LEAGUE_NOW });

    const rows = await rowsIn('Premier League');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Fulham'),
      expect.stringContaining('Manchester City'),
      expect.stringContaining('Tottenham Hotspur'),
      expect.stringContaining('Brentford'),
    ]);
    const [fulham] = rows;
    expect(within(fulham!).getByRole('link', { name: 'Match Details' })).toHaveAttribute(
      'href',
      'https://www.espn.com/soccer/match/_/gameId/401878777/manchester-united-fulham',
    );
  });
});

describe('Per-day fallback with cached past days', () => {
  it('requests only the uncached days and shows cached and fetched Results together', async () => {
    // Today is 20 Sep (Europe/London); 18 Sep is a complete, cacheable past day.
    const cached: Result = {
      id: 'cached-1',
      competitionId: 'premier-league',
      kickoff: '2026-09-18T14:00:00Z',
      home: { name: 'Cached Hosts', shortName: 'Hosts', score: 2 },
      away: { name: 'Cached Visitors', shortName: 'Visitors', score: 0 },
      matchDetailsUrl: 'https://www.espn.com/soccer/match/_/gameId/1',
      winner: 'home',
    };
    const storage = createMemoryStorage({
      [cacheKey('premier-league', 'Europe/London', '2026-09-18')]: cacheValue([cached]),
    });
    const espn = createFakeEspn();
    espn.failWhen((url) => isHeader(url) && isPremierLeague(url));
    renderApp({ espn, storage, now: PREMIER_LEAGUE_NOW });

    const rows = await rowsIn('Premier League');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Fulham'),
      expect.stringContaining('Manchester City'),
      expect.stringContaining('Tottenham Hotspur'),
      expect.stringContaining('Cached Hosts'),
    ]);
    expect(siteScoreboardRequests(espn).map((u) => u.searchParams.get('dates')).sort()).toEqual([
      '20260919',
      '20260920',
    ]);
  });
});

describe('Unparseable and malformed ESPN data', () => {
  it('falls back to the site scoreboard when the header body is not the expected shape', async () => {
    const espn = createFakeEspn({
      header: { ...defaultHeaderFixtures, 'soccer/eng.1': '<html>Service Unavailable</html>' },
    });
    renderApp({ espn, now: PREMIER_LEAGUE_NOW });

    const rows = await rowsIn('Premier League');
    expect(rows).toHaveLength(4);
    expect(siteScoreboardRequests(espn)).toHaveLength(3);
  });

  it('skips events with a missing competitor or score without failing the Competition', async () => {
    // 20 Sep holds Man City v Sunderland and Fulham v Man Utd. ESPN sent no
    // malformed event, so one loses its away competitor and the other its scores.
    let scoreboard = withScoreboardEvent(premierLeagueScoreboard20260920, '401879272', (event) => {
      event.competitions[0].competitors = event.competitions[0].competitors.filter(
        (c: { homeAway: string }) => c.homeAway === 'home',
      );
    });
    scoreboard = withScoreboardEvent(scoreboard, '401878777', (event) => {
      for (const c of event.competitions[0].competitors) delete c.score;
    });
    const espn = createFakeEspn({
      scoreboard: { ...defaultScoreboardFixtures, 'soccer/eng.1/20260920': scoreboard },
    });
    espn.failWhen((url) => isHeader(url) && isPremierLeague(url));
    renderApp({ espn, now: PREMIER_LEAGUE_NOW });

    await rowsIn('Premier League');
    for (const team of ['Manchester City', 'Sunderland', 'Fulham', 'Manchester United']) {
      expect(screen.queryByText(team)).not.toBeInTheDocument();
    }
    expect(screen.getByText('Tottenham Hotspur')).toBeInTheDocument();
  });
});

describe('A Competition that fails to load', () => {
  it('shows an inline error with a Retry button only when the fallback fails too', async () => {
    const espn = createFakeEspn();
    espn.failWhen(isPremierLeague);
    renderApp({ espn, now: PREMIER_LEAGUE_NOW });

    const premierLeague = within(await region('Premier League'));
    expect(await premierLeague.findByRole('alert')).toHaveTextContent(
      "Couldn't load Premier League results.",
    );
    expect(premierLeague.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(premierLeague.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('does not affect the other Competitions', async () => {
    const espn = createFakeEspn();
    espn.failWhen(isPremierLeague);
    renderApp({ espn, now: PREMIER_LEAGUE_NOW });

    await within(await region('Premier League')).findByRole('alert');
    for (const competition of ['NBA', 'NFL', 'Gallagher Premiership']) {
      const others = within(await region(competition));
      await waitFor(() => expect(others.queryByRole('status')).not.toBeInTheDocument());
      expect(others.queryByRole('alert')).not.toBeInTheDocument();
    }
  });
});

describe('Retrying a failed Competition', () => {
  it('re-fetches only that Competition and shows its Results', async () => {
    const espn = createFakeEspn();
    espn.failWhen(isPremierLeague);
    const { user } = renderApp({ espn, now: PREMIER_LEAGUE_NOW });
    const premierLeague = within(await region('Premier League'));
    await premierLeague.findByRole('alert');
    await settled('NBA');
    await settled('NFL');
    await settled('Gallagher Premiership');
    const before = espn.requests.length;

    espn.stopFailing();
    await user.click(premierLeague.getByRole('button', { name: 'Retry' }));

    const rows = await rowsIn('Premier League');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Fulham'),
      expect.stringContaining('Manchester City'),
      expect.stringContaining('Tottenham Hotspur'),
      expect.stringContaining('Brentford'),
    ]);
    expect(premierLeague.queryByRole('alert')).not.toBeInTheDocument();
    const retried = espn.requests.slice(before);
    expect(retried).toHaveLength(1);
    expect(retried[0]!.pathname).toBe('/apis/v2/scoreboard/header');
    expect(retried[0]!.searchParams.get('league')).toBe('eng.1');
  });

  it('keeps loaded Results visible while the retry is in flight', async () => {
    const espn = createFakeEspn();
    espn.failWhen(isPremierLeague);
    let holdRetry = false;
    let release: () => void = () => {};
    const gated: typeof fetch = async (input, init) => {
      if (holdRetry && isPremierLeague(new URL(String(input)))) {
        await new Promise<void>((resolve) => (release = resolve));
      }
      return espn.fetch(input, init);
    };
    const { user } = renderApp({ espn: { ...espn, fetch: gated }, now: PREMIER_LEAGUE_NOW });
    const premierLeague = within(await region('Premier League'));
    await premierLeague.findByRole('alert');
    // The recording has no NBA matches in the Premier League's week.
    const nba = within(await region('NBA'));
    await nba.findByText(/No results/);

    espn.stopFailing();
    holdRetry = true;
    await user.click(premierLeague.getByRole('button', { name: 'Retry' }));

    expect(premierLeague.getByRole('status')).toHaveTextContent('Retrying…');
    expect(premierLeague.getByRole('button', { name: 'Retry' })).toBeDisabled();
    expect(nba.getByText(/No results/)).toBeInTheDocument();
    for (const competition of ['NFL', 'Gallagher Premiership']) {
      await settled(competition);
    }

    release();
    await waitFor(() => expect(premierLeague.queryByRole('status')).not.toBeInTheDocument());
    expect(await rowsIn('Premier League')).toHaveLength(4);
  });
});
