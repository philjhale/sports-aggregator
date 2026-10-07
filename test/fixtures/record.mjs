#!/usr/bin/env node
/**
 * Re-records the ESPN fixtures from the live API.
 *
 *   node test/fixtures/record.mjs
 *
 * Each fixture is a real response with its `events` trimmed to the listed ids.
 * Nothing else in the response (or in a kept event) is edited. Events ESPN no
 * longer returns for the recorded range are reported, not invented.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), 'espn');
const TZ = 'Europe/London';

const header = ({ sport, league, dates }) =>
  `https://site.web.api.espn.com/apis/v2/scoreboard/header?${new URLSearchParams({ sport, league, dates, tz: TZ, limit: '1000' })}`;
const site = ({ sport, league, date }) =>
  `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?${new URLSearchParams({ dates: date, tz: TZ })}`;

const headers = {
  'nba-header.json': {
    request: { sport: 'basketball', league: 'nba', dates: '20260929-20261007' },
    // Heat at Raptors (before the 3-day Window), then four finals 6-7 Oct.
    ids: ['401902644', '401898388', '401901820', '401898389', '401898390'],
  },
  'nfl-header.json': {
    request: { sport: 'football', league: 'nfl', dates: '20260929-20261007' },
    // Chiefs at Raiders (before the Window), Lions at Panthers, Falcons at Saints.
    ids: ['401872976', '401872978', '401872979'],
  },
  'premier-league-header.json': {
    request: { sport: 'soccer', league: 'eng.1', dates: '20260913-20260920' },
    // Leeds v Newcastle (before the Window), Brentford v Chelsea, Spurs v Villa, Man City v Sunderland, Fulham 1-1 Man Utd.
    ids: ['401879280', '401879275', '401879269', '401879272', '401878777'],
  },
  'gallagher-premiership-header.json': {
    request: { sport: 'rugby', league: '267979', dates: '20260929-20261007' },
    ids: ['604619', '604621', '604623'],
  },
};

const scoreboards = {
  'premier-league-scoreboard-20260918.json': { sport: 'soccer', league: 'eng.1', date: '20260918', ids: ['401879275'] },
  'premier-league-scoreboard-20260919.json': { sport: 'soccer', league: 'eng.1', date: '20260919', ids: ['401879269'] },
  'premier-league-scoreboard-20260920.json': { sport: 'soccer', league: 'eng.1', date: '20260920', ids: ['401879272', '401878777'] },
};

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
}

function keep(events, ids, file) {
  const kept = events.filter((e) => ids.includes(e.id));
  for (const id of ids) if (!kept.some((e) => e.id === id)) console.warn(`${file}: event ${id} not returned`);
  return kept;
}

for (const [file, { request, ids }] of Object.entries(headers)) {
  const body = await get(header(request));
  const league = body.sports[0].leagues[0];
  league.events = keep(league.events, ids, file);
  writeFileSync(join(out, file), JSON.stringify(body, null, 2) + '\n');
}
for (const [file, { ids, ...request }] of Object.entries(scoreboards)) {
  const body = await get(site(request));
  body.events = keep(body.events, ids, file);
  writeFileSync(join(out, file), JSON.stringify(body, null, 2) + '\n');
}
