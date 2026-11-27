import { useCallback, useEffect, useState } from 'react';
import {
  Body1,
  Button,
  MessageBar,
  MessageBarBody,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Broom24Regular, FolderOpen24Regular } from '@fluentui/react-icons';
import { bridge, downloads, errorMessage } from '../../api/index.js';
import { ACTIVE } from '../../format.js';
import Card from './Card.jsx';

const useStyles = makeStyles({
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingHorizontalXL,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  heading: { margin: 0 },
  list: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
    padding: 0,
    margin: 0,
    listStyle: 'none',
  },
  actions: { display: 'flex', columnGap: tokens.spacingHorizontalXS, flexShrink: 0 },
});

/** @param {{ onCount?: (active: number) => void }} props */
export default function Downloads({ onCount }) {
  const styles = useStyles();
  const [items, setItems] = useState(/** @type {import('./Card.jsx').Job[]} */ ([]));
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await downloads.list();
      setItems(data.items);
      onCount?.(
        data.items.filter((/** @type {import('./Card.jsx').Job} */ j) => ACTIVE.includes(j.state))
          .length,
      );
      setLoadError('');
    } catch (problem) {
      setLoadError(errorMessage(problem));
    }
  }, [onCount]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  /** @param {() => Promise<unknown>} task */
  async function act(task) {
    try {
      await task();
      setActionError('');
    } catch (problem) {
      setActionError(errorMessage(problem));
    }
    refresh();
  }

  // A failed control stays visible; the list refreshing every second must not clear it.
  const error = actionError || loadError;

  return (
    <section className={styles.card} aria-label="Downloads">
      <div className={styles.header}>
        <Title3 as="h2" className={styles.heading}>
          Downloads
        </Title3>
        <div className={styles.actions}>
          <Button icon={<FolderOpen24Regular />} onClick={() => act(bridge.openDownloadsFolder)}>
            Open folder
          </Button>
          {items.some((job) => !ACTIVE.includes(job.state)) && (
            <Button
              icon={<Broom24Regular />}
              appearance="primary"
              onClick={() => act(downloads.clear)}
            >
              Clear history
            </Button>
          )}
        </div>
      </div>
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      {items.length === 0 ? (
        <Body1 as="p">Nothing here yet. Add a stream to get started.</Body1>
      ) : (
        <ul className={styles.list}>
          {items.map((job) => (
            <Card key={job.id} job={job} act={act} />
          ))}
        </ul>
      )}
    </section>
  );
}
