import type { Competition, CompetitionConfig, Sport } from './types';

export interface SportSection {
  sport: Sport;
  competitions: Competition[];
}

/**
 * The configured Sports in display order, each with its Competitions (in
 * config order) except those in `hidden`. Sports left with no Competitions are
 * omitted.
 */
export function groupBySport(
  config: CompetitionConfig,
  hidden: ReadonlySet<string>,
): SportSection[] {
  return [...config.sports]
    .sort((a, b) => a.order - b.order)
    .map((sport) => ({
      sport,
      competitions: config.competitions.filter(
        (c) => c.sportId === sport.id && !hidden.has(c.id),
      ),
    }))
    .filter((section) => section.competitions.length > 0);
}
