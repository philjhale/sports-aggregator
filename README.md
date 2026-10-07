# sports-aggregator

A quiet, browser-only summary of recent match Results across several Competitions, using ESPN's free unofficial API (see `docs/adr/0001-espn-unofficial-api-direct-from-browser.md`).

## Run

```sh
npm install
npm run dev
```

## Test

```sh
npm test            # Vitest, once
npm run test:watch  # Vitest, watch mode
npm run typecheck   # tsc --noEmit
```

## Layout

- `src/core/`: framework-free domain core (types, Competition config, Window, results service). All ESPN knowledge lives in `src/core/espn/adapter.ts`.
- `src/ui/`: React components rendering what the core returns.
- `test/`: whole-app tests. `test/helpers/renderApp.tsx` renders the app with a fake ESPN `fetch` (`fakeEspn.ts`), a fixed clock and timezone, and in-memory storage (`memoryStorage.ts`). ESPN fixtures live in `test/fixtures/espn/`.
