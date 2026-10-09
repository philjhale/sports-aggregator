# ESPN unofficial API: what data exists besides match results

All requests were made with `curl --compressed` on **2026-10-09** (about 19:45 to 20:30 UTC), with no auth and no special headers, through the agent proxy. Every claim cites the exact URL requested or a repo file. Sources are the live ESPN endpoints and this repo only. A fact with no primary source is labelled **unverified**. For request limits, date ranges and `tz` bucketing, see `docs/research/espn-api-fetch-limits.md` (not repeated here).

Competitions covered (from `src/core/config.ts`): NBA `basketball/nba`, NFL `football/nfl`, Premier League `soccer/eng.1`, Gallagher Premiership `rugby/267979`.

Example ids used below:

- NBA: event `401898395` (HOU v DAL, final), team `1` (Hawks), athlete `4278039`.
- NFL: event `401872980` (TB @ DAL, final), team `1` (Falcons), athlete `4568510`.
- Premier League: event `401879280` (final), team `359` (Arsenal), athlete `169532`.
- Gallagher Premiership: event `604619` (Bath v Exeter, final), team `25898` (Bath).

## TL;DR

- Besides results, ESPN exposes standings, team lists and detail, rosters, schedules, team and athlete stats, league stat leaders, news, injuries, transactions, odds, play-by-play, win probability, box scores, lineups, commentary, officials, broadcasts, drafts, awards and futures. Coverage is very uneven across the four competitions.
- **NFL is richest** (depth charts, drives, predictor, draft, about 20k athletes). **NBA** is close but has no drives or predictor.
- **Premier League** has standings, rosters, odds, play-by-play, key events and commentary. Injuries and transactions are empty, and core league leaders return 400.
- **Gallagher Premiership is sparse.** Standings (with bonus points and tries), play-by-play, summary box score and lineups, and a team list work. Rosters, athletes, news, odds, officials, broadcasts and team stats are empty or error.
- Nothing needs auth, but none of it is documented. Many unsupported sub-paths return `200 {}` instead of 404, so a 200 is not proof that data exists.

## Already used by the project

| Endpoint | Used for | Source |
|---|---|---|
| `https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=&league=&dates=&tz=&limit=1000` | Results (primary) | `src/core/espn/adapter.ts` `headerUrl` |
| `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard?dates=&tz=` | Results (per-day fallback) | `src/core/espn/adapter.ts` `siteScoreboardUrl` |
| `link` / `links[]` from those responses | Match Details link | `src/core/espn/adapter.ts` |

Nothing else is fetched. Fixtures exist only for the header and the site scoreboard (`test/fixtures/espn/*`, `test/fixtures/README.md`).

## Hosts and path families

| Family | Base | Shape |
|---|---|---|
| Site | `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/...` | Inline JSON, presentation oriented |
| Site v2 (standings) | `https://site.web.api.espn.com/apis/v2/sports/{sport}/{league}/standings` | Inline JSON |
| Common v3 (athlete and league stats) | `https://site.web.api.espn.com/apis/common/v3/sports/{sport}/{league}/...` | Inline JSON |
| Core | `https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/...` | Resource graph. Lists return `{count,pageIndex,pageSize,pageCount,items:[{"$ref"}]}`; follow each `$ref` |

The core path needs `leagues/` between sport and league. `https://sports.core.api.espn.com/v2/sports/basketball/nba/leagues/nba/events` (wrong) returned 404 `{"error":{"message":"application error","code":404}}`, while `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events` worked.

The core league root lists sub-resources. `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba` returned keys `athletes, awards, calendar, draft, events, franchises, groups, leaders, notes, rankings, season, seasons, teams, transactions`. The same root for NFL (`football/leagues/nfl`) adds `freeAgents, talentPicks`; for EPL (`soccer/leagues/eng.1`) it has `alternateId, country, franchises, transactions`; for rugby (`rugby/leagues/267979`) only `athletes, calendar, events, rankings, seasons, teams` among these.

## Coverage matrix

`Y` = data, `empty` = 200 with no content, `x` = 400/404/500. "Site" paths are under `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}`.

