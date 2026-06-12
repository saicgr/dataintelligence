import { BlurView } from 'expo-blur';
import { type Href, router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  type CardHit,
  CHAPTER_SIZE,
  checkpointCount,
  checkpointKey,
  firstLessonAtLevel,
  freshSessionCardsForRole,
  lessonDeck,
  lessonCount,
  lessonTitle,
  type Level,
  LEVEL_OPTIONS,
  levelIndex,
  levelLabel,
  searchCards,
  Track,
  trackBySlug,
  trackCardCount,
  tracksForRole,
  tracksForRoleAtLevel,
} from '../../lib/content';
import { basicsForRole } from '../../lib/basics';
import { nextSpineStep, spineDays } from '../../lib/spine';
import { daysLeftInWeek } from '../../lib/leagues';
import { hasMockDeck } from '../../lib/mock';
import { coreTracksForRole, GROUP_LABEL, groupOrderForRole, roleByKey } from '../../lib/roles';
import { CardState } from '../../lib/srs';
import { isDev, isProActive, level, useStore, xpInLevel } from '../../lib/store';
import { radius, space, useTheme } from '../../lib/theme';
import { haptic, sfx } from '../../lib/feedback';
import type { PlanItem } from '../../lib/autopilot';
import { AnimatedProgressBar, CardEnter, CountUp, PressableScale, Shake } from '../../ui/anim';
import { AutopilotPlanCard, useAutopilot, useStartPlanItem } from '../../ui/AutopilotPlan';
import { Icon } from '../../ui/Icon';
import { H2, LevelPicker, Row, Segmented, T } from '../../ui/kit';
import { InterviewPlanCard } from '../../ui/InterviewPlanCard';
import { QuestStrip } from '../../ui/QuestStrip';
import { RolePicker } from '../../ui/RolePicker';
import { SessionView } from '../../ui/SessionView';
import { StreakSheet } from '../../ui/StreakSheet';

// On web the app is clamped to a centered phone column (see _layout); RN <Modal> escapes that,
// so web-only styles below re-center sheet content to the same width.
const isWeb = Platform.OS === 'web';

/**
 * The Duolingo-style "Learn" home: a winding Path of bite-size lesson units, with a
 * daily-review banner on top. Starting any session (review banner, a path node, Practice,
 * a track) flips `inSession` and this screen becomes the card player until you exit.
 */
export default function Learn() {
  const inSession = useStore((s) => s.inSession);
  if (inSession) return <Player />;
  return <LearnPath />;
}

/* ── Active session player ─────────────────────────────────────────────────── */
function Player() {
  const { c } = useTheme();
  const endSession = useStore((s) => s.endSession);
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.surface }}>
      <Row style={{ paddingHorizontal: space.md, paddingTop: 6, paddingBottom: 8 }}>
        <Pressable onPress={endSession} hitSlop={10}>
          <T weight="800" size={14} color={c.muted}>✕ Exit</T>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Streak />
      </Row>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ padding: space.md, paddingBottom: 120 }}>
          <SessionView />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Learn path (browse) ───────────────────────────────────────────────────── */
