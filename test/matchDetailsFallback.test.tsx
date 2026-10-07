import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeEspn, defaultHeaderFixtures } from './helpers/fakeEspn';
import { GALLAGHER_NOW, PREMIER_LEAGUE_NOW, renderApp } from './helpers/renderApp';

/** A copy of a header fixture with every event's web link removed. */
function withoutLinks(fixture: unknown): unknown {
  const copy = structuredClone(fixture) as {
    sports: { leagues: { events: Record<string, unknown>[] }[] }[];
  };
  for (const event of copy.sports[0]!.leagues[0]!.events) {
    delete event.link;
    delete event.links;
  }
  return copy;
}

describe('Match Details link when ESPN gives no web link', () => {
  it.each([
    ['NBA', undefined, 'Golden State Warriors', 'https://www.espn.com/nba/game/_/gameId/401898390'],
    ['NFL', undefined, 'Carolina Panthers', 'https://www.espn.com/nfl/game/_/gameId/401872978'],
    [
      'Premier League',
      PREMIER_LEAGUE_NOW,
      'Manchester City',
      'https://www.espn.com/soccer/match/_/gameId/401879272',
    ],
    [
      'Gallagher Premiership',
      GALLAGHER_NOW,
      'Saracens',
      'https://www.espn.com/rugby/match/_/gameId/604623/league/267979',
    ],
  ])('builds the %s match page from the event id', async (competition, now, homeTeam, href) => {
    const header = Object.fromEntries(
      Object.entries(defaultHeaderFixtures).map(([key, fixture]) => [key, withoutLinks(fixture)]),
    );
    renderApp({ espn: createFakeEspn({ header }), now });

    const region = await screen.findByRole('region', { name: competition });
    const rows = await within(region).findAllByRole('listitem');
    const row = rows.find((r) => r.textContent?.includes(homeTeam));
    expect(within(row!).getByRole('link', { name: 'Match Details' })).toHaveAttribute('href', href);
  });
});
