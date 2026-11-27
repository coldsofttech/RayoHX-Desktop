import {
  Body1,
  Button,
  Field,
  Input,
  Tab,
  TabList,
  Title3,
  ToggleButton,
  mergeClasses,
} from '@fluentui/react-components';
import { ArrowDownload24Regular } from '@fluentui/react-icons';
import { OutputFields, SectionFields, SelectionFields } from './options/index.js';
import Quality from './Quality.jsx';
import { useFormStyles } from './styles.js';

/**
 * @typedef {object} Track
 * @property {string} group
 * @property {string} name
 * @property {string | null} [language]
 */
/**
 * @typedef {object} Variant
 * @property {number} index
 * @property {string | null} [name]
 * @property {string | null} [resolution]
 * @property {number | null} [bandwidth]
 * @property {string[]} codecs
 */
/**
 * @typedef {object} Playlist
 * @property {string} type
 * @property {Variant[]} [variants]
 * @property {Track[]} [audio_tracks]
 * @property {Track[]} [subtitle_tracks]
 * @property {number} [segments]
 * @property {number} [duration]
 */

/**
 * What an inspected stream offers, and how to pick from it: Quick (one quality) or Advanced
 * (the stream, output, storage and engine options).
 * @param {{
 *   playlist: Playlist,
 *   mode: string,
 *   panel: string,
 *   onPanel: (panel: string) => void,
 *   tab: string,
 *   onTab: (tab: string) => void,
 *   choices?: ReturnType<typeof import('../../options.js').streamChoices>,
 *   values: Record<string, any>,
 *   onChange: (id: string, value: unknown) => void,
 *   allowLocalPaths: boolean,
 *   quality: string,
 *   onQuality: (quality: string) => void,
 *   filename: string,
 *   onFilename: (filename: string) => void,
 *   needsSelection: boolean,
 *   busy: boolean,
 *   onStart: () => void,
 * }} props
 */
export default function Details({
  playlist,
  mode,
  panel,
  onPanel,
  tab,
  onTab,
  choices,
  values,
  onChange,
  allowLocalPaths,
  quality,
  onQuality,
  filename,
  onFilename,
  needsSelection,
  busy,
  onStart,
}) {
  const styles = useFormStyles();

  return (
    <section className={styles.card} aria-label="Stream details">
      <div className={styles.heading}>
        {playlist.type === 'master' ? (
          <Title3>{(playlist.variants ?? []).length} streams available</Title3>
        ) : (
          <Body1>
            Single stream: {playlist.segments} segments, {Math.round(playlist.duration ?? 0)} s.
          </Body1>
        )}
        <div role="group" aria-label="Choose how to pick the stream" className={styles.segments}>
          <ToggleButton
            checked={panel === 'quick'}
            appearance={panel === 'quick' ? 'primary' : 'secondary'}
            onClick={() => onPanel('quick')}
          >
            Quick
          </ToggleButton>
          <ToggleButton
            checked={panel === 'advanced'}
            appearance={panel === 'advanced' ? 'primary' : 'secondary'}
            onClick={() => onPanel('advanced')}
          >
            Advanced
          </ToggleButton>
        </div>
      </div>
      {panel === 'quick' ? (
        <Quality value={quality} onChange={onQuality} />
      ) : (
        <>
          <TabList
            size="small"
            selectedValue={tab}
            onTabSelect={(_, data) => onTab(String(data.value))}
          >
            {choices && <Tab value="stream">Stream</Tab>}
            <Tab value="output">Output</Tab>
            <Tab value="storage">Storage</Tab>
            <Tab value="engine">Engine</Tab>
          </TabList>
          {tab === 'stream' ? (
            <SelectionFields values={values} onChange={onChange} choices={choices} />
          ) : tab === 'engine' || tab === 'storage' ? (
            <SectionFields
              section={tab}
              values={values}
              onChange={onChange}
              allowLocalPaths={allowLocalPaths}
            />
          ) : (
            <>
              {mode !== 'many' && (
                <Field label="File name" hint="Optional. Saved in the download folder.">
                  <Input value={filename} onChange={(_, data) => onFilename(data.value)} />
                </Field>
              )}
              <OutputFields values={values} onChange={onChange} allowLocalPaths={allowLocalPaths} />
            </>
          )}
        </>
      )}
      {needsSelection && (
        <Body1>Choose a stream or a size on the Stream tab, or switch to Quick.</Body1>
      )}
      <div className={mergeClasses(styles.row, styles.end)}>
        <Button
          appearance="primary"
          icon={<ArrowDownload24Regular />}
          onClick={onStart}
          disabled={busy || needsSelection}
        >
          Download
        </Button>
      </div>
    </section>
  );
}
