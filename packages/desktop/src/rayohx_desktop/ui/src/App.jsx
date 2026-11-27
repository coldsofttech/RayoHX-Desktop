import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  FluentProvider,
  Tab,
  TabList,
  Text,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { WeatherMoon24Regular, WeatherSunny24Regular } from '@fluentui/react-icons';
import { darkTheme, lightTheme } from './theme.js';
import { settings } from './api/index.js';
import { toValues } from './options.js';
import AddStream from './components/new/AddStream.jsx';
import Downloads from './components/downloads/Downloads.jsx';
import Settings from './components/settings/Settings.jsx';

const useStyles = makeStyles({
  shell: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `1.4rem ${tokens.spacingHorizontalXL}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `2px solid ${tokens.colorBrandBackground}`,
  },
  brand: { display: 'flex', alignItems: 'center', columnGap: tokens.spacingHorizontalM },
  logo: { width: '40px', height: '40px' },
  title: { margin: 0, lineHeight: 1.1 },
  scroll: { flex: 1, overflowY: 'auto', scrollbarGutter: 'stable' },
  main: { padding: tokens.spacingHorizontalXL },
  nav: { display: 'flex', alignItems: 'center', columnGap: tokens.spacingHorizontalS },
});

function initialDark() {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
}

export default function App() {
  const styles = useStyles();
  const [dark, setDark] = useState(initialDark);
  const [tab, setTab] = useState('new');
  const [active, setActive] = useState(0);
  const [defaults, setDefaults] = useState(/** @type {Record<string, any>} */ ({}));
  const [local, setLocal] = useState(false);

  useEffect(() => {
    settings.get().then(
      (s) => {
        setDefaults(s.defaults ?? {});
        if (s.theme) setDark(s.theme === 'dark');
        setLocal(s.allow_local_paths);
      },
      () => {},
    );
  }, []);

  // The page behind the app (and the space kept for the scrollbar) follows the theme too.
  useEffect(() => {
    const root = document.documentElement;
    root.style.backgroundColor = (dark ? darkTheme : lightTheme).colorNeutralBackground2;
    root.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  function toggleTheme() {
    setDark(!dark);
    settings.save({ theme: dark ? 'light' : 'dark' }).catch(() => {});
  }

  const inherited = useMemo(() => toValues(defaults), [defaults]);

  /** @param {{ defaults?: Record<string, any> }} saved */
  const onSettingsChanged = (saved) => setDefaults(saved.defaults ?? {});

  return (
    <FluentProvider theme={dark ? darkTheme : lightTheme}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <img className={styles.logo} src="/icon.png" alt="" />
            <div>
              <Title2 as="h1" className={styles.title}>
                RayoHX
              </Title2>
              <br />
              <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
                Fast, private HLS downloads
              </Text>
            </div>
          </div>
          <div className={styles.nav}>
            <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(String(data.value))}>
              <Tab value="new">New</Tab>
              <Tab value="downloads">
                Downloads{' '}
                {active > 0 && (
                  <Badge appearance="filled" color="brand" size="small">
                    {active}
                  </Badge>
                )}
              </Tab>
              <Tab value="settings">Settings</Tab>
            </TabList>
            <Button
              appearance="subtle"
              icon={dark ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />}
              onClick={toggleTheme}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            />
          </div>
        </header>
        <div className={styles.scroll}>
          <main className={styles.main}>
            {tab === 'new' && (
              <AddStream
                inherited={inherited}
                allowLocalPaths={local}
                onStarted={() => setTab('downloads')}
              />
            )}
            {tab === 'downloads' && <Downloads onCount={setActive} />}
            {tab === 'settings' && <Settings onChanged={onSettingsChanged} />}
          </main>
        </div>
      </div>
    </FluentProvider>
  );
}
