/**
 * Contract: every field the ESPN adapter reads is present, with the right type,
 * in every recorded event. A fixture that invents or drops a field fails here
 * instead of passing while the adapter reads a path real ESPN never sends.
 * Update this list together with `src/core/espn/adapter.ts`.
 */
import { describe, expect, it } from 'vitest';
import gallagherHeader from './fixtures/espn/gallagher-premiership-header.json';
import nbaHeader from './fixtures/espn/nba-header.json';
import nflHeader from './fixtures/espn/nfl-header.json';
import premierLeagueHeader from './fixtures/espn/premier-league-header.json';
import scoreboard20260918 from './fixtures/espn/premier-league-scoreboard-20260918.json';
import scoreboard20260919 from './fixtures/espn/premier-league-scoreboard-20260919.json';
import scoreboard20260920 from './fixtures/espn/premier-league-scoreboard-20260920.json';

type Json = Record<string, unknown>;

const at = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((v, key) => (v as Json | undefined)?.[key], value);

/** The paths in `paths` (each a `typeof` name) that `value` lacks or has mistyped. */
function violations(value: unknown, paths: Record<string, string>): string[] {
  return Object.entries(paths)
    .filter(([path, type]) => typeof at(value, path) !== type)
    .map(([path, type]) => `${path}: expected ${type}, got ${typeof at(value, path)}`);
}

const headers = {
  nba: nbaHeader,
  nfl: nflHeader,
  'premier league': premierLeagueHeader,
  'gallagher premiership': gallagherHeader,
};

describe('scoreboard header fixtures', () => {
  for (const [name, body] of Object.entries(headers)) {
    it(`${name}: events carry every field the adapter reads`, () => {
      const events = body.sports[0]!.leagues[0]!.events as unknown[];
      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        const competitors = at(event, 'competitors') as unknown[];
        expect(competitors).toHaveLength(2);
        expect(
          [
            ...violations(event, {
              id: 'string',
              date: 'string',
              status: 'string',
              'fullStatus.type.name': 'string',
              'fullStatus.type.completed': 'boolean',
            }),
            ...competitors.flatMap((c) =>
              violations(c, { homeAway: 'string', displayName: 'string', name: 'string', score: 'string' }),
            ),
          ],
          `event ${at(event, 'id')}`,
        ).toEqual([]);
      }
    });
  }
});

describe('site scoreboard fixtures', () => {
  const days = { 20260918: scoreboard20260918, 20260919: scoreboard20260919, 20260920: scoreboard20260920 };
  for (const [date, body] of Object.entries(days)) {
    it(`premier league ${date}: events carry every field the adapter reads`, () => {
      expect(body.events.length).toBeGreaterThan(0);
      for (const event of body.events as unknown[]) {
        const competitors = at(event, 'competitions.0.competitors') as unknown[];
        expect(competitors).toHaveLength(2);
        expect(
          [
            ...violations(event, {
              id: 'string',
              date: 'string',
              'competitions.0.status.type.name': 'string',
              'competitions.0.status.type.completed': 'boolean',
            }),
            ...competitors.flatMap((c) =>
              violations(c, {
                homeAway: 'string',
                score: 'string',
                'team.displayName': 'string',
                'team.shortDisplayName': 'string',
              }),
            ),
          ],
          `event ${at(event, 'id')}`,
        ).toEqual([]);
      }
    });
  }
});
