import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { competitionConfig } from '../src/core/config';
import type { CompetitionConfig } from '../src/core/types';
import gallagherHeader from './fixtures/espn/gallagher-premiership-header.json';
import nflHeader from './fixtures/espn/nfl-header.json';
import premierLeagueHeader from './fixtures/espn/premier-league-header.json';
import { createFakeEspn, defaultHeaderFixtures } from './helpers/fakeEspn';
import { IN_PROGRESS, POSTPONED, SCHEDULED, withHeaderStatus } from './helpers/patchEspn';
import { GALLAGHER_NOW, PREMIER_LEAGUE_NOW, renderApp } from './helpers/renderApp';

function sportHeadings() {
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
}

async function resultRows(competition: string) {
  const region = await screen.findByRole('region', { name: competition });
  return within(region).findAllByRole('listitem');
}

describe('All four launch Competitions grouped by Sport', () => {
  it('shows the Sports in config order', () => {
    renderApp();

    expect(sportHeadings()).toEqual(['Basketball', 'American Football', 'Football', 'Rugby Union']);
  });

  it('groups each Competition under its Sport', () => {
    renderApp();

    const expected: [string, string][] = [
      ['Basketball', 'NBA'],
      ['American Football', 'NFL'],
      ['Football', 'Premier League'],
      ['Rugby Union', 'Gallagher Premiership'],
    ];
    for (const [sport, competition] of expected) {
      const section = screen.getByRole('region', { name: sport });
      expect(within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        competition,
      ]);
    }
  });
});

describe('Config drives the layout', () => {
  it('orders Sports by their configured order', () => {
    const reordered: CompetitionConfig = {
      ...competitionConfig,
      sports: competitionConfig.sports.map((sport) => ({ ...sport, order: -sport.order })),
    };
    renderApp({ config: reordered });

    expect(sportHeadings()).toEqual(['Rugby Union', 'Football', 'American Football', 'Basketball']);
  });

  it('shows a new Sport and Competition added by config alone', async () => {
    const extended: CompetitionConfig = {
      sports: [...competitionConfig.sports, { id: 'ice-hockey', name: 'Ice Hockey', order: 5 }],
      competitions: [
        ...competitionConfig.competitions,
        {
          id: 'nhl',
          sportId: 'ice-hockey',
          name: 'NHL',
          source: { kind: 'espn', sport: 'hockey', league: 'nhl' },
        },
      ],
    };
    const { espn } = renderApp({ config: extended });

    expect(sportHeadings()).toEqual([
      'Basketball',
      'American Football',
      'Football',
      'Rugby Union',
      'Ice Hockey',
    ]);
    const iceHockey = screen.getByRole('region', { name: 'Ice Hockey' });
    expect(within(iceHockey).getByRole('heading', { name: 'NHL' })).toBeInTheDocument();
    await waitFor(() =>
      expect(espn.headerRequests().map((u) => u.searchParams.get('league'))).toContain('nhl'),
    );
  });
});

describe('Results within each Competition', () => {
  // Each Competition is recorded in a different week, so each is checked at a
  // clock inside its own: NFL 5-7 Oct, Premier League 18-20 Sep, Gallagher
  // Premiership 2-4 Oct (all 3-day Windows in Europe/London).
  it.each([
    ['NFL', undefined, ['New Orleans Saints', 'Carolina Panthers']],
    [
      'Premier League',
      PREMIER_LEAGUE_NOW,
      ['Fulham', 'Manchester City', 'Tottenham Hotspur', 'Brentford'],
    ],
    ['Gallagher Premiership', GALLAGHER_NOW, ['Saracens', 'Gloucester Rugby', 'Bath Rugby']],
  ])('shows finished %s Results in the Window, newest first', async (competition, now, homeTeams) => {
    renderApp({ now });

    const rows = await resultRows(competition);
    expect(rows.map((r) => r.textContent)).toEqual(
      homeTeams.map((team) => expect.stringContaining(team)),
    );
  });

  it.each([
    ['NFL', undefined, 'Las Vegas Raiders'], // 4 Oct
    ['Premier League', PREMIER_LEAGUE_NOW, 'Leeds United'], // 14 Sep
    ['Gallagher Premiership', '2026-10-05T12:00:00Z', 'Bath Rugby'], // 2 Oct, Window is 3-5 Oct
  ])('leaves out finished %s matches before the Window', async (competition, now, team) => {
    renderApp({ now });
    await resultRows(competition);

    expect(screen.queryByText(team)).not.toBeInTheDocument();
  });

  it.each([
    ['NFL', undefined, '401872979', 'Atlanta Falcons', POSTPONED, 'football/nfl', nflHeader],
    [
      'Premier League',
      PREMIER_LEAGUE_NOW,
      '401879272',
      'Sunderland',
      SCHEDULED,
      'soccer/eng.1',
      premierLeagueHeader,
    ],
    [
      'Gallagher Premiership',
      GALLAGHER_NOW,
      '604623',
      'Sale Sharks',
      IN_PROGRESS,
      'rugby/267979',
      gallagherHeader,
    ],
  ])(
    'leaves out %s matches that are postponed, scheduled or in progress',
    async (competition, now, id, team, status, key, header) => {
      // A recording holds only matches ESPN had already finished, so one is
      // changed to another status.
      const espn = createFakeEspn({
        header: { ...defaultHeaderFixtures, [key]: withHeaderStatus(header, id, status) },
      });
      renderApp({ espn, now });
      const rows = await resultRows(competition);

      expect(screen.queryByText(team)).not.toBeInTheDocument();
      expect(rows.length).toBeGreaterThan(0);
    },
  );
});

describe('Fetching the Competitions', () => {
  it('makes one header request per Competition, all in parallel', async () => {
    // A fetch that never answers: every request seen must have been issued
    // without waiting for another Competition's response.
    const espn = createFakeEspn();
    const requested: URL[] = [];
    const pending: typeof fetch = (input) => {
      requested.push(new URL(String(input)));
      return new Promise(() => {});
    };
    renderApp({ espn: { ...espn, fetch: pending } });

    await waitFor(() => expect(requested).toHaveLength(4));
    expect(requested.map((u) => u.pathname)).toEqual(
      Array(4).fill('/apis/v2/scoreboard/header'),
    );
    expect(requested.map((u) => `${u.searchParams.get('sport')}/${u.searchParams.get('league')}`).sort()).toEqual([
      'basketball/nba',
      'football/nfl',
      'rugby/267979',
      'soccer/eng.1',
    ]);
  });
});
