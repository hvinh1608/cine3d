import { MD3DarkTheme, type MD3Theme } from 'react-native-paper';

export const colors = {
  background: '#09090B',
  surface: '#151518',
  surfaceRaised: '#202024',
  primary: '#E50914',
  primarySoft: '#FF4D57',
  text: '#FAFAFA',
  textMuted: '#A1A1AA',
  border: '#2D2D32',
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

export const radius = { sm: 8, md: 14, lg: 22 } as const;

export const paperTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: radius.md,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: '#3D0A0D',
    onPrimaryContainer: '#FFD9DA',
    secondary: colors.primarySoft,
    onSecondary: '#FFFFFF',
    secondaryContainer: colors.surfaceRaised,
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
