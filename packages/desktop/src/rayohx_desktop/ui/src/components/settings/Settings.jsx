import { useEffect, useState } from 'react';
import { Button, MessageBar, MessageBarBody, Text, Title3 } from '@fluentui/react-components';
import { bridge, errorMessage, settings as settingsApi } from '../../api/index.js';
import { buildOptions, toValues } from '../../options.js';
import Options from '../new/options/Options.jsx';
import About from './About.jsx';
import CleanUp from './CleanUp.jsx';
import { useCardStyles } from './styles.js';

/**
 * @typedef {object} Limits
 * @property {number} min_concurrency
 * @property {number} max_concurrency
 */
/**
 * @typedef {object} AppSettings
 * @property {string} download_dir
 * @property {boolean} allow_local_paths
 * @property {Record<string, any>} defaults
 * @property {Limits} limits
 * @property {string} version
 */

/** @param {{ onChanged?: (settings: AppSettings) => void }} props */
export default function Settings({ onChanged }) {
  const styles = useCardStyles();
  const [settings, setSettings] = useState(/** @type {AppSettings | null} */ (null));
  const [values, setValues] = useState(/** @type {Record<string, any>} */ ({}));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    settingsApi.get().then(
      (loaded) => {
        setSettings(loaded);
        setValues(toValues(loaded.defaults));
      },
      (problem) => setError(errorMessage(problem)),
    );
  }, []);

  /** @param {Record<string, unknown>} changes */
  async function change(changes) {
    try {
      const next = await settingsApi.save(changes);
      setSettings(next);
      onChanged?.(next);
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }

  async function saveDefaults() {
    try {
      const next = await settingsApi.saveDefaults(buildOptions(values));
      setSettings(next);
      setValues(toValues(next.defaults));
      onChanged?.(next);
      setSaved(true);
      setError('');
    } catch (problem) {
      setSaved(false);
      setError(errorMessage(problem));
    }
  }

  async function pickFolder() {
    try {
      const folder = await bridge.chooseFolder(settings?.download_dir);
      if (folder) await change({ download_dir: folder });
    } catch (problem) {
      setError(errorMessage(problem));
    }
  }

  if (!settings) {
    return error ? (
      <MessageBar intent="error" role="alert">
        <MessageBarBody>{error}</MessageBarBody>
      </MessageBar>
    ) : null;
  }

  return (
    <div>
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <section className={styles.card} aria-label="Settings">
        <Title3 as="h2" className={styles.heading}>
          Settings
        </Title3>
        <div className={styles.split}>
          <Text>
            Saved in: <code>{settings.download_dir}</code>
          </Text>
          <Button onClick={pickFolder}>Change</Button>
        </div>
        <Text size={200}>Your choices are remembered. New downloads use this folder.</Text>
      </section>

      <section className={styles.card} aria-label="Default options">
        <Title3 as="h2" className={styles.heading}>
          Default options
        </Title3>
        <Text>
          Options you leave empty in a new download use these. Logins and passwords are never saved.
        </Text>
        <Options
          forDefaults
          values={values}
          allowLocalPaths={settings.allow_local_paths}
          onChange={(id, next) => {
            setSaved(false);
            setValues((current) => ({ ...current, [id]: next }));
          }}
        />
        <div className={styles.row}>
          <Button appearance="primary" onClick={saveDefaults}>
            Save defaults
          </Button>
        </div>
        {saved && (
          <MessageBar intent="success" role="status">
            <MessageBarBody>Default options saved.</MessageBarBody>
          </MessageBar>
        )}
      </section>

      <CleanUp />
      <About version={settings.version} />
    </div>
  );
}
