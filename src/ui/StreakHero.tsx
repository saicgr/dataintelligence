/**
 * The "big number" streak — the centerpiece gamification surface (2026 trend:
 * the streak is a second value proposition, so the count is the hero element).
 */
import { View } from 'react-native';

import { useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { CountUp, Pop } from './anim';
import { Icon } from './Icon';
import { Card, Row, T } from './kit';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function StreakHero({ variant = 'hero' }: { variant?: 'hero' | 'compact' }) {
  const { c, scheme } = useTheme();
  const streak = useStore((s) => s.streak);
  const freezes = useStore((s) => s.freezes);
  const lastActiveDay = useStore((s) => s.lastActiveDay);
  const restDays = useStore((s) => s.restDays);
  const flame = '#f76707';
  const big = variant === 'hero';
  const litCount = Math.min(7, streak);

  // Streak-loss urgency (plan #0.2) + rest-day awareness (plan #23).
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const doneToday = lastActiveDay === today;
  const isRestToday = restDays.includes(now.getUTCDay());
  const banner =
    streak <= 0
      ? null
      : doneToday
        ? { text: '✓ Streak safe — see you tomorrow', color: c.success }
        : isRestToday
          ? { text: '😌 Rest day — your streak is protected', color: c.success }
          : { text: `⚠️ Study today to keep your ${streak}-day streak`, color: c.warn };

  return (
    <Card style={{ alignItems: 'center', paddingVertical: big ? 26 : 18, gap: 4 }}>
      <Pop trigger={streak}>
        <T size={big ? 64 : 44}>🔥</T>
      </Pop>
      <Row style={{ alignItems: 'flex-end', gap: 6 }}>
        <CountUp to={streak} style={{ color: flame, fontWeight: '900', fontSize: big ? 56 : 40 }} />
        <T weight="900" size={big ? 20 : 16} color={c.muted} style={{ marginBottom: big ? 10 : 6 }}>
          day{streak === 1 ? '' : 's'}
        </T>
      </Row>
      <T weight="800" size={big ? 14 : 12.5} color={c.muted} style={{ letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {streak > 0 ? 'streak' : 'start your streak today'}
      </T>

      <Row style={{ gap: 8, marginTop: 12 }}>
        {DAYS.map((d, i) => {
          const lit = i >= 7 - litCount;
          return (
            <View key={i} style={{ alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: lit ? flame : c.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {lit ? <T size={11} color="#fff" weight="900">✓</T> : null}
              </View>
              <T size={10} weight="700" color={c.muted}>{d}</T>
            </View>
          );
        })}
      </Row>

      {banner ? (
        <View
          style={{
            marginTop: 12,
            backgroundColor: banner.color + (scheme === 'dark' ? '22' : '18'),
            borderRadius: radius.md,
            paddingVertical: 8,
            paddingHorizontal: 14,
          }}>
          <T weight="800" size={12.5} color={banner.color}>{banner.text}</T>
        </View>
      ) : null}

      {streak > 0 && streak % 5 === 0 ? (
        <Pop trigger={streak} style={{ marginTop: 12 }}>
          <View style={{ backgroundColor: '#e7f5ff', borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 14 }}>
            <Row style={{ gap: 3 }}>
              <Icon name="freeze" size={12.5} color="#1c7ed6" />
              <T weight="800" size={12.5} color="#1c7ed6">Streak freeze earned — you have {freezes}</T>
            </Row>
          </View>
        </Pop>
      ) : freezes > 0 ? (
        <Row style={{ gap: 3, marginTop: 10 }}>
          <Icon name="freeze" size={11.5} color={c.muted} />
          <T size={11.5} weight="700" color={c.muted}>{freezes} freeze{freezes > 1 ? 's' : ''} banked</T>
        </Row>
      ) : null}
    </Card>
  );
}
