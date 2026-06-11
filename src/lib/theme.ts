import { Platform, useColorScheme } from 'react-native';

import { useStore } from './store';

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
  /** Keylime brand accent. Used ONLY as a fill behind `onAccent` text — never as text on light. */
  accent: string;
  /** Ink text/icon color to sit on top of `accent`. Near-black; never white on keylime. */
  onAccent: string;
  /** Readable accent-family color for accent-colored TEXT/icons (a deep lime that passes on light). */
  accentInk: string;
  success: string;
  danger: string;
  /** Amber — reserved for "warning / at-risk" (streak-at-risk, verifyBy expiring). Distinct from brand. */
  warn: string;
  navy: string;
}

export const palette: Record<'light' | 'dark', Palette> = {
  light: {
    surface: '#f5f6fa',
    card: '#ffffff',
    border: '#e9ebf0',
    fg: '#0f1b2d',
    muted: '#6b7790',
    // Defaults mirror ACCENTS[DEFAULT_ACCENT] — the free "Classic" accent. useTheme() overrides
    // these per the user's picked accent (Pro + account gated; see resolveAccent below).
    accent: '#cf4602',
    onAccent: '#ffffff',
    accentInk: '#c2410c',
    success: '#1a9e57',
    danger: '#e8453c',
    warn: '#c9922a',
    navy: '#1c2a44',
  },
  dark: {
    surface: '#0b0f15',
    card: '#151b24',
    border: '#262e3a',
    fg: '#e9eef5',
    muted: '#8a97ac',
    accent: '#cf4602',
    onAccent: '#ffffff',
    accentInk: '#ff922b',
    success: '#3fb950',
    danger: '#f85149',
    warn: '#e0a93a',
    navy: '#1c2a44',
  },
};

/** One accent option: brand fill + the ink/white that sits on it + a readable text-color variant. */
export interface AccentSwatch {
  accent: string;
  onAccent: string;
  accentInk: string;
}
export type AccentKey = 'classic' | 'keylime' | 'violet' | 'sky' | 'rose' | 'teal';

/**
 * Selectable accent themes. `pro: true` requires a live Pro entitlement AND a signed-in account
 * (see `resolveAccent`). Keylime is intentionally Pro-only — neon lime needs ink text, so each
 * swatch ships its own `onAccent`/`accentInk` rather than assuming white-on-fill.
 */
export const ACCENTS: Record<AccentKey, { name: string; pro: boolean; light: AccentSwatch; dark: AccentSwatch }> = {
  classic: {
    name: 'Classic', pro: false,
    // White text on a slightly-deepened orange → 4.64:1 (WCAG AA); accentInk handles orange TEXT on light.
    light: { accent: '#cf4602', onAccent: '#ffffff', accentInk: '#c2410c' },
    dark: { accent: '#cf4602', onAccent: '#ffffff', accentInk: '#ff922b' },
  },
  keylime: {
    name: 'Keylime', pro: true,
    light: { accent: '#ccff00', onAccent: '#0f1b2d', accentInk: '#5a6b00' },
    dark: { accent: '#ccff00', onAccent: '#0f1b2d', accentInk: '#ccff00' },
  },
  violet: {
    name: 'Violet', pro: true,
    light: { accent: '#7048e8', onAccent: '#ffffff', accentInk: '#6741d9' },
    dark: { accent: '#9775fa', onAccent: '#15102b', accentInk: '#9775fa' },
  },
  sky: {
    name: 'Sky', pro: true,
    light: { accent: '#1c7ed6', onAccent: '#ffffff', accentInk: '#1971c2' },
    dark: { accent: '#4dabf7', onAccent: '#06223a', accentInk: '#4dabf7' },
  },
  rose: {
    name: 'Rose', pro: true,
    light: { accent: '#e64980', onAccent: '#ffffff', accentInk: '#c2255c' },
    dark: { accent: '#f783ac', onAccent: '#2b0716', accentInk: '#f783ac' },
  },
  teal: {
    name: 'Teal', pro: true,
    light: { accent: '#0ca678', onAccent: '#ffffff', accentInk: '#087f5b' },
    dark: { accent: '#20c997', onAccent: '#04241a', accentInk: '#20c997' },
  },
};

export const DEFAULT_ACCENT: AccentKey = 'classic';

/** Resolve the usable accent: a Pro swatch is only honored when the user is entitled (Pro + account). */
export function resolveAccent(key: AccentKey, scheme: 'light' | 'dark', entitled: boolean): AccentSwatch {
  const chosen = ACCENTS[key] ?? ACCENTS[DEFAULT_ACCENT];
  const usable = chosen.pro && !entitled ? ACCENTS[DEFAULT_ACCENT] : chosen;
  return usable[scheme];
}

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

/** Darken a `#rrggbb` (or `#rgb`) hex by `factor` (0–1, lower = darker). Powers 3D button edges. */
export function shade(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h;
  const n = parseInt(full, 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * factor)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export const radius = { sm: 10, md: 14, lg: 18, xl: 22 } as const;
export const space = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 } as const;

/** Monospace family for code panels (RN has no built-in token). */
export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;

export type Theme = {
  scheme: 'light' | 'dark';
  c: Palette;
  track: (key: string) => string;
};

/** The scheme actually in effect: the user's Profile preference, falling back to the OS. */
export function useResolvedScheme(): 'light' | 'dark' {
  const sys = useColorScheme() === 'dark' ? 'dark' : 'light';
  const pref = useStore((s) => s.themePref);
  return pref === 'system' ? sys : pref;
}

export function useTheme(): Theme {
  const scheme = useResolvedScheme();
  const tc = trackColors[scheme] as Record<string, string>;
  // Accent picker: a Pro swatch only applies when the user is entitled (live Pro + signed-in account).
  const accentKey = useStore((s) => s.accentKey);
  const entitled = useStore((s) => (s.unlocked || (__DEV__ && s.devMode)) && !!s.userId);
  const sw = resolveAccent(accentKey, scheme, entitled);
  const c: Palette = { ...palette[scheme], accent: sw.accent, onAccent: sw.onAccent, accentInk: sw.accentInk };
  return {
    scheme,
    c,
    // Fall back to navy (works under white text) — never keylime, which needs ink text.
    track: (key: string) => tc[key] ?? palette[scheme].navy,
  };
}
