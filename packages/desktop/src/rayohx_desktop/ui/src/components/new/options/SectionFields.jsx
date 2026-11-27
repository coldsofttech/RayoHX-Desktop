import { SECTIONS } from '../../../options.js';
import Fields from './Fields.jsx';

/**
 * One section's fields without the collapsible header, split into tabs when they name a group.
 * @param {{ section: string, values: Record<string, any>, onChange: (id: string, next: any) => void, allowLocalPaths?: boolean }} props
 */
export default function SectionFields({ section, values, onChange, allowLocalPaths = false }) {
  const found = SECTIONS.find((item) => item.id === section);
  return (
    <Fields
      fields={(found?.fields ?? []).filter(
        (field) => !field.defaultsOnly && (!field.local || allowLocalPaths),
      )}
      prefix={section}
      values={values}
      onChange={onChange}
    />
  );
}
