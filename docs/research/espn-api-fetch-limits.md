# ESPN unofficial API: how much data one request can return

All tests were run with `curl` + `jq` on **2026-10-07** (between about 08:05 and 08:40 UTC) from macOS, with no auth and no special headers. "Events" means `.events | length` (site scoreboard), `.sports[0].leagues[0].events | length` (header), or `.items | length` / `.count` (core). Byte sizes are uncompressed unless marked `gz`.

Competitions: NBA `basketball/nba`, NFL `football/nfl`, Premier League `soccer/eng.1`, Gallagher Prem `rugby/267979`.

## TL;DR

- **The site scoreboard (`site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`) does not accept date ranges.** Every range syntax returned HTTP 400 for all 4 leagues. It accepts only a single day (`YYYYMMDD`), a month (`YYYYMM`) or a year (`YYYY`). `startDate`/`endDate` are silently ignored: you get the default "current" scoreboard.
- **The scoreboard header endpoint does accept ranges:** `site.web.api.espn.com/apis/v2/scoreboard/header?sport={sport}&league={league}&dates=YYYYMMDD-YYYYMMDD`. It works for all 4 leagues and across month boundaries. It returns final scores and status inline. **It caps results at 75 events by default and truncates silently. Always pass `limit=1000`.** Very large results (above about 255 NBA events, about 3.5 MB) return HTTP 502.
- **`limit` caps at 1000** on both the site scoreboard and core. Any value above 1000 silently falls back to 25 events. The site scoreboard has **no pagination**: `page` is ignored. Default page size is 100 (site scoreboard), 75 (header) and 25 (core).
- **The core API** (`sports.core.api.espn.com/v2/.../events?dates=A-B`) supports ranges and real pagination (`count`, `pageIndex`, `pageSize`, `pageCount`). It returns only `$ref` links, so getting scores costs N more requests. It is not useful here.
- **Day bucketing is not UTC by default.** It is roughly US Eastern, with an unexplained outlier. **A `tz=` parameter (for example `tz=Europe/London` or `tz=UTC`) changes the bucketing** on both the scoreboard and header endpoints. This matters for Window boundaries.
- No rate-limit headers were returned, and no throttling occurred in 25 sequential requests plus 40 requests at 20-way concurrency. Every endpoint tested sends `access-control-allow-origin: *`.
- **Recommendation:** use 1 header request per competition per Window, with `dates=<start>-<end>&tz=<user tz>&limit=1000`. That is 4 requests in total for any Window of 1, 3, 7 or 14 days.

## Request patterns

| # | Pattern | Result | Counts / notes |
|---|---|---|---|
| 1 | site scoreboard `?dates=YYYYMMDD` | 200, all 4 leagues | NBA 20261005 = 5 events, 94 KB |
| 2 | site scoreboard `?dates=YYYYMMDD-YYYYMMDD` (2, 7 and 14-day spans; within a month and crossing a month) | **400** for all 4 leagues | body `{"code":400,"message":"Failed to get events endpoint."}` |
| 3 | site scoreboard, URL-encoded hyphen `%2D` | **400** for all 4 | |
| 4 | site scoreboard `?dates=A,B` | **400** for all 4 | |
| 5 | site scoreboard `?dates=2026-10-05` | **400** | |
| 6 | site scoreboard `?startDate=A&endDate=B` | 200, **params ignored** | Same event IDs as the bare default scoreboard, for all 4 leagues |
| 7 | site scoreboard `?dates=YYYYMM` | 200 | Default cap 100. NBA 202610: 100 events by default, 155 with `limit=1000` |
| 8 | site scoreboard `?dates=YYYY` | 200 | Default 100. NBA 2025 with `limit=1000`: exactly 1000 events (truncated; ends 2025-11-02) |
| 9 | site scoreboard `limit` > 1000 | 200, **falls back to 25** | Tested 1001, 1500, 2000 … 10000 |
| 10 | site scoreboard `page=2` / `offset=50` | **ignored** | Same IDs as page 1 |
| 11 | `site.web.api.espn.com/apis/site/v2/.../scoreboard` | Same behaviour as `site.api` | Range: 400. Day/month: 200 |
| 12 | **header** `site.web.api.espn.com/apis/v2/scoreboard/header?sport=&league=&dates=A-B` | **200, all 4 leagues** | Default cap **75**; `limit=1000` lifts it. Matches the per-day union exactly |
| 13 | header on `site.api.espn.com/apis/v2/scoreboard/header` | 200 | Same data |
| 14 | header, range too large (≥ about 255 NBA events) | **502** | NBA 20260310-20260410 = 252 events, 200. 20260310-20260411 gives 502 |
| 15 | core `.../events?dates=A-B` | 200, ranges work | Paginated, `$ref` only. Default `pageSize` 25. Max `limit` 1000 (1001 falls back to 25) |
| 16 | `cdn.espn.com/core/nba/scoreboard?xhr=1&dates=…` | `dates` ignored | Uses `date=YYYYMMDD` (singular). `date=` range or month returns a fallback scoreboard |
| 17 | NFL `?week=N&seasontype=2` | 200 | 16 events for week 4 of 2026 |
| 18 | `tz=` on scoreboard and header | 200, **changes day bucketing** | See §6 |

