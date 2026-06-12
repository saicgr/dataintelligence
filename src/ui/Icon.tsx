import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

import { useTheme } from '../lib/theme';

/**
 * One consistent vector icon set for UI chrome — replaces emoji-as-icons, which
 * render inconsistently across devices and read as "AI-generated app". Brand
 * personality emoji (the Mascot, XP/combo/💔 session vitals) stay as emoji on
 * purpose; everything functional routes through here.
 *
 * Call sites use SEMANTIC names (<Icon name="streak" />), not glyph names, so the
 * underlying set can be swapped in one place.
 */
const MAP = {
  // status / navigation
  search: 'magnify',
  lock: 'lock',
  locked: 'lock',
  check: 'check',
  close: 'close',
  chevron: 'chevron-right',
  back: 'chevron-left',
  // gamification
  streak: 'fire',
  freeze: 'snowflake',
  goal: 'target',
  target: 'target',
  bolt: 'lightning-bolt',
  xp: 'lightning-bolt',
  trophy: 'trophy',
  medal: 'medal',
  flag: 'flag-checkered',
  party: 'party-popper',
  // learning surfaces
  book: 'book-open-variant',
  review: 'book-open-variant',
  sprout: 'sprout',
  map: 'map-outline',
  compass: 'compass-outline',
  brain: 'brain',
  dice: 'dice-5',
  doc: 'file-document-outline',
  pencil: 'pencil',
  bookmark: 'bookmark-outline',
  // io / modes
  mic: 'microphone',
  headphones: 'headphones',
  laptop: 'laptop',
  plane: 'airplane-landing',
  // sections (Learn path groups)
  coding: 'keyboard-outline',
  deploy: 'rocket-launch-outline',
  oncall: 'alarm-light-outline',
  behavioral: 'account-voice',
  craft: 'target',
  concept: 'book-open-variant',
  // misc
  fresh: 'new-box',
  warn: 'alert',
  info: 'information-outline',
  bulb: 'lightbulb-on-outline',
  // added for the remaining-screens migration (profile settings, practice, session chrome)
  mistakes: 'book-alert-outline',
  folder: 'folder-outline',
  tracks: 'folder-multiple-outline',
  company: 'office-building-outline',
  timer: 'timer-outline',
  bell: 'bell-outline',
  speaker: 'volume-high',
  vibrate: 'vibrate',
  gamepad: 'gamepad-variant-outline',
  restore: 'restore',
  wrench: 'wrench-outline',
  link: 'open-in-new',
  scales: 'scale-balance',
  tradeoff: 'scale-balance',
  like: 'thumb-up-outline',
  dislike: 'thumb-down-outline',
  gem: 'diamond-stone',
  pro: 'diamond-stone',
  person: 'account-circle-outline',
  people: 'account-group-outline',
  friends: 'account-group-outline',
  chart: 'chart-bar',
  share: 'bullhorn-outline',
  save: 'content-save-outline',
  rest: 'sleep',
  refresh: 'refresh',
  repeat: 'repeat',
} as const;

export type IconName = keyof typeof MAP;

export function Icon({
  name,
  size = 18,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  /** Defaults to the foreground color; pass c.muted / c.accentInk / a hex for chrome. */
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { c } = useTheme();
  return <MaterialCommunityIcons name={MAP[name]} size={size} color={color ?? c.fg} style={style} />;
}
