/**
 * StreakSheet (#13) — tap the header streak cluster to see how the streak system works:
 * the full StreakHero, how freezes are earned/used, rest days, and an editable daily goal.
 * Same glass bottom-sheet pattern as the home SettingsSheet.
 */
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '../lib/feedback';
import { useStore } from '../lib/store';
import { radius, space, useTheme } from '../lib/theme';
import { Row, Segmented, T } from './kit';
import { StreakHero } from './StreakHero';

const isWeb = Platform.OS === 'web';

const GOALS = [
  { label: 'Casual · 5', value: '5' },
  { label: 'Regular · 10', value: '10' },
  { label: 'Serious · 20', value: '20' },
  { label: 'Intense · 30', value: '30' },
];

export function StreakSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c, scheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const dark = scheme === 'dark';
  const freezes = useStore((s) => s.freezes);
  const streak = useStore((s) => s.streak);
  const restDays = useStore((s) => s.restDays);
  const dailyGoal = useStore((s) => s.dailyGoal);
  const setDailyGoal = useStore((s) => s.setDailyGoal);
  const untilFreeze = streak % 5 === 0 ? 5 : 5 - (streak % 5);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.22)', justifyContent: 'flex-end', ...(isWeb && { alignItems: 'center' }) }}
        onPress={onClose}>
        <Pressable onPress={() => {}} style={{ maxHeight: '85%', ...(isWeb && { width: '100%', maxWidth: 440 }) }}>
          <BlurView
            intensity={dark ? 55 : 75}
            tint={dark ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
            blurMethod="dimezisBlurView"
            style={{
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)',
              overflow: 'hidden',
              paddingHorizontal: space.md,
              paddingTop: 10,
              paddingBottom: insets.bottom + 16,
            }}>
            <View
              style={{
                alignSelf: 'center',
                width: 38,
                height: 5,
                borderRadius: 999,
                backgroundColor: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.22)',
                marginBottom: 12,
              }}
            />
            <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <T weight="800" size={17}>Your streak</T>
              <Pressable onPress={onClose} hitSlop={10}>
                <T weight="800" size={14} color="#4263eb">Done</T>
              </Pressable>
            </Row>
            <ScrollView
              showsVerticalScrollIndicator
              indicatorStyle={dark ? 'white' : 'black'}
              style={{ maxHeight: winH * 0.66 }}
              contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
              <StreakHero variant="hero" />

              <ExplainRow
                icon="🧊"
                title={`Streak freezes · ${freezes}/2 banked`}
                body={`A freeze auto-covers a missed day so your streak survives. Earn one every 5 streak days${
                  freezes >= 2 ? ' (you’re full)' : streak > 0 ? ` — next in ${untilFreeze} day${untilFreeze === 1 ? '' : 's'}` : ''
                }. No tapping needed — it spends itself.`}
              />
              <ExplainRow
                icon="🛌"
                title={restDays.length ? `Rest days · ${restDays.length}/week scheduled` : 'Rest days'}
                body="Scheduled rest days never break the streak. Set them for the days you genuinely don't study."
                action={{ label: 'Edit in Profile ›', onPress: () => { onClose(); router.push('/profile'); } }}
              />

              <View style={{ gap: 8 }}>
                <T weight="800" size={12.5}>Daily goal · cards per day</T>
                <Segmented
                  options={GOALS}
                  value={String(dailyGoal)}
                  onChange={(v) => {
                    haptic.selection();
                    setDailyGoal(Number(v));
                  }}
                />
                <T muted size={11} style={{ lineHeight: 16 }}>
                  Hitting the goal keeps the day counted. Pick what you can sustain — streaks beat sprints.
                </T>
              </View>
            </ScrollView>
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ExplainRow({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        borderRadius: radius.md,
        padding: 12,
      }}>
      <T size={18}>{icon}</T>
      <View style={{ flex: 1, gap: 3 }}>
        <T weight="800" size={13}>{title}</T>
        <T muted size={11.5} style={{ lineHeight: 16 }}>{body}</T>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={6} style={{ marginTop: 3 }}>
            <T weight="800" size={12} color="#4263eb">{action.label}</T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
