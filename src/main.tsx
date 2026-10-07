import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import type { AppDeps } from './ui/App';
import './ui/styles.css';

const deps: AppDeps = {
  fetch: (...args) => window.fetch(...args),
  now: () => new Date(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  storage: window.localStorage,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App deps={deps} />
  </StrictMode>,
);
