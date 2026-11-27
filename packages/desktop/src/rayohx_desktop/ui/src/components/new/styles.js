import { makeStyles, tokens } from '@fluentui/react-components';

// The look shared by the parts of the new download form.
export const useFormStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', rowGap: tokens.spacingVerticalL },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalM,
    alignItems: 'flex-end',
  },
  end: { justifyContent: 'flex-end' },
  address: { flexGrow: 2, flexBasis: 0, minWidth: '16rem' },
  heading: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalS,
  },
  name: { flexBasis: '12rem' },
  segments: {
    display: 'flex',
    width: 'fit-content',
    '> button': { minWidth: '7rem' },
    '> button:first-child': {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },
    '> button:last-child': {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      marginLeft: '-1px',
    },
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingHorizontalXL,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
});