## Detailed findings

### 1. The site scoreboard rejects every range format

These requests were tested on 2026-10-07, for each of `basketball/nba`, `football/nfl`, `soccer/eng.1` and `rugby/267979`:

- `https://site.api.espn.com/apis/site/v2/sports/{L}/scoreboard?dates=20261001-20261007` returned **400** (80 bytes gz).
- `…?dates=20261001%2D20261007` returned **400**.
- `…?dates=20261001,20261007` returned **400**.
- `…?dates=20261006-20261007` (2 days) returned **400**.
- `…?dates=20260928-20261004` (7 days, crossing a month) returned **400**.
- `…?dates=20260924-20261007` (14 days, crossing a month) returned **400**.
- `…?dates=20250301-20250307` (a past range) and the same with `&limit=1000` returned **400**.
- `…?dates=20261001-20261007&tz=UTC` returned **400**.
- `…?startDate=20261001&endDate=20261007` returned 200. The event IDs are identical to the bare `…/scoreboard` (checked with `startDate=20250101&endDate=20250107`), so the parameters are ignored. Counts: NBA 4, NFL 15, EPL 6, Prem 1. These are just the current or next slate.

### 2. Month and year queries, `limit`, and pagination (site scoreboard)

All tested on 2026-10-07:

- `…/basketball/nba/scoreboard?dates=202610` returned 100 events, 849 KB. With `&limit=1000`: 155 events, 1.22 MB. **The earlier claim (100, then 155) is confirmed.**
- `…/basketball/nba/scoreboard?dates=202603` with `limit=150`: 150 events. `limit=200`: 200. `limit=1000`: 239 (3.24 MB raw, 274 KB gz). The last event is `2026-04-01T03:00Z`, which is a US-evening game on 31 March.
- `…/basketball/nba/scoreboard?dates=2025&limit=` with 999 gave 999, 1000 gave **1000** (13.5 MB), and 1001, 1500, 2000, 3000, 4000, 4999, 5000 and 10000 all gave **25** (340 KB). So the **maximum is 1000, and anything above it silently falls back to 25.**
- `…?dates=2025&limit=1000` for NBA hit the cap: 1000 events, the last on 2025-11-02. Core reports the calendar year 2026 as 1381 NBA events, so a full NBA year cannot fit in one request.
- Without `limit`, the full-year counts are: NFL 2025 = 100 (335 with `limit=1000`), EPL 2025 = 100 (378), Prem 2025 = 88 (88).
- Month counts without and with `limit=1000`: NFL 202609 = 48/48, EPL 202609 = 30/30, Prem 202609 = 5/5, NBA 202510 = 100/151, NBA 202511 = 100/219.
- `…/basketball/nba/scoreboard?dates=202603&limit=50&page=2` returned the same 50 IDs as without `page`. `&offset=50` was also ignored. **There is no pagination.**

### 3. The scoreboard header endpoint supports ranges

All tested on 2026-10-07:

