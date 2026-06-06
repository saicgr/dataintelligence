import { Platform, useColorScheme } from 'react-native';

/**
 * Brand tokens ported 1:1 from the approved prototype (mockups/mobile-app.html).
 * Light + dark palettes, plus per-track accent colors.
 */
export interface Palette {
  surface: string;
  card: string;
  border: string;
  fg: string;
  muted: string;
  accent: string;
  success: string;
  danger: string;
  navy: string;
}

export const palette: Record<'light' | 'dark', Palette> = {
  light: {
    surface: '#f5f6fa',
    card: '#ffffff',
    border: '#e9ebf0',
    fg: '#0f1b2d',
    muted: '#6b7790',
    accent: '#c9922a',
    success: '#1a9e57',
    danger: '#e8453c',
    navy: '#1c2a44',
  },
  dark: {
    surface: '#0b0f15',
    card: '#151b24',
    border: '#262e3a',
    fg: '#e9eef5',
    muted: '#8a97ac',
    accent: '#e0a93a',
    success: '#3fb950',
    danger: '#f85149',
    navy: '#1c2a44',
  },
};

export const trackColors = {
  light: {
    spark: '#f76707', kafka: '#0ca678', rag: '#7048e8', sql: '#1c7ed6',
    dbt: '#e8590c', sysd: '#4263eb', eval: '#e64980',
  },
  dark: {
    spark: '#ff922b', kafka: '#20c997', rag: '#9775fa', sql: '#4dabf7',
    dbt: '#ff922b', sysd: '#748ffc', eval: '#f783ac',
  },
} as const;

export type TrackColorKey = keyof typeof trackColors.light;

export const radius = { sm: 10, md: 14, lg: 18, xl: 22 } as const;
export const space = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 } as const;

/** Monospace family for code panels (RN has no built-in token). */
export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;

export type Theme = {
  scheme: 'light' | 'dark';
  c: Palette;
  track: (key: string) => string;
};

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const tc = trackColors[scheme] as Record<string, string>;
  return {
    scheme,
    c: palette[scheme],
    track: (key: string) => tc[key] ?? palette[scheme].accent,
  };
}