function LearnPath() {
  const { c, track: trackColor } = useTheme();
  const progress = useStore((st) => st.progress);
  const role = useStore((st) => st.role);
  const userLevel = useStore((st) => st.userLevel);
  const unlocked = useStore(isProActive);
  const startSingle = useStore((st) => st.startSingle);
  const due = useStore((st) => st.sessionMeta.due);
  const interviewDate = useStore((st) => st.interviewDate);
  const startDaily = useStore((st) => st.startDaily);
  const startFresh = useStore((st) => st.startFresh);
  const startDiagnostic = useStore((st) => st.startDiagnostic);
  const [showSettings, setShowSettings] = useState(false);
  const [showStreak, setShowStreak] = useState(false);
  // Search is visible by default (not hidden behind the header glass); the icon just toggles it off.
  const [searchOpen, setSearchOpen] = useState(true);
  const [q, setQ] = useState('');
  const [manual, setManual] = useState<Record<string, boolean>>({});
  // Interview Autopilot: when a date is set, the derived plan replaces the generic path —
  // and for Pro, today's next plan item takes over the ContinueHero.
  const plan = useAutopilot();
  const autopilotOn = plan.status !== 'dormant';
  const baseAction = nextAction(role, progress, due, userLevel);
  const todayFrac =
    plan.today && plan.today.items.length > 0
      ? plan.today.items.filter((i) => i.done).length / plan.today.items.length
      : 0;
  const action: NextAction =
    unlocked && plan.status === 'active' && plan.nextItem
      ? {
          kind: 'autopilot',
          eyebrow: plan.daysUntil <= 7 ? `Interview in ${plan.daysUntil}d` : 'Autopilot',
          title: plan.nextItem.title,
          sub: plan.nextItem.sub,
          icon: plan.nextItem.icon,
          frac: todayFrac,
          colorKind: 'navy',
          item: plan.nextItem,
        }
      : baseAction;
  const scrollRef = useRef<ScrollView>(null);
  const trackY = useRef<Record<string, number>>({});
  const sectionY = useRef<Record<string, number>>({});
  const scrollSV = useSharedValue(0);
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);

  const query = q.trim().toLowerCase();
  const match = (t: Track) => !query || t.name.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query);
  // Role + level filtered: a track shows only if it has cards at the chosen level ("All levels" = all).
  const roleTracks = tracksForRoleAtLevel(role, userLevel).filter(match);
  // Personalization: the role's headline tracks pin to a "Your path" section on top, and the
  // section order itself is role-aware (AI/data roles lead with Concepts, infra with Deploy…).
  // Both collapse while searching — results take over and pinned dupes would only confuse.
  const coreSlugs = query ? [] : coreTracksForRole(role);
  const coreTracks = coreSlugs
    .map((slug) => roleTracks.find((t) => t.slug === slug)) // intersect: respects the level filter
    .filter((t): t is Track => !!t);
  const coreSet = new Set(coreTracks.map((t) => t.slug));
  const grouped = groupOrderForRole(role)
    .map((g) => ({ g, tracks: roleTracks.filter((t) => t.group === g && !coreSet.has(t.slug)) }))
    .filter((x) => x.tracks.length > 0);
  const shown = [...coreTracks, ...grouped.flatMap((x) => x.tracks)];
  // Question-level search: typing a phrase also surfaces matching cards across the role's tracks,
  // so you can jump straight into a remembered question instead of hunting through tracks.
  const cardHits = query.length >= 2 ? searchCards(query, role) : [];
  // Free users taste the first 2 cards of any track (matches the track screen); the rest are Pro.
  const canOpen = (h: CardHit) => unlocked || h.idxInTrack < 2;
  const openHit = (h: CardHit) => (canOpen(h) ? startSingle(h.card.id) : router.push('/paywall'));

  // Collapsed by default — the Continue hero already surfaces the current lesson, so the
  // sections start tidy and expansion is user-driven (keeps the screen calm).
  const isOpen = (slug: string) => manual[slug] ?? false;
  const toggle = (slug: string) => setManual((m) => ({ ...m, [slug]: !(m[slug] ?? false) }));

  const measure = (slug: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    trackY.current[slug] = e.nativeEvent.layout.y;
  };
  const measureSection = (key: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  // Jump chip → scroll to the section header. Unmeasured (not yet laid out) → no-op, never jump to 0.
  const jumpToSection = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  };
  const renderUnit = (t: Track) => (
    <View key={t.slug} onLayout={measure(t.slug)}>
      <Unit track={t} progress={progress} open={isOpen(t.slug)} onToggle={() => toggle(t.slug)} />
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.surface }}>
      <Header
        onMenu={() => setShowSettings(true)}
        onSearch={() => setSearchOpen((v) => !v)}
        onStreak={() => setShowStreak(true)}
        searchOpen={searchOpen}
      />
      {searchOpen && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            marginHorizontal: space.md,
            marginTop: 8,
            marginBottom: 6,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
            borderRadius: radius.md,
            paddingHorizontal: 11,
          }}>
          <Icon name="search" size={15} color={c.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search tracks & questions…"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={{ flex: 1, paddingVertical: 9, color: c.fg, fontSize: 13.5 }}
          />
        </View>
      )}

      {/* Section jump bar — always visible above the long path; hidden while searching. */}
      {!query && (coreTracks.length > 0 || grouped.length > 1) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 6, paddingHorizontal: space.md, paddingVertical: 6 }}>
          {coreTracks.length > 0 && <SectionChip label="⭐ Your path" onPress={() => jumpToSection('core')} />}
          {grouped.map(({ g }) => (
            <SectionChip key={g} label={GROUP_LABEL[g]} onPress={() => jumpToSection(g)} />
          ))}
        </ScrollView>
      )}

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
          onContentSizeChange={(_w, hh) => setContentH(hh)}
          onScroll={(e) => {
            scrollSV.value = e.nativeEvent.contentOffset.y;
          }}>
          <View style={{ padding: space.md, gap: space.sm, paddingBottom: 130, paddingRight: 26 }}>
            {/* While searching, results REPLACE the home content (like Library search) — the
                hero/quests/plan sections hide so matches aren't buried under the default page. */}
            {!query && (
              <Fragment>
                <RoleHeader role={role} onPress={() => setShowSettings(true)} />
                {/* Autopilot owns the interview surface while a date is set; the old static
                    countdown card covers the dormant case (it renders null without a date). */}
                {autopilotOn ? (
                  <AutopilotPlanCard plan={plan} heroItemId={action.kind === 'autopilot' ? action.item?.id : undefined} />
                ) : (
                  <InterviewPlanCard dateIso={interviewDate} onStart={startDaily} />
                )}
                <CardEnter>
                  <ContinueHero action={action} />
                </CardEnter>
                <CardEnter>
                  {/* When the Autopilot hero IS the review item, treat it as 'review' so the strip
                      drops its Review pill — otherwise "Clear your due cards" shows three times
                      (hero + plan row + pill), three buttons for one action. */}
                  <DailyStrip
                    heroKind={action.kind === 'autopilot' && action.item?.kind === 'review' ? 'review' : action.kind}
                  />
                </CardEnter>
                <CardEnter delay={50}>
                  {/* Each quest opens the session that actually advances it: fresh stream for "review a
                      fresh card", a diagnostic deck for "finish a diagnostic", else the daily review queue. */}
                  <QuestStrip
                    onPressQuest={(qq) => {
                      if (qq.id === 'review-fresh') startFresh();
                      else if (qq.id === 'finish-diagnostic') startDiagnostic();
                      else startDaily();
                    }}
                  />
                </CardEnter>
                {!autopilotOn && (
                  <CardEnter delay={50}>
                    <PlanList />
                  </CardEnter>
                )}
                <CardEnter delay={50}>
                  <ContestBanner />
                </CardEnter>
              </Fragment>
            )}
            {/* Pinned "Your path": the role's headline tracks, in its registry priority order. */}
            {coreTracks.length > 0 && (
              <Fragment>
                <View onLayout={measureSection('core')}>
                  <H2 style={{ marginTop: 6 }}>⭐ Your {roleByKey(role)?.name ?? 'role'} path</H2>
                </View>
                {coreTracks.map(renderUnit)}
              </Fragment>
            )}
            {grouped.map(({ g, tracks }) => (
              <Fragment key={g}>
                <View onLayout={measureSection(g)}>
                  <H2 style={{ marginTop: 6 }}>{GROUP_LABEL[g]}</H2>
                </View>
                {tracks.map(renderUnit)}
              </Fragment>
            ))}
            {shown.length === 0 && query.length > 0 && <T muted size={13}>No tracks match “{q}”.</T>}
            {query.length >= 2 && (
              <View style={{ gap: 8 }}>
                <H2 style={{ marginTop: 6 }}>Questions</H2>
                {cardHits.length === 0 ? (
                  <T muted size={13}>No questions match “{q}”.</T>
                ) : (
                  cardHits.map((h) => {
                    const open = canOpen(h);
                    const col = trackColor(h.track.color);
                    return (
                      <Pressable
                        key={h.card.id}
                        accessibilityRole="button"
                        accessibilityLabel={open ? `Open question: ${h.card.q}` : `Pro question: ${h.card.q}`}
                        onPress={() => openHit(h)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          padding: 12,
                          backgroundColor: c.card,
                          borderColor: c.border,
                          borderWidth: 1,
                          borderRadius: radius.md,
                        }}>
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            backgroundColor: col + '29',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <T size={14}>{h.track.icon}</T>
                        </View>
                        <View style={{ flex: 1 }}>
                          <T size={13} weight="600" style={{ lineHeight: 17 }} numberOfLines={2}>
                            {h.card.q}
                          </T>
                          <T muted size={11} weight="700" style={{ marginTop: 2 }}>
                            {h.track.name}
                            {h.card.level ? ` · ${h.card.level}` : ''}
                          </T>
                        </View>
                        {open ? (
                          <T muted weight="800">›</T>
                        ) : (
                          <T weight="800" size={10} color={trackColor('rag')}>Pro</T>
                        )}
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
            {shown.length === 0 && query.length === 0 && userLevel && (
              <View style={{ gap: 6, paddingVertical: 8 }}>
                <T weight="800" size={14}>No {levelLabel(userLevel)} topics for this role yet.</T>
                <T muted size={12.5} style={{ lineHeight: 18 }}>
                  Pick another level — or “All levels” — from your prep (tap “{role ? 'change ›' : 'Pick a role'}” above).
                </T>
              </View>
            )}
          </View>
        </ScrollView>
        <Scrollbar
          scrollSV={scrollSV}
          viewportH={viewportH}
          contentH={contentH}
          tracks={shown}
          trackY={trackY}
          onScrollTo={(y) => scrollRef.current?.scrollTo({ y, animated: false })}
        />
      </View>
      <SettingsSheet open={showSettings} onClose={() => setShowSettings(false)} />
      <StreakSheet open={showStreak} onClose={() => setShowStreak(false)} />
    </SafeAreaView>
  );
}

/**
 * Right-edge scrollbar with a DYNAMIC thumb (length ∝ viewport/content), draggable to
 * scroll, showing the current section's name (one horizontal line) while you drag.
 */
function Scrollbar({
  scrollSV,
  viewportH,
  contentH,
  tracks,
  trackY,
  onScrollTo,
}: {
  scrollSV: SharedValue<number>;
  viewportH: number;
  contentH: number;
  tracks: Track[];
  trackY: { current: Record<string, number> };
  onScrollTo: (y: number) => void;
}) {
  const { c } = useTheme();
  const [drag, setDrag] = useState<{ idx: number; top: number } | null>(null);

  const maxScroll = Math.max(0, contentH - viewportH);
  const ratio = contentH > 0 ? Math.min(1, viewportH / contentH) : 1;
  const barH = Math.max(1, viewportH - 12);
  const thumbH = Math.max(44, barH * ratio);
  const travel = Math.max(1, barH - thumbH);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: travel * Math.min(1, Math.max(0, maxScroll > 0 ? scrollSV.value / maxScroll : 0)) }],
  }));

  if (ratio >= 1 || maxScroll <= 0) return null; // nothing to scroll

  const onDrag = (fingerY: number) => {
    const t = Math.min(travel, Math.max(0, fingerY - thumbH / 2));
    const y = (t / travel) * maxScroll;
    onScrollTo(y);
    let idx = 0;
    for (let i = 0; i < tracks.length; i++) {
      const ty = trackY.current[tracks[i].slug];
      if (ty != null && ty <= y + 28) idx = i;
    }
    setDrag({ idx, top: t });
  };
  const pan = Gesture.Pan()
    .onBegin((e) => runOnJS(onDrag)(e.y))
    .onUpdate((e) => runOnJS(onDrag)(e.y))
    .onFinalize(() => runOnJS(setDrag)(null));
  const tap = Gesture.Tap().onEnd((e) => runOnJS(onDrag)(e.y));

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 6, bottom: 6 }}>
      {drag && tracks[drag.idx] && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 24,
            top: Math.max(0, drag.top + thumbH / 2 - 16),
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: c.navy,
            borderRadius: 9,
            paddingVertical: 7,
            paddingHorizontal: 12,
          }}>
          <T size={14}>{tracks[drag.idx].icon}</T>
          <T size={13} weight="800" color="#fff">
            {tracks[drag.idx].name}
          </T>
        </View>
      )}
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 22, alignItems: 'center', justifyContent: 'flex-start' }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, width: 4, borderRadius: 2, backgroundColor: c.border, opacity: 0.4 }} />
          <Animated.View style={[{ width: 6, height: thumbH, borderRadius: 3, backgroundColor: drag ? c.fg : c.muted }, thumbStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
}

/** A compact pill in the jump bar — scrolls the path to its section. */
function SectionChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Jump to ${label}`}
      style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 }}>
      <T weight="800" size={11.5}>{label}</T>
    </Pressable>
  );
}

function Streak() {
  const streak = useStore((st) => st.streak);
  const xp = useStore((st) => st.xp);
  return (
    <Row style={{ gap: 8 }}>
      <Row style={{ gap: 3 }}>
        <Icon name="streak" size={15} color="#f76707" />
        <T weight="800" size={14} color="#f76707">{streak}</T>
      </Row>
      <View style={{ backgroundColor: '#4263eb', borderRadius: 9, paddingHorizontal: 7, height: 24, justifyContent: 'center' }}>
        <T color="#fff" weight="800" size={11}>Lv {level(xp)}</T>
      </View>
    </Row>
  );
}

function Header({
  onMenu,
  onSearch,
  onStreak,
  searchOpen,
}: {
  onMenu: () => void;
  onSearch: () => void;
  onStreak: () => void;
  searchOpen: boolean;
}) {
  const { c } = useTheme();
  const xp = useStore((st) => st.xp);
  const streak = useStore((st) => st.streak);
  const freezes = useStore((st) => st.freezes);
  const cardsToday = useStore((st) => st.cardsToday);
  const dailyGoal = useStore((st) => st.dailyGoal);
  const devMode = useStore((st) => st.devMode);
  const setDevMode = useStore((st) => st.setDevMode);
  const goalMet = cardsToday >= dailyGoal;
  const xpPct = Math.max(0, Math.min(1, xpInLevel(xp) / 1000));
  return (
    <View
      style={{
        paddingTop: 8,
        paddingHorizontal: space.md,
        paddingBottom: 10,
        backgroundColor: c.card,
        borderBottomColor: c.border,
        borderBottomWidth: 1,
      }}>
      <Row style={{ gap: 10 }}>
        <T size={17} weight="800">
          Byte<T color="#f76707" weight="800" size={17}>Shards</T>
        </T>
        <View style={{ flex: 1 }} />
        {/* The whole streak cluster is tappable → StreakSheet (freezes, rest days, daily goal). */}
        <PressableScale
          onPress={onStreak}
          hapticStyle="selection"
          scaleTo={0.96}
          accessibilityLabel="Streak details — freezes, rest days and daily goal">
          <Row style={{ gap: 8 }}>
            {freezes > 0 && (
              <Row style={{ gap: 3 }}>
                <Icon name="freeze" size={14} color="#4dabf7" />
                <T weight="800" size={13} color="#4dabf7">{freezes}</T>
              </Row>
            )}
            {/* Hide the demotivating "🔥 0" — only celebrate a live streak. */}
            {streak > 0 && (
              <Row style={{ gap: 3 }}>
                <Icon name="streak" size={15} color="#f76707" />
                <CountUp to={streak} style={{ fontWeight: '800', fontSize: 14, color: '#f76707' }} />
              </Row>
            )}
            <Row style={{ gap: 3 }}>
              <Icon name="goal" size={14} color={goalMet ? c.success : c.muted} />
              <T weight="800" size={13} color={goalMet ? c.success : c.muted}>
                {/* "cards" disambiguates this from the Daily Quests 0/3 counter below. */}
                {goalMet ? 'Done' : `${cardsToday}/${dailyGoal} cards`}
              </T>
            </Row>
          </Row>
        </PressableScale>
        {/* Level as a circular coin with a ring — reads as a "level badge", not a mystery bar.
            A thin fill at the base shows XP progress toward the next level. */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#4263eb',
            borderWidth: 2,
            borderColor: '#91a7ff',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
          <T color="rgba(255,255,255,0.85)" weight="900" style={{ fontSize: 6.5, letterSpacing: 0.5, lineHeight: 8 }}>LV</T>
          <CountUp to={level(xp)} style={{ color: '#fff', fontWeight: '900', fontSize: 12.5, lineHeight: 14 }} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)' }}>
            <View style={{ height: 3, width: `${xpPct * 100}%`, backgroundColor: '#fff' }} />
          </View>
        </View>
        {/* Dev-only: flip the whole Learn path between the curated User view and the full Dev view.
            `__DEV__`-gated so it never renders (and can never engage) in a production build. */}
        {__DEV__ && (
          <Pressable
            onPress={() => setDevMode(!devMode)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={devMode ? 'Dev mode on — tap for user view' : 'User view — tap for dev mode'}>
            <View
              style={{
                backgroundColor: devMode ? '#e8453c' : 'transparent',
                borderColor: devMode ? '#e8453c' : c.border,
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 7,
                height: 24,
                justifyContent: 'center',
              }}>
              <T color={devMode ? '#fff' : c.muted} weight="900" size={10}>{devMode ? 'DEV' : 'USER'}</T>
            </View>
          </Pressable>
        )}
        <Pressable onPress={onSearch} hitSlop={8} accessibilityRole="button" accessibilityLabel={searchOpen ? 'Hide search' : 'Search tracks and questions'}>
          <Icon name="search" size={18} color={searchOpen ? '#f76707' : c.muted} />
        </Pressable>
        <Pressable onPress={onMenu} hitSlop={8} accessibilityRole="button" accessibilityLabel="Role and prep settings">
          <T weight="900" size={18} color={c.muted}>⋯</T>
        </Pressable>
      </Row>
    </View>
  );
}

/** A tappable "studying as <role>" line above the path; opens the role/settings panel. */
function RoleHeader({ role, onPress }: { role: string; onPress: () => void }) {
  const { c } = useTheme();
  const userLevel = useStore((s) => s.userLevel);
  const def = roleByKey(role);
  // Prefix the chosen seniority (Junior/Mid/Senior) to the role — e.g. "Junior Data Engineer".
  // Skip it for the catch-all "all" role ("Senior Explore all tracks" makes no sense) and when no level is set.
  const name = def?.name ?? 'Pick a role';
  const titled = def && role !== 'all' && userLevel ? `${levelLabel(userLevel)} ${name}` : name;
  // "Preparing as Explore all tracks" reads broken — the catch-all gets its own phrasing.
  const heading = role === 'all' ? 'Exploring all tracks' : `Preparing as ${titled}`;
  return (
    <PressableScale onPress={onPress} hapticStyle="selection" scaleTo={0.99} accessibilityLabel={`${heading} — change role, level, or goal`}>
      <Row style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
        <Row style={{ gap: 6, flex: 1 }}>
          <T size={15}>{def?.emoji ?? '🎯'}</T>
          <T weight="800" size={13}>{heading}</T>
        </Row>
        <T weight="800" size={12} color={c.muted}>change ›</T>
      </Row>
    </PressableScale>
  );
}

/** Pinned FREE Stage-0 primer entry — basics for the role's core tracks. Hides once complete. */
/** The single best "what do I do now" — drives the one dominant ContinueHero. */
type NextAction = {
  kind: 'lesson' | 'review' | 'basics' | 'autopilot';
  /** Autopilot only: the plan item the hero starts. */
  item?: PlanItem;
  eyebrow: string;
  title: string;
  sub: string;
  icon: string;
  frac: number; // hero progress fill 0..1 (0 = no bar)
  colorKind: 'track' | 'navy' | 'success';
  colorKey?: string; // track color key when colorKind === 'track'
  slug?: string;
  idx?: number;
};

/** Pick the highest-priority next step: resume → review → fundamentals → begin.
 *  For Senior+ users the fundamentals primer DEMOTES below starting a real track (#6/#10) —
 *  "Start here · Fundamentals" stops being the dominant hero for people past it. */
function nextAction(role: string, progress: Record<string, CardState>, due: number, userLevel: Level | null): NextAction {
  const tracks = tracksForRole(role);
  const seniorPlus = userLevel != null && levelIndex(userLevel) >= 2; // Sr / Staff / Principal
  // 1. Resume the first in-progress track at its next incomplete lesson.
  for (const t of tracks) {
    const count = lessonCount(t.slug);
    if (count === 0) continue;
    const statuses = Array.from({ length: count }, (_, i) => lessonStatus(t.slug, i, progress));
    const doneCount = statuses.filter((s) => s.done).length;
    if (doneCount > 0 && doneCount < count) {
      // Resume AT THE USER'S LEVEL too (#10) — a Principal who just did lesson 12 shouldn't be
      // steered back to "Fundamentals · Lesson 1". No level set → first incomplete (unchanged).
      const idx = firstLessonAtLevel(t.slug, userLevel, progress);
      return {
        kind: 'lesson', eyebrow: 'Continue',
        title: `${t.name} · ${lessonTitle(t.slug, idx)}`,
        sub: `Lesson ${idx + 1} of ${count}`,
        icon: t.icon, frac: doneCount / count, colorKind: 'track', colorKey: t.color, slug: t.slug, idx,
      };
    }
  }
  // 2. Spaced review, if anything is due.
  if (due > 0) {
    return { kind: 'review', eyebrow: 'Due today', title: "Today's review", sub: `${due} card${due === 1 ? '' : 's'} due`, icon: '📚', frac: 0, colorKind: 'navy' };
  }
  // 3. Fundamentals primer (Jr/Mid only here — Senior+ gets it as optional review after a real start).
  const basics = basicsForRole(role);
  const basicsSeen = basics.filter((cd) => (progress[cd.id]?.reps ?? 0) > 0).length;
  const basicsLeft = basics.length > 0 && basicsSeen < basics.length;
  if (basicsLeft && !seniorPlus) {
    return { kind: 'basics', eyebrow: 'Start here', title: 'Fundamentals', sub: `The basics first · ${basicsSeen}/${basics.length}`, icon: '🌱', frac: basicsSeen / basics.length, colorKind: 'success' };
  }
  // 3.5 Curated spine (#4): the role's "do these first" sequence drives what starts next.
  const spine = nextSpineStep(role, progress, userLevel);
  if (spine) {
    const tdef = trackBySlug(spine.step.track);
    if (tdef) {
      return {
        kind: 'lesson',
        eyebrow: spine.index === 0 ? 'Start here' : 'Recommended next',
        title: `${tdef.name} · ${lessonTitle(spine.step.track, spine.lessonIdx)}`,
        sub: spine.step.label ?? `Step ${spine.index + 1} of your plan`,
        icon: tdef.icon, frac: 0, colorKind: 'track', colorKey: tdef.color, slug: spine.step.track, idx: spine.lessonIdx,
      };
    }
  }
  // 4. Nothing in progress, nothing due → begin the role's first track AT THE USER'S LEVEL (#10).
  const first = tracks[0];
  if (first) {
    const count = lessonCount(first.slug);
    const idx = firstLessonAtLevel(first.slug, userLevel, progress);
    const levelled = userLevel != null && idx > 0;
    return {
      kind: 'lesson',
      eyebrow: 'Start',
      title: `${first.name} · ${lessonTitle(first.slug, idx)}`,
      sub: levelled ? `Starts at ${levelLabel(userLevel)} · earlier lessons stay open` : `Lesson ${idx + 1} of ${count}`,
      icon: first.icon, frac: 0, colorKind: 'track', colorKey: first.color, slug: first.slug, idx,
    };
  }
  // 5. Senior+ fallback: nothing real to start → fundamentals as optional review.
  if (basicsLeft) {
    return { kind: 'basics', eyebrow: 'Optional review', title: 'Review fundamentals', sub: `Skim the basics · ${basicsSeen}/${basics.length}`, icon: '🌱', frac: basicsSeen / basics.length, colorKind: 'success' };
  }
  // Fallback (role with no tracks) → review.
  return { kind: 'review', eyebrow: 'Practice', title: "Today's review", sub: 'A quick session', icon: '📚', frac: 0, colorKind: 'navy' };
}

/** The ONE dominant card: the smart next action, filled in its action color. */
function ContinueHero({ action: a }: { action: NextAction }) {
  const { c, track } = useTheme();
  const startLesson = useStore((s) => s.startLesson);
  const startDaily = useStore((s) => s.startDaily);
  const startBasics = useStore((s) => s.startBasics);
  const startPlanItem = useStartPlanItem();
  const heroPulse = useStore((s) => s.heroPulse);
  const clearHeroPulse = useStore((s) => s.clearHeroPulse);
  const reduced = useReducedMotion();
  // Post-onboarding one-shot: a gentle breathing scale so the first next-action is unmissable.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (heroPulse && !reduced) {
      pulse.value = withRepeat(withTiming(1.022, { duration: 850 }), -1, true);
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [heroPulse, reduced, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const color = a.colorKind === 'navy' ? c.navy : a.colorKind === 'success' ? c.success : track(a.colorKey ?? 'spark');
  const onPress = () => {
    clearHeroPulse();
    if (a.kind === 'autopilot' && a.item) startPlanItem(a.item);
    else if (a.kind === 'lesson' && a.slug != null && a.idx != null) startLesson(a.slug, a.idx);
    else if (a.kind === 'review') startDaily();
    else startBasics();
  };
  return (
    <Animated.View style={pulseStyle}>
    <PressableScale onPress={onPress} sound>
      <View style={{ borderRadius: radius.lg, padding: 16, backgroundColor: color, overflow: 'hidden' }}>
        <Row style={{ gap: 13 }}>
          <View style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <T size={25}>{a.icon}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T color="rgba(255,255,255,0.82)" weight="900" size={10.5} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>{a.eyebrow}</T>
            <T color="#fff" weight="800" size={15.5} style={{ marginTop: 2 }}>{a.title}</T>
            <T color="rgba(255,255,255,0.82)" size={12} style={{ marginTop: 1 }}>{a.sub}</T>
          </View>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
            <T color="#fff" weight="900" size={15}>▶</T>
          </View>
        </Row>
        {a.frac > 0 && (
          <View style={{ marginTop: 13 }}>
            <AnimatedProgressBar value={a.frac} color="#fff" track="rgba(255,255,255,0.28)" height={6} />
          </View>
        )}
      </View>
    </PressableScale>
    </Animated.View>
  );
}

/**
 * Curated "do these first" plan (#4) — the role's spine chunked into days, collapsible.
 * The current step is the same target the ContinueHero recommends; rows are tappable.
 */
function PlanList() {
  const { c, track: trackColor } = useTheme();
  const role = useStore((s) => s.role);
  const progress = useStore((s) => s.progress);
  const userLevel = useStore((s) => s.userLevel);
  const startLesson = useStore((s) => s.startLesson);
  const [open, setOpen] = useState(false);
  const days = spineDays(role, progress);
  const flat = days.flatMap((d) => d.steps);
  if (flat.length === 0) return null;
  const doneCount = flat.filter((s) => s.done).length;
  const currentIdx = flat.findIndex((s) => !s.done);
  const allDone = currentIdx === -1;
  return (
    <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md }}>
      <PressableScale onPress={() => setOpen((o) => !o)} hapticStyle="selection" scaleTo={0.99}
        accessibilityLabel={`Your ${days.length}-day plan — ${doneCount} of ${flat.length} steps done. ${open ? 'Collapse' : 'Expand'}`}>
        <Row style={{ padding: 12, gap: 10 }}>
          <T size={18}>🗺️</T>
          <View style={{ flex: 1 }}>
            <T weight="800" size={13.5}>Your {days.length}-day plan</T>
            <T muted size={11.5}>
              {allDone ? 'Plan complete — review keeps it sharp' : `${doneCount}/${flat.length} steps · the proven order for this role`}
            </T>
          </View>
          <T weight="900" size={13} color={c.muted}>{open ? '▾' : '▸'}</T>
        </Row>
      </PressableScale>
      {open && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 6 }}>
          {days.map(({ day, steps }) => (
            <Fragment key={day}>
              <T muted weight="800" size={10.5} style={{ letterSpacing: 0.4, marginTop: 4 }}>DAY {day}</T>
              {steps.map((s, i) => {
                const flatIdx = (day - 1) * 2 + i;
                const isCurrent = flatIdx === currentIdx;
                const col = trackColor(trackBySlug(s.track)?.color ?? 'spark');
                return (
                  <Pressable
                    key={`${s.track}-${flatIdx}`}
                    disabled={s.done}
                    onPress={() => startLesson(s.track, firstLessonAtLevel(s.track, userLevel, progress))}
                    accessibilityLabel={`${s.label ?? s.name} — ${s.done ? 'done' : `${s.seen} of ${s.quota} cards`}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 9,
                      borderWidth: 1,
                      borderColor: isCurrent ? col : c.border,
                      borderRadius: radius.sm,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      opacity: s.done ? 0.55 : 1,
                      backgroundColor: isCurrent ? col + '12' : 'transparent',
                    }}>
                    <T size={12} weight="900" color={s.done ? c.success : isCurrent ? col : c.muted}>
                      {s.done ? '✓' : isCurrent ? '▶' : '○'}
                    </T>
                    <View style={{ flex: 1 }}>
                      <T size={12.5} weight={isCurrent ? '800' : '700'}>{s.label ?? s.name}</T>
                      {s.label ? <T muted size={10.5}>{s.name}</T> : null}
                    </View>
                    <T muted size={11} weight="800">{s.seen}/{s.quota}</T>
                  </Pressable>
                );
              })}
            </Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

