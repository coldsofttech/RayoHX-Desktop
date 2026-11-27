import { Checkbox, Dropdown, Field, Input, Option, Textarea } from '@fluentui/react-components';
import FileControl from './FileControl.jsx';
import PresetControl from './PresetControl.jsx';
import ProxyControl from './ProxyControl.jsx';

/**
 * @param {{ field: any, value: any, onChange: (next: any) => void, choices?: { value: string, label: string }[], disabled?: boolean, inherited?: any }} props
 */
export default function Control({ field, value, onChange, choices, disabled, inherited }) {
  const shown = value ?? inherited;
  if (choices && field.type !== 'bool') {
    // A list field takes several choices, kept as the comma separated text the form already holds.
    const many = field.type === 'list';
    const selected = many
      ? String(value ?? '')
          .split(',')
          .filter(Boolean)
      : value
        ? [String(value)]
        : [];
    return (
      <Field label={field.label}>
        <Dropdown
          disabled={disabled}
          multiselect={many}
          value={selected.map((v) => choices.find((c) => c.value === v)?.label ?? v).join(', ')}
          selectedOptions={selected}
          placeholder="Any"
          clearable={!many}
          onOptionSelect={(_, data) =>
            onChange(many ? data.selectedOptions.join(',') : (data.optionValue ?? ''))
          }
        >
          {choices.map((choice) => (
            <Option key={choice.value} value={choice.value}>
              {choice.label}
            </Option>
          ))}
        </Dropdown>
      </Field>
    );
  }
  switch (field.type) {
    case 'preset':
      return <PresetControl field={field} value={value} onChange={onChange} disabled={disabled} />;
    case 'proxy':
      return <ProxyControl field={field} value={value} onChange={onChange} disabled={disabled} />;
    case 'bool':
      return (
        <Checkbox
          label={field.label}
          disabled={disabled}
          checked={shown ?? field.fallback ?? false}
          onChange={(_, data) => onChange(Boolean(data.checked))}
        />
      );
    case 'select':
      return (
        <Field label={field.label} hint={field.hint}>
          <Dropdown
            disabled={disabled}
            value={shown ?? ''}
            selectedOptions={shown ? [shown] : []}
            placeholder="Default"
            clearable
            onOptionSelect={(_, data) => onChange(data.optionValue)}
          >
            {field.options.map((/** @type {string} */ choice) => (
              <Option key={choice} value={choice}>
                {choice}
              </Option>
            ))}
          </Dropdown>
        </Field>
      );
    case 'lines':
      return (
        <Field label={field.label} hint={field.hint}>
          <Textarea
            disabled={disabled}
            value={value ?? ''}
            placeholder={inherited}
            onChange={(_, data) => onChange(data.value)}
            rows={3}
          />
        </Field>
      );
    default:
      if (field.types) {
        return <FileControl field={field} value={value} onChange={onChange} disabled={disabled} />;
      }
      return (
        <Field label={field.label} hint={field.hint}>
          <Input
            disabled={disabled}
            value={value ?? ''}
            placeholder={inherited}
            type={
              field.type === 'secret' ? 'password' : field.type === 'number' ? 'number' : 'text'
            }
            autoComplete="off"
            onChange={(_, data) => onChange(data.value)}
          />
        </Field>
      );
  }
}
