import { useState } from 'react';
import { Dropdown, Field, Input, Option } from '@fluentui/react-components';

/** A user agent picked from known browsers, or typed when Custom is chosen. */
export default function PresetControl({ field, value, onChange, disabled }) {
  const [custom, setCustom] = useState(false);
  const known = field.presets.find((p) => p.value === value);
  const label = custom || (value && !known) ? 'Custom' : (known?.label ?? '');
  return (
    <>
      <Field label={field.label}>
        <Dropdown
          disabled={disabled}
          value={label}
          selectedOptions={label ? [label] : []}
          placeholder="Default"
          clearable
          onOptionSelect={(_, data) => {
            const picked = field.presets.find((p) => p.label === data.optionValue);
            setCustom(data.optionValue === 'Custom');
            onChange(picked?.value ?? '');
          }}
        >
          {[...field.presets.map((p) => p.label), 'Custom'].map((item) => (
            <Option key={item} value={item}>
              {item}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {label === 'Custom' && (
        <Field label={`${field.label} text`}>
          <Input
            disabled={disabled}
            value={value ?? ''}
            autoComplete="off"
            onChange={(_, data) => onChange(data.value)}
          />
        </Field>
      )}
    </>
  );
}