/** Weekly contest entry — a ranked, timed round; the countdown is days left this week. */
function ContestBanner() {
  const { c, track } = useTheme();
  const role = useStore((s) => s.role);
  // Recompute the countdown when the tab regains focus — this banner can stay mounted across a
  // UTC week-boundary, and a stale number here disagreed with the contest page's fresh one.
  const [, setTick] = useState(0);
  useFocusEffect(useCallback(() => setTick((n) => n + 1), []));
  // The contest reuses the mock deck — a role with no auto-gradable cards (e.g. Project Manager)
  // can't enter, so don't advertise "Enter ▶" into a dead-end.
  const canEnter = useMemo(() => hasMockDeck(role), [role]);
  if (!canEnter) return null;
  const days = daysLeftInWeek();
  return (
    <PressableScale onPress={() => router.push('/contest')} sound>
      <Row style={{ gap: 10, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 13, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
        <T size={20}>⚡</T>
        <View style={{ flex: 1 }}>
          <T weight="800" size={13.5}>Weekly contest</T>
          <T muted size={11.5}>Ranked timed round · closes in {days}d</T>
        </View>
        <T weight="900" size={12.5} color={track('rag')}>Enter ▶</T>
      </Row>
    </PressableScale>
  );
}

/** Quiet secondary shelf: small Review / Stay-current pills (the hero's action is omitted). */
function DailyStrip({ heroKind }: { heroKind: NextAction['kind'] }) {
  const { c, track } = useTheme();
  const role = useStore((s) => s.role);
  const progress = useStore((s) => s.progress);
  const due = useStore((s) => s.sessionMeta.due);
  const startDaily = useStore((s) => s.startDaily);
  const startFresh = useStore((s) => s.startFresh);
  const unlocked = useStore(isProActive);
  // "Stay current" stays VISIBLE whenever the role has any live fresh cards — it's a permanent place to
  // review what shipped (manual or auto adds land here). The badge counts only the NEW (unseen) ones.
  const freshDeck = freshSessionCardsForRole(role, Date.now());
  const freshUnseen = freshDeck.filter((cd) => (progress[cd.id]?.reps ?? 0) === 0).length;
  const pills: { key: string; icon: string; label: string; n: number; onPress: () => void; color: string; pro?: boolean; a11y?: string }[] = [];
  if (heroKind !== 'review') pills.push({ key: 'review', icon: '📚', label: 'Review', n: due, onPress: startDaily, color: c.navy });
  // "Stay current" full stream is Pro (subscription). Locked → route to the paywall instead of the deck;
  // an explicit PRO chip (not just the small 🔒) says so before the tap.
  if (freshDeck.length > 0)
    pills.push({
      key: 'fresh',
      icon: unlocked ? '🆕' : '🔒',
      label: 'Stay current',
      n: unlocked ? freshUnseen : 0,
      onPress: unlocked ? startFresh : () => router.push('/paywall'),
      color: track('rag'),
      pro: !unlocked,
      a11y: unlocked ? 'Stay current — review fresh cards' : 'Stay current — Pro feature, opens the paywall',
    });
  if (pills.length === 0) return null;
  return (
    <Row style={{ gap: space.sm }}>
      {pills.map((p) => (
        <PressableScale key={p.key} onPress={p.onPress} style={{ flex: 1 }} accessibilityLabel={p.a11y ?? p.label}>
          <Row style={{ gap: 8, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
            <T size={15}>{p.icon}</T>
            <T weight="800" size={12.5} style={{ flex: 1 }}>{p.label}</T>
            {p.pro && (
              <View style={{ backgroundColor: p.color, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 }}>
                <T color="#fff" weight="900" size={9}>PRO</T>
              </View>
            )}
            {p.n > 0 && (
              <View style={{ minWidth: 21, height: 21, borderRadius: 11, paddingHorizontal: 6, backgroundColor: p.color, alignItems: 'center', justifyContent: 'center' }}>
                <T color="#fff" weight="900" size={10.5}>{p.n}</T>
              </View>
            )}
          </Row>
        </PressableScale>
      ))}
    </Row>
  );
}

/**
 * Role picker + goal + feel toggles, presented as a glassmorphic (iOS-style frosted) bottom
 * sheet — opened from the ⋯ menu or the role header. The BlurView frosts the screen behind it
 * (real UIVisualEffect material on iOS, dimezisBlurView on Android).
 */
function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const s = useStore();
  const dark = scheme === 'dark';
  const [roleQ, setRoleQ] = useState('');
  // Swipe-down-to-dismiss: the pan is bound to the grabber (handle + header) only, so it never
  // fights the inner ScrollView. Drag past ~110px → close; otherwise spring back.
  const ty = useSharedValue(0);
  const grab = Gesture.Pan()
    .onUpdate((e) => {
      ty.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 110) runOnJS(onClose)();
      ty.value = withSpring(0, { damping: 18, stiffness: 160 });
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Light scrim so the frosted glass reads as glass; tap-outside dismisses.
          On web, RN Modal fills the whole window, so center the sheet to the phone-frame width. */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.22)', justifyContent: 'flex-end', ...(isWeb && { alignItems: 'center' }) }}
        onPress={onClose}>
        {/* Inner Pressable swallows taps so tapping the sheet itself doesn't dismiss. */}
        <Pressable onPress={() => {}} style={{ maxHeight: '85%', ...(isWeb && { width: '100%', maxWidth: 440 }) }}>
          <Animated.View style={sheetStyle}>
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
            {/* Grabber zone — the handle + title row; dragging here dismisses the sheet. */}
            <GestureDetector gesture={grab}>
              <View>
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
                  <T weight="800" size={17}>Your prep</T>
                  <Pressable onPress={onClose} hitSlop={10}>
                    <T weight="800" size={14} color="#4263eb">Done</T>
                  </Pressable>
                </Row>
              </View>
            </GestureDetector>
            <ScrollView
              showsVerticalScrollIndicator
              indicatorStyle={dark ? 'white' : 'black'}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              // A definite numeric height makes the inner list actually scroll (a %/flex height
              // inside a Modal doesn't establish a scroll viewport on web — the list was getting clipped).
              style={{ maxHeight: winH * 0.66 }}
              contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
              {/* Goal first — a quick toggle, no scrolling past 40 roles to reach it. */}
              <T weight="800" size={12.5}>Goal</T>
              <Segmented
                options={[
                  { label: '🎯 Cram', value: 'cram' },
                  { label: '🧭 Maintain', value: 'maintain' },
                ]}
                value={s.mode}
                onChange={(v) => s.setMode(v as never)}
              />
              {/* Difficulty level — scopes BOTH which tracks show on Home and which questions appear in sessions. */}
              <T weight="800" size={12.5} style={{ marginTop: 4 }}>Level</T>
              <LevelPicker options={LEVEL_OPTIONS} value={s.userLevel} onChange={(v) => s.setUserLevel(v)} />
              <T muted size={11}>Filters your tracks and questions to that seniority. “All levels” shows everything.</T>
              <T weight="800" size={12.5} style={{ marginTop: 4 }}>I&apos;m preparing as</T>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
                  borderRadius: radius.md,
                  paddingHorizontal: 11,
                }}>
                <Icon name="search" size={15} color={c.muted} />
                <TextInput
                  value={roleQ}
                  onChangeText={setRoleQ}
                  placeholder="Search roles…"
                  placeholderTextColor={c.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  style={{ flex: 1, paddingVertical: 8, color: c.fg, fontSize: 13.5 }}
                />
              </View>
              <RolePicker value={s.role} onChange={(v) => s.setRole(v)} query={roleQ} />

              {/* Interview Autopilot entry — jd.tsx owns the date input + validation. */}
              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/jd' as Href);
                }}
                accessibilityRole="button"
                accessibilityLabel="Interview Autopilot — set or change your interview date">
                <Row
                  style={{
                    gap: 9,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
                    borderRadius: radius.md,
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    marginTop: 4,
                  }}>
                  <T size={16}>🛬</T>
                  <View style={{ flex: 1 }}>
                    <T weight="800" size={13}>Interview Autopilot</T>
                    <T muted size={11}>
                      {s.interviewDate ? `Planning toward ${s.interviewDate}` : 'Set your interview date → a day-by-day plan'}
                    </T>
                  </View>
                  <T weight="800" size={13} color={c.muted}>›</T>
                </Row>
              </Pressable>
            </ScrollView>
          </BlurView>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function lessonStatus(slug: string, idx: number, progress: Record<string, CardState>) {
  // Read the lesson's ACTUAL card ids (not reconstructed `${slug}-${i}`) so stay-current cards that
  // keep their stable `fresh-…` id still count toward Path progress/unlock.
  const slice = lessonDeck(slug, idx);
  const total = slice.length;
  const seen = slice.filter((cd) => (progress[cd.id]?.reps ?? 0) > 0).length;
  return { seen, total, done: total > 0 && seen === total };
}

/** Pulsing halo behind the current node (microinteraction). */
function PulseRing({ color }: { color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 1500 }), -1, false);
  }, [v]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + v.value * 0.45 }],
    opacity: 0.55 * (1 - v.value),
  }));
  // Anchored to overlay the 52×52 node it sits inside (1px overhang, scales from centre).
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: -1, left: -1, width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: color },
        style,
      ]}
    />
  );
}

