# Test fixtures

These ESPN fixtures are recorded from the live API (`node test/fixtures/record.mjs`), each trimmed to a handful of events. Nothing else in a response or a kept event is edited.

- `espn/*-header.json`: scoreboard header (`sports[0].leagues[0].events[]`), served for `site.web.api.espn.com/apis/v2/scoreboard/header`.
- `espn/*-scoreboard-YYYYMMDD.json`: site scoreboard (`events[].competitions[0]`), one file per day, served for `site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard?dates=YYYYMMDD` (the per-day fallback).

Recorded 7 Oct 2026, `tz=Europe/London`:

| Competition | Recorded week | Events |
|---|---|---|
| NBA | 3-7 Oct | Heat at Raptors (before the default Window) and four finals 6-7 Oct |
| NFL | 4-6 Oct | Chiefs at Raiders (before the default Window), Lions at Panthers, Falcons at Saints |
| Premier League | 14-20 Sep | Leeds v Newcastle (before the Window), then Brentford, Spurs, Man City and a Fulham 1-1 Man Utd draw. Site scoreboard fallback for 18-20 Sep |
| Gallagher Premiership | 2-4 Oct | Three finals |

The default test clock is 7 Oct 2026, Europe/London (Window 5-7 Oct). The Premier League paused 1-7 Oct and the Gallagher Premiership played nothing 5-7 Oct, so those tests set `PREMIER_LEAGUE_NOW` (18-20 Sep) or `GALLAGHER_NOW` (2-4 Oct).

## What a recording cannot hold

ESPN returns a postponed, scheduled or in-progress match only while it is one, and overtime, extra time and shootouts only when they happen. Where a test needs one, it changes a single recorded event with a helper in `test/helpers/patchEspn.ts` and says so; the rest of the response stays as recorded. The same helper makes the malformed events (missing competitor, missing scores) the adapter must skip.

## Contract

`test/fixtures.contract.test.ts` fails when a recorded event lacks a field the adapter reads. Add a path there whenever the adapter starts reading a new one.

## Re-recording

Run `node test/fixtures/record.mjs`. Team names, scores and ids are asserted in tests, so ESPN correcting a past result would show up as a failing test.
