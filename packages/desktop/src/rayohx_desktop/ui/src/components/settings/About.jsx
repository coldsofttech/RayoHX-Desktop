import { Body1, Text, Title3 } from '@fluentui/react-components';
import { useCardStyles } from './styles.js';

/** @param {{ version: string }} props */
export default function About({ version }) {
  const styles = useCardStyles();

  return (
    <section className={styles.card} aria-label="About">
      <Title3 as="h2" className={styles.heading}>
        About
      </Title3>
      <Body1>RayoHX is a fast, private downloader for HLS streams.</Body1>
      <Body1>
        Downloads and settings stay on this computer, and the app works without an account.
      </Body1>
      <Text>Version {version}</Text>
    </section>
  );
}
