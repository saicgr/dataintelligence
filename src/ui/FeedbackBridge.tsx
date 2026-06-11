/**
 * Headless bridge: turns store-owned feedback events (session complete, streak up,
 * level up, first card, daily goal, badge unlocks) into sound + haptics, and renders
 * the self-dismissing celebration overlays / badge toast.
 * Mounted once in the (tabs) layout so it overlays every tab + the session player.
 */
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { type Badge, computeBadges } from '../lib/badges';
import { haptic, sfx } from '../lib/feedback';
import { nextWeekTier, weekKey, zoneForRank } from '../lib/leagues';
import { useStore } from '../lib/store';
import { radius, space, useTheme } from '../lib/theme';
import { Confetti } from './anim';
import { T } from './kit';

/** Transient celebration moments rendered by this bridge (each self-dismisses). */
type Moment =
  | { kind: 'firstCard' }
  | { kind: 'goalMet'; goal: number }
  | { kind: 'promote'; tier: string; rank: number }
  | { kind: 'relegate'; tier: string };

export function FeedbackBridge() {
  const ev = useStore((s) => s.lastEvent);
  const clear = useStore((s) => s.clearEvent);
  const levelUpTo = useStore((s) => s.levelUpTo);
  const dailyGoal = useStore((s) => s.dailyGoal);
  const [moment, setMoment] = useState<Moment | null>(null);

  useEffect(() => {
    if (!ev) return;
    switch (ev.kind) {
      case 'complete':
        sfx.complete();
        haptic.success();
        break;
      case 'streak':
        sfx.streak();
        haptic.success();
        break;
      case 'levelUp':
        sfx.levelUp();
        haptic.success();
        break;
      case 'firstCard':
        sfx.streak();
        haptic.success();
        setMoment({ kind: 'firstCard' });
        break;
      case 'goalMet':
        sfx.streak();
        haptic.success();
        setMoment({ kind: 'goalMet', goal: dailyGoal });
        break;
      case 'badge':
        sfx.levelUp();
        haptic.success();
        break;
      default:
        break;
    }
    clear();
  }, [ev, clear, dailyGoal]);

  // Weekly league result (#15): a LIVE snapshot from a previous week resolves once per new week.
  const leagueSnapshot = useStore((s) => s.leagueSnapshot);
  const leagueResultShownWeek = useStore((s) => s.leagueResultShownWeek);
  const markLeagueResultShown = useStore((s) => s.markLeagueResultShown);
  useEffect(() => {
    const wk = weekKey();
    if (!leagueSnapshot || leagueSnapshot.week === wk || leagueResultShownWeek === wk) return;
    markLeagueResultShown(wk);
    const zone = zoneForRank(leagueSnapshot.rank, leagueSnapshot.size);
    if (zone === 'hold') return; // no fanfare for holding — just a fresh week
    const tier = nextWeekTier(leagueSnapshot.rank, leagueSnapshot.size);
    if (zone === 'promote') {
      sfx.levelUp();
      haptic.success();
      setMoment({ kind: 'promote', tier, rank: leagueSnapshot.rank });
    } else {
      haptic.light();
      setMoment({ kind: 'relegate', tier });
    }
  }, [leagueSnapshot, leagueResultShownWeek, markLeagueResultShown]);

  return (
    <>
      <BadgeToastWatcher />
      {moment != null && <MomentOverlay moment={moment} onDone={() => setMoment(null)} />}
      {levelUpTo != null && <LevelUpOverlay level={levelUpTo} />}
    </>
  );
}

/**
 * Watches for session end (inSession true→false) and toasts newly earned badges.
 * Track-mastery needs coverage data, so it's diffed on the Progress tab instead —
 * the badge grid is on screen there, so no toast is needed.
 */