| Data | Endpoint | NBA | NFL | EPL | Prem |
|---|---|---|---|---|---|
| Standings | `https://site.web.api.espn.com/apis/v2/sports/{s}/{l}/standings` | Y | Y | Y | Y |
| Standings (site path) | `{Site}/standings` | link only | link only | `{}` | link only |
| Teams list | `{Site}/teams` | Y (30) | Y (32) | Y (20) | Y (10) |
| Team detail | `{Site}/teams/{id}` | Y | Y | Y | Y |
| Roster | `{Site}/teams/{id}/roster` | Y | Y (grouped) | Y | empty |
| Team schedule | `{Site}/teams/{id}/schedule` | Y | Y (+bye) | Y | x (500) |
| Team stats | `{Site}/teams/{id}/statistics` | Y | Y | empty | x (400) |
| Depth chart | `{Site}/teams/{id}/depthcharts` | Y | Y | empty | empty |
| League team stats | `https://site.web.api.espn.com/apis/common/v3/sports/{s}/{l}/statistics/byteam` | Y | Y | x (500) | x (500) |
| League athlete stats | `.../common/v3/sports/{s}/{l}/statistics/byathlete` | Y | Y | `currentSeason` only | `currentSeason` only |
| League stat leaders | `{Site}/statistics` | `stats: null` | Y | Y | `stats: null` |
| Core leaders | `https://sports.core.api.espn.com/v2/sports/{s}/leagues/{l}/leaders` | Y | Y | x (400) | x (400) |
| News | `{Site}/news` | Y | Y | Y | header only |
| Injuries | `{Site}/injuries` | Y | Y | empty | x (500) |
| Transactions | `{Site}/transactions` | Y (367) | Y (1766) | empty | empty |
| Draft | `{Site}/draft` | Y | Y | x | x |
| Awards | core `.../leagues/{l}/awards` | Y (22) | Y (20) | x | x |
| Rankings | core `.../leagues/{l}/rankings` | empty | empty | empty | empty |
| Athletes (core) | core `.../leagues/{l}/athletes` | 715 | 20310 | 797 | 0 |
| Event `summary` | `{Site}/summary?event={id}` | Y | Y | Y | Y (thin) |
| Odds | core event `.../odds` | Y | Y | Y | empty |
| Play-by-play | core event `.../plays` | 507 | 184 | 1425 | 55 |
| Win probability | core event `.../probabilities` | 507 | 184 | x (400) | x (400) |
| Drives | core event `.../drives` | 0 | 21 | 0 | 0 |
| Predictor | core event `.../predictor` | x (400) | Y | x (400) | x (400) |
| Officials | core event `.../officials` | 4 | 7 | 1 | x (500) |

Evidence: the URLs in the sections below. The `Site` standings row was requested at `{Site}/standings` for each league (NBA/NFL/rugby returned `{"fullViewLink":{...}}`, EPL returned `{}`).

## Per-endpoint detail

### Standings

- `https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings` (and the `football/nfl`, `soccer/eng.1`, `rugby/267979` equivalents) returned 200 with root keys `abbreviation, children, id, name, season, uid`. `children[]` are conferences for NBA (Eastern, Western, 15 teams each) and NFL (AFC, NFC, 16 each), and a single table for EPL (20 teams) and Prem (10 teams). Each entry has `stats[]` as name/value pairs.
- NBA stat names: `wins, losses, winPercent, gamesBehind, streak, playoffSeed, pointsFor, pointsAgainst, pointDifferential, Home, Road, vs. Div., vs. Conf., Last Ten Games`. NFL adds `ties, divisionRecord, lockedDivRank`.
- EPL: `gamesPlayed, wins, ties, losses, points, pointsFor, pointsAgainst, pointDifferential, rank, rankChange, ppg, deductions`.
- Prem: `gamesPlayed, gamesWon, gamesDrawn, gamesLost, bonusPoints, bonusPointsTry, bonusPointsLosing, triesFor, triesAgainst, triesDifference, pointsFor, pointsAgainst, points, rank`.
- `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/standings` returned only a `fullViewLink`, so the data is on the `site.web.api.espn.com/apis/v2` path.
- Core: `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/standings` returned a single `$ref`. Following it listed `.../seasons/2027/types/1/groups/7/standings/{id}` entries (`overall`, `expanded`, ...). NFL also lists `playoff`; EPL and rugby list only `overall`.
- The season year differs by competition. The NBA and rugby core standings paths above use `seasons/2027` for the 2026-27 season, while NFL and EPL use `2026` (`.../football/leagues/nfl/standings` and `.../soccer/leagues/eng.1/standings` follow-ups). Do not assume one convention.

