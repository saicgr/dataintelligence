/**
 * InterviewPlanCard — a countdown + today's cram target, driven by lib/cramPlan.
 *
 * Given an interview date (ISO), it shows "Interview in N days", today's suggested card
 * count (or a "morning-of warm-up" when the date is today), the plan summary, and a
 * "Start today's prep" button. Renders nothing when no date is set, so it's safe to drop
 * at the top of any screen unconditionally.
 *
 * Pure presentational: the date comes in as a prop (store has no `interviewDate` field
 * yet — see INTEGRATION NOTES). Role is read from the store to pick the right ramp.
 */
import { View } from 'react-native';

import { buildCramPlan } from '../lib/cramPlan';
import { useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { Btn, Card, Row, T } from './kit';

export function InterviewPlanCard({
  /** Interview date as ISO (`YYYY-MM-DD`); null/empty → renders nothing. */
  dateIso,
  /** Fired by "Start today's prep" with today's card target — wire to startDaily(target)
   *  so the launched session matches the number the card just promised. */
  onStart,
}: {
  dateIso: string | null;
  onStart?: (todayTarget: number) => void;
}) {
  const { c } = useTheme();
  const role = useStore((s) => s.role);
  const plan = buildCramPlan(dateIso, role);

  // No date (or unparseable) → render nothing, per spec.
  if (!plan) return null;

  // Headline countdown wording.
  const count =
    plan.isPast ? 'Interview date passed'
    : plan.isToday ? 'Interview is today'
    : plan.daysUntil === 1 ? 'Interview tomorrow'
    : `Interview in ${plan.daysUntil} days`;

  // Accent the countdown amber inside the final week (at-risk / heads-down), else accent ink.
  const urgent = !plan.isPast && plan.daysUntil <= 7;
  const countColor = plan.isPast ? c.muted : urgent ? c.warn : c.accentInk;

  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T weight="900" size={17} color={countColor}>{count}</T>
        {plan.warmUpToday ? (
          <View
            // amber pill: morning-of warm-up signal
            style={{
              backgroundColor: c.warn,
              borderRadius: 999,
              paddingVertical: 4,
              paddingHorizontal: 10,
            }}>
            <T weight="800" size={11} color="#fff">☀️ Warm-up</T>
          </View>
        ) : null}
      </Row>

      <T muted size={12.5} style={{ lineHeight: 18 }}>{plan.summary}</T>

      <View
        style={{
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: 12,
        }}>
        <T muted size={11} weight="800" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {plan.warmUpToday ? 'Morning-of warm-up' : "Today's target"}
        </T>
        <Row style={{ gap: 6, marginTop: 4 }}>
          <T weight="900" size={26} color={c.fg}>{plan.todayTarget}</T>
          <T muted weight="700" size={13} style={{ marginBottom: 3, alignSelf: 'flex-end' }}>
            cards
          </T>
        </Row>
      </View>

      <Btn
        label={plan.warmUpToday ? '☀️ Start warm-up' : "Start today's prep →"}
        variant={plan.warmUpToday ? 'navy' : 'primary'}
        onPress={() => onStart?.(plan.todayTarget)}
      />
    </Card>
  );
}
