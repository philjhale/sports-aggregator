import { useId } from 'react';
import { WINDOW_DAYS } from '../core/types';
import type { WindowDays } from '../core/types';

export function WindowSelector({
  value,
  onChange,
}: {
  value: WindowDays;
  onChange: (days: WindowDays) => void;
}) {
  const name = useId();
  const labelId = useId();
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="window-selector">
      <span id={labelId} className="window-selector__label">
        Window
      </span>
      {WINDOW_DAYS.map((days) => (
        <label key={days} className="window-selector__option">
          <input
            type="radio"
            name={name}
            value={days}
            checked={value === days}
            onChange={() => onChange(days)}
          />
          {days === 1 ? '1 day' : `${days} days`}
        </label>
      ))}
    </div>
  );
}