function BadgeToastWatcher() {
  const inSession = useStore((s) => s.inSession);
  const prev = useRef(inSession);
  const [toast, setToast] = useState<{ badge: Badge; extra: number } | null>(null);

  useEffect(() => {
    const wasInSession = prev.current;
    prev.current = inSession;
    if (!wasInSession || inSession) return; // only on true→false
    const s = useStore.getState();
    const earned = computeBadges({
      streak: s.streak,
      xp: s.xp,
      progress: s.progress,
      lastMockScore: s.lastMockScore,
      trackCoverage: [],
      savedCount: s.savedIds.length,
      checkpointsDone: s.checkpointsDone.length,
      voiceTried: s.voiceTried,
    }).filter((b) => b.earned);
    const fresh = earned.filter((b) => !s.badgesSeen.includes(b.id));
    if (fresh.length === 0) return;
    s.markBadgesSeen(fresh.map((b) => b.id));
    s.emit('badge');
    setToast({ badge: fresh[0], extra: fresh.length - 1 });
  }, [inSession]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  return <BadgeToast badge={toast.badge} extra={toast.extra} onDismiss={() => setToast(null)} />;
}

function BadgeToast({ badge, extra, onDismiss }: { badge: Badge; extra: number; onDismiss: () => void }) {
  const { c } = useTheme();
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(12)}
      exiting={FadeOut.duration(200)}
      style={{ position: 'absolute', top: 64, left: 0, right: 0, alignItems: 'center', zIndex: 1100 }}>
      <Pressable onPress={onDismiss}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: c.card,
            borderWidth: 1.5,
            borderColor: c.accent,
            borderRadius: 999,
            paddingVertical: 10,
            paddingHorizontal: 16,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}>
          <T size={22}>{badge.icon}</T>
          <View>
            <T weight="900" size={13}>Achievement unlocked</T>
            <T muted size={11.5} weight="700">
              {badge.label}
              {extra > 0 ? ` · +${extra} more` : ''}
            </T>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Small centered celebration for first-card / daily-goal moments (auto-dismisses). */
function MomentOverlay({ moment, onDone }: { moment: Moment; onDone: () => void }) {
  const { c } = useTheme();
  useEffect(() => {
    const id = setTimeout(onDone, 2200);
    return () => clearTimeout(id);
  }, [onDone]);

  const { width, height } = Dimensions.get('window');
  const copy =
    moment.kind === 'firstCard'
      ? { emoji: '🎉', title: 'First card down!', sub: 'That’s the loop — rate honestly, the app does the scheduling.' }
      : moment.kind === 'goalMet'
        ? { emoji: '🎯', title: 'Daily goal hit!', sub: `${moment.goal} cards today — streak safe. Anything extra is gravy.` }
        : moment.kind === 'promote'
          ? { emoji: '🏆', title: `Promoted to ${moment.tier}!`, sub: `You finished #${moment.rank} last week — new league starts now.` }
          : { emoji: '🍂', title: `Back to ${moment.tier}`, sub: 'You slipped a tier — this week is a completely fresh board.' };

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(220)}
      style={{
        position: 'absolute',
        width,
        height,
        top: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(8,12,20,0.45)',
        zIndex: 1000,
      }}>
      <Confetti />
      <Pressable style={{ position: 'absolute', width, height }} onPress={onDone} />
      <Animated.View
        entering={ZoomIn.springify().damping(11)}
        style={{
          backgroundColor: c.card,
          borderRadius: radius.xl,
          paddingVertical: 26,
          paddingHorizontal: 30,
          alignItems: 'center',
          gap: 6,
          maxWidth: 320,
          marginHorizontal: space.md,
        }}>
        <T size={50}>{copy.emoji}</T>
        <T weight="900" size={22}>{copy.title}</T>
        <T muted size={13} style={{ textAlign: 'center', lineHeight: 18 }}>{copy.sub}</T>
      </Animated.View>
    </Animated.View>
  );
}

function LevelUpOverlay({ level }: { level: number }) {
  const { c } = useTheme();
  const clearLevelUp = useStore((s) => s.clearLevelUp);
  const playful = useStore((s) => s.playful);

  useEffect(() => {
    const id = setTimeout(clearLevelUp, 2000);
    return () => clearTimeout(id);
  }, [clearLevelUp]);

  const { width, height } = Dimensions.get('window');
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(220)}
      style={{
        position: 'absolute',
        width,
        height,
        top: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(8,12,20,0.55)',
        zIndex: 1000,
      }}>
      <Pressable style={{ position: 'absolute', width, height }} onPress={clearLevelUp} />
      <Animated.View
        entering={ZoomIn.springify().damping(11)}
        style={{
          backgroundColor: c.card,
          borderRadius: radius.xl,
          paddingVertical: 30,
          paddingHorizontal: 34,
          alignItems: 'center',
          gap: 6,
        }}>
        <T size={playful ? 60 : 44}>{playful ? '🎉' : '⭐️'}</T>
        <T weight="900" size={26}>Level {level}!</T>
        <T muted size={13.5} style={{ textAlign: 'center' }}>You leveled up — keep the streak alive.</T>
        <View style={{ marginTop: 10, backgroundColor: '#4263eb', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 }}>
          <T color="#fff" weight="900" size={14}>Lv {level}</T>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
