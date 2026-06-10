/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '../lib/theme';

export function useTheme() {
  // Resolved = user's Profile preference (System/Light/Dark), falling back to the OS.
  return Colors[useResolvedScheme()];
}
