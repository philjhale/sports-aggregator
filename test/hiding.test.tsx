import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SETTINGS_KEY } from '../src/core/settings';
import { createMemoryStorage } from './helpers/memoryStorage';
import { renderApp } from './helpers/renderApp';

const requestedLeagues = (espn: ReturnType<typeof renderApp>['espn']) =>
  espn.headerRequests().map((u) => u.searchParams.get('league'));

async function openCompetitionsPanel(user: ReturnType<typeof renderApp>['user']) {
  await user.click(screen.getByRole('button', { name: 'Competitions' }));
  return screen.getByRole('group', { name: 'Show Competitions' });
}

describe('Hiding Competitions', () => {
  it('lists every Competition grouped by Sport, all shown by default', async () => {
    const { user } = renderApp();
    const panel = within(await openCompetitionsPanel(user));

    for (const [sport, competition] of [
      ['Basketball', 'NBA'],
      ['American Football', 'NFL'],
      ['Football', 'Premier League'],
      ['Rugby Union', 'Gallagher Premiership'],
    ]) {
      const group = within(panel.getByRole('group', { name: sport }));
      expect(group.getByRole('checkbox', { name: competition })).toBeChecked();
    }
  });

  it('removes a hidden Competition from the page', async () => {
    const { user } = renderApp();
    const panel = within(await openCompetitionsPanel(user));

    await user.click(panel.getByRole('checkbox', { name: 'Premier League' }));

    expect(panel.getByRole('checkbox', { name: 'Premier League' })).not.toBeChecked();
    expect(screen.queryByRole('region', { name: 'Premier League' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'NBA' })).toBeInTheDocument();
  });

  it('shows and fetches a Competition again once it is unhidden', async () => {
    const { user, espn } = renderApp();
    const panel = within(await openCompetitionsPanel(user));
    await user.click(panel.getByRole('checkbox', { name: 'NFL' }));
    const before = espn.headerRequests().length;

    await user.click(panel.getByRole('checkbox', { name: 'NFL' }));

    const nfl = await screen.findByRole('region', { name: 'NFL' });
    expect(await within(nfl).findByText('Green Bay Packers')).toBeInTheDocument();
    expect(espn.headerRequests().slice(before).map((u) => u.searchParams.get('league'))).toEqual([
      'nfl',
    ]);
  });

  it('omits a Sport heading when all its Competitions are hidden', async () => {
    const { user } = renderApp();
    const panel = within(await openCompetitionsPanel(user));

    await user.click(panel.getByRole('checkbox', { name: 'Gallagher Premiership' }));

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Basketball',
      'American Football',
      'Football',
    ]);
  });

  it('says so when every Competition is hidden', async () => {
    const { user } = renderApp();
    const panel = within(await openCompetitionsPanel(user));
    expect(screen.queryByText(/All Competitions are hidden/)).not.toBeInTheDocument();

    for (const name of ['NBA', 'NFL', 'Premier League', 'Gallagher Premiership']) {
      await user.click(panel.getByRole('checkbox', { name }));
    }

    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(screen.getByText(/All Competitions are hidden/)).toBeInTheDocument();
  });
});

describe('Remembering hidden Competitions', () => {
  it('keeps them hidden, and unfetched, on the next visit with the same storage', async () => {
    const first = renderApp();
    const panel = within(await openCompetitionsPanel(first.user));
    await first.user.click(panel.getByRole('checkbox', { name: 'NBA' }));
    first.unmount();

    const { espn, user } = renderApp({ storage: first.storage });

    expect(screen.queryByRole('region', { name: 'NBA' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Basketball' })).not.toBeInTheDocument();
    await waitFor(() => expect(espn.headerRequests()).toHaveLength(3));
    expect(requestedLeagues(espn)).not.toContain('nba');
    const reopened = within(await openCompetitionsPanel(user));
    expect(reopened.getByRole('checkbox', { name: 'NBA' })).not.toBeChecked();
  });

  it('keeps the Window and hidden Competitions together', async () => {
    const first = renderApp();
    await first.user.click(screen.getByRole('radio', { name: '7 days' }));
    const panel = within(await openCompetitionsPanel(first.user));
    await first.user.click(panel.getByRole('checkbox', { name: 'NFL' }));
    await first.user.click(screen.getByRole('radio', { name: '14 days' }));
    first.unmount();

    renderApp({ storage: first.storage });

    expect(screen.getByRole('radio', { name: '14 days' })).toBeChecked();
    expect(screen.queryByRole('region', { name: 'NFL' })).not.toBeInTheDocument();
  });

  it('ignores stored ids of Competitions no longer in config', async () => {
    const storage = createMemoryStorage({
      [SETTINGS_KEY]: JSON.stringify({ window: 3, hidden: ['nhl', 'premier-league'] }),
    });
    const { espn, user, unmount } = renderApp({ storage });

    expect(screen.queryByRole('region', { name: 'Premier League' })).not.toBeInTheDocument();
    for (const name of ['NBA', 'NFL', 'Gallagher Premiership']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    await waitFor(() => expect(espn.headerRequests()).toHaveLength(3));

    // Unhiding the last hidden Competition leaves nothing hidden on the next visit.
    const panel = within(await openCompetitionsPanel(user));
    await user.click(panel.getByRole('checkbox', { name: 'Premier League' }));
    unmount();

    renderApp({ storage });
    for (const name of ['NBA', 'NFL', 'Premier League', 'Gallagher Premiership']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  it.each([
    ['storage that throws', createMemoryStorage({}, { throws: true })],
    ['corrupt JSON', createMemoryStorage({ [SETTINGS_KEY]: '{not json' })],
    ['a hidden list of the wrong shape', createMemoryStorage({ [SETTINGS_KEY]: JSON.stringify({ hidden: 'nba' }) })],
  ])('shows every Competition, and can still hide one, with %s', async (_, storage) => {
    const { espn, user } = renderApp({ storage });

    for (const name of ['NBA', 'NFL', 'Premier League', 'Gallagher Premiership']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    await waitFor(() => expect(espn.headerRequests()).toHaveLength(4));

    const panel = within(await openCompetitionsPanel(user));
    await user.click(panel.getByRole('checkbox', { name: 'NBA' }));
    expect(screen.queryByRole('region', { name: 'NBA' })).not.toBeInTheDocument();
  });
});
