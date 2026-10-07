import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeEspn, defaultHeaderFixtures } from './helpers/fakeEspn';
import type { FakeEspn } from './helpers/fakeEspn';
import { renderApp } from './helpers/renderApp';

const isHeader = (url: URL) => url.pathname === '/apis/v2/scoreboard/header';
const isPremierLeague = (url: URL) =>
  url.searchParams.get('league') === 'eng.1' || url.pathname.includes('/soccer/eng.1/');

function region(name: string) {
  return screen.findByRole('region', { name });
}

async function rowsIn(name: string) {
  return within(await region(name)).findAllByRole('listitem');
}

function siteScoreboardRequests(espn: FakeEspn) {
  return espn.requests.filter((u) => u.pathname.endsWith('/scoreboard'));
}

describe('Per-day fallback when the header request fails', () => {
  it('requests the site scoreboard once per Window day for that Competition only', async () => {
    const espn = createFakeEspn();
    espn.failWhen((url) => isHeader(url) && isPremierLeague(url));
    renderApp({ espn });

    await rowsIn('Premier League');
    const fallback = siteScoreboardRequests(espn);
    expect(fallback.map((u) => u.pathname)).toEqual(
      Array(3).fill('/apis/site/v2/sports/soccer/eng.1/scoreboard'),
    );
    expect(fallback.map((u) => u.hostname)).toEqual(Array(3).fill('site.api.espn.com'));
    expect(fallback.map((u) => u.searchParams.get('dates')).sort()).toEqual([
      '20261005',
      '20261006',
      '20261007',
    ]);
    expect(fallback.map((u) => u.searchParams.get('tz'))).toEqual(Array(3).fill('Europe/London'));
  });

  it('still shows the Competition’s finished Results, newest first', async () => {
    const espn = createFakeEspn();
    espn.failWhen((url) => isHeader(url) && isPremierLeague(url));
    renderApp({ espn });

    const rows = await rowsIn('Premier League');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Manchester City'),
      expect.stringContaining('Everton'),
    ]);
    const [manCity] = rows;
    expect(within(manCity!).getByRole('link', { name: 'Match Details' })).toHaveAttribute(
      'href',
      'https://www.espn.com/soccer/match/_/gameId/740103/fulham-manchester-city',
    );
  });
});

describe('Unparseable and malformed ESPN data', () => {
  it('falls back to the site scoreboard when the header body is not the expected shape', async () => {
    const espn = createFakeEspn({
      header: { ...defaultHeaderFixtures, 'soccer/eng.1': '<html>Service Unavailable</html>' },
    });
    renderApp({ espn });

    const rows = await rowsIn('Premier League');
    expect(rows).toHaveLength(2);
    expect(siteScoreboardRequests(espn)).toHaveLength(3);
  });

  it('skips events with a missing competitor or score without failing the Competition', async () => {
    const espn = createFakeEspn();
    espn.failWhen((url) => isHeader(url) && isPremierLeague(url));
    renderApp({ espn });

    await rowsIn('Premier League');
    // 6 Oct: Wolves v Brentford has no away competitor; Crystal Palace v Bournemouth has no scores.
    for (const team of ['Wolverhampton Wanderers', 'Brentford', 'Crystal Palace', 'AFC Bournemouth']) {
      expect(screen.queryByText(team)).not.toBeInTheDocument();
    }
    expect(screen.getByText('Manchester City')).toBeInTheDocument();
  });
});

describe('A Competition that fails to load', () => {
  it('shows an inline error with a Retry button only when the fallback fails too', async () => {
    const espn = createFakeEspn();
    espn.failWhen(isPremierLeague);
    renderApp({ espn });

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
    renderApp({ espn });

    await within(await region('Premier League')).findByRole('alert');
    for (const competition of ['NBA', 'NFL', 'Gallagher Premiership']) {
      expect(await rowsIn(competition)).not.toHaveLength(0);
      expect(within(await region(competition)).queryByRole('alert')).not.toBeInTheDocument();
    }
  });
});

describe('Retrying a failed Competition', () => {
  it('re-fetches only that Competition and shows its Results', async () => {
    const espn = createFakeEspn();
    espn.failWhen(isPremierLeague);
    const { user } = renderApp({ espn });
    const premierLeague = within(await region('Premier League'));
    await premierLeague.findByRole('alert');
    await rowsIn('NBA');
    await rowsIn('NFL');
    await rowsIn('Gallagher Premiership');
    const before = espn.requests.length;

    espn.stopFailing();
    await user.click(premierLeague.getByRole('button', { name: 'Retry' }));

    const rows = await rowsIn('Premier League');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Manchester City'),
      expect.stringContaining('Everton'),
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
    const { user } = renderApp({ espn: { ...espn, fetch: gated } });
    const premierLeague = within(await region('Premier League'));
    await premierLeague.findByRole('alert');
    const nbaRows = await rowsIn('NBA');

    espn.stopFailing();
    holdRetry = true;
    await user.click(premierLeague.getByRole('button', { name: 'Retry' }));

    expect(premierLeague.getByRole('status')).toHaveTextContent('Retrying…');
    expect(premierLeague.getByRole('button', { name: 'Retry' })).toBeDisabled();
    expect(await rowsIn('NBA')).toHaveLength(nbaRows.length);
    for (const competition of ['NFL', 'Gallagher Premiership']) {
      expect(await rowsIn(competition)).not.toHaveLength(0);
    }

    release();
    await waitFor(() => expect(premierLeague.queryByRole('status')).not.toBeInTheDocument());
    expect(await rowsIn('Premier League')).toHaveLength(2);
  });
});
