import type { Result, TeamResult } from '../core/types';

export function ResultRow({
  result,
  timeZone,
  locale,
}: {
  result: Result;
  timeZone: string;
  locale: string | undefined;
}) {
  const date = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(result.kickoff));

  return (
    <li className="result">
      <Team team={result.home} />
      <Team team={result.away} />
      <time dateTime={result.kickoff}>{date}</time>
      <a href={result.matchDetailsUrl} target="_blank" rel="noopener noreferrer">
        Match Details
      </a>
    </li>
  );
}

function Team({ team }: { team: TeamResult }) {
  return (
    <span className="team">
      <span className="team-name">{team.name}</span> <span className="team-score">{team.score}</span>
    </span>
  );
}
