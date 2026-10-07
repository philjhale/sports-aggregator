import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cacheKey, cacheValue } from '../src/core/cache';
import { SETTINGS_KEY } from '../src/core/settings';
import type { Result } from '../src/core/types';
import { createFakeEspn } from './helpers/fakeEspn';
import type { FakeEspn } from './helpers/fakeEspn';
import { createMemoryStorage } from './helpers/memoryStorage';
import { renderApp } from './helpers/renderApp';

// now = 2026-10-07T12:00Z in Europe/London: today is 7 Oct, yesterday 6 Oct,
// so only 5 Oct and earlier are cacheable.
const nbaHeaderRequests = (espn: FakeEspn) =>
  espn.headerRequests().filter((u) => u.searchParams.get('league') === 'nba');

/** A Result that only exists in the cache, so seeing it proves the cache was read. */
function cachedResult(kickoff: string, home: string): Result {
  return {
    id: `cached-${home}`,
    competitionId: 'nba',
    kickoff,
    home: { name: home, shortName: 'CAC', score: 101 },
    away: { name: 'Cached Visitors', shortName: 'Visitors', score: 99 },
    matchDetailsUrl: 'https://www.espn.com/nba/game/_/gameId/1',
    winner: 'home',
  };
}

function seed(entries: Record<string, Result[]>, timeZone = 'Europe/London') {
  return Object.fromEntries(
    Object.entries(entries).map(([date, results]) => [
      cacheKey('nba', timeZone, date),
      cacheValue(results),
    ]),
  );
}

const nbaDates = async (espn: FakeEspn) => {
  await waitFor(() => expect(nbaHeaderRequests(espn).length).toBeGreaterThan(0));
  return nbaHeaderRequests(espn).map((u) => u.searchParams.get('dates'));
};

describe('Past-day cache', () => {
  it('reuses cached past days on the next visit, requesting only the uncached span', async () => {
    const first = renderApp();
    await first.user.click(screen.getByRole('radio', { name: '7 days' }));
    await within(screen.getByRole('region', { name: 'NBA' })).findByText('Miami Heat');
    first.unmount();

    const { espn } = renderApp({ storage: first.storage });

    const nba = screen.getByRole('region', { name: 'NBA' });
    expect(await within(nba).findByText('Miami Heat')).toBeInTheDocument();
    expect(within(nba).getByText('Atlanta Hawks')).toBeInTheDocument();
    expect(within(nba).getByText('Golden State Warriors')).toBeInTheDocument();
    expect(espn.headerRequests()).toHaveLength(4);
    expect(nbaHeaderRequests(espn).map((u) => u.searchParams.get('dates'))).toEqual([
      '20261006-20261007',
    ]);
  });
});

describe('Pre-seeded cache', () => {
  it('serves cached past days and fetches only from the oldest uncached day to today', async () => {
    const storage = createMemoryStorage(
      seed({ '2026-10-05': [cachedResult('2026-10-05T18:00:00Z', 'Cached Hosts')] }),
    );
    const { espn } = renderApp({ storage });

    const nba = screen.getByRole('region', { name: 'NBA' });
    expect(await within(nba).findByText('Cached Hosts')).toBeInTheDocument();
    expect(within(nba).getByText('Golden State Warriors')).toBeInTheDocument();
    expect(await nbaDates(espn)).toEqual(['20261006-20261007']);
  });

  it('fetches from the oldest gap when a cached day is missing in the middle', async () => {
    const storage = createMemoryStorage({
      ...seed({ '2026-10-01': [], '2026-10-02': [], '2026-10-04': [] }),
      [SETTINGS_KEY]: JSON.stringify({ window: 7 }),
    });
    const { espn } = renderApp({ storage });

    expect(await nbaDates(espn)).toEqual(['20261003-20261007']);
    // 4 Oct was cached as empty but is inside the fetched span, so the fetch wins.
    expect(
      await within(screen.getByRole('region', { name: 'NBA' })).findByText('Miami Heat'),
    ).toBeInTheDocument();
  });

  it('always refetches today and yesterday, ignoring anything stored for them', async () => {
    const storage = createMemoryStorage(
      seed({
        '2026-10-05': [],
        '2026-10-06': [cachedResult('2026-10-06T18:00:00Z', 'Stale Yesterday')],
        '2026-10-07': [cachedResult('2026-10-07T09:00:00Z', 'Stale Today')],
      }),
    );
    const { espn } = renderApp({ storage });

    const nba = screen.getByRole('region', { name: 'NBA' });
    expect(await within(nba).findByText('Golden State Warriors')).toBeInTheDocument();
    expect(within(nba).queryByText('Stale Yesterday')).not.toBeInTheDocument();
    expect(within(nba).queryByText('Stale Today')).not.toBeInTheDocument();
    expect(await nbaDates(espn)).toEqual(['20261006-20261007']);
  });

  it('keys cached days by timezone, so another timezone does not reuse them', async () => {
    const storage = createMemoryStorage(
      seed({ '2026-10-05': [cachedResult('2026-10-05T18:00:00Z', 'Cached Hosts')] }),
    );
    const { espn } = renderApp({ storage, timeZone: 'America/New_York' });

    const nba = screen.getByRole('region', { name: 'NBA' });
    expect(await within(nba).findByText('Atlanta Hawks')).toBeInTheDocument();
    expect(within(nba).queryByText('Cached Hosts')).not.toBeInTheDocument();
    expect(await nbaDates(espn)).toEqual(['20261005-20261007']);
  });
});

