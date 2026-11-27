import { useState } from 'react';
import {
  Button,
  MessageBar,
  MessageBarBody,
  Tab,
  TabList,
  Title3,
  Tooltip,
} from '@fluentui/react-components';
import { Info16Regular } from '@fluentui/react-icons';
import { downloads, errorMessage, inspect } from '../../api/index.js';
import { buildOptions, buildSource, streamChoices } from '../../options.js';
import { Inherited } from './options/inherited.js';
import { SectionFields } from './options/index.js';
import Details from './Details.jsx';
import Multi from './Multi.jsx';
import Single from './Single.jsx';
import Text from './Text.jsx';
import { useFormStyles } from './styles.js';

/**
 * @param {{ onStarted: () => void, inherited?: Record<string, any>, allowLocalPaths?: boolean }} props
 */
export default function AddStream({ onStarted, inherited = {}, allowLocalPaths = false }) {
  const styles = useFormStyles();
  const [mode, setMode] = useState('url');
  const [url, setUrl] = useState('');
  const [urls, setUrls] = useState('');
  const [text, setText] = useState('');
  const [base, setBase] = useState('');
  const [filename, setFilename] = useState('');
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [playlist, setPlaylist] = useState(
    /** @type {import('./Details.jsx').Playlist | null} */ (null),
  );
  // Empty until one is picked; the request then leaves it to the saved defaults.
  const [quality, setQuality] = useState('');
  const shownQuality = quality || inherited['selection.quality'] || 'best';
  // Which way of choosing the stream is open; only that one is used for the download.
  const [panel, setPanel] = useState('quick');
  const [advancedChoice, setAdvancedTab] = useState('stream');
  const [showConnection, setShowConnection] = useState(false);

  const input = { url, urls, text, base };
  const source = buildSource(mode, input);
  const ready =
    mode === 'url' ? url.trim() : mode === 'many' ? urls.trim() : text.trim() && base.trim();
  const toggleConnection = () => setShowConnection((open) => !open);

  /**
   * @param {string} id
   * @param {unknown} next
   */
  const setValue = (id, next) => setValues((current) => ({ ...current, [id]: next }));

  /** @param {import('react').FormEvent} event */
  async function look(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setPlaylist(null);
    try {
      const { network } = buildOptions(values);
      const data = await inspect.run({ ...source, network });
      // What was picked for the last stream means nothing for this one.
      setValues((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => !id.startsWith('selection.'))),
      );
      setPlaylist(data.playlist);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  const choices = playlist?.type === 'master' ? streamChoices(playlist) : undefined;
  const advancedTab = choices ? advancedChoice : 'output';
  const needsSelection =
    panel === 'advanced' &&
    Boolean(choices) &&
    !Object.entries(values).some(
      ([id, value]) =>
        id.startsWith('selection.') && value !== undefined && value !== '' && value !== false,
    );

  async function start() {
    setBusy(true);
    setError('');
    try {
      const { selection, ...options } = buildOptions(values);
      await downloads.start({
        ...source,
        ...(filename.trim() && mode !== 'many' ? { filename: filename.trim() } : {}),
        ...options,
        ...(panel === 'advanced' && choices
          ? { selection }
          : { selection: { ...(quality ? { quality } : {}), video_only: true } }),
      });
      setPlaylist(null);
      setUrl('');
      setUrls('');
      setText('');
      onStarted();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Inherited.Provider value={inherited}>
      <div className={styles.stack}>
        <form className={styles.card} onSubmit={look}>
          <div className={styles.heading}>
            <Title3>Add a stream</Title3>
            {mode === 'many' && (
              <Tooltip
                relationship="description"
                content="Advanced is not available for several addresses, so you cannot choose the stream per address, the format, the tracks and so on. If you need any of these, use One address and download it from there."
              >
                <Button
                  appearance="transparent"
                  icon={<Info16Regular />}
                  aria-label="Why Advanced is not available"
                />
              </Tooltip>
            )}
          </div>
          <TabList
            size="small"
            selectedValue={mode}
            onTabSelect={(_, d) => {
              // What was inspected belongs to the address typed in the other tab.
              setMode(String(d.value));
              setPlaylist(null);
              setError('');
            }}
          >
            <Tab value="url">One address</Tab>
            <Tab value="many">Several addresses</Tab>
            <Tab value="text">Playlist text</Tab>
          </TabList>
          {mode === 'url' && (
            <Single
              url={url}
              onUrl={setUrl}
              busy={busy}
              ready={Boolean(ready)}
              connectionOpen={showConnection}
              onConnection={toggleConnection}
            />
          )}
          {mode === 'many' && (
            <Multi
              urls={urls}
              onUrls={setUrls}
              quality={shownQuality}
              onQuality={setQuality}
              busy={busy}
              ready={Boolean(ready)}
              connectionOpen={showConnection}
              onConnection={toggleConnection}
              onStart={start}
            />
          )}
          {mode === 'text' && (
            <Text
              text={text}
              onText={setText}
              base={base}
              onBase={setBase}
              busy={busy}
              ready={Boolean(ready)}
              connectionOpen={showConnection}
              onConnection={toggleConnection}
            />
          )}
          {showConnection && (
            <SectionFields
              section="network"
              values={values}
              onChange={setValue}
              allowLocalPaths={allowLocalPaths}
            />
          )}
          {error && (
            <MessageBar intent="error" role="alert">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
        </form>

        {playlist && (
          <Details
            playlist={playlist}
            mode={mode}
            panel={panel}
            onPanel={setPanel}
            tab={advancedTab}
            onTab={setAdvancedTab}
            choices={choices}
            values={values}
            onChange={setValue}
            allowLocalPaths={allowLocalPaths}
            quality={shownQuality}
            onQuality={setQuality}
            filename={filename}
            onFilename={setFilename}
            needsSelection={needsSelection}
            busy={busy}
            onStart={start}
          />
        )}
      </div>
    </Inherited.Provider>
  );
}
