import { Field, Input } from '@fluentui/react-components';
import { InspectActions } from './Actions.jsx';
import { useFormStyles } from './styles.js';

/**
 * One playlist address, which gets inspected before it is downloaded.
 * @param {{
 *   url: string,
 *   onUrl: (url: string) => void,
 *   busy: boolean,
 *   ready: boolean,
 *   connectionOpen: boolean,
 *   onConnection: () => void,
 * }} props
 */
export default function Single({ url, onUrl, busy, ready, connectionOpen, onConnection }) {
  const styles = useFormStyles();

  return (
    <div className={styles.row}>
      <Field label="Playlist address" className={styles.address}>
        <Input
          value={url}
          onChange={(_, data) => onUrl(data.value)}
          placeholder="https://cdn.example.com/vod/master.m3u8"
          type="url"
          required
        />
      </Field>
      <InspectActions busy={busy} ready={ready} open={connectionOpen} onToggle={onConnection} />
    </div>
  );
}
