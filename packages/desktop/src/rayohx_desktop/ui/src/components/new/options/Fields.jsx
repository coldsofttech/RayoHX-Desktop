import { useState } from 'react';
import { Tab, TabList } from '@fluentui/react-components';
import Grid from './Grid.jsx';

/**
 * A section's fields, split under collapsible sub-sections when they name a group.
 * @param {{ fields: any[], prefix: string, values?: Record<string, any>, onChange: (id: string, next: any) => void, choices?: Record<string, any> }} props
 */
export default function Fields({ fields, prefix, values, onChange, choices }) {
  const groups = [...new Set(fields.map((field) => field.group).filter(Boolean))];
  const [tab, setTab] = useState(groups[0]);
  const shared = { prefix, values, onChange, choices };
  if (!groups.length) return <Grid fields={fields} {...shared} />;
  const current = groups.includes(tab) ? tab : groups[0];
  return (
    <>
      <Grid fields={fields.filter((field) => !field.group)} {...shared} />
      <TabList
        size="small"
        selectedValue={current}
        onTabSelect={(_, data) => setTab(String(data.value))}
      >
        {groups.map((group) => (
          <Tab key={group} value={group}>
            {group}
          </Tab>
        ))}
      </TabList>
      <Grid fields={fields.filter((field) => field.group === current)} {...shared} />
    </>
  );
}
