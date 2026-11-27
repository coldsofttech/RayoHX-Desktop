import { Button, Spinner } from '@fluentui/react-components';
import { Globe24Regular, Search24Regular } from '@fluentui/react-icons';

/** @param {{ open: boolean, onToggle: () => void }} props */
export function ConnectionButton({ open, onToggle }) {
  return (
    <Button type="button" icon={<Globe24Regular />} aria-expanded={open} onClick={onToggle}>
      Connection
    </Button>
  );
}

/**
 * The buttons next to an address that gets inspected: Connection, then Inspect (the form's submit).
 * @param {{ busy: boolean, ready: boolean, open: boolean, onToggle: () => void }} props
 */
export function InspectActions({ busy, ready, open, onToggle }) {
  return (
    <>
      <ConnectionButton open={open} onToggle={onToggle} />
      <Button
        appearance="primary"
        type="submit"
        icon={busy ? <Spinner size="tiny" /> : <Search24Regular />}
        disabled={busy || !ready}
      >
        Inspect
      </Button>
    </>
  );
}
