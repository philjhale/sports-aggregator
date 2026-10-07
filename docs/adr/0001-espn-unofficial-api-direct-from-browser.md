# Use ESPN's unofficial API, called directly from the browser

The app is a static site with no backend. It fetches Results straight from ESPN's undocumented `site.api.espn.com` scoreboard endpoints. As of 2026-10, ESPN is the only free source that covers all four launch Competitions (NBA, NFL, Premier League, Gallagher Prem) with no API key and `Access-Control-Allow-Origin: *`. The app is for personal use, so the unofficial status and the no-commercial-reuse terms are accepted risks. All ESPN access sits behind a per-source adapter so it can be replaced.

## Considered Options

- **TheSportsDB (free key `123`)**: covers all four, but the free tier caps responses at 1–15 events. That would show silently partial Results. It is rejected as a fallback too.
- **football-data.org, balldontlie, API-Sports**: each needs a key and covers only some Competitions. football-data.org also blocks browser origins with ports.

## Consequences

- The site scoreboard rejects date ranges (HTTP 400), but ESPN's scoreboard header endpoint accepts them. A Window is fetched with one header request per Competition (`dates=start-end&tz=…&limit=1000`). If that fails, the app falls back to one site scoreboard request per day. See `docs/research/espn-api-fetch-limits.md`.
- Results for completed past days are cached in the browser, so only recent days are refetched.
- Making the app public, or switching to a key-based source, means revisiting this decision. A key-based source needs a proxy to keep the key secret.
