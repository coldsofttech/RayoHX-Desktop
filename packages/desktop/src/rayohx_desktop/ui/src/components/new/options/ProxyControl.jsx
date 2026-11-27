import { useState } from 'react';
import { Dropdown, Field, Input, Option } from '@fluentui/react-components';
import { PROXY_SCHEMES } from '../../../options.js';
import { useOptionStyles } from './styles.js';

/** A proxy address kept as one URL: a scheme dropdown beside the host and port. */
export default function ProxyControl({ field, value, onChange, disabled }) {
  const styles = useOptionStyles();
  const [scheme, setScheme] = useState(/^(\w+):\/\//.exec(value ?? '')?.[1] ?? 'http');
  const host = String(value ?? '').replace(/^\w+:\/\//, '');
  return (
    <Field label={field.label} hint="Host and port, for example proxy.example.com:8080.">
      <div className={styles.proxy}>
        <Dropdown
          aria-label="Proxy type"
          disabled={disabled}
          value={scheme}
          selectedOptions={[scheme]}
          onOptionSelect={(_, data) => {
            const next = data.optionValue ?? 'http';
            setScheme(next);
            if (host) onChange(`${next}://${host}`);
          }}
        >
          {PROXY_SCHEMES.map((item) => (
            <Option key={item} value={item}>
              {item}
            </Option>
          ))}
        </Dropdown>
        <Input
          aria-label="Proxy host"
          disabled={disabled}
          value={host}
          autoComplete="off"
          onChange={(_, data) => onChange(data.value ? `${scheme}://${data.value}` : '')}
        />
      </div>
    </Field>
  );
}
