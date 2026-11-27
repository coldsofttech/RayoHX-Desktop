import { useEffect, useState } from 'react';
import { downloads } from '../../api/index.js';

/**
 * What the engine reported for one download, refreshed while it is open.
 * @param {{ id: string }} props
 */
export default function Log({ id }) {
  const [events, setEvents] = useState(
    /** @type {{ time: number, type: string, message?: string | null, segment?: number | null }[] | null} */ (
      null
    ),
  );
  useEffect(() => {
    let alive = true;
    const load = () =>
      downloads.log(id).then(
        (data) => alive && setEvents(data),
        () => {},
      );
    load();
    const timer = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);
  if (!events) return null;
  return (
    <ol aria-label="Engine log" style={{ margin: 0, paddingLeft: '1.25rem' }}>
      {events.map((event, i) => (
        <li key={`${event.time}-${i}`}>
          <code>{new Date(event.time * 1000).toLocaleTimeString()}</code>{' '}
          {event.type.replaceAll('_', ' ')}
          {event.segment != null && ` (segment ${event.segment})`}
          {event.message && `: ${event.message}`}
        </li>
      ))}
    </ol>
  );
}
