import { Pressable, View } from 'react-native';

import { mono, radius, useTheme } from '../lib/theme';
import { T } from './kit';

export type CellState = 'hit' | 'miss' | undefined;

/**
 * Synthetic metric panel rendered from a `string[][]` (row 0 = header). Body cells
 * are tappable for the "tap the tell" interaction (evidence / Spark-UI / eval tables).
 */
export function MetricTable({
  cells,
  tappable,
  onTapCell,
  cellState,
}: {
  cells: string[][];
  tappable?: boolean;
  onTapCell?: (r: number, col: number) => void;
  cellState?: (r: number, col: number) => CellState;
}) {
  const { c, scheme } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.md, overflow: 'hidden' }}>
      {cells.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', borderTopWidth: r === 0 ? 0 : 1, borderTopColor: c.border }}>
          {row.map((cell, col) => {
            const header = r === 0;
            const st = !header ? cellState?.(r, col) : undefined;
            const bg =
              st === 'hit'
                ? scheme === 'dark'
                  ? 'rgba(63,185,80,.16)'
                  : 'rgba(26,158,87,.14)'
                : st === 'miss'
                  ? scheme === 'dark'
                    ? 'rgba(248,81,73,.14)'
                    : 'rgba(232,69,60,.12)'
                  : 'transparent';
            const inner = (
              <T
                size={11}
                weight={header ? '800' : '600'}
                color={header ? c.muted : c.fg}
                style={{ fontFamily: mono }}>
                {cell}
              </T>
            );
            const cellStyle = {
              flex: 1,
              paddingVertical: 7,
              paddingHorizontal: 8,
              backgroundColor: bg,
              borderLeftWidth: col === 0 ? 0 : 1,
              borderLeftColor: c.border,
            } as const;
            return tappable && !header ? (
              <Pressable key={col} onPress={() => onTapCell?.(r, col)} style={cellStyle}>
                {inner}
              </Pressable>
            ) : (
              <View key={col} style={cellStyle}>
                {inner}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