/** A unit = a collapsible track: a tappable header that expands into a winding, titled trail. */
function Unit({
  track: t,
  progress,
  open,
  onToggle,
}: {
  track: Track;
  progress: Record<string, CardState>;
  open: boolean;
  onToggle: () => void;
}) {
  const { c, track } = useTheme();
  const startLesson = useStore((s) => s.startLesson);
  const checkpointsDone = useStore((s) => s.checkpointsDone);
  const dev = useStore(isDev);
  const reduced = useReducedMotion();
  const [shake, setShake] = useState<{ i: number; n: number }>({ i: -1, n: 0 });
  const [peek, setPeek] = useState<number | null>(null);
  // Chevron eases from ▸ to ▾ as the unit opens (subtle, no bounce).
  const chev = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    chev.value = reduced ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 180 });
  }, [open, reduced, chev]);
  const chevStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chev.value * 90}deg` }] }));
  const col = track(t.color);
  const cards = trackCardCount(t.slug);
  const count = lessonCount(t.slug);
  const statuses = Array.from({ length: count }, (_, i) => lessonStatus(t.slug, i, progress));
  const firstIncomplete = statuses.findIndex((s) => !s.done);
  const current = firstIncomplete === -1 ? count : firstIncomplete;
  const doneCount = statuses.filter((s) => s.done).length;
  const pct = count ? doneCount / count : 0;
  // User view reveals only up to the NEXT stage (current + 1) to build anticipation; Dev view shows all.
  const lastVisible = dev ? count - 1 : Math.min(count - 1, current + 1);
  const hidden = count - (lastVisible + 1);
  const visible = statuses.slice(0, lastVisible + 1);

  return (
    <View style={{ marginBottom: open ? 12 : 8 }}>
      <PressableScale
        onPress={onToggle}
        hapticStyle="selection"
        scaleTo={0.985}
        accessibilityLabel={`${t.name} — ${doneCount} of ${count} lessons done, ${cards} cards. ${open ? 'Collapse' : 'Expand'}`}>
        <Row style={{ backgroundColor: c.card, borderWidth: 1, borderColor: open ? col : c.border, borderRadius: radius.md, padding: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
            <T size={19}>{t.icon}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T weight="800" size={15}>{t.name}</T>
            <T muted size={11.5}>{doneCount}/{count} lessons · {cards} cards</T>
          </View>
          {doneCount === count && count > 0 ? (
            <T size={18} color={c.success}>✓</T>
          ) : doneCount > 0 ? (
            <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
              <T size={9.5} weight="900" color={col}>{Math.round(pct * 100)}%</T>
            </View>
          ) : null}
          <Animated.View style={[chevStyle, { marginLeft: 6 }]}>
            <T weight="900" size={15} color={c.muted}>▸</T>
          </Animated.View>
        </Row>
      </PressableScale>
      {open && (
      <View style={{ paddingVertical: 8 }}>
        {visible.map((st, i) => {
          const locked = !dev && i > current;
          const isCurrent = i === current && i < count;
          const off = i % 2 === 0 ? -22 : 22; // gentle wind; small enough to stay connected
          const title = lessonTitle(t.slug, i);
          const titleOnRight = off < 0;
          const peekable = !locked; // unlocked stages can reveal their question list inline
          // Chapter "boss" checkpoint after every CHAPTER_SIZE lessons (plan #25).
          const chapterIdx = Math.floor(i / CHAPTER_SIZE);
          const isChapterEnd = (i + 1) % CHAPTER_SIZE === 0 && chapterIdx < checkpointCount(t.slug);
          const chapterStart = chapterIdx * CHAPTER_SIZE;
          const chapterDone = statuses.slice(chapterStart, i + 1).every((s) => s.done);
          const cpKey = checkpointKey(t.slug, chapterIdx);
          const cpDone = checkpointsDone.includes(cpKey);
          return (
            <Fragment key={i}>
            <View style={{ alignItems: 'center' }}>
              {i > 0 && (
                <View
                  style={{
                    width: 4,
                    height: 16,
                    borderRadius: 2,
                    backgroundColor: i <= current ? col : c.border,
                    opacity: i <= current ? 1 : 0.55,
                  }}
                />
              )}
              <View style={{ width: '100%', height: 56, alignItems: 'center', justifyContent: 'center' }}>
                <Shake trigger={shake.i === i ? shake.n : 0}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Lesson ${i + 1}: ${title}${st.done ? ' — done' : locked ? ' — locked' : ''}`}
                  accessibilityState={{ disabled: locked }}
                  onPress={() => {
                    if (locked) {
                      // Locked → tell the user why with a shake + error buzz instead of a dead tap.
                      setShake((s) => ({ i, n: s.i === i ? s.n + 1 : 1 }));
                      haptic.error();
                      return;
                    }
                    haptic.light();
                    sfx.tap();
                    startLesson(t.slug, i);
                  }}
                  style={({ pressed }) => ({ transform: [{ translateX: off }, { scale: pressed ? 0.96 : 1 }] })}>
                  <View style={{ width: 52, height: 52 }}>
                    {isCurrent && <PulseRing color={col} />}
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: st.done ? col : isCurrent ? c.card : c.surface,
                        borderWidth: isCurrent ? 3 : locked ? 1 : 2,
                        borderColor: locked ? c.border : col,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: locked ? 0.55 : 1,
                        shadowColor: isCurrent ? col : '#000',
                        shadowOpacity: isCurrent ? 0.45 : 0.12,
                        shadowRadius: isCurrent ? 9 : 4,
                        shadowOffset: { width: 0, height: 2 },
                      }}>
                      <T size={18} weight="900" color={st.done ? '#fff' : locked ? c.muted : col}>
                        {st.done ? '✓' : locked ? '🔒' : i + 1}
                      </T>
                    </View>
                  </View>
                </Pressable>
                </Shake>

                <Pressable
                  onPress={() => peekable && setPeek((p) => (p === i ? null : i))}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${title} — ${peek === i ? 'hide' : 'show'} questions`}
                  style={{
                    position: 'absolute',
                    maxWidth: 132,
                    ...(titleOnRight ? { left: '50%', marginLeft: 20 } : { right: '50%', marginRight: 20 }),
                  }}>
                  <T
                    weight={isCurrent ? '800' : '700'}
                    size={12.5}
                    color={locked ? c.muted : isCurrent ? col : c.fg}
                    style={{ textAlign: titleOnRight ? 'left' : 'right' }}>
                    {title}
                    {peekable && <T size={10} color={c.muted}>{peek === i ? '  ⌄' : '  ›'}</T>}
                  </T>
                  {isCurrent && (
                    <T weight="900" size={10} color={col} style={{ textAlign: titleOnRight ? 'left' : 'right', marginTop: 1 }}>
                      START →
                    </T>
                  )}
                </Pressable>
              </View>

              {/* Inline preview: the actual questions inside this stage (self-documenting). */}
              {peek === i && peekable && (
                <CardEnter
                  style={{
                    width: '100%',
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: radius.md,
                    padding: 10,
                    marginTop: 2,
                    marginBottom: 4,
                    gap: 7,
                  }}>
                  {lessonDeck(t.slug, i).map((cd, k) => (
                    <Row key={cd.id} style={{ gap: 8, alignItems: 'flex-start' }}>
                      <T size={10} weight="900" color={col} style={{ minWidth: 14, marginTop: 1 }}>{k + 1}</T>
                      <T size={11.5} style={{ flex: 1 }} color={c.fg}>{cd.q}</T>
                      {cd.tag ? <T size={9.5} weight="800" color={c.muted}>{cd.tag}</T> : null}
                    </Row>
                  ))}
                </CardEnter>
              )}
            </View>
            {isChapterEnd && (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: cpDone ? col : c.border, opacity: cpDone ? 1 : 0.55 }} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={cpDone ? `Chapter ${chapterIdx + 1} cleared` : `Checkpoint, chapter ${chapterIdx + 1}${chapterDone || dev ? '' : ' — locked'}`}
                  accessibilityState={{ disabled: !(chapterDone || dev) }}
                  onPress={() => {
                    const available = chapterDone || dev;
                    if (!available) { haptic.error(); return; }
                    haptic.light();
                    sfx.tap();
                    router.push(`/checkpoint?slug=${t.slug}&chapter=${chapterIdx}` as Href);
                  }}
                  style={{ alignItems: 'center', paddingVertical: 6 }}>
                  <View
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 16,
                      transform: [{ rotate: '45deg' }],
                      backgroundColor: cpDone ? col : chapterDone || dev ? c.card : c.surface,
                      borderWidth: 3,
                      borderColor: chapterDone || dev ? col : c.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: chapterDone || dev ? 1 : 0.55,
                    }}>
                    <T size={20} style={{ transform: [{ rotate: '-45deg' }] }}>
                      {cpDone ? '🏆' : chapterDone || dev ? '🏁' : '🔒'}
                    </T>
                  </View>
                  <T weight="800" size={11} color={cpDone ? c.success : c.muted} style={{ marginTop: 8 }}>
                    {cpDone ? `Chapter ${chapterIdx + 1} cleared` : `Checkpoint · Chapter ${chapterIdx + 1}`}
                  </T>
                </Pressable>
              </View>
            )}
            </Fragment>
          );
        })}
        {/* User view hides the long tail — tease how much is ahead without revealing it. */}
        {!dev && hidden > 0 && (
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <T size={11} weight="700" color={c.muted}>🔒 {hidden} more {hidden === 1 ? 'stage' : 'stages'} ahead</T>
          </View>
        )}
      </View>
      )}
    </View>
  );
}
