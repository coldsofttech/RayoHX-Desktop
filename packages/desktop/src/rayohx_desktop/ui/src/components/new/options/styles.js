import { makeStyles, tokens } from '@fluentui/react-components';

// The look shared by the option fields.
export const useOptionStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
    alignItems: 'start',
    gap: tokens.spacingVerticalM + ' ' + tokens.spacingHorizontalL,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalM,
  },
  wide: { gridColumn: '1 / -1' },
  checks: { display: 'flex', flexWrap: 'wrap', columnGap: tokens.spacingHorizontalXXL },
  file: { display: 'grid', gridTemplateColumns: '1fr auto', gap: tokens.spacingHorizontalS },
  proxy: { display: 'grid', gridTemplateColumns: '8rem 1fr', gap: tokens.spacingHorizontalS },
});
