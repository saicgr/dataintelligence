import { View } from 'react-native';

import type { CodePanel as CP } from '../lib/content';
import { useTheme } from '../lib/theme';
import { CodeBlock } from './CodeBlock';
import { T } from './kit';

const ACCENT = {
  bug: { icon: '🐞', fallback: 'Bug' },
  fix: { icon: '✅', fallback: 'Fix' },
} as const;

/**
 * Renders a flip card's `code` examples as real monospace panels under the
 * answer prose — each with an optional coloured label ("🐞 Bug" / "✅ Fix").
 * Reuses the existing CodeBlock; no syntax engine, no new dependency.
 */
export function CodePanels({ panels }: { panels: CP[] }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      {panels.map((p, i) => {
        const meta = p.accent ? ACCENT[p.accent] : undefined;
        const labelColor = p.accent === 'bug' ? c.danger : p.accent === 'fix' ? c.success : c.muted;
        const label = p.label ?? meta?.fallback;
        return (
          <View key={i}>
            {label ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <T size={11.5} weight="800" color={labelColor}>
                  {meta ? `${meta.icon} ` : ''}
                  {label}
                </T>
                {p.lang ? (
                  <T size={10.5} weight="700" color={c.muted}>
                    {p.lang}
                  </T>
                ) : null}
              </View>
            ) : null}
            <CodeBlock lines={p.lines} />
          </View>
        );
      })}
    </View>
  );
}
