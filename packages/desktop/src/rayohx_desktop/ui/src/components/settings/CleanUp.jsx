import { useState } from 'react';
import { Body1, Button, MessageBar, MessageBarBody, Title3 } from '@fluentui/react-components';
import { clean, errorMessage } from '../../api/index.js';
import { bytes } from '../../format.js';
import { useCardStyles } from './styles.js';

/**
 * @typedef {object} CleanReport
 * @property {boolean} dry_run
 * @property {string[]} folders
 * @property {number} freed_bytes
 * @property {number} skipped_in_use
 */

export default function CleanUp() {
  const styles = useCardStyles();
  const [report, setReport] = useState(/** @type {CleanReport | null} */ (null));
  const [error, setError] = useState('');

  /** @param {boolean} dryRun */
  async function sweep(dryRun) {
    try {
      setReport(await clean.run({ dry_run: dryRun }));
      setError('');
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }

  return (
    <>
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <section className={styles.card} aria-label="Clean up">
        <Title3 as="h2" className={styles.heading}>
          Clean up
        </Title3>
        <Body1>
          Interrupted downloads leave working folders behind. Removing one means that download
          starts again from the beginning. Running downloads are never touched.
        </Body1>
        <div className={styles.row}>
          <Button onClick={() => sweep(true)}>Preview</Button>
          <Button appearance="primary" onClick={() => sweep(false)}>
            Remove leftovers
          </Button>
        </div>
        {report && (
          <MessageBar intent="info" role="status">
            <MessageBarBody>
              {report.folders.length === 0
                ? 'Nothing to clean.'
                : `${report.dry_run ? 'Would remove' : 'Removed'} ${report.folders.length} folder(s), ${bytes(report.freed_bytes)}.`}
              {report.skipped_in_use > 0 && ` ${report.skipped_in_use} in use were skipped.`}
            </MessageBarBody>
          </MessageBar>
        )}
      </section>
    </>
  );
}
