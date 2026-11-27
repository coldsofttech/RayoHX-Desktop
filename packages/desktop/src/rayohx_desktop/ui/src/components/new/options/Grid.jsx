import { lookup } from '../../../options.js';
import Control from './Control.jsx';
import { useInherited } from './inherited.js';
import { useOptionStyles } from './styles.js';

/**
 * Fields in an aligned grid; tick boxes take a full row so they never push the inputs around.
 * @param {{ fields: any[], prefix: string, values?: Record<string, any>, onChange: (id: string, next: any) => void, choices?: Record<string, any> }} props
 */
export default function Grid({ fields, prefix, values, onChange, choices }) {
  const styles = useOptionStyles();
  const inherited = useInherited();
  return (
    <div className={styles.grid}>
      {fields.map((field) => {
        const id = `${prefix}.${field.key}`;
        const control = (
          <Control
            key={id}
            field={field}
            value={lookup(values, id)}
            onChange={(next) => onChange(id, next)}
            choices={lookup(choices, id)}
            inherited={lookup(inherited, id)}
          />
        );
        return field.type === 'bool' || field.type === 'lines' ? (
          <div key={id} className={field.type === 'bool' ? styles.wide : undefined}>
            {control}
          </div>
        ) : (
          control
        );
      })}
    </div>
  );
}
