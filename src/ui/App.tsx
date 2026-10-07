import { useEffect, useId, useMemo, useState } from 'react';
import { competitionConfig } from '../core/config';
import { createResultsService } from '../core/resultsService';
import type { CompetitionOutcome, ResultsService } from '../core/resultsService';
import type { Competition, CompetitionConfig } from '../core/types';
import { DEFAULT_WINDOW } from '../core/types';
import { Footer } from './Footer';
import { ResultRow } from './ResultRow';

/** Everything from the outside world the app needs. Injected so tests can fake it. */
export interface AppDeps {
  fetch: typeof fetch;
  now: () => Date;
  /** Viewer's IANA timezone. */
  timeZone: string;
  /** Locale for formatting dates; undefined means the browser default. */
  locale?: string;
  storage: Storage;
}

export interface AppProps {
  deps: AppDeps;
  config?: CompetitionConfig;
}

export function App({ deps, config = competitionConfig }: AppProps) {
  const service = useMemo(() => createResultsService(deps), [deps]);
  const sections = useMemo(() => service.layout(config), [service, config]);

  return (
    <div className="app">
      <header>
        <h1>Sports Aggregator</h1>
      </header>
      <main>
        {sections.map(({ sport, competitions }) => (
          <Section key={sport.id} title={sport.name} level={2}>
            {competitions.map((competition) => (
              <CompetitionResults
                key={competition.id}
                competition={competition}
                service={service}
                deps={deps}
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
}: {
  competition: Competition;
  service: ResultsService;
  deps: AppDeps;
}) {
  const [outcome, setOutcome] = useState<CompetitionOutcome | undefined>();
  const [loading, setLoading] = useState(true);
  // Bumped by Retry to reload just this Competition.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    // Keep whatever is already shown until the new outcome arrives.
    setLoading(true);
    void service.loadCompetition(competition, DEFAULT_WINDOW).then((next) => {
      if (!current) return;
      setOutcome(next);
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [service, competition, attempt]);

  return (
    <Section title={competition.name} level={3}>
      {loading && (
        <p role="status">{outcome === undefined ? 'Loading results…' : 'Retrying…'}</p>
      )}
      {outcome?.status === 'error' && (
        <div className="competition-error">
          <p role="alert">{outcome.message}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} disabled={loading}>
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
    </Section>
  );
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