- `https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=basketball&league=nba&dates=20260301-20260314` returned **75** events (truncated; the last is 2026-03-11). With `&limit=1000`: **109**. That equals the de-duplicated union of 14 single-day site scoreboard calls (`diff` was empty).
- `…sport=basketball&league=nba&dates=20260325-20260407&limit=1000` (crossing a month) returned 108, equal to the per-day union.
- `…sport=basketball&league=nba&dates=20260228-20260301` (2 days, crossing a month) returned 16.
- `…sport=basketball&league=nba&dates=20260301-20260331` returned 75. With `limit=1000`: 239 (3.29 MB), the same as site `202603&limit=1000`. With `limit=50`: 50. With `limit=1001`: 239, so the header did **not** fall back to 25.
- `…sport=football&league=nfl&dates=20260924-20261007` returned 32, equal to the per-day union.
- `…sport=rugby&league=267979&dates=20260924-20261007` returned 10, equal to the per-day union.
- `…sport=soccer&league=eng.1&dates=20260912-20260920` returned 20. `20260919-20260920` returned 9. `20260830-20260913` returned 24. `20260924-20261007` returned 0, which is correct: the site per-day calls also returned 0, and the `202609` and `202610` month calls have no EPL events between 20 September and 10 October.
- `…sport=rugby&league=267979&dates=20250101-20251231&limit=1000` (a whole year) returned 88 (284 KB). So the **span itself is not limited.**
- **502 on large results:** NBA `20260201-20260331`, NBA `20260301-20260415`, NBA `20260310-20260411` and NFL `20250901-20251231`, all with `limit=1000`, returned 502. NBA `20260301-20260402` (254 events) and NFL `20250901-20251031` (122 events) returned 200. NBA `20260710-20260830` (0 events) returned 200. So the threshold seems to depend on result size, not on the number of days.
- Event shape (Prem `20260924-20261007`): `date`, `status` (`pre`/`in`/`post`), `fullStatus.type` (`{name:"STATUS_FINAL", state:"post", completed:true}`), and `competitors[]` with `displayName`, `score`, `winner` and `homeAway`. That is enough for results without any follow-up requests.
- `https://site.api.espn.com/apis/v2/scoreboard/header?...&dates=20260301-20260314&limit=1000` returned 109, the same as `site.web`.
- `https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header?sport=basketball&league=nba&dates=20260301-20260314&limit=1000` returned 109.

### 4. Core API

All tested on 2026-10-07, at `https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/events?...`:

- `basketball/nba` `dates=20261005` gave `{count:5,pageIndex:1,pageSize:25,pageCount:1}`.
- `dates=20260301-20260314` gave `{count:109,pageSize:25,pageCount:5}`. `&page=2` gave `pageIndex:2`. `&limit=1000` gave `pageSize:1000,pageCount:1`, with all 109 items.
- `dates=202603` gave count 239. `dates=2026` gave count 1381 and pageCount 56. `dates=2026&limit=1000` gave 1000 items and pageCount 2. `limit=1001`, `2000` and `5000` all gave **pageSize 25**.
- NFL `20260924-20261007` gave count 32. EPL `20260912-20260920` gave count 20. Prem `20260924-20261007` gave count 10.
- Each item is only `{"$ref": ".../events/{id}?lang=en&region=us"}`. Scores sit 2 more `$ref` levels down (`competitions/{id}/competitors/{id}/score`). Not viable for a browser results view.
- Header: `cache-control: max-age=900, stale-while-revalidate=7200`.

### 5. The cdn host and NFL week parameters

Tested on 2026-10-07:

- `https://cdn.espn.com/core/nba/scoreboard?xhr=1&dates=20261005` and `&dates=20260310` returned the same 4 default events, so `dates` is ignored. `&date=20260310` returned 11 events on 2026-03-10/11. `&date=20260301-20260314` and `&date=202603` each returned 5 unrelated fallback events. **cdn: single day only, via `date=`.** It also returns a large page wrapper (254 KB for 4 events).
- `…/football/nfl/scoreboard?week=4&seasontype=2` returned 16 events, 2026-10-02 to 2026-10-06, week 4, season 2026. Adding `&dates=2026`, or omitting `seasontype`, gave the same result.
- `…?seasontype=2&week=18&dates=2025` returned 16 events in January 2026. Here `dates=YYYY` acts as the **season** year.
- `…?seasontype=3&week=5&dates=2025` returned 1 event (2026-02-08, the Super Bowl).
- `…?seasontype=3&dates=2025` with no `week` returned 100 events from 2025-01-04 to 2025-09-14, so `seasontype` is ignored without `week`.
- An NFL week does not line up with calendar-day Windows. Not needed if you use the header ranges.

