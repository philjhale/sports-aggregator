import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeEspn } from './helpers/fakeEspn';
import { competitionConfig } from '../src/core/config';
import type { CompetitionConfig } from '../src/core/types';
import { renderApp } from './helpers/renderApp';

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
  // Default Window: 5-7 Oct 2026 in Europe/London.
  it.each([
    ['NFL', ['Green Bay Packers', 'Seattle Seahawks']],
    ['Premier League', ['Manchester City', 'Everton']],
    ['Gallagher Premiership', ['Northampton Saints', 'Sale Sharks']],
  ])('shows finished %s Results in the Window, newest first', async (competition, homeTeams) => {
    renderApp();

    const rows = await resultRows(competition);
    expect(rows.map((r) => r.textContent)).toEqual(
      homeTeams.map((team) => expect.stringContaining(team)),
    );
  });

  it('leaves out scheduled and postponed matches, and those before the Window', async () => {
    renderApp();
    await resultRows('Premier League');
    await resultRows('NFL');
    await resultRows('Gallagher Premiership');

    for (const team of [
      'Kansas City Chiefs', // NFL, before the Window
      'Tampa Bay Buccaneers', // NFL, postponed
      'Arsenal', // Premier League, before the Window
      'Newcastle United', // Premier League, postponed
      'Chelsea', // Premier League, scheduled tonight
      'Bath Rugby', // Gallagher Premiership, before the Window
      'Gloucester Rugby', // Gallagher Premiership, scheduled tonight
    ]) {
      expect(screen.queryByText(team)).not.toBeInTheDocument();
    }
  });
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
