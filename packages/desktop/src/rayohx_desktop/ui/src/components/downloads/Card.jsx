import { useState } from 'react';
import {
  Badge,
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  ProgressBar,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowClockwise24Regular,
  Delete24Regular,
  DocumentText24Regular,
  Dismiss24Regular,
  Pause24Regular,
  Play24Regular,
} from '@fluentui/react-icons';
import { downloads } from '../../api/index.js';
import { ACTIVE, bytes, duration, speed } from '../../format.js';
import Log from './Log.jsx';

const useStyles = makeStyles({
  item: {
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
  },
  url: {
    flexGrow: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  meta: {
    display: 'flex',
    columnGap: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground3,
  },
  actions: { display: 'flex', columnGap: tokens.spacingHorizontalXS, flexShrink: 0 },
});

/** @type {Map<string, import('@fluentui/react-components').BadgeProps>} */
const BADGE = new Map([
  ['downloading', { color: 'brand', appearance: 'filled' }],
  ['paused', { color: 'warning', appearance: 'filled' }],
  ['failed', { color: 'danger', appearance: 'filled' }],
  ['cancelled', { color: 'danger', appearance: 'outline' }],
  ['completed', { color: 'success', appearance: 'filled' }],
]);

/** @param {{ state: string }} props */
export function StateBadge({ state }) {
  /** @type {import('@fluentui/react-components').BadgeProps} */
  const style = BADGE.get(state) ?? { color: 'informative', appearance: 'tint' };
  return <Badge {...style}>{state}</Badge>;
}

/**
 * @typedef {object} Job
 * @property {string} id
 * @property {string} url
 * @property {string} state
 * @property {string | null} [quality]
 * @property {boolean} [retryable]
 * @property {boolean} [has_log]
 * @property {string} [output_path]
 * @property {number | null} [output_size_bytes]
 * @property {string | null} [error]
 * @property {string | null} [error_code]
 * @property {{ fraction: number | null, speed: number | null, eta_seconds: number | null } | null} [progress]
 */

/**
 * One download in the list, with the buttons that act on it. `act` runs an action and shows what
 * went wrong, so the card never talks to the API outside of the calls it hands to it.
 * @param {{ job: Job, act: (task: () => Promise<unknown>) => void }} props
 */
export default function Card({ job, act }) {
  const styles = useStyles();
  const p = job.progress;
  const running = ACTIVE.includes(job.state);
  const [showLog, setShowLog] = useState(false);

  return (
    <li className={styles.item}>
      <div className={styles.top}>
        <Text weight="semibold" className={styles.url} title={job.url}>
          {job.output_path ?? job.url}
        </Text>
        {job.quality && (
          <Badge appearance="outline" color="informative">
            {job.quality}
          </Badge>
        )}
        <StateBadge state={job.state} />
        <div className={styles.actions}>
          {job.state === 'downloading' && (
            <Button
              icon={<Pause24Regular />}
              appearance="subtle"
              aria-label={`Pause ${job.id}`}
              onClick={() => act(() => downloads.control(job.id, 'pause'))}
            />
          )}
          {job.state === 'paused' && (
            <Button
              icon={<Play24Regular />}
              appearance="subtle"
              aria-label={`Resume ${job.id}`}
              onClick={() => act(() => downloads.control(job.id, 'resume'))}
            />
          )}
          {job.retryable && (
            <Button
              icon={<ArrowClockwise24Regular />}
              appearance="subtle"
              aria-label={`Retry ${job.id}`}
              onClick={() => act(() => downloads.retry(job.id))}
            />
          )}
          {job.has_log && (
            <Button
              icon={<DocumentText24Regular />}
              appearance="subtle"
              aria-label={showLog ? 'Hide log' : 'Show log'}
              aria-pressed={showLog}
              title={showLog ? 'Hide log' : 'Show log'}
              onClick={() => setShowLog(!showLog)}
            />
          )}
          {running ? (
            <Button
              icon={<Dismiss24Regular />}
              appearance="subtle"
              aria-label={`Cancel ${job.id}`}
              onClick={() => act(() => downloads.control(job.id, 'cancel'))}
            />
          ) : (
            <Button
              icon={<Delete24Regular />}
              appearance="subtle"
              aria-label={`Remove ${job.id}`}
              onClick={() => act(() => downloads.remove(job.id))}
            />
          )}
        </div>
      </div>
      {running && (
        <ProgressBar
          value={p?.fraction ?? undefined}
          color={job.state === 'paused' ? 'warning' : 'brand'}
          aria-label="Download progress"
        />
      )}
      <div className={styles.meta}>
        {p && running && (
          <>
            <span>{Math.round((p.fraction ?? 0) * 100)}%</span>
            <span>{speed(p.speed)}</span>
            <span>ETA {duration(p.eta_seconds)}</span>
          </>
        )}
        {job.output_size_bytes != null && <span>{bytes(job.output_size_bytes)}</span>}
      </div>
      {showLog && job.has_log && <Log id={job.id} />}
      {job.error && (
        <MessageBar intent="error">
          <MessageBarBody>{job.error}</MessageBarBody>
          {job.error_code === 'output_exists' && job.retryable && (
            <MessageBarActions>
              <Button onClick={() => act(() => downloads.retry(job.id, true))}>Overwrite</Button>
            </MessageBarActions>
          )}
        </MessageBar>
      )}
    </li>
  );
}
