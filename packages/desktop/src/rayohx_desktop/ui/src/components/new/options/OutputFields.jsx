import { mergeClasses } from '@fluentui/react-components';
import Control from './Control.jsx';
import { useInherited } from './inherited.js';
import { SECTIONS, lookup } from '../../../options.js';
import { useOptionStyles } from './styles.js';

/**
 * The output fields. The FFmpeg path is only offered when FFmpeg is the chosen remuxer, and the two
 * tick boxes share one row.
 * @param {{ values: Record<string, any>, onChange: (id: string, next: any) => void, allowLocalPaths?: boolean }} props
 */
export default function OutputFields({ values, onChange, allowLocalPaths = false }) {
  const styles = useOptionStyles();
  const inherited = useInherited();
  const section = SECTIONS.find((item) => item.id === 'output');
  const fields = (section?.fields ?? []).filter(
    (field) =>
      (!field.local || allowLocalPaths) &&
      (field.key !== 'ffmpeg' || values['output.remux_backend'] === 'ffmpeg'),
  );
  const render = (/** @type {(typeof fields)[number]} */ field) => {
    const id = `output.${field.key}`;
    return (
      <Control
        key={id}
        field={field}
        value={lookup(values, id)}
        onChange={(next) => onChange(id, next)}
        inherited={lookup(inherited, id)}
      />
    );
  };
  return (
    <div className={styles.grid}>
      {fields.filter((field) => field.type !== 'bool').map(render)}
      <div className={mergeClasses(styles.wide, styles.checks)}>
        {fields.filter((field) => field.type === 'bool').map(render)}
      </div>
    </div>
  );
}
