import type { Result, Team } from '../core/types';

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
      <TeamLine team={result.home} won={result.winner === 'home'} />
      <TeamLine team={result.away} won={result.winner === 'away'} />
      {result.extraTime && (
        <abbr className="extra-time" title="Decided beyond regulation time">
          {result.extraTime}
        </abbr>
      )}
      <time dateTime={result.kickoff}>{date}</time>
      <a href={result.matchDetailsUrl} target="_blank" rel="noopener noreferrer">
        Match Details
      </a>
    </li>
  );
}

function TeamLine({ team, won }: { team: Team; won: boolean }) {
  const content = (
    <>
      <span className="team-name">
        <span className="team-name-full">{team.name}</span>
        <span className="team-name-short">{team.shortName}</span>
      </span>{' '}
      <span className="team-score">{team.score}</span>
    </>
  );
  return (
    <span className="team">
      {team.logoUrl ? (
        <img className="team-logo" src={team.logoUrl} alt="" width={24} height={24} loading="lazy" />
      ) : (
        <span className="team-logo" aria-hidden="true" />
      )}
      {won ? <strong>{content}</strong> : content}
    </span>
  );
}