### Teams, rosters, schedules

- `{Site}/teams` returned `sports[0].leagues[0].teams[]`. `{Site}/teams/1` returned `team` with `abbreviation, color, alternateColor, logos, links, record, nextEvent, standingSummary, franchise, groups`.
- Roster, NBA (`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/1/roster`): flat `athletes[]` with `age, birthPlace, college, contract, dateOfBirth, displayHeight, displayWeight, experience, headshot, injuries, jersey, position, status`, plus `coach`.
- Roster, NFL (`.../football/nfl/teams/1/roster`): `athletes[]` grouped as `offense, defense, specialTeam, injuredReserveOrOut, suspended, practiceSquad`, each with `items[]`.
- Roster, EPL (`.../soccer/eng.1/teams/359/roster`): 27 athletes with `citizenship, flag, statistics, transactions`. Rugby (`.../rugby/267979/teams/25898/roster`): `athletes: []`.
- Schedule: `.../basketball/nba/teams/1/schedule` returned 5 events (`seasonType.name` "Preseason" at check time) with `competitions, date, id, name, seasonType`. NFL adds `byeWeek`. Rugby `.../rugby/267979/teams/25898/schedule` returned 500 and `.../teams/25898/statistics` returned 400.
- Depth charts: `.../basketball/nba/teams/1/depthcharts` returned `depthchart[0].positions` keyed `pg` etc. with `athletes`. NFL (`.../football/nfl/teams/1/depthcharts`) returned formations `Base 3-4 D, Special Teams, 3WR 1TE`. EPL and rugby returned only `season, status, team, timestamp`.
- Core season-scoped team `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2026/teams/1` links to `athletes, awards, coaches, depthCharts, events, againstTheSpreadRecords`. Its `/coaches`, `/events` and `/depthcharts` sub-paths worked. `/statistics`, `/record`, `/leaders`, `/odds`, `/roster`, `/injuries` returned 404.
- These site team sub-paths returned `200 {}` for all four (not real endpoints): `/teams/{id}/injuries`, `/news`, `/record`, `/leaders`, `/transactions`, `/standings`, `/athletes`, `/stats`. `/teams/{id}/events` returned 500 for NBA and NFL.

### Team and athlete statistics

- Team stats: `{Site}/teams/1/statistics` for NBA returned `results.stats.categories` named `general, offensive, defensive`. NFL is larger (12 KB). EPL returned `results: {}`.
- League-wide: `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete` (665 KB) and `.../byteam` (273 KB) returned `categories, glossary, currentSeason` plus `athletes[]` (50 per page, with `pagination`) or `teams[]`. NFL equivalents also work. EPL and rugby `byathlete` returned only `currentSeason`. EPL and rugby `byteam` returned 500.
- League leaders: `{Site}/football/nfl/statistics` (12.8 MB) returned `stats.categories[]` such as `passingYards`, each with `leaders[]`. `{Site}/soccer/eng.1/statistics` (669 KB) returned `stats` as an array with `abbreviation, displayName, leaders, name`. NBA and rugby `{Site}/statistics` returned `stats: null`.
- Core leaders: `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/leaders` returned categories `points, rebounds, assists, steals`. NFL starts `totalPoints, totalTouchdowns, rushingTouchdowns, rushingYards, passingTouchdowns, completions, passingYards, receptions, interceptions, sacks`. EPL and rugby returned 400.
- Athlete (common v3): `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/4278039` and `/overview`, `/gamelog`, `/splits`, `/stats`, `/bio` all returned 200. NFL (`.../football/nfl/athletes/4568510`) the same. EPL (`.../soccer/eng.1/athletes/169532`) returned 200 for the base, `/overview`, `/gamelog`, `/bio`, and 404 for `/splits` and `/stats`. `/overview` carries `statistics, gameLog, news, nextGame` (NBA also `awards, fantasy, rotowire`).
- Athlete (core): `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/4278039` returned the profile; `/statistics` returned `splits`; `/contracts` and `/seasons` worked. `/eventlog` worked for NFL and EPL but was 404 for NBA. `/injuries` and `/notes` returned 404 for all.
- Rugby: `https://sports.core.api.espn.com/v2/sports/rugby/leagues/267979/athletes` returned `count: 0`, so no rugby athlete endpoints were tested.

