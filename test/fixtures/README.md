# Test fixtures

These ESPN fixtures are hand-built in the shape of real ESPN responses (ESPN was not reachable when they were written). Replace them with trimmed recorded responses when possible.

- `espn/*-header.json`: scoreboard header shape (`sports[0].leagues[0].events[]`), served for `site.web.api.espn.com/apis/v2/scoreboard/header`.
- `espn/*-scoreboard-YYYYMMDD.json`: site scoreboard shape (`events[].competitions[0]`), one file per day, served for `site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard?dates=YYYYMMDD` (the per-day fallback).

Site scoreboard fixtures (Premier League only, 5-7 Oct 2026):

| File | Notable events |
|---|---|
| `premier-league-scoreboard-20261005.json` | finished 1-1 draw |
| `premier-league-scoreboard-20261006.json` | finished, postponed, one with no away competitor, one with no scores (both malformed, must be skipped) |
| `premier-league-scoreboard-20261007.json` | scheduled tonight |

Header fixtures (the default Window in tests is 5-7 Oct 2026, Europe/London):

| File | Competition | Notable events |
|---|---|---|
| `nba-header.json` | NBA | finished (one `Final/OT`), postponed, in progress, scheduled tonight, one before the Window |
| `nfl-header.json` | NFL | finished (one `Final/OT`), postponed, one before the Window |
| `premier-league-header.json` | Premier League | finished (one 1-1 draw), postponed, scheduled tonight, one before the Window |
| `gallagher-premiership-header.json` | Gallagher Premiership | finished (one 24-24 draw), scheduled tonight, one before the Window |
