# sports-aggregator

Shows summary of recent match results across several competitions using [ESPN's free unofficial API](https://github.com/pseudo-r/Public-ESPN-API). This was created as a playground for testing some of [Matt Pocock's skills](https://www.aihero.dev/skills) like `/pr` and `/implement-spec`.

## Local development

Requires Node 22+.

```sh
npm install
npm run dev       # Vite dev server at http://localhost:5173/sports-aggregator/
npm run build     # type-check and build to dist/
npm run preview   # serve the built dist/ locally
```

The app calls ESPN directly from the browser, so the dev server needs internet access to show real Results.


## Deploy

`.github/workflows/ci.yml` type-checks and tests every pull request. On push to `main` it also builds and deploys `dist/` to GitHub Pages using the official Pages actions.

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
