// RayoHX brand theme for Fluent UI, taken from the RayoHX logo: the amber to red-orange
// gradient (#FFB020 / #FFA23D to #FF4D2E / #C92A12), the maroon arrow (#7A1A0A / #5A0F05) and the
// tray neutral (#1F1F1F). Change a colour here and every component follows.
import { createDarkTheme, createLightTheme } from '@fluentui/react-components';

export const brand = {
  10: '#1a0402',
  20: '#330a04',
  30: '#4a0d05',
  40: '#5a0f05',
  50: '#7a1a0a',
  60: '#9c200c',
  70: '#b32510',
  80: '#c92a12',
  90: '#e33a1c',
  100: '#ff4d2e',
  110: '#ff6240',
  120: '#ff7a52',
  130: '#ff9168',
  140: '#ffa23d',
  150: '#ffb89a',
  160: '#ffd3bf',
};

export const neutral = {
  ink: '#1f1f1f',
  night: '#1f1f1f',
  nightDeep: '#171717',
  nightRaised: '#2b2b2b',
  mist: '#faf7f5',
  muted: '#a8a29e',
};

export const accent = { amber: '#ffb020', maroon: '#7a1a0a' };

export const lightTheme = {
  ...createLightTheme(brand),
  colorNeutralBackground1: '#ffffff',
  colorNeutralBackground2: neutral.mist,
  colorNeutralBackground3: '#f3ece8',
  colorNeutralForeground1: neutral.ink,
  colorNeutralForeground2: '#44403c',
  colorNeutralForeground3: '#78716c',
  colorNeutralStroke1: '#d6cfca',
  colorNeutralStroke2: '#e7e0db',
  colorStatusDangerBackground3: '#b91c1c',
  colorStatusDangerForeground1: '#991b1b',
  colorStatusWarningBackground3: accent.amber,
  colorStatusWarningForeground1: '#854d0e',
};

export const darkTheme = {
  ...createDarkTheme(brand),
  colorNeutralBackground1: neutral.night,
  colorNeutralBackground2: neutral.nightDeep,
  colorNeutralBackground3: neutral.nightRaised,
  colorNeutralForeground1: neutral.mist,
  colorNeutralForeground2: '#d6d3d1',
  colorNeutralForeground3: neutral.muted,
  colorNeutralStroke1: '#57534e',
  colorNeutralStroke2: '#3a3634',
  colorStatusDangerBackground3: '#ef4444',
  colorStatusDangerForeground1: '#f87171',
  colorStatusWarningBackground3: accent.amber,
  colorStatusWarningForeground1: '#fde047',
};
