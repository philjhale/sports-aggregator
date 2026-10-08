import { useId, useState } from 'react';
import { groupBySport } from '../core/sports';
import type { CompetitionConfig } from '../core/types';

const NONE_HIDDEN: ReadonlySet<string> = new Set();

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
  // Every Competition, hidden or not, so each can be toggled.
  const sections = groupBySport(config, NONE_HIDDEN);

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
          {sections.map(({ sport, competitions }) => (
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
          ))}
        </fieldset>
      )}
    </div>
  );
}
