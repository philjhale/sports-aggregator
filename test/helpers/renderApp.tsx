import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/ui/App';
import type { AppDeps } from '../../src/ui/App';
import type { CompetitionConfig } from '../../src/core/types';
import { createFakeEspn } from './fakeEspn';
import type { FakeEspn } from './fakeEspn';
import { createMemoryStorage } from './memoryStorage';

export interface RenderAppOptions {
  /** Fixed "now" as an ISO instant. Default: 2026-10-07T12:00:00Z (a Wednesday). */
  now?: string;
  /** Viewer's IANA timezone. Default: Europe/London. */
  timeZone?: string;
  /** Locale for date formatting. Default: en-GB. */
  locale?: string;
  espn?: FakeEspn;
  storage?: Storage;
  /** Competition config. Default: the app's launch config. */
  config?: CompetitionConfig;
}

export const DEFAULT_NOW = '2026-10-07T12:00:00Z';

// The recordings come from real weeks, and no week has results for every
// Competition (the Premier League paused 1-7 Oct), so some tests set a clock.
/** Window 18-20 Sep in Europe/London: the recorded Premier League weekend. */
export const PREMIER_LEAGUE_NOW = '2026-09-20T18:00:00Z';
/** Window 2-4 Oct in Europe/London: the recorded Gallagher Premiership matches. */
export const GALLAGHER_NOW = '2026-10-04T20:00:00Z';

/**
 * Renders the whole app with only the outside world faked: ESPN (fetch),
 * the clock, the timezone/locale and browser storage.
 */
export function renderApp(options: RenderAppOptions = {}) {
  const espn = options.espn ?? createFakeEspn();
  const storage = options.storage ?? createMemoryStorage();
  const now = new Date(options.now ?? DEFAULT_NOW);
  const deps: AppDeps = {
    fetch: espn.fetch,
    now: () => now,
    timeZone: options.timeZone ?? 'Europe/London',
    locale: options.locale ?? 'en-GB',
    storage,
  };
  const user = userEvent.setup();
  const view = render(<App deps={deps} config={options.config} />);
  return { ...view, espn, storage, user, deps };
}
