import Control from './Control.jsx';
import { useInherited } from './inherited.js';
import { SECTIONS, lookup } from '../../../options.js';
import { useOptionStyles } from './styles.js';

/**
 * The stream selection fields. A field that needs tracks is left out when the inspected stream has
 * none, and the filters are switched off while a single stream is picked.
 * @param {{ values: Record<string, any>, onChange: (id: string, next: any) => void, choices?: Record<string, { value: string, label: string }[]> }} props
 */
export default function SelectionFields({ values, onChange, choices = {} }) {
  const styles = useOptionStyles();
  const inherited = useInherited();
  const section = SECTIONS.find((item) => item.id === 'selection');
  const picked = Boolean(values['selection.variant']);
  return (
    <div className={styles.grid}>
      {section?.fields
        .filter((field) => !field.defaultsOnly)
        .filter((field) => !field.tracks || field.tracks.some((t) => choices[`selection.${t}`]))
        .map((field) => {
          const id = `selection.${field.key}`;
          return (
            <Control
              key={id}
              field={field}
              value={lookup(values, id)}
              onChange={(next) => onChange(id, next)}
              choices={lookup(choices, id)}
              inherited={lookup(inherited, id)}
              disabled={
                (picked && Boolean(field.filter)) ||
                Boolean(field.offWith && values[`selection.${field.offWith}`])
              }
            />
          );
        })}
    </div>
  );
}
