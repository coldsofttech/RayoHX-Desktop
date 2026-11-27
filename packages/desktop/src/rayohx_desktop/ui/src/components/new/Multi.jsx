import { Button, Field, Spinner, Textarea } from '@fluentui/react-components';
import { ArrowDownload24Regular } from '@fluentui/react-icons';
import { ConnectionButton } from './Actions.jsx';
import Quality from './Quality.jsx';
import { useFormStyles } from './styles.js';

/**
 * Several playlist addresses. A batch is not inspected: one quality rule applies to every address.
 * @param {{
 *   urls: string,
 *   onUrls: (urls: string) => void,
 *   quality: string,
 *   onQuality: (quality: string) => void,
 *   busy: boolean,
 *   ready: boolean,
 *   connectionOpen: boolean,
 *   onConnection: () => void,
 *   onStart: () => void,
 * }} props
 */
export default function Multi({
  urls,
  onUrls,
  quality,
  onQuality,
  busy,
  ready,
  connectionOpen,
  onConnection,
  onStart,
}) {
  const styles = useFormStyles();

  return (
    <>
      <Field label="Playlist addresses" hint="One per line. Lines starting with # are ignored.">
        <Textarea value={urls} onChange={(_, data) => onUrls(data.value)} rows={4} />
      </Field>
      <div className={styles.row}>
        <div className={styles.name}>
          <Quality value={quality} onChange={onQuality} />
        </div>
        <ConnectionButton open={connectionOpen} onToggle={onConnection} />
        <Button
          appearance="primary"
          icon={busy ? <Spinner size="tiny" /> : <ArrowDownload24Regular />}
          onClick={onStart}
          disabled={busy || !ready}
        >
          Download all
        </Button>
      </div>
    </>
  );
}
