import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import nbaHeader from './fixtures/espn/nba-header.json';
import premierLeagueHeader from './fixtures/espn/premier-league-header.json';
import { createFakeEspn, defaultHeaderFixtures } from './helpers/fakeEspn';
import { renderApp } from './helpers/renderApp';

// Default Window: 5-7 Oct 2026 in Europe/London.

async function resultRow(competition: string, team: string) {
  const region = await screen.findByRole('region', { name: competition });
  const rows = await within(region).findAllByRole('listitem');
  const row = rows.find((r) => r.textContent?.includes(team));
  if (!row) throw new Error(`No ${competition} Result with ${team}`);
  return row;
}

function logos(row: HTMLElement) {
  return Array.from(row.querySelectorAll('img')).map((img) => img.getAttribute('src'));
}

/** The NBA fixture with the Lakers' logo removed. */
function nbaWithoutLakersLogo() {
  const header = structuredClone(nbaHeader);
  for (const event of header.sports[0]!.leagues[0]!.events) {
    for (const competitor of event.competitors as { displayName: string; logo?: string }[]) {
      if (competitor.displayName === 'Los Angeles Lakers') delete competitor.logo;
    }
  }
  return header;
}

/**
 * The Premier League fixture with Everton v Liverpool given another final
 * status, shaped as ESPN reports soccer matches decided in extra time or on
 * penalties.
 */
function premierLeagueWithEvertonStatus(name: string, detail: string) {
  const header = structuredClone(premierLeagueHeader);
  const event = header.sports[0]!.leagues[0]!.events.find((e) => e.id === '740102')!;
  event.summary = detail;
  event.fullStatus.type = {
    ...event.fullStatus.type,
    name,
    description: detail,
    detail,
    shortDetail: detail,
  };
  return header;
}

/** Full team names shown in bold in a Result row. */
function boldTeams(row: HTMLElement) {
  return Array.from(row.querySelectorAll('strong .team-name-full')).map((el) => el.textContent);
}

describe('Result rows', () => {
  it('shows the winner in bold', async () => {
    renderApp();

    const row = await resultRow('NBA', 'Golden State Warriors');
    expect(boldTeams(row)).toEqual(['Los Angeles Lakers']);
  });

  it.each([
    ['Premier League', 'Everton'],
    ['Gallagher Premiership', 'Sale Sharks'],
  ])('bolds nobody on a %s draw', async (competition, team) => {
    renderApp();

    const row = await resultRow(competition, team);
    expect(boldTeams(row)).toEqual([]);
  });

  it('marks a Result decided in overtime', async () => {
    renderApp();

    const row = await resultRow('NFL', 'Green Bay Packers');
    expect(within(row).getByText('OT')).toBeInTheDocument();
  });

  it.each([
    ['extra time', 'STATUS_FINAL_AET', 'AET', 'AET'],
    ['a penalty shootout', 'STATUS_FINAL_PEN', 'FT-Pens', 'Pens'],
  ])('marks a football Result decided in %s', async (_, name, detail, marker) => {
    const espn = createFakeEspn({
      header: {
        ...defaultHeaderFixtures,
        'soccer/eng.1': premierLeagueWithEvertonStatus(name, detail),
      },
    });
    renderApp({ espn });

    const row = await resultRow('Premier League', 'Everton');
    expect(within(row).getByText(marker)).toBeInTheDocument();
  });

  it('shows no marker for a Result decided in regulation', async () => {
    renderApp();

    const row = await resultRow('NFL', 'Seattle Seahawks');
    expect(within(row).queryByText('OT')).not.toBeInTheDocument();
  });

  it('shows both team logos', async () => {
    renderApp();

    const row = await resultRow('NBA', 'Golden State Warriors');
    expect(logos(row)).toEqual([
      'https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/gs.png',
      'https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lal.png',
    ]);
  });

  it('still shows a Result when a team has no logo', async () => {
    const espn = createFakeEspn({
      header: { ...defaultHeaderFixtures, 'basketball/nba': nbaWithoutLakersLogo() },
    });
    renderApp({ espn });

    const row = await resultRow('NBA', 'Golden State Warriors');
    expect(row).toHaveTextContent('Los Angeles Lakers');
    expect(row).toHaveTextContent('120');
    expect(logos(row)).toEqual(['https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/gs.png']);
  });

  // Which one is visible is decided by a CSS media query, which jsdom can't
  // evaluate; so check both are rendered, distinguishably.
  it('renders full and short team names for the stylesheet to choose between', async () => {
    renderApp();

    const row = await resultRow('NBA', 'Golden State Warriors');
    const text = (selector: string) =>
      Array.from(row.querySelectorAll(selector)).map((el) => el.textContent);
    expect(text('.team-name-full')).toEqual(['Golden State Warriors', 'Los Angeles Lakers']);
    expect(text('.team-name-short')).toEqual(['Warriors', 'Lakers']);
  });
});

describe('Status filtering', () => {
  it('shows a completed match even when ESPN names its status a forfeit', async () => {
    const espn = createFakeEspn({
      header: {
        ...defaultHeaderFixtures,
        'soccer/eng.1': premierLeagueWithEvertonStatus('STATUS_FORFEIT', 'FT'),
      },
    });
    renderApp({ espn });

    expect(await resultRow('Premier League', 'Everton')).toHaveTextContent('Liverpool');
  });
});