### News

`{Site}/news` returned `articles[]` for NBA, NFL and EPL: 6 by default, `?limit=25` gave 25, `?limit=100` gave 50 (cap 50). Article keys: `categories, contentKey, dataSourceIdentifier, description, headline, id, images, lastModified, links, nowId, premium, published, type`. Rugby (`https://site.api.espn.com/apis/site/v2/sports/rugby/267979/news`) returned only `{"header":"Prem Rugby News"}`. Core `.../leagues/{l}/news` returned 404 for all four.

### Injuries and transactions

- `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries` (1.3 MB) returned 30 team groups. Each `injuries[]` entry has `athlete, date, details, longComment, shortComment, source, status, type`. NFL returned 32 groups (8.7 MB). EPL returned `injuries: []`. Rugby returned 500.
- `{Site}/transactions` returned `transactions[]` of `{date, description, team}`, with `count` 367 for NBA (for example "Waived G Terrell Brown Jr.", 2026-10-06) and 1766 for NFL. EPL and rugby returned `count: 0`.

### Draft, awards, calendar, seasons, reference data

- `{Site}/basketball/nba/draft` returned `year 2026`, 2 rounds, 60 picks, 30 teams. NFL returned `year 2027`, 7 rounds, 0 picks. EPL and rugby returned 404.
- Core `.../football/leagues/nfl/talentpicks` returned `count 165` items. Core `.../leagues/nba/awards` count 22 and `.../leagues/nfl/awards` count 20; EPL and rugby returned 404. Core `.../basketball/leagues/nba/seasons/2026/futures` returned 15 markets (for example `NBA Championship Winner`).
- Core `.../leagues/{l}/seasons` counts: NBA 81, NFL 105, EPL 26, Prem 30. `.../football/leagues/nfl/seasons/2026/types/2/weeks/5/events` returned 15 events. `.../leagues/{l}/calendar` returned 4 `$ref` links (`ondays, offdays, blacklist, whitelist`).
- Site `groups`: NBA (196 KB) and NFL (215 KB) list conferences and divisions. EPL and rugby return only the season name.
- Core `franchises`: NBA 30, NFL 32, EPL 20, rugby 500. `venues`: NBA 648, NFL 681, EPL 10250, Prem 8200. `positions`: NBA 11, NFL 74, EPL 42, Prem 35.
- Rankings (`https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/rankings`) returned `count: 0` for all four. `{Site}/basketball/nba/rankings` returned 404. Rankings appear to be poll-style data that these competitions do not use (inference, not checked against a college league).

### Per-event data (the richest area)

`https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={id}` returned 200 for all four. Top-level content by sport:

| Key | NBA | NFL | EPL | Prem |
|---|---|---|---|---|
| `boxscore` | `players, teams` | `players, teams` | `teams` | `players, teams` |
| `plays` | 507 | `drives` + `scoringPlays` (7) | none (see `keyEvents`) | none |
| `winprobability` | 507 | 184 | none | none |
| `leaders` | 2 | 2 | 2 | none |
| `injuries` | 2 | 2 | none | none |
| `pickcenter` / `odds` | `pickcenter` 1, `odds` 0 | same | `pickcenter` 1, `odds` 2 | both empty |
| `againstTheSpread` | 2 | 2 | none | empty |
| `rosters` | none | none | 2 (with `formation`) | 2 |
| `keyEvents` / `commentary` | none | none | 31 / 106 | none |
| `lastFiveGames` | none | none | 2 | 2 (+ `headToHeadGames`) |
| `seasonseries` | 1 | none | 1 | none |
| `gameInfo` | `attendance, officials, venue` | same | same | `attendance, venue` |
| `videos` | 6 | 8 | 1 | none |
| `news` | articles | articles | articles | header only |
| `broadcasts` | 0 (finished) | 1 | 1 | none |

Core event sub-resources, base `https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/events/{id}/competitions/{id}/`:

