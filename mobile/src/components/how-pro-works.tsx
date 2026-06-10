import { View } from 'react-native';

import { radius, useTheme } from '../lib/theme';
import { Row, T } from '../ui/kit';

// The three things Pro actually does, in order. Mirrors the Free-vs-Pro rows:
// stay-current fresh drops · unlimited reps · weak-spot/adaptive scheduling.
const STEPS: [string, string][] = [
  ['We track what ships', 'New Claude, OpenAI & AWS features the week they land.'],
  ['Fresh cards drop weekly', 'Turned into real interview Q&A — your deck never goes stale.'],
  ['Smart scheduling', 'Your weak spots resurface right before you would forget them.'],
];

/**
 * "How it works" — 3 numbered steps explaining the Pro loop.
 * `onPurple` renders light-on-violet for the upsell card; otherwise theme colors.
 */
export function HowProWorks({ onPurple = false }: { onPurple?: boolean }) {
  const { c, track } = useTheme();
  const accent = track('rag');
  const chipBg = onPurple ? 'rgba(255,255,255,.16)' : accent + '1f';
  const chipFg = onPurple ? '#fff' : accent;
  const titleColor = onPurple ? '#fff' : c.fg;
  const subColor = onPurple ? '#cdc7f5' : undefined;

  return (
    <View style={{ gap: onPurple ? 9 : 11 }}>
      <T
        weight="800"
        size={onPurple ? 11 : 12}
        color={onPurple ? '#bcb4ef' : c.muted}
        style={{ letterSpacing: 1 }}>
        HOW IT WORKS
      </T>
      {STEPS.map(([title, sub], i) => (
        <Row key={i} style={{ gap: 11, alignItems: 'flex-start' }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: chipBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}>
            <T weight="900" size={12} color={chipFg}>{i + 1}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T weight="800" size={13.5} color={titleColor}>{title}</T>
            <T muted={!onPurple} color={subColor} size={12} style={{ marginTop: 1, lineHeight: 17 }}>
              {sub}
            </T>
          </View>
        </Row>
      ))}
    </View>
  );
}
