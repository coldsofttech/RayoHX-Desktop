import { useState } from 'react';
import { Button, Field, Input } from '@fluentui/react-components';
import { bridge } from '../../../api/index.js';
import { useOptionStyles } from './styles.js';

/** A path typed by hand or picked with the window's own file dialog. */
export default function FileControl({ field, value, onChange, disabled }) {
  const styles = useOptionStyles();
  const [problem, setProblem] = useState('');
  async function browse() {
    setProblem('');
    try {
      const path = await bridge.chooseFile(field.types);
      if (path) onChange(path);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  }
  return (
    <Field
      label={field.label}
      hint={field.hint}
      validationState={problem ? 'error' : 'none'}
      validationMessage={problem || undefined}
    >
      <div className={styles.file}>
        <Input
          disabled={disabled}
          value={value ?? ''}
          autoComplete="off"
          onChange={(_, data) => onChange(data.value)}
        />
        <Button disabled={disabled} onClick={browse} aria-label={`Browse for ${field.label}`}>
          Browse
        </Button>
      </div>
    </Field>
  );
}
