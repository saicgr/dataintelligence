import { Pressable, View } from 'react-native';

import { mono, radius, useTheme } from '../lib/theme';
import { T } from './kit';

export type LineState = 'bug' | 'goodbug' | undefined;

/**
 * Read-only monospace code panel rendered from a pre-split `lines: string[]`
 * (authored ≤~52 cols so RN never reflows → line indices stay stable for tap-the-bug).
 * No Monaco, no syntax engine, no new dependency.
 */
export function CodeBlock({
  lines,
  tappable,
  onTapLine,
  lineState,
}: {
  lines: string[];
  tappable?: boolean;
  onTapLine?: (i: number) => void;
  lineState?: (i: number) => LineState;
}) {
  const { c, scheme } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.md, overflow: 'hidden', paddingVertical: 8 }}>
      {lines.map((ln, i) => {
        const st = lineState?.(i);
        const bg =
          st === 'bug'
            ? scheme === 'dark'
              ? 'rgba(248,81,73,.14)'
              : 'rgba(232,69,60,.12)'
            : st === 'goodbug'
              ? scheme === 'dark'
                ? 'rgba(63,185,80,.16)'
                : 'rgba(26,158,87,.14)'
              : 'transparent';
        const bd = st === 'bug' ? c.danger : st === 'goodbug' ? c.success : 'transparent';
        const row = (
          <View
            style={{
              flexDirection: 'row',
              gap: 9,
              paddingVertical: 2,
              paddingLeft: 8,
              paddingRight: 10,
              borderLeftWidth: 3,
              borderLeftColor: bd,
              backgroundColor: bg,
            }}>
            <T size={11.5} color={c.muted} style={{ fontFamily: mono, width: 18, textAlign: 'right' }}>
              {String(i + 1)}
            </T>
            <T size={12} style={{ fontFamily: mono, flex: 1, lineHeight: 18 }}>
              {ln}
            </T>
          </View>
        );
        return tappable ? (
          <Pressable key={i} onPress={() => onTapLine?.(i)}>
            {row}
          </Pressable>
        ) : (
          <View key={i}>{row}</View>
        );
      })}
    </View>
  );
}
