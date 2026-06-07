/**
 * QuestStrip — a horizontal shelf of today's three Daily Quests, each a small card with its own
 * progress bar + a checkmark when done. Renders under the DailyStrip on the Learn home.
 *
 * Live progress is read from the store (cardsToday / dailyGoal / questProgress). Quest completion
 * is computed by the pure helpers in lib/quests, seeded by today's day string so the trio rotates
 * daily and is identical across devices. The store gates `questProgress` per day (questDay); this
 * component is a pure view — it never writes. Optionally accept already-completed ids via props.
 */
import { ScrollView, View } from 'react-native';

import {
  questDayKey,
  questDone,
  questFraction,
  type Quest,
  type QuestId,
  type QuestProgressInputs,
  questsCompleted,
  todaysQuests,
} from '../lib/quests';
import { useStore } from '../lib/store';
import { radius, space, useTheme } from '../lib/theme';
import { AnimatedProgressBar, CardEnter, PressableScale } from './anim';
import { H2, Row, T } from './kit';

export function QuestStrip({
  completedIds,
  onPressQuest,
}: {
  /** Override which quests read as done (else computed from store). Useful for previews/tests. */
  completedIds?: QuestId[];
  onPressQuest?: (q: Quest) => void;
}) {
  const { c } = useTheme();
  const cardsToday = useStore((s) => s.cardsToday);
  const dailyGoal = useStore((s) => s.dailyGoal);
  // `questProgress` / `questDay` are store fields the integration adds (see INTEGRATION NOTES).
  // Read defensively so this file is type-correct + safe before the store ships them.
  const questProgress = useStore((s) => (s as { questProgress?: QuestProgressInputs['questProgress'] }).questProgress) ?? {};
  const questDay = useStore((s) => (s as { questDay?: string | null }).questDay) ?? null;

  const today = questDayKey(Date.now());
  // If the store's quest counters are from a previous day (not yet rolled over), treat them as zero
  // so the strip never shows stale progress before the store resets them.
  const inputs: QuestProgressInputs = {
    cardsToday,
    dailyGoal,
    questProgress: questDay === today ? questProgress : {},
  };

  const quests = todaysQuests(today);
  const override = completedIds ? new Set(completedIds) : null;
  const isDone = (q: Quest) => (override ? override.has(q.id) : questDone(q.id, inputs));
  const doneCount = override ? quests.filter((q) => override.has(q.id)).length : questsCompleted(today, inputs);

  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>Daily Quests</H2>
        <T weight="800" size={11} color={doneCount === quests.length ? c.success : c.muted}>
          {doneCount}/{quests.length}
        </T>
      </Row>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingRight: space.sm }}>
        {quests.map((q, i) => (
          <CardEnter key={q.id} delay={i * 50}>
            <QuestCard quest={q} done={isDone(q)} frac={override ? (override.has(q.id) ? 1 : 0) : questFraction(q.id, inputs)} onPress={onPressQuest} />
          </CardEnter>
        ))}
      </ScrollView>
    </View>
  );
}

function QuestCard({
  quest,
  done,
  frac,
  onPress,
}: {
  quest: Quest;
  done: boolean;
  frac: number;
  onPress?: (q: Quest) => void;
}) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={onPress ? () => onPress(quest) : undefined} disabled={!onPress} scaleTo={0.97}>
      <View
        style={{
          width: 152,
          borderRadius: radius.md,
          padding: 12,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: done ? c.success : c.border,
          gap: 9,
        }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              backgroundColor: done ? c.success : c.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <T size={17}>{done ? '✓' : quest.icon}</T>
          </View>
          {done && (
            <View style={{ backgroundColor: c.success, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
              <T color="#fff" weight="900" size={9}>DONE</T>
            </View>
          )}
        </Row>
        <T weight="800" size={12.5} style={{ minHeight: 34 }}>
          {quest.label}
        </T>
        <AnimatedProgressBar value={frac} color={done ? c.success : c.accent} track={c.border} height={6} />
      </View>
    </PressableScale>
  );
}