### 6. Date bucketing and `tz`

Tested on 2026-10-07:

- `…/basketball/nba/scoreboard?dates=20260331` returned 7 events, from `2026-03-31T23:00Z` to `2026-04-01T03:00Z`. `dates=20260401` started at `2026-04-01T23:00Z`. **The default is not UTC.** Late-evening ET games (after 00:00Z) belong to the earlier US date.
- `…/soccer/mex.1/scoreboard?dates=20251127` included `2025-11-27T05:00Z`, which is 00:00 EST. That fits US Eastern.
- **Outlier:** `…/basketball/nba/scoreboard?dates=20251002` included `2025-10-03T09:30Z` (Melbourne United at Pelicans, a preseason game in Australia). That is 05:30 EDT on 3 October, yet it is bucketed on 2 October. So the default is not strictly ET midnight. Cause unknown.
- **`tz` overrides the bucketing.** The same changes apply to scoreboard and header:
  - `…/basketball/nba/scoreboard?dates=20260331&tz=UTC` returned 8 events, from `2026-03-31T00:00Z` to `2026-03-31T23:30Z` (pure UTC day).
  - `…?dates=20260331&tz=Europe/London` returned 8 events, from `2026-03-30T23:00Z` to `2026-03-31T02:00Z`. This is the correct BST day: 2026-03-30T23:00Z to 2026-03-31T22:59Z.
  - `…?dates=20251002&tz=UTC` returned only `2025-10-02T16:00Z`. `…?dates=20251003&tz=UTC` returned `2025-10-03T09:30Z`. The outlier is fixed.
  - `…?dates=202603&tz=UTC&limit=1000` returned 237 events, `2026-03-01T00:00Z` to `2026-03-31T23:30Z`.
  - Header `…sport=basketball&league=nba&dates=20260330-20260331&limit=1000` returned 15 events by default, 11 with `&tz=UTC` (`2026-03-30T02:00Z` to `2026-03-31T23:30Z`), and 11 with `&tz=Europe/London` (`2026-03-29T23:00Z` to `2026-03-31T02:00Z`, which accounts for the DST change on 29 March).
  - `…/soccer/mex.1/scoreboard?dates=20251126&tz=America/Los_Angeles` gained the `2025-11-27T05:00Z` game (21:00 PST on 26 November).
- Note: header range `nba&dates=20261001-20261007` with the default tz included 5 `pre` games dated `2026-10-07T23:00Z` or later, which are tonight's US games. A Window must filter on `fullStatus.type.completed` (or `status == "post"`).

### 7. Response size

Tested on 2026-10-07, raw / gzip (the server gzips when the client sends `Accept-Encoding: gzip`, as browsers do):

| Request | Events | Raw | gz |
|---|---|---|---|
| site NBA `dates=20260310` | 11 | 154 KB | 15 KB |
| site NBA `dates=202603&limit=1000` | 239 | 3.24 MB | 274 KB |
| header NBA `dates=20260310` | 11 | 152 KB | 12 KB |
| header NBA `dates=20260308-20260314&limit=1000` | 56 | 770 KB | 55 KB |
| header NBA `dates=20260301-20260314&limit=1000` | 109 | 1.50 MB | 105 KB |
| site EPL `dates=20260912` | 7 | 83 KB | 8 KB |
| header EPL `dates=20260907-20260920&limit=1000` | 20 | 252 KB | 19 KB |
| site Prem `dates=20260925` | 1 | 38 KB | 5 KB |
| header Prem `dates=20260924-20261007&limit=1000` | 10 | 33 KB | n/a |

The cost is about 13.5 KB raw per NBA event (header) or 13.6 KB (site), and about 1 KB per event gzipped. A 14-day NBA Window costs about 1.5 MB raw and 105 KB on the wire, then a 1.5 MB `JSON.parse`. That is acceptable.

