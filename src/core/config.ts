import type { CompetitionConfig } from './types';

/**
 * Sports and Competitions shown by the app. Adding a Competition (or a Sport)
 * is a config-only change.
 */
export const competitionConfig: CompetitionConfig = {
  sports: [
    { id: 'basketball', name: 'Basketball', order: 1 },
    { id: 'american-football', name: 'American Football', order: 2 },
    { id: 'football', name: 'Football', order: 3 },
    { id: 'rugby-union', name: 'Rugby Union', order: 4 },
  ],
  competitions: [
    {
      id: 'nba',
      sportId: 'basketball',
      name: 'NBA',
      source: { kind: 'espn', sport: 'basketball', league: 'nba' },
    },
    {
      id: 'nfl',
      sportId: 'american-football',
      name: 'NFL',
      source: { kind: 'espn', sport: 'football', league: 'nfl' },
    },
    {
      id: 'premier-league',
      sportId: 'football',
      name: 'Premier League',
      source: { kind: 'espn', sport: 'soccer', league: 'eng.1' },
    },
    {
      id: 'gallagher-premiership',
      sportId: 'rugby-union',
      name: 'Gallagher Premiership',
      // ESPN identifies this league by a numeric id, not a readable slug.
      source: { kind: 'espn', sport: 'rugby', league: '267979' },
    },
  ],
};