- `odds`: NBA 1, NFL 1, EPL 2, rugby 0. Item keys: `awayTeamOdds, homeTeamOdds, close, open, current, details, overUnder, spread, overOdds, underOdds, moneylineWinner, spreadWinner, propBets, provider`. EPL adds `drawOdds`. Provider was DraftKings.
- `plays`: NBA 507, NFL 184, EPL 1425, rugby 55 (accepts `?limit=`). Rugby plays had `type.text` "try", `clock`, `homeScore`, `awayScore`, `participants`. Soccer plays have `scoringPlay, yellowCard, redCard, penaltyKick, ownGoal, substitution` flags.
- `probabilities` (win probability): NBA 507, NFL 184. EPL and rugby returned 400.
- `predictor`: NFL only (keys `awayTeam, homeTeam, lastModified`). NBA, EPL, rugby returned 400. `powerindex`: NFL count 2, NBA count 0, EPL and rugby 400.
- `drives`: NFL 21, others 0. `broadcasts`: NBA 1, NFL 1, EPL 2, rugby 0. `officials`: NBA 4, NFL 7, EPL 1, rugby 500. `commentaries`: EPL 2, others 0.
- `status`, `situation` (NFL: `down, distance, yardLine, isRedZone`; NBA: `awayFouls, homeFouls, awayTimeouts, homeTimeouts`) and `competitors` returned 200. Competition `leaders` worked for NFL and rugby; NBA returned 400 `Not supported for basketball/nba`.
- `details`, `boxscore`, `lineups`, `matchstats` returned 404 for all four. Box score and lineups come from `summary`. `competitors/1/statistics` returned 404 for the NBA event.
- `.../leagues/{l}/events` without `dates` returned only the current slate (NBA 2, NFL 15, EPL 6, rugby 1; see `$meta.parameters`).

### Data already in the scoreboard and header responses

The responses the adapter already fetches carry fields it ignores. Site scoreboard competitions (`https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`) include `broadcasts, geoBroadcasts, notes, venue, attendance, highlights, recent, playByPlayAvailable`. NFL adds `headlines, leaders`; EPL adds `odds, tickets, details`.

The header event (`https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=basketball&league=nba&dates=20261009-20261011&limit=1000`) has an `odds` key on upcoming games only: `details "HOU -3.5"`, `overUnder 231.5`, `spread`, `pointSpread`, `moneyline`, `total`, provider DraftKings. The recorded fixture `test/fixtures/espn/nba-header.json` has no `odds` key, because those games were finished.

## Gaps, limits and gotchas

- **Auth and limits.** No auth needed. `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news` returned `access-control-allow-origin: *` and `cache-control: max-age=3`. No stress test was done here; see the earlier doc for concurrency tests.
- **Silent empties.** `200 {}` or empty arrays are common for unsupported sub-paths (see the team sub-paths above).
- **Gaps by competition.** Premier League: no injuries, transactions, draft, awards, depth charts, win probability; core leaders 400. Gallagher Premiership: no roster, athletes, news articles, odds, broadcasts, officials, awards, draft, team stats; schedule 500; summary is thin.
- **Size.** NFL `statistics` is 12.8 MB and NFL `injuries` 8.7 MB; NBA `injuries` is 1.3 MB. Heavy for a browser app.
- **Season year conventions differ** (see Standings).
- **Time sensitive.** At check time the NBA was in the preseason, NFL in week 5, and one rugby match was live. Empty values (NFL draft picks, EPL injuries) may fill later.
- **Stability.** ESPN publishes no contract or deprecation policy for these APIs. Treated as unverified.
- **Not tested:** other hosts (`cdn.espn.com` pages beyond the earlier doc, `now.core.api.espn.com`), authenticated endpoints, other sports, rugby athletes, and live-game variants of `situation` and `drives`.

## Candidate additions for this project (observations, not recommendations)

Each could follow the adapter pattern in `src/core/espn/adapter.ts`, with fixtures recorded per `test/fixtures/README.md`:

1. Standings: one request per competition, small stable shape.
2. Upcoming-match odds: already inside the header response the app fetches.
3. News: one request per competition except rugby.
4. Match Details enrichment via `summary?event=` (box score, key events, leaders), available for all four.

## Unverified

- That season year `2027` for NBA and Gallagher is intended and stable. Observed only on 2026-10-09.
- Whether the 400s for `probabilities`, `predictor` and `powerindex` are permanent or depend on game state. Only one finished event per sport was tested.
- Whether in-progress games expose more than finished ones. A live rugby event `604624` was seen on the scoreboard but not probed.
- Maximum `limit` for endpoints other than news (50) and those in the earlier doc.
