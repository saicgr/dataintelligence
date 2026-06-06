import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  freshSessionCards,
  lessonDeck,
  lessonCount,
  lessonTitle,
  roleDomain,
  Track,
  trackCardCount,
  tracksForRole,
} from '../../lib/content';
import { basicsForRole } from '../../lib/basics';
import { GROUP_LABEL, GROUP_ORDER, roleByKey } from '../../lib/roles';
import { CardState } from '../../lib/srs';
import { isDev, level, useStore, xpInLevel } from '../../lib/store';
import { radius, space, useTheme } from '../../lib/theme';
import { haptic, sfx } from '../../lib/feedback';
import { AnimatedProgressBar, CardEnter, CountUp, PressableScale, Shake } from '../../ui/anim';
import { H2, Row, Segmented, T } from '../../ui/kit';
import { RolePicker } from '../../ui/RolePicker';
import { SessionView } from '../../ui/SessionView';

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
  const { c } = useTheme();
  const progress = useStore((st) => st.progress);
  const role = useStore((st) => st.role);
  const due = useStore((st) => st.sessionMeta.due);
  const [showSettings, setShowSettings] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const action = nextAction(role, progress, due);
  const scrollRef = useRef<ScrollView>(null);
  const trackY = useRef<Record<string, number>>({});
  const scrollSV = useSharedValue(0);
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);

  const query = q.trim().toLowerCase();
  const match = (t: Track) => !query || t.name.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query);
  // Role-filtered: only the selected role's tracks, grouped into Learn-path sections.
  const roleTracks = tracksForRole(role).filter(match);
  const grouped = GROUP_ORDER.map((g) => ({ g, tracks: roleTracks.filter((t) => t.group === g) })).filter(
    (x) => x.tracks.length > 0
  );
  const shown = grouped.flatMap((x) => x.tracks);

  // Collapsed by default — the Continue hero already surfaces the current lesson, so the
  // sections start tidy and expansion is user-driven (keeps the screen calm).
  const isOpen = (slug: string) => manual[slug] ?? false;
  const toggle = (slug: string) => setManual((m) => ({ ...m, [slug]: !(m[slug] ?? false) }));

  const measure = (slug: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    trackY.current[slug] = e.nativeEvent.layout.y;
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
          <T size={13} color={c.muted}>🔍</T>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search tracks…"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            clearButtonMode="while-editing"
            style={{ flex: 1, paddingVertical: 9, color: c.fg, fontSize: 13.5 }}
          />
        </View>
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
            <RoleHeader role={role} onPress={() => setShowSettings(true)} />
            <CardEnter>
              <ContinueHero action={action} />
            </CardEnter>
            <CardEnter delay={50}>
              <DailyStrip heroKind={action.kind} />
            </CardEnter>
            {grouped.map(({ g, tracks }, gi) => (
              <Fragment key={g}>
                <H2 style={{ marginTop: gi === 0 ? 6 : 6 }}>{GROUP_LABEL[g]}</H2>
                {tracks.map(renderUnit)}
              </Fragment>
            ))}
            {shown.length === 0 && <T muted size={13}>No tracks match “{q}”.</T>}
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

function Streak() {
  const streak = useStore((st) => st.streak);
  const xp = useStore((st) => st.xp);
  return (
    <Row style={{ gap: 8 }}>
      <T weight="800" size={14} color="#f76707">🔥 {streak}</T>
      <View style={{ backgroundColor: '#4263eb', borderRadius: 9, paddingHorizontal: 7, height: 24, justifyContent: 'center' }}>
        <T color="#fff" weight="800" size={11}>Lv {level(xp)}</T>
      </View>
    </Row>
  );
}

function Header({ onMenu, onSearch, searchOpen }: { onMenu: () => void; onSearch: () => void; searchOpen: boolean }) {
  const { c } = useTheme();
  const xp = useStore((st) => st.xp);
  const streak = useStore((st) => st.streak);
  const freezes = useStore((st) => st.freezes);
  const devMode = useStore((st) => st.devMode);
  const setDevMode = useStore((st) => st.setDevMode);
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
          Field<T color="#f76707" weight="800" size={17}>Notes</T>
        </T>
        <View style={{ flex: 1 }} />
        {freezes > 0 && <T weight="800" size={13} color="#4dabf7">🧊 {freezes}</T>}
        {/* Hide the demotivating "🔥 0" — only celebrate a live streak. */}
        {streak > 0 && (
          <Row style={{ gap: 2 }}>
            <T weight="800" size={14} color="#f76707">🔥</T>
            <CountUp to={streak} style={{ fontWeight: '800', fontSize: 14, color: '#f76707' }} />
          </Row>
        )}
        <View style={{ backgroundColor: '#4263eb', borderRadius: 10, paddingHorizontal: 8, height: 26, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }}>
          <T color="#fff" weight="800" size={11.5}>Lv </T>
          <CountUp to={level(xp)} style={{ color: '#fff', fontWeight: '800', fontSize: 11.5 }} />
        </View>
        {/* Dev-only: flip the whole Learn path between the curated User view and the full Dev view.
            `__DEV__`-gated so it never renders (and can never engage) in a production build. */}
        {__DEV__ && (
          <Pressable onPress={() => setDevMode(!devMode)} hitSlop={8}>
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
        <Pressable onPress={onSearch} hitSlop={8}>
          <T weight="900" size={15} color={searchOpen ? '#f76707' : c.muted}>🔍</T>
        </Pressable>
        <Pressable onPress={onMenu} hitSlop={8}>
          <T weight="900" size={18} color={c.muted}>⋯</T>
        </Pressable>
      </Row>
      <View style={{ marginTop: 8 }}>
        <AnimatedProgressBar value={xpInLevel(xp) / 1000} color="#f76707" track={c.border} height={8} />
      </View>
    </View>
  );
}

/** A tappable "studying as <role>" line above the path; opens the role/settings panel. */
function RoleHeader({ role, onPress }: { role: string; onPress: () => void }) {
  const { c } = useTheme();
  const def = roleByKey(role);
  return (
    <PressableScale onPress={onPress} hapticStyle="selection" scaleTo={0.99}>
      <Row style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
        <Row style={{ gap: 6, flex: 1 }}>
          <T size={15}>{def?.emoji ?? '🎯'}</T>
          <T weight="800" size={13}>Preparing as {def?.name ?? 'Pick a role'}</T>
        </Row>
        <T weight="800" size={12} color={c.muted}>change ›</T>
      </Row>
    </PressableScale>
  );
}

/** Pinned FREE Stage-0 primer entry — basics for the role's core tracks. Hides once complete. */
/** The single best "what do I do now" — drives the one dominant ContinueHero. */
type NextAction = {
  kind: 'lesson' | 'review' | 'basics';
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

/** Pick the highest-priority next step: resume → review → fundamentals → begin. */
function nextAction(role: string, progress: Record<string, CardState>, due: number): NextAction {
  const tracks = tracksForRole(role);
  // 1. Resume the first in-progress track at its next incomplete lesson.
  for (const t of tracks) {
    const count = lessonCount(t.slug);
    if (count === 0) continue;
    const statuses = Array.from({ length: count }, (_, i) => lessonStatus(t.slug, i, progress));
    const doneCount = statuses.filter((s) => s.done).length;
    if (doneCount > 0 && doneCount < count) {
      const idx = statuses.findIndex((s) => !s.done);
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
  // 3. Fundamentals primer, if not finished.
  const basics = basicsForRole(role);
  if (basics.length > 0) {
    const seen = basics.filter((cd) => (progress[cd.id]?.reps ?? 0) > 0).length;
    if (seen < basics.length) {
      return { kind: 'basics', eyebrow: 'Start here', title: 'Fundamentals', sub: `The basics first · ${seen}/${basics.length}`, icon: '🌱', frac: seen / basics.length, colorKind: 'success' };
    }
  }
  // 4. Nothing in progress, nothing due → begin the role's first track.
  const first = tracks[0];
  if (first) {
    const count = lessonCount(first.slug);
    return { kind: 'lesson', eyebrow: 'Start', title: `${first.name} · ${lessonTitle(first.slug, 0)}`, sub: `Lesson 1 of ${count}`, icon: first.icon, frac: 0, colorKind: 'track', colorKey: first.color, slug: first.slug, idx: 0 };
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
  const color = a.colorKind === 'navy' ? c.navy : a.colorKind === 'success' ? c.success : track(a.colorKey ?? 'spark');
  const onPress = () => {
    if (a.kind === 'lesson' && a.slug != null && a.idx != null) startLesson(a.slug, a.idx);
    else if (a.kind === 'review') startDaily();
    else startBasics();
  };
  return (
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
  const unlocked = useStore((s) => s.unlocked);
  // "Stay current" stays VISIBLE whenever the role has any live fresh cards — it's a permanent place to
  // review what shipped (manual or auto adds land here). The badge counts only the NEW (unseen) ones.
  const freshDeck = freshSessionCards(Date.now(), roleDomain(role));
  const freshUnseen = freshDeck.filter((cd) => (progress[cd.id]?.reps ?? 0) === 0).length;
  const pills: { key: string; icon: string; label: string; n: number; onPress: () => void; color: string }[] = [];
  if (heroKind !== 'review') pills.push({ key: 'review', icon: '📚', label: 'Review', n: due, onPress: startDaily, color: c.navy });
  // "Stay current" full stream is Pro (subscription). Locked → route to the paywall instead of the deck.
  if (freshDeck.length > 0)
    pills.push({
      key: 'fresh',
      icon: unlocked ? '🆕' : '🔒',
      label: 'Stay current',
      n: unlocked ? freshUnseen : 0,
      onPress: unlocked ? startFresh : () => router.push('/paywall'),
      color: track('rag'),
    });
  if (pills.length === 0) return null;
  return (
    <Row style={{ gap: space.sm }}>
      {pills.map((p) => (
        <PressableScale key={p.key} onPress={p.onPress} style={{ flex: 1 }}>
          <Row style={{ gap: 8, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
            <T size={15}>{p.icon}</T>
            <T weight="800" size={12.5} style={{ flex: 1 }}>{p.label}</T>
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
  const s = useStore();
  const dark = scheme === 'dark';
  const [roleQ, setRoleQ] = useState('');
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Light scrim so the frosted glass reads as glass; tap-outside dismisses. */}
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.22)', justifyContent: 'flex-end' }} onPress={onClose}>
        {/* Inner Pressable swallows taps so tapping the sheet itself doesn't dismiss. */}
        <Pressable onPress={() => {}} style={{ maxHeight: '85%' }}>
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
              <T weight="800" size={17}>Your prep</T>
              <Pressable onPress={onClose} hitSlop={10}>
                <T weight="800" size={14} color="#4263eb">Done</T>
              </Pressable>
            </Row>
            <ScrollView
              showsVerticalScrollIndicator
              indicatorStyle={dark ? 'white' : 'black'}
              keyboardShouldPersistTaps="handled"
              style={{ flexShrink: 1 }}
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
                <T size={13} color={c.muted}>🔍</T>
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
            </ScrollView>
          </BlurView>
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
      <PressableScale onPress={onToggle} hapticStyle="selection" scaleTo={0.985}>
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
          return (
            <View key={i} style={{ alignItems: 'center' }}>
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
