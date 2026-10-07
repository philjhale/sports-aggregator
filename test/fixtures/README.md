# Test fixtures

These ESPN fixtures are hand-built in the shape of real ESPN responses (ESPN was not reachable when they were written). Replace them with trimmed recorded responses when possible.

- `espn/*-header.json`: scoreboard header shape (`sports[0].leagues[0].events[]`), served for `site.web.api.espn.com/apis/v2/scoreboard/header`.

Header fixtures (the default Window in tests is 5-7 Oct 2026, Europe/London):

| File | Competition | Notable events |
|---|---|---|
| `nba-header.json` | NBA | finished (one `Final/OT`), postponed, in progress, scheduled tonight, one before the Window |
| `nfl-header.json` | NFL | finished (one `Final/OT`), postponed, one before the Window |
| `premier-league-header.json` | Premier League | finished (one 1-1 draw), postponed, scheduled tonight, one before the Window |
| `gallagher-premiership-header.json` | Gallagher Premiership | finished (one 24-24 draw), scheduled tonight, one before the Window |
