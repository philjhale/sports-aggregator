import { useEffect, useId, useMemo, useState } from 'react';
import { competitionConfig } from '../core/config';
import { createResultsService } from '../core/resultsService';
import { createSettingsStore } from '../core/settings';
import type { CompetitionOutcome, ResultsService } from '../core/resultsService';
import type { Competition, CompetitionConfig, WindowDays } from '../core/types';
import { CompetitionsPanel } from './CompetitionsPanel';
import { Footer } from './Footer';
import { ResultRow } from './ResultRow';
import { WindowSelector } from './WindowSelector';

/** Everything from the outside world the app needs. Injected so tests can fake it. */
export interface AppDeps {
  fetch: typeof fetch;
  now: () => Date;
  /** Viewer's IANA timezone. */
  timeZone: string;
  /** Locale for formatting dates; undefined means the browser default. */
  locale?: string;
  /** Browser storage; undefined when the browser blocks it. */
  storage: Storage | undefined;
}

export interface AppProps {
  deps: AppDeps;
  config?: CompetitionConfig;
}

export function App({ deps, config = competitionConfig }: AppProps) {
  const service = useMemo(() => createResultsService(deps), [deps]);
  const settings = useMemo(
    () => createSettingsStore(deps.storage, config.competitions.map((c) => c.id)),
    [deps.storage, config],
  );
  const [windowDays, setWindowDays] = useState<WindowDays>(() => settings.load().window);
  const changeWindow = (days: WindowDays) => setWindowDays(settings.update({ window: days }).window);
  // Bumped by the refresh button; each Competition refetches when it changes.
  const [refreshCount, setRefreshCount] = useState(0);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set(settings.load().hidden));
  const toggleCompetition = (id: string, shown: boolean) => {
    const next = new Set(hidden);
    if (shown) next.delete(id);
    else next.add(id);
    setHidden(new Set(settings.update({ hidden: [...next] }).hidden));
  };
  const sections = useMemo(() => service.layout(config, hidden), [service, config, hidden]);

  return (
    <div className="app">
      <header>
        <h1>Sports Aggregator</h1>
        <WindowSelector value={windowDays} onChange={changeWindow} />
        <button type="button" onClick={() => setRefreshCount((n) => n + 1)}>
          Refresh
        </button>
        <CompetitionsPanel config={config} hidden={hidden} onToggle={toggleCompetition} />
      </header>
      <main>
        {sections.length === 0 && (
          <p className="empty">
            All Competitions are hidden. Choose some to show under Competitions.
          </p>
        )}
        {sections.map(({ sport, competitions }) => (
          <Section key={sport.id} title={sport.name} level={2}>
            {competitions.map((competition) => (
              <CompetitionResults
                key={competition.id}
                competition={competition}
                service={service}
                deps={deps}
                windowDays={windowDays}
                refreshCount={refreshCount}
              />
            ))}
          </Section>
        ))}
      </main>
      <Footer />
    </div>
  );
}

function CompetitionResults({
  competition,
  service,
  deps,
  windowDays,
  refreshCount,
}: {
  competition: Competition;
  service: ResultsService;
  deps: AppDeps;
  windowDays: WindowDays;
  refreshCount: number;
}) {
  const [outcome, setOutcome] = useState<CompetitionOutcome | undefined>();
  const [loading, setLoading] = useState(true);
  // Bumped by Retry to reload just this Competition.
  const [attempt, setAttempt] = useState(0);

  // Every reload (Retry, Refresh, Window change) keeps what is shown until the
  // new outcome arrives, so the page never blanks out.
  useEffect(() => {
    let current = true;
    setLoading(true);
    void service.loadCompetition(competition, windowDays).then((next) => {
      if (!current) return;
      setOutcome(next);
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [service, competition, windowDays, refreshCount, attempt]);

  const retry = () => setAttempt((n) => n + 1);

  return (
    <Section title={competition.name} level={3}>
      {loading && (
        <p role="status">{loadingMessage(outcome)}</p>
      )}
      {outcome?.status === 'error' && (
        <div className="competition-error">
          <p role="alert">{outcome.message}</p>
          <button type="button" onClick={retry} disabled={loading}>
            Retry
          </button>
        </div>
      )}
      {outcome?.status === 'results' && (
        <ul className="results">
          {outcome.results.map((result) => (
            <ResultRow key={result.id} result={result} timeZone={deps.timeZone} locale={deps.locale} />
          ))}
        </ul>
      )}
      {outcome?.status === 'empty' && (
        <p className="empty">
          {windowDays === 1 ? 'No results today' : `No results in the last ${windowDays} days`}
        </p>
      )}
    </Section>
  );
}

function loadingMessage(shown: CompetitionOutcome | undefined): string {
  if (shown === undefined) return 'Loading results…';
  return shown.status === 'error' ? 'Retrying…' : 'Refreshing…';
}

function Section({
  title,
  level,
  children,
}: {
  title: string;
  level: 2 | 3;
  children: React.ReactNode;
}) {
  const id = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section aria-labelledby={id}>
      <Heading id={id}>{title}</Heading>
      {children}
    </section>
  );
}
