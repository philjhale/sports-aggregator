import type { CompetitionConfig } from './types';

/**
 * Sports and Competitions shown by the app. Adding a Competition (or a Sport)
 * is a config-only change.
 */
export const competitionConfig: CompetitionConfig = {
  sports: [{ id: 'basketball', name: 'Basketball', order: 1 }],
  competitions: [
    {
      id: 'nba',
      sportId: 'basketball',
      name: 'NBA',
      source: { kind: 'espn', sport: 'basketball', league: 'nba' },
    },
  ],
};
