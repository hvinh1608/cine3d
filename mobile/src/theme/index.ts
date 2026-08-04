import { MD3DarkTheme, type MD3Theme } from 'react-native-paper';

export const colors = {
  background: '#07090D',
  surface: '#11151A',
  surfaceRaised: '#1B2027',
  primary: '#D71945',
  primarySoft: '#FF496F',
  accent: '#13A6A4',
  accentSoft: '#62D5CF',
  burgundy: '#43111D',
  text: '#F8F7F8',
  textMuted: '#A8ADB7',
  border: '#30343C',
  success: '#22C55E',
  warning: '#F59E0B',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = { sm: 10, md: 18, lg: 28 } as const;

export const paperTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: radius.md,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: colors.burgundy,
    onPrimaryContainer: '#FFD9DA',
    secondary: colors.accent,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#0C3E40',
    onSecondaryContainer: colors.text,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceRaised,
    surfaceDisabled: 'rgba(250, 250, 250, 0.08)',
    onSurfaceDisabled: 'rgba(250, 250, 250, 0.32)',
    outline: colors.border,
    outlineVariant: colors.border,
    onBackground: colors.text,
    onSurface: colors.text,
    onSurfaceVariant: colors.textMuted,
    inverseSurface: colors.text,
    inverseOnSurface: colors.background,
    inversePrimary: colors.primary,
    error: colors.primarySoft,
    elevation: {
      level0: 'transparent',
      level1: colors.surface,
      level2: colors.surfaceRaised,
      level3: colors.surfaceRaised,
      level4: colors.surfaceRaised,
      level5: colors.surfaceRaised,
    },
  },
};
