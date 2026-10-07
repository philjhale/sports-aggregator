import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from './helpers/renderApp';

async function nbaResults() {
  const nba = await screen.findByRole('region', { name: 'NBA' });
  return within(nba).findAllByRole('listitem');
}

describe('NBA Results for the default Window', () => {
  it('shows finished NBA Results under the Basketball Sport', async () => {
    renderApp();

    const basketball = screen.getByRole('region', { name: 'Basketball' });
    expect(within(basketball).getByRole('heading', { name: 'NBA' })).toBeInTheDocument();

    const rows = await nbaResults();
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Golden State Warriors'),
      expect.stringContaining('Boston Celtics'),
    ]);
  });

  it('does not show scheduled, in-progress or postponed matches, or finished ones outside the Window', async () => {
    renderApp();
    await nbaResults();

    for (const team of ['Brooklyn Nets', 'Dallas Mavericks', 'Utah Jazz', 'Miami Heat']) {
      expect(screen.queryByText(team)).not.toBeInTheDocument();
    }
  });

  it('shows both teams, both final scores, the local date and a Match Details link', async () => {
    renderApp();

    const [lakersWarriors] = await nbaResults();
    const row = within(lakersWarriors!);
    expect(row.getByText('Golden State Warriors')).toBeInTheDocument();
    expect(row.getByText('118')).toBeInTheDocument();
    expect(row.getByText('Los Angeles Lakers')).toBeInTheDocument();
    expect(row.getByText('120')).toBeInTheDocument();
    expect(row.getByText('Wed 7 Oct')).toBeInTheDocument();

    const link = row.getByRole('link', { name: 'Match Details' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.espn.com/nba/game/_/gameId/401800002/lakers-warriors',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it("shows a late-evening match on the viewer's local day", async () => {
    // Knicks at Celtics tipped off at 2026-10-05T23:30Z.
    renderApp({ timeZone: 'Europe/London' });
    const london = await nbaResults();
    expect(within(london[1]!).getByText('Tue 6 Oct')).toBeInTheDocument();
  });

  it('shows the same match a day earlier for a viewer in New York', async () => {
    renderApp({ timeZone: 'America/New_York' });
    const newYork = await nbaResults();
    expect(within(newYork[1]!).getByText('Mon 5 Oct')).toBeInTheDocument();
  });

  it('shows a loading indicator until Results arrive', async () => {
    renderApp();

    const nba = screen.getByRole('region', { name: 'NBA' });
    expect(within(nba).getByRole('status')).toHaveTextContent('Loading');

    await nbaResults();
    expect(within(nba).queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('ESPN requests', () => {
  it("makes one header request covering the 3-day Window in the viewer's timezone", async () => {
    const { espn } = renderApp({ now: '2026-10-07T12:00:00Z', timeZone: 'Europe/London' });
    await nbaResults();

    expect(espn.requests).toHaveLength(1);
    const [url] = espn.requests;
    expect(url!.origin + url!.pathname).toBe(
      'https://site.web.api.espn.com/apis/v2/scoreboard/header',
    );
    expect(Object.fromEntries(url!.searchParams)).toEqual({
      sport: 'basketball',
      league: 'nba',
      dates: '20261005-20261007',
      tz: 'Europe/London',
      limit: '1000',
    });
  });

  it('spans a month boundary', async () => {
    const { espn } = renderApp({ now: '2026-10-01T09:00:00Z', timeZone: 'Europe/London' });
    await screen.findByRole('region', { name: 'NBA' });
    await waitFor(() => expect(espn.requests).toHaveLength(1));

    expect(espn.requests[0]!.searchParams.get('dates')).toBe('20260929-20261001');
  });

  it("uses the viewer's local today, not UTC's", async () => {
    // 01:30 on 1 Oct in Sydney is still 30 Sep in UTC.
    const { espn } = renderApp({ now: '2026-09-30T15:30:00Z', timeZone: 'Australia/Sydney' });
    await waitFor(() => expect(espn.requests).toHaveLength(1));

    const url = espn.requests[0]!;
    expect(url.searchParams.get('dates')).toBe('20260929-20261001');
    expect(url.searchParams.get('tz')).toBe('Australia/Sydney');
  });
});
