/**
 * Helpers for the few situations a recording cannot contain (ESPN returns a
 * postponed or in-progress match only while it is one). Each takes a recorded
 * response and changes one recorded event, so the rest stays exactly as ESPN
 * sent it.
 */
// biome-ignore lint/suspicious/noExplicitAny: patches arbitrary recorded ESPN JSON
type Json = Record<string, any>;

interface Status {
  name: string;
  state: 'pre' | 'in' | 'post';
  completed: boolean;
  detail: string;
}

/** Header shape: change one event's status. */
export function withHeaderStatus<T>(header: T, eventId: string, status: Status): T {
  const copy = structuredClone(header) as Json;
  const event = copy.sports[0].leagues[0].events.find((e: Json) => e.id === eventId);
  if (!event) throw new Error(`No recorded event ${eventId}`);
  event.status = status.state;
  event.summary = status.detail;
  event.fullStatus.type = {
    ...event.fullStatus.type,
    name: status.name,
    state: status.state,
    completed: status.completed,
    description: status.detail,
    detail: status.detail,
    shortDetail: status.detail,
  };
  return copy as T;
}

/** Header shape: change a recorded event. */
export function withHeaderEvent<T>(header: T, eventId: string, edit: (event: Json) => void): T {
  const copy = structuredClone(header) as Json;
  const event = copy.sports[0].leagues[0].events.find((e: Json) => e.id === eventId);
  if (!event) throw new Error(`No recorded event ${eventId}`);
  edit(event);
  return copy as T;
}

/** Site scoreboard shape: change a recorded event. */
export function withScoreboardEvent<T>(scoreboard: T, eventId: string, edit: (event: Json) => void): T {
  const copy = structuredClone(scoreboard) as Json;
  const event = copy.events.find((e: Json) => e.id === eventId);
  if (!event) throw new Error(`No recorded event ${eventId}`);
  edit(event);
  return copy as T;
}

export const POSTPONED: Status = { name: 'STATUS_POSTPONED', state: 'post', completed: false, detail: 'Postponed' };
export const IN_PROGRESS: Status = { name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, detail: '5:12 - 3rd Quarter' };
export const SCHEDULED: Status = { name: 'STATUS_SCHEDULED', state: 'pre', completed: false, detail: 'Wed, October 7th at 7:30 PM EDT' };
