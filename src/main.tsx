import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import type { AppDeps } from './ui/App';
import './ui/styles.css';

/**
 * `window.localStorage`, or undefined where merely touching it throws
 * (blocked storage), so the app still renders, just without remembering.
 */
function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const deps: AppDeps = {
  fetch: (...args) => window.fetch(...args),
  now: () => new Date(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  storage: browserStorage(),
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App deps={deps} />
  </StrictMode>,
);
