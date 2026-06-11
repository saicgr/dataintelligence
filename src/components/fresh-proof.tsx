/**
 * FreshProof (#5) — concrete anti-Anki evidence on the paywall: the actual latest
 * "what shipped" cards with dates and sources. A shared Anki deck can't do this;
 * showing the real rows beats claiming it.
 */
import { View } from 'react-native';

import { freshCount, liveFresh } from '../lib/fresh';
import { radius, useTheme } from '../lib/theme';
import { Row, T } from '../ui/kit';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

export function FreshProof({ limit = 3 }: { limit?: number }) {
  const { c } = useTheme();
  const now = Date.now();
  const rows = liveFresh(now).filter((f) => !f.packId).slice(0, limit);
  if (rows.length === 0) return null;
  const total = freshCount(now, 'all');
  return (
    <View style={{ gap: 9 }}>
      <T muted weight="800" size={11} style={{ letterSpacing: 0.5 }}>WHAT SHIPPED — ALREADY IN THE DECK</T>
      {rows.map((f) => (
        <View
          key={f.id}
          style={{
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            padding: 10,
            gap: 4,
            backgroundColor: c.card,
          }}>
          <Row style={{ gap: 7 }}>
            <View style={{ backgroundColor: c.surface, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
              <T size={10} weight="800">{f.tool}</T>
            </View>
            <T muted size={10.5} weight="700">
              {shortDate(f.publishedAt)}
              {f.sourceLabel ? ` · ${f.sourceLabel}` : ''}
            </T>
          </Row>
          <T size={12.5} weight="700" numberOfLines={2} style={{ lineHeight: 17 }}>
            {f.q}
          </T>
          <T muted size={10.5}>🔒 answer unlocks with Pro</T>
        </View>
      ))}
      <T muted size={11} style={{ lineHeight: 16 }}>
        {total} live cards · every one source-linked and auto-retired at its verify-by date — a shared
        Anki deck can&apos;t do that.
      </T>
    </View>
  );
}