describe('Manual refresh', () => {
  it('refetches the uncached span for every Competition', async () => {
    const { espn, user } = renderApp();
    const nba = screen.getByRole('region', { name: 'NBA' });
    await within(nba).findByText('Golden State Warriors');
    await waitFor(() => expect(espn.headerRequests()).toHaveLength(4));

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(espn.headerRequests()).toHaveLength(8));
    expect(nbaHeaderRequests(espn).map((u) => u.searchParams.get('dates'))).toEqual([
      '20261005-20261007',
      '20261006-20261007',
    ]);
    expect(await within(nba).findByText('Golden State Warriors')).toBeInTheDocument();
  });
  it('keeps loaded Results visible while the refresh is in flight', async () => {
    const espn = createFakeEspn();
    let hold = false;
    const held: (() => void)[] = [];
    const gated: typeof fetch = async (input, init) => {
      if (hold) await new Promise<void>((resolve) => held.push(resolve));
      return espn.fetch(input, init);
    };
    const { user } = renderApp({ espn: { ...espn, fetch: gated } });
    const nba = within(screen.getByRole('region', { name: 'NBA' }));
    await nba.findByText('Golden State Warriors');

    hold = true;
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(nba.getByRole('status')).toHaveTextContent('Refreshing…');
    expect(nba.getByText('Golden State Warriors')).toBeInTheDocument();
    expect(nba.getByText('Atlanta Hawks')).toBeInTheDocument();
    held.forEach((release) => release());
  });
});

describe('Storage problems never break Results', () => {
  it.each([
    ['corrupt JSON', '{not json'],
    ['another schema version', JSON.stringify({ version: 0, results: [] })],
    ['the wrong shape', JSON.stringify({ version: 1, results: [{ id: 7 }] })],
    [
      'a Result with an unknown winner',
      cacheValue([{ ...cachedResult('2026-10-05T18:00:00Z', 'Cached Hosts'), winner: 'nobody' as never }]),
    ],
    [
      'a Result with no Competition id',
      cacheValue([{ ...cachedResult('2026-10-05T18:00:00Z', 'Cached Hosts'), competitionId: undefined as never }]),
    ],
  ])('treats a cached day holding %s as uncached', async (_, stored) => {
    const storage = createMemoryStorage({ [cacheKey('nba', 'Europe/London', '2026-10-05')]: stored });
    const { espn } = renderApp({ storage });

    const nba = screen.getByRole('region', { name: 'NBA' });
    expect(await within(nba).findByText('Atlanta Hawks')).toBeInTheDocument();
    expect(await nbaDates(espn)).toEqual(['20261005-20261007']);
  });

  it('renders Results when storage throws on every access', async () => {
    const { espn } = renderApp({ storage: createMemoryStorage({}, { throws: true }) });

    const nba = screen.getByRole('region', { name: 'NBA' });
    expect(await within(nba).findByText('Atlanta Hawks')).toBeInTheDocument();
    expect(await nbaDates(espn)).toEqual(['20261005-20261007']);
  });

  it('renders Results when storage is full', async () => {
    const storage = createMemoryStorage();
    storage.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    renderApp({ storage });

    const nba = screen.getByRole('region', { name: 'NBA' });
    expect(await within(nba).findByText('Atlanta Hawks')).toBeInTheDocument();
    expect(within(nba).getByText('Golden State Warriors')).toBeInTheDocument();
  });
});
