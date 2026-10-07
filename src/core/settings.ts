/**
 * Settings store: the viewer's preferences, persisted in browser storage under
 * their own key (separate from the results cache).
 *
 * Tolerant by design: unavailable storage, bad JSON, a wrong shape or an
 * out-of-range value never throws. Each field falls back to its default on
 * its own, so one bad field doesn't discard the others, and writes that fail
 * are swallowed (the app just won't remember).
 *
 * To add a setting: add the field to `Settings` and `DEFAULT_SETTINGS`, and a
 * reader for it in `readSettings`.
 */
import { DEFAULT_WINDOW, WINDOW_DAYS } from './types';
import type { WindowDays } from './types';

export const SETTINGS_KEY = 'sports-aggregator:settings:v1';

export interface Settings {
  window: WindowDays;
}

export const DEFAULT_SETTINGS: Settings = {
  window: DEFAULT_WINDOW,
};

export interface SettingsStore {
  /** The stored settings, with defaults for anything missing or invalid. */
  load(): Settings;
  /** Merge `changes` into the stored settings, save, and return the result. */
  update(changes: Partial<Settings>): Settings;
}

export function createSettingsStore(storage: Storage | undefined): SettingsStore {
  function load(): Settings {
    return readSettings(readJson(storage));
  }

  return {
    load,
    update(changes) {
      const next = { ...load(), ...changes };
      try {
        storage?.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Storage full or blocked: carry on without remembering.
      }
      return next;
    },
  };
}

function readJson(storage: Storage | undefined): unknown {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function readSettings(raw: unknown): Settings {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    window: isWindowDays(stored.window) ? stored.window : DEFAULT_SETTINGS.window,
  };
}

function isWindowDays(value: unknown): value is WindowDays {
  return (WINDOW_DAYS as readonly unknown[]).includes(value);
}
