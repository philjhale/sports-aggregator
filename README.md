# sports-aggregator

A quiet, browser-only summary of recent match Results across several Competitions, using ESPN's free unofficial API. There is no backend and no API key (see `docs/adr/0001-espn-unofficial-api-direct-from-browser.md`). Domain terms (Sport, Competition, Result, Window, Match Details) are defined in `GLOSSARY.md`.

## Local development

Requires Node 22+.

```sh
npm install
npm run dev       # Vite dev server at http://localhost:5173/sports-aggregator/
npm run build     # type-check and build to dist/
npm run preview   # serve the built dist/ locally
```

The app calls ESPN directly from the browser, so the dev server needs internet access to show real Results.

## Tests and type-check

```sh
npm test            # Vitest, once
npm run test:watch  # Vitest, watch mode
npm run typecheck   # tsc --noEmit
```

Tests render the whole app in jsdom. `test/helpers/renderApp.tsx` injects a fake ESPN `fetch` (`fakeEspn.ts`), a fixed clock and timezone, and in-memory storage (`memoryStorage.ts`).

The ESPN fixtures in `test/fixtures/espn/` are trimmed recordings of live responses. Re-record them with `node test/fixtures/record.mjs`; see `test/fixtures/README.md`.

## Deploy

`.github/workflows/ci.yml` type-checks and tests every pull request. On push to `main` it also builds and deploys `dist/` to GitHub Pages using the official Pages actions.

- One-time setup: in the repo's **Settings > Pages**, set **Source** to **GitHub Actions**.
- The site is served from the `/sports-aggregator/` project sub-path, set by `base` in `vite.config.ts`. If you rename the repo, update `base` to match.

## Adding a Competition or Sport

Everything lives in `src/core/config.ts`. No other code changes are needed.

- **Competition**: add an entry to `competitions` with a unique `id`, the `sportId` of an existing Sport, a display `name`, and the ESPN `source` slugs. The slugs are the `{sport}/{league}` parts of ESPN's API URLs (e.g. `soccer/eng.1`). Some leagues use a numeric id (Gallagher Premiership is `rugby/267979`).

  ```ts
  {
    id: 'la-liga',
    sportId: 'football',
    name: 'La Liga',
    source: { kind: 'espn', sport: 'soccer', league: 'esp.1' },
  },
  ```

- **Sport**: add an entry to `sports` with an `id`, a display `name` and an `order` (Sports are shown in ascending `order`). Then add its Competitions as above.

If the tests should cover the new Competition, add a fixture to `test/fixtures/espn/` and register it in `test/helpers/fakeEspn.ts`.

## Layout

- `src/core/`: framework-free domain core (types, Competition config, Window, settings, results service). All ESPN parsing lives in `src/core/espn/adapter.ts`.
- `src/ui/`: React components rendering what the core returns. `styles.css` defines light and dark colour tokens as CSS custom properties, switched by `prefers-color-scheme`.
- `test/`: whole-app tests, helpers and fixtures.
