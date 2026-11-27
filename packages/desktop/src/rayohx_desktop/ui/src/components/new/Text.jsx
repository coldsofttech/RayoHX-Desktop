import { Field, Input, Textarea } from '@fluentui/react-components';
import { InspectActions } from './Actions.jsx';
import { useFormStyles } from './styles.js';

/**
 * The contents of a playlist file, with the address its relative addresses are resolved against.
 * @param {{
 *   text: string,
 *   onText: (text: string) => void,
 *   base: string,
 *   onBase: (base: string) => void,
 *   busy: boolean,
 *   ready: boolean,
 *   connectionOpen: boolean,
 *   onConnection: () => void,
 * }} props
 */
export default function Text({
  text,
  onText,
  base,
  onBase,
  busy,
  ready,
  connectionOpen,
  onConnection,
}) {
  const styles = useFormStyles();

  return (
    <>
      <Field label="Playlist text" hint="The contents of an .m3u8 file you already have.">
        <Textarea value={text} onChange={(_, data) => onText(data.value)} rows={5} />
      </Field>
      <Field
        label="Base address"
        hint="Relative addresses in the playlist are resolved against it."
      >
        <Input value={base} onChange={(_, data) => onBase(data.value)} type="url" />
      </Field>
      <div className={styles.row}>
        <InspectActions busy={busy} ready={ready} open={connectionOpen} onToggle={onConnection} />
      </div>
    </>
  );
}