### 8. Rate limiting and caching

Tested on 2026-10-07:

- 25 sequential requests to `…/basketball/nba/scoreboard?dates=20260310&_=N` all returned 200.
- 25 sequential requests to the header 14-day `limit=1000` range all returned 200.
- 40 requests at 20-way concurrency (`xargs -P 20`) to the site scoreboard all returned 200.
- No `x-ratelimit-*`, `retry-after` or similar headers appeared on any endpoint.
- `cache-control`:
  - site scoreboard: `max-age=5` (seen as `max-age=1` on another request)
  - site scoreboard 400: `max-age=1`
  - header on site.web: `max-age=1`, and also seen as `max-age=10`
  - header on site.api: `max-age=10`
  - core: `max-age=900, stale-while-revalidate=7200`
  - cdn: `max-age=300`

### 9. CORS

Tested on 2026-10-07 with `Origin: http://localhost:5173`. Every response returned `access-control-allow-origin: *`, including the 400 from the site range request. Endpoints checked: the site scoreboard (day and range), the header on both `site.web.api` and `site.api`, core events, and cdn. The header endpoint also returned `access-control-allow-methods: GET,PUT,POST,DELETE,OPTIONS,HEAD`. A plain `fetch` GET with no custom headers needs no preflight.

## Unverified claims

- "Site v2 MLB and NFL scoreboards currently return HTTP 400 for `dates=YYYYMMDD-YYYYMMDD`", described as a regression. Source: github.com/pseudo-r/Public-ESPN-API (read 2026-10-07). **This is consistent with the tests and broader than claimed**: all 4 tested leagues return 400. That ranges once worked on the site scoreboard is unverified.
- "No official limits published, but excessive requests may be blocked." Source: the same gist. Blocking at volumes above about 65 requests in a burst is **unverified**.
- The cause of the header endpoint's 502 is unverified (size and timeout are suspected). The exact threshold is somewhere between 254 events (200) and the NBA 20260310-20260411 range (502).
- The rule behind the default (no `tz`) bucketing is unverified. It is mostly US Eastern, but the Melbourne preseason game contradicts that. Avoid depending on it.
- Long-term stability is unverified. All of these APIs are undocumented and may change without notice.

## Recommended fetch strategy

Use **1 request per competition per Window** on the header endpoint, with the user's IANA time zone so that ESPN's day buckets match the Window's calendar days:

```
https://site.web.api.espn.com/apis/v2/scoreboard/header
  ?sport={sport}&league={league}
  &dates={startYYYYMMDD}-{endYYYYMMDD}
  &tz={Intl.DateTimeFormat().resolvedOptions().timeZone}
  &limit=1000
```

Then filter to `fullStatus.type.completed === true`, or `status === "post"`. As a safety net, also filter `date` client-side against the Window's local boundaries.

| Window | Requests per competition | Total (4 comps) | Expected max NBA events / raw size |
|---|---|---|---|
| 1 day | 1 | 4 | about 15 / about 0.2 MB |
| 3 days | 1 | 4 | 26 / 0.36 MB (measured 20260312-20260314) |
| 7 days | 1 | 4 | 56 / 0.77 MB (measured 20260308-20260314) |
| 14 days | 1 | 4 | 109 / 1.5 MB (measured 20260301-20260314) |

All four Windows stay well under the 75 default cap only if `limit=1000` is passed. The NBA 14-day Window would otherwise truncate at 75. They also stay well under the 502 threshold of about 250 events.

**Fallback** if the header endpoint breaks: use the site scoreboard with `dates=YYYYMMDD&tz=…`, one request per day. That is 1, 3, 7 or 14 requests per competition, so 4, 12, 28 or 56 in total. The `dates=YYYYMM&limit=1000` call is not a better fallback for these Windows. A Window that crosses a month needs 2 calls. An NBA month is up to about 3.2 MB raw. You also over-fetch up to a month to get 1 day.

Do not use these: core (`$ref` fan-out), cdn (single day only, heavy wrapper), or NFL `week` (does not align with calendar days).
