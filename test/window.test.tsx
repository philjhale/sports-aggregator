import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SETTINGS_KEY } from '../src/core/settings';
import type { FakeEspn } from './helpers/fakeEspn';
import { createMemoryStorage } from './helpers/memoryStorage';
import { renderApp } from './helpers/renderApp';

// Every Competition is fetched; these tests follow the NBA requests.
const nbaHeaderRequests = (espn: FakeEspn) =>
  espn.headerRequests().filter((u) => u.searchParams.get('league') === 'nba');

function windowSelector() {
  return screen.getByRole('radiogroup', { name: 'Window' });
}

describe('Window selector', () => {
  it('offers 1, 3, 7 and 14 days with 3 days selected by default', () => {
    renderApp();

    const selector = within(windowSelector());
    expect(selector.getAllByRole('radio')).toEqual([
      selector.getByRole('radio', { name: '1 day' }),
      selector.getByRole('radio', { name: '3 days' }),
      selector.getByRole('radio', { name: '7 days' }),
      selector.getByRole('radio', { name: '14 days' }),
    ]);
    expect(selector.getByRole('radio', { name: '3 days' })).toBeChecked();
  });

  it('refetches with the new range when the Window changes, and shows its Results', async () => {
    const { espn, user } = renderApp({ now: '2026-10-07T12:00:00Z', timeZone: 'Europe/London' });
    const nba = await screen.findByRole('region', { name: 'NBA' });
    await within(nba).findByText('Boston Celtics');
    expect(within(nba).queryByText('Miami Heat')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '7 days' }));

    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
    expect(await within(nba).findByText('Miami Heat')).toBeInTheDocument();
    const last = nbaHeaderRequests(espn).at(-1)!;
    expect(last.searchParams.get('dates')).toBe('20261001-20261007');
    expect(last.searchParams.get('tz')).toBe('Europe/London');
  });
});

describe('Window boundaries', () => {
  // Knicks at Celtics tipped off at 2026-10-05T23:30Z: 6 Oct in London, 5 Oct in New York.
  const now = '2026-10-06T12:00:00Z';

  it("includes a late-evening match on the viewer's local today (London)", async () => {
    const { user } = renderApp({ now, timeZone: 'Europe/London' });
    await user.click(screen.getByRole('radio', { name: '1 day' }));

    const nba = screen.getByRole('region', { name: 'NBA' });
    expect(await within(nba).findByText('Boston Celtics')).toBeInTheDocument();
    // Lakers at Warriors (2026-10-06T23:00Z) is already 7 Oct in London.
    expect(within(nba).getAllByRole('listitem')).toHaveLength(1);
  });

  it('leaves the same match out of a 1-day Window in New York, where it was yesterday', async () => {
    const { user, espn } = renderApp({ now, timeZone: 'America/New_York' });
    await user.click(screen.getByRole('radio', { name: '1 day' }));

    const nba = screen.getByRole('region', { name: 'NBA' });
    // Lakers at Warriors (2026-10-06T23:00Z) is 6 Oct in New York, so it stays.
    expect(await within(nba).findByText('Golden State Warriors')).toBeInTheDocument();
    expect(within(nba).getAllByRole('listitem')).toHaveLength(1);
    expect(within(nba).queryByText('Boston Celtics')).not.toBeInTheDocument();
    const last = nbaHeaderRequests(espn).at(-1)!;
    expect(last.searchParams.get('dates')).toBe('20261006-20261006');
    expect(last.searchParams.get('tz')).toBe('America/New_York');
  });

  it('requests a 14-day range that crosses into the previous month', async () => {
    const { user, espn } = renderApp({ now: '2026-10-07T12:00:00Z', timeZone: 'Europe/London' });
    await user.click(screen.getByRole('radio', { name: '14 days' }));

    await waitFor(() =>
      expect(nbaHeaderRequests(espn).at(-1)!.searchParams.get('dates')).toBe('20260924-20261007'),
    );
  });
});

describe('Competition with no Results in the Window', () => {
  it('says "No results in the last N days"', async () => {
    // Nothing in the fixture finished between 10 and 12 Oct.
    renderApp({ now: '2026-10-12T12:00:00Z' });

    const nba = await screen.findByRole('region', { name: 'NBA' });
    expect(await within(nba).findByText('No results in the last 3 days')).toBeInTheDocument();
    expect(within(nba).queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('says "No results today" for a 1-day Window', async () => {
    // Nothing in the fixture finished on 8 Oct (London); 6-7 Oct did have Results.
    const { user } = renderApp({ now: '2026-10-08T12:00:00Z' });
    const nba = await screen.findByRole('region', { name: 'NBA' });
    await within(nba).findByText('Golden State Warriors');

    await user.click(screen.getByRole('radio', { name: '1 day' }));

    expect(await within(nba).findByText('No results today')).toBeInTheDocument();
  });
});

describe('Remembering the Window', () => {
  it('restores the chosen Window on the next visit with the same storage', async () => {
    const first = renderApp();
    await first.user.click(screen.getByRole('radio', { name: '7 days' }));
    first.unmount();

    const { espn } = renderApp({ storage: first.storage });

    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
    await waitFor(() => expect(nbaHeaderRequests(espn)).toHaveLength(1));
    expect(nbaHeaderRequests(espn)[0]!.searchParams.get('dates')).toBe('20261001-20261007');
  });

  it('falls back to 3 days, and still switches Window, when storage throws', async () => {
    const { user, espn } = renderApp({ storage: createMemoryStorage({}, { throws: true }) });

    expect(screen.getByRole('radio', { name: '3 days' })).toBeChecked();
    const nba = screen.getByRole('region', { name: 'NBA' });
    expect(await within(nba).findByText('Boston Celtics')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '7 days' }));
    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked();
    expect(await within(nba).findByText('Miami Heat')).toBeInTheDocument();
    expect(nbaHeaderRequests(espn).at(-1)!.searchParams.get('dates')).toBe('20261001-20261007');
  });

  it.each([
    ['corrupt JSON', '{not json'],
    ['a Window that is not offered', JSON.stringify({ window: 5 })],
    ['the wrong shape', JSON.stringify(['window', 7])],
  ])('falls back to 3 days when stored settings hold %s', async (_, stored) => {
    const storage = createMemoryStorage({ [SETTINGS_KEY]: stored });
    const { espn } = renderApp({ storage });

    expect(screen.getByRole('radio', { name: '3 days' })).toBeChecked();
    await waitFor(() => expect(nbaHeaderRequests(espn)).toHaveLength(1));
    expect(nbaHeaderRequests(espn)[0]!.searchParams.get('dates')).toBe('20261005-20261007');
  });
});
