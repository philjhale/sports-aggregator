import { useId, useState } from 'react';
import type { CompetitionConfig } from '../core/types';

/**
 * Header control for choosing which Competitions are shown: a button that
 * opens a panel with one checkbox per Competition, grouped by Sport.
 */
export function CompetitionsPanel({
  config,
  hidden,
  onToggle,
}: {
  config: CompetitionConfig;
  hidden: ReadonlySet<string>;
  onToggle: (competitionId: string, shown: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const sports = [...config.sports].sort((a, b) => a.order - b.order);

  return (
    <div className="competitions-panel">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        Competitions
      </button>
      {open && (
        <fieldset id={panelId} className="competitions-panel__body">
          <legend>Show Competitions</legend>
          {sports.map((sport) => {
            const competitions = config.competitions.filter((c) => c.sportId === sport.id);
            if (competitions.length === 0) return null;
            return (
              <fieldset key={sport.id} className="competitions-panel__sport">
                <legend>{sport.name}</legend>
                {competitions.map((competition) => (
                  <label key={competition.id} className="competitions-panel__option">
                    <input
                      type="checkbox"
                      checked={!hidden.has(competition.id)}
                      onChange={(e) => onToggle(competition.id, e.target.checked)}
                    />
                    {competition.name}
                  </label>
                ))}
              </fieldset>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
