import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { daysUntil } from '../lib/cramPlan';
import { LEVELS, levelLabel, type Level } from '../lib/content';
import { haptic } from '../lib/feedback';
import { ROLES } from '../lib/roles';
import { Mode, useStore } from '../lib/store';
import { mono, radius, space, useTheme } from '../lib/theme';
import { CardEnter, Confetti, FollowUpCue } from '../ui/anim';
import { Btn, LevelPicker, Row, Segmented, T } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { RoleSelect } from '../ui/RoleSelect';

const ORANGE = '#f76707'; // bright brand orange — decorative fills only (hero band, dots). Text uses c.accentInk.
const STEPS = 4;

/**
 * Do-first first-run flow: short showcase → tailor (role + goal, so the demo can match) →
 * answer a REAL role-aware question → a short founder's note → in. "Skip intro" jumps to tailor
 * (never past the question). Notification permission is asked after the first lesson, not here.
 */
export default function Onboarding() {
  const { c } = useTheme();
  const router = useRouter();
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string>('de');
  const [mode, setMode] = useState<Mode>('cram');
  const [level, setLevel] = useState<Level>('Mid'); // Junior/Mid/Senior = Jr/Mid/Sr

  const finish = () => {
    complete(role, mode, level);
    router.replace('/'); // push permission is now primed after the first completed session, not here
  };

  const cta: Record<number, { label: string; onPress: () => void }> = {
    0: { label: 'See how it works →', onPress: () => setStep(1) },
    1: { label: 'Try a real one →', onPress: () => setStep(2) },
    2: { label: 'Build my path →', onPress: () => setStep(3) },
    3: { label: 'Start free →', onPress: finish },
  };

  // Floating "scroll for more" cue: shown only when content runs below the fold, and it
  // fades out the moment you reach the bottom. Reset to top on every step change.
  const scrollRef = useRef<ScrollView>(null);
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const moreBelow = contentH - viewH - scrollY > 28;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setScrollY(e.nativeEvent.contentOffset.y);
  const onView = (e: LayoutChangeEvent) => setViewH(e.nativeEvent.layout.height);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setScrollY(0);
  }, [step]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}>
      {/* Top bar: back · progress dots · skip */}
      <Row style={{ paddingHorizontal: space.md, paddingTop: 6, height: 34 }}>
        {step > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => setStep((s) => s - 1)} hitSlop={10}>
            <T size={15} weight="900" color={c.muted}>‹ Back</T>
          </Pressable>
        ) : (
          <View style={{ width: 64 }} />
        )}
        <View
          accessible
          accessibilityLabel={`Step ${step + 1} of ${STEPS}`}
          style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <Dot key={i} active={i === step} c={c} />
          ))}
        </View>
        {step < 1 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={() => setStep(1)} hitSlop={10}>
            <T size={13} weight="800" color={c.muted}>Skip intro</T>
          </Pressable>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </Row>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={onView}
        onContentSizeChange={(_w, h) => setContentH(h)}>
        <CardEnter key={step}>
          {step === 0 && <Showcase c={c} />}
          {step === 1 && <Tailor c={c} role={role} setRole={setRole} mode={mode} setMode={setMode} level={level} setLevel={setLevel} />}
          {step === 2 && <TryOne c={c} role={role} level={level} />}
          {step === 3 && <FounderNote c={c} />}
        </CardEnter>
      </ScrollView>

      {/* Floating scroll cue — pinned just above the CTA, fades out at the bottom. */}
      {moreBelow && (
        <Animated.View
          pointerEvents="none"
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(160)}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 80, alignItems: 'center' }}>
          <FollowUpCue compact color={c.onAccent} bg={c.accent} label="more below — scroll down" />
        </Animated.View>
      )}

      {/* Bottom CTA bar */}
      <View style={{ paddingHorizontal: space.lg, paddingBottom: 10, paddingTop: 6 }}>
        <Btn label={cta[step].label} variant="primary" onPress={cta[step].onPress} />
        {step === 3 && (
          <T muted size={11} style={{ textAlign: 'center', marginTop: 8 }}>
            Free to start · change your role anytime
          </T>
        )}
      </View>
    </SafeAreaView>
  );
}

type C = ReturnType<typeof useTheme>['c'];

/** Progress dot that smoothly widens when it becomes the active step (subtle, no bounce). */
function Dot({ active, c }: { active: boolean; c: C }) {
  const reduced = useReducedMotion();
  const w = useSharedValue(active ? 22 : 7);
  useEffect(() => {
    const to = active ? 22 : 7;
    w.value = reduced ? to : withTiming(to, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [active, reduced, w]);
  const st = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[{ height: 7, borderRadius: 4, backgroundColor: active ? ORANGE : c.border }, st]} />;
}

/** Gently floating mascot — bobs ~6px on a slow loop (alive, not bouncy). */
function FloatBadge() {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.value = withRepeat(withTiming(-6, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduced, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[st, { alignItems: 'center', justifyContent: 'center' }]}>
      <Mascot
        mood="idea"
        size={104}
        style={{ shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } }}
      />
    </Animated.View>
  );
}

/** Vertically-scrolling word carousel — cycles motivations so non-interviewers feel seen. */
function RotatingPhrase({ items, color }: { items: string[]; color: string }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((p) => (p + 1) % items.length), 2400);
    return () => clearInterval(id);
  }, [reduced, items.length]);
  return (
    <View style={{ height: 30, overflow: 'hidden', justifyContent: 'center', alignSelf: 'stretch' }}>
      <Animated.Text
        key={i}
        entering={reduced ? undefined : FadeInDown.duration(320).easing(Easing.out(Easing.cubic))}
        exiting={reduced ? undefined : FadeOutUp.duration(320).easing(Easing.in(Easing.cubic))}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ position: 'absolute', width: '100%', textAlign: 'center', fontSize: 21, fontWeight: '900', color }}>
        {items[i]}
      </Animated.Text>
    </View>
  );
}

/* ── Step 0: showcase what you get (wedge, not a pile) ─────────────────────── */
function Showcase({ c }: { c: C }) {
  const features = [
    { icon: '🧭', accent: '#4263eb', tint: 'rgba(66,99,235,0.10)', bd: 'rgba(66,99,235,0.28)', title: 'A path, not a pile', sub: 'Lessons tuned to your exact role — a sequence from fundamentals to mastery.' },
    { icon: '🔁', accent: ORANGE, tint: 'rgba(247,103,7,0.10)', bd: 'rgba(247,103,7,0.30)', title: 'Drills that test the why', sub: 'Cards that push past recognition to the reasoning interviewers actually probe.' },
    { icon: '🆕', accent: '#1a9e57', tint: 'rgba(26,158,87,0.10)', bd: 'rgba(26,158,87,0.28)', title: 'Stay current', sub: 'Fresh cards on Cortex, Bedrock, Vertex AI & agents — as they actually ship.' },
  ];
  return (
    <View style={{ gap: space.md }}>
      {/* Vibrant hero band: floating mascot + playful confetti shapes */}
      <View
        style={{
          borderRadius: 26,
          backgroundColor: ORANGE,
          paddingVertical: 24,
          alignItems: 'center',
          overflow: 'hidden',
          shadowColor: ORANGE,
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 5,
        }}>
        <View style={{ position: 'absolute', top: -26, right: -20, width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.14)' }} />
        <View style={{ position: 'absolute', bottom: -34, left: -22, width: 116, height: 116, borderRadius: 58, backgroundColor: 'rgba(255,255,255,0.10)' }} />
        <View style={{ position: 'absolute', top: 22, left: 24 }}><T size={15}>✨</T></View>
        <View style={{ position: 'absolute', bottom: 20, right: 28 }}><T size={14}>⚡️</T></View>
        <FloatBadge />
        <T size={10.5} weight="900" color="rgba(255,255,255,0.95)" style={{ letterSpacing: 1.6, marginTop: 14 }}>
          DATA &amp; AI · INTERVIEW PREP
        </T>
      </View>

      {/* Wordmark + rotating motivation + the WEDGE (not a volume pile) */}
      <View style={{ alignItems: 'center', gap: 5, marginTop: 2 }}>
        <T size={28} weight="900">
          Field<T size={28} weight="900" color={c.accentInk}>Notes</T>
        </T>
        <T size={11.5} weight="900" color={c.muted} style={{ letterSpacing: 1, marginTop: 2 }}>WHETHER YOU&apos;RE</T>
        <RotatingPhrase color={c.accentInk} items={['interviewing soon', 'breaking into Data/AI', 'staying current']} />
        <T size={14.5} weight="800" style={{ marginTop: 1 }}>FieldNotes gets you sharp.</T>
        <Row style={{ gap: 7, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, marginTop: 6 }}>
          <T size={11.5} weight="900" color={c.accentInk}>senior-level reasoning</T>
          <T size={11.5} weight="900" color={c.border}>•</T>
          <T size={11.5} weight="900" color="#1a9e57">refreshed weekly</T>
        </Row>
      </View>

      <View style={{ gap: 10, marginTop: 2 }}>
        {features.map((f, i) => (
          <CardEnter key={f.title} delay={140 + i * 90}>
            <Row style={{ gap: 13, backgroundColor: f.tint, borderWidth: 1, borderColor: f.bd, borderRadius: radius.lg, padding: 13, alignItems: 'center' }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: f.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: f.accent,
                  shadowOpacity: 0.45,
                  shadowRadius: 7,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 4,
                }}>
                <T size={22}>{f.icon}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T weight="900" size={15.5}>{f.title}</T>
                <T muted size={12.5} style={{ lineHeight: 18, marginTop: 2 }}>{f.sub}</T>
              </View>
            </Row>
          </CardEnter>
        ))}
      </View>
    </View>
  );
}

/* ── Step 1: tailor it (role + goal; the demo on the next step matches the role) ── */
function Tailor({ c, role, setRole, mode, setMode, level, setLevel }: { c: C; role: string; setRole: (r: string) => void; mode: Mode; setMode: (m: Mode) => void; level: Level; setLevel: (l: Level) => void }) {
  const interviewDate = useStore((s) => s.interviewDate);
  const setInterviewDate = useStore((s) => s.setInterviewDate);
  const [dateText, setDateText] = useState(interviewDate ?? '');
  const onDate = (v: string) => {
    setDateText(v);
    if (v.trim() === '') setInterviewDate(null);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim()) && daysUntil(v.trim()) != null) setInterviewDate(v.trim());
  };
  return (
    <View style={{ gap: space.lg, marginTop: 4 }}>
      <View style={{ gap: 5 }}>
        <T size={22} weight="900">Let&apos;s tailor it to you.</T>
        <T muted size={13} style={{ lineHeight: 19 }}>Your path, daily session, and fresh stream are built from this.</T>
      </View>

      <View style={{ gap: 9 }}>
        <T weight="800" size={13}>Which role are you focused on?</T>
        <RoleSelect value={role} onChange={setRole} />
      </View>

      <View style={{ gap: 9 }}>
        <T weight="800" size={13}>What level are you targeting?</T>
        <LevelPicker
          options={LEVELS.map((value) => ({ label: levelLabel(value), value }))}
          value={level}
          onChange={setLevel}
        />
        <T muted size={11.5} style={{ lineHeight: 16 }}>
          Sets the difficulty of your daily cards. Change it anytime, and switch to “All levels” in Settings.
        </T>
      </View>

      <View style={{ gap: 9 }}>
        <T weight="800" size={13}>How soon do you need it?</T>
        <Segmented
          options={[
            { label: '🎯 Soon — cram', value: 'cram' },
            { label: '🧭 Ongoing — stay current', value: 'maintain' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
        />
        <T muted size={11.5} style={{ lineHeight: 16 }}>
          Cram surfaces high-yield cards first. Stay-current paces you with spaced review.
        </T>
      </View>

      {mode === 'cram' && (
        <View style={{ gap: 8 }}>
          <T weight="800" size={13}>
            When&apos;s your interview? <T muted weight="600" size={13}>(optional)</T>
          </T>
          <TextInput
            value={dateText}
            onChangeText={onDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            accessibilityLabel="Interview date, year-month-day"
            style={{
              borderWidth: 1.5,
              borderColor: c.border,
              borderRadius: radius.md,
              padding: 12,
              color: c.fg,
              backgroundColor: c.surface,
              fontSize: 15,
            }}
          />
          <T muted size={11.5} style={{ lineHeight: 16 }}>
            We&apos;ll build a ramping cram plan and a morning-of warm-up.
          </T>
        </View>
      )}
    </View>
  );
}

/* ── Step 2: answer a REAL, role-aware question + arrange the fix ───────────── */
type TryConfig = {
  tool: string;
  icon: string;
  iconBg: string;
  q: string;
  code?: string;
  opts: { t: string; ok: boolean }[];
  verdict: ReactNode;
  fixPrompt: string;
  fixLines: string[];
  fixPool: number[]; // shuffled presentation order; correct sequence is 0,1,2,…
  fixSuccess: string;
  fixExplain: ReactNode;
};

// Domain × level matrix — the demo question matches the role's domain AND the chosen level.
const SQL_ICON = { tool: 'SQL', icon: '🗃️', iconBg: '#1c7ed6' } as const;
const RAG_ICON = { tool: 'RAG', icon: '🔎', iconBg: '#7048e8' } as const;

type TryFamily = 'data' | 'ai' | 'swe' | 'platform';
// The onboarding demo only ships three difficulty variants; the full ladder (incl. Staff/Principal)
// clamps onto these for the one-time taste (see `demoLevel`).
type DemoLevel = 'Jr' | 'Mid' | 'Sr';
const TRY: Record<TryFamily, Record<DemoLevel, TryConfig>> = {
  data: {
    Jr: {
      ...SQL_ICON,
      q: 'You need every user — even those with no orders. Which JOIN do you reach for?',
      code: 'SELECT u.id, o.total\nFROM users u\n???  orders o ON o.user_id = u.id',
      opts: [
        { t: 'LEFT JOIN — keep all users, NULL where there are no orders', ok: true },
        { t: 'INNER JOIN — it returns everything anyway', ok: false },
        { t: 'CROSS JOIN — to be safe', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          <T weight="800">INNER JOIN</T> silently drops users with no orders. <T weight="800">LEFT JOIN</T> keeps every
          left row and fills <T weight="800">NULL</T> on the right.
        </T>
      ),
      fixPrompt: 'Build it: every user + their order total (NULL if none).',
      fixLines: ['SELECT u.id, o.total', 'FROM users u', 'LEFT JOIN orders o ON o.user_id = u.id', 'ORDER BY u.id'],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ That keeps everyone.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          <T weight="800">LEFT JOIN</T> preserves all rows from the left table; unmatched right-side columns come back{' '}
          <T weight="800">NULL</T>.
        </T>
      ),
    },
    Mid: {
      ...SQL_ICON,
      q: 'Your JOIN suddenly returns double the rows. What’s the most likely cause?',
      code: 'SELECT u.id, u.name, o.total\nFROM users u\nJOIN orders o ON o.user_id = u.id',
      opts: [
        { t: 'One side of the join key has duplicates — the rows fan out', ok: true },
        { t: 'You forgot to add DISTINCT', ok: false },
        { t: 'The table is missing a primary key', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          A one-to-many join <T weight="800">multiplies rows</T>. Most people reach for <T weight="800">DISTINCT</T> — the
          band-aid, not the cause. It hides the fan-out (and tanks performance); the real fix is the <T weight="800">grain</T>.
        </T>
      ),
      fixPrompt: 'Build the query that gives one row per user:',
      fixLines: ['SELECT u.id, SUM(o.total) AS total', 'FROM users u', 'JOIN orders o ON o.user_id = u.id', 'GROUP BY u.id'],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ That builds it.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          <T weight="800">GROUP BY u.id</T> collapses each user&apos;s orders into one row, so the join can&apos;t fan out —
          the fix is the grain, not DISTINCT.
        </T>
      ),
    },
    Sr: {
      ...SQL_ICON,
      q: 'Dedupe a table, keeping only the latest row per user. Best approach at scale?',
      opts: [
        { t: 'ROW_NUMBER() partitioned by user, ordered by updated_at — keep rn = 1', ok: true },
        { t: 'SELECT DISTINCT *', ok: false },
        { t: 'GROUP BY user_id', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          <T weight="800">DISTINCT</T> and <T weight="800">GROUP BY</T> can&apos;t keep the whole latest row. A window{' '}
          <T weight="800">ROW_NUMBER()</T> ranks rows per user so you keep rank 1.
        </T>
      ),
      fixPrompt: 'Build the dedupe (latest row per user):',
      fixLines: [
        'SELECT * FROM (',
        '  SELECT *, ROW_NUMBER() OVER (',
        '    PARTITION BY user_id ORDER BY updated_at DESC) rn FROM events',
        ') WHERE rn = 1',
      ],
      fixPool: [3, 1, 0, 2],
      fixSuccess: '✓ That keeps the latest.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Rank rows per <T weight="800">user_id</T> newest-first, then keep <T weight="800">rn = 1</T> — one row per user,
          the latest, no fan-out.
        </T>
      ),
    },
  },
  ai: {
    Jr: {
      ...RAG_ICON,
      q: 'What is RAG actually doing before the model answers?',
      opts: [
        { t: 'Retrieving relevant docs and adding them to the prompt as context', ok: true },
        { t: 'Fine-tuning the model on your documents', ok: false },
        { t: 'Caching previous answers to reuse them', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          RAG <T weight="800">retrieves</T> relevant chunks and <T weight="800">augments the prompt</T> — no training. The
          model answers from the context you hand it.
        </T>
      ),
      fixPrompt: 'Order the RAG request flow:',
      fixLines: ['Embed the user query', 'Retrieve the top-k similar chunks', 'Add the chunks to the prompt as context', 'Generate the answer'],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ That’s the flow.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Embed → retrieve → augment → generate. Retrieval grounds the model; it can only use what you put in the prompt.
        </T>
      ),
    },
    Mid: {
      ...RAG_ICON,
      q: 'Your RAG app keeps citing outdated docs after you refreshed the knowledge base. Most likely cause?',
      opts: [
        { t: 'The updated docs were never re-embedded / re-indexed (stale vectors)', ok: true },
        { t: 'The model temperature is too high', ok: false },
        { t: 'The system prompt is too long', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          Retrieval can only surface what&apos;s in the <T weight="800">index</T>. Refresh the source but skip{' '}
          <T weight="800">re-embedding</T> and you keep serving <T weight="800">stale vectors</T> — the model can&apos;t cite
          what it never retrieved.
        </T>
      ),
      fixPrompt: 'Order the re-index pipeline:',
      fixLines: ['Chunk the updated docs', 'Embed each chunk', 'Upsert vectors into the index', 'Re-run retrieval eval'],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ That refreshes it.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Re-embed on every source change, <T weight="800">upsert</T> to the index, then verify with a{' '}
          <T weight="800">retrieval eval</T> — otherwise retrieval silently serves stale context.
        </T>
      ),
    },
    Sr: {
      ...RAG_ICON,
      q: 'Your RAG gives confident answers that cite the wrong chunk. Most useful first move?',
      opts: [
        { t: 'Add a retrieval eval (recall@k / groundedness) before touching the LLM', ok: true },
        { t: 'Raise the temperature for more variety', ok: false },
        { t: 'Swap in a bigger generation model', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          Confident-but-wrong with bad citations is a <T weight="800">retrieval</T> problem, not a generation one.{' '}
          <T weight="800">Measure retrieval</T> before you tune the model.
        </T>
      ),
      fixPrompt: 'Order the eval-first debug loop:',
      fixLines: [
        'Label an eval set: query → expected chunk',
        'Measure recall@k for the retriever',
        'Fix chunking / embeddings if recall is low',
        'Re-check the answers’ groundedness',
      ],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ Measure, then fix.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          If the right chunk isn&apos;t retrieved, no model can cite it. Measure <T weight="800">recall@k</T> first, fix
          retrieval, then judge groundedness.
        </T>
      ),
    },
  },
  swe: {
    Jr: {
      tool: 'Backend', icon: '💻', iconBg: '#4263eb',
      q: 'A list endpoint is slow and your logs show one DB query per row returned. What is this?',
      opts: [
        { t: 'An N+1 query — fix it with a single JOIN / IN, or eager-load', ok: true },
        { t: 'The JSON response is just too large', ok: false },
        { t: 'The server needs more RAM', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          One query per item is the classic <T weight="800">N+1</T>. Batch it into a single query (JOIN / <T weight="800">WHERE id IN (…)</T>) instead of looping.
        </T>
      ),
      fixPrompt: 'Order the fix:',
      fixLines: ['Spot the N+1 (one query per row in the trace)', 'Collect the ids you need', 'Fetch them in one JOIN / IN query', 'Map results back in memory'],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ One query, not N.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Replace the per-row loop with a single set-based query, then stitch the results in code — one round-trip instead of N.
        </T>
      ),
    },
    Mid: {
      tool: 'Backend', icon: '💻', iconBg: '#4263eb',
      q: 'An endpoint’s p99 latency spiked 10× right after a deploy. First thing you check?',
      opts: [
        { t: 'What the deploy changed — profile the new code path / query', ok: true },
        { t: 'Add more pods', ok: false },
        { t: 'Restart the database', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          A spike <T weight="800">correlated with a deploy</T> points at the change, not capacity. Profile the new path before you scale hardware.
        </T>
      ),
      fixPrompt: 'Order the triage:',
      fixLines: ['Check what the deploy changed', 'Trace the slow endpoint to the new code path', 'Find the added query / N+1 / missing index', 'Fix it and confirm p99 recovers'],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ Found the regression.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Deploy-correlated regressions live in the diff. Trace → find the new query/index gap → fix → watch p99 drop back.
        </T>
      ),
    },
    Sr: {
      tool: 'Backend', icon: '💻', iconBg: '#4263eb',
      q: 'You must ship a breaking DB schema change with zero downtime. Safest rollout?',
      opts: [
        { t: 'Expand–contract: add new, dual-write, backfill, switch reads, then drop old', ok: true },
        { t: 'Take a maintenance window and migrate in one shot', ok: false },
        { t: 'Deploy it and fix forward if anything breaks', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          Zero-downtime = <T weight="800">expand–contract</T>: every step is backwards-compatible, never a big-bang cutover.
        </T>
      ),
      fixPrompt: 'Order the expand–contract migration:',
      fixLines: ['Add the new column (nullable) — expand', 'Dual-write old + new', 'Backfill historical rows', 'Switch reads to new, then drop old — contract'],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ Zero downtime.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Keep old and new valid at once: <T weight="800">expand</T> the schema, dual-write + backfill, flip reads, then{' '}
          <T weight="800">contract</T> away the old — each step is independently safe to roll back.
        </T>
      ),
    },
  },
  platform: {
    Jr: {
      tool: 'SRE', icon: '🛡️', iconBg: '#0ca678',
      q: 'Error rate looks fine but users say the app is “down.” Which signal did you miss?',
      opts: [
        { t: 'Latency / saturation — it’s slow, not erroring (the four golden signals)', ok: true },
        { t: 'CPU temperature', ok: false },
        { t: 'The log file’s color', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          Errors are just one of the <T weight="800">four golden signals</T> — latency, traffic, errors, saturation. A slow service is “up” but unusable.
        </T>
      ),
      fixPrompt: 'Order the golden-signals check:',
      fixLines: ['Check the error rate', 'Check latency (p99)', 'Check traffic / load', 'Check saturation (CPU / mem / queues)'],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ All four covered.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Watch latency, traffic, errors, and saturation together — most “down but no errors” incidents are latency or saturation.
        </T>
      ),
    },
    Mid: {
      tool: 'SRE', icon: '🛡️', iconBg: '#0ca678',
      q: 'A flaky service pages you at 3am but nothing is actually broken. Best fix?',
      opts: [
        { t: 'Alert on a user-facing SLO burn rate, not every transient blip', ok: true },
        { t: 'Mute the pager overnight', ok: false },
        { t: 'Auto-restart it on a cron', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          Alert fatigue comes from paging on <T weight="800">causes/noise</T>. Page on fast burn of the <T weight="800">error budget</T> (user-facing SLO), not blips.
        </T>
      ),
      fixPrompt: 'Order the alert fix:',
      fixLines: ['Define the user-facing SLO (e.g. 99.9% success)', 'Alert on fast error-budget burn rate', 'Send low-severity to tickets, not pages', 'Attach a runbook link to the alert'],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ Pages that matter.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Tie pages to an SLO and its burn rate; route the rest to tickets. Fewer, higher-signal pages — no 3am noise.
        </T>
      ),
    },
    Sr: {
      tool: 'SRE', icon: '🛡️', iconBg: '#0ca678',
      q: 'A whole region goes down and your service degrades hard. What design choice prevents it?',
      opts: [
        { t: 'Run active in 2+ regions with automatic failover + graceful degradation', ok: true },
        { t: 'A single, bigger instance', ok: false },
        { t: 'More logging', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          A single region is a single point of failure. Design for <T weight="800">failover</T> and shed non-critical load under stress.
        </T>
      ),
      fixPrompt: 'Order the resilience plan:',
      fixLines: ['Run active in 2+ regions', 'Health-check + automatic failover (DNS / LB)', 'Degrade non-critical features under load', 'Game-day test the failover regularly'],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ Survives a region loss.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Multi-region + automated failover keeps you serving; graceful degradation sheds the non-essential so the core stays up.
        </T>
      ),
    },
  },
};

/** Tap-to-arrange code/steps builder (the app's `order` format, miniaturised for onboarding). */
function ArrangeCode({ c, lines, pool: poolOrder, successLabel, explain }: { c: C; lines: string[]; pool: number[]; successLabel: string; explain: ReactNode }) {
  const [placed, setPlaced] = useState<number[]>([]);
  const complete = placed.length === lines.length;
  const correct = complete && placed.every((v, i) => v === i);
  const pool = poolOrder.filter((i) => !placed.includes(i));
  useEffect(() => {
    if (complete && correct) haptic.success();
  }, [complete, correct]);
  return (
    <View style={{ gap: 9 }}>
      {correct && <Confetti />}
      {/* build area */}
      <View style={{ backgroundColor: c.navy, borderRadius: radius.sm, padding: 11, gap: 3 }}>
        {placed.length === 0 ? (
          <T size={12} color="#7e8aa0" style={{ fontFamily: mono }}>— tap the lines below, in order —</T>
        ) : (
          placed.map((li) => (
            <Pressable
              key={li}
              disabled={complete}
              accessibilityRole="button"
              accessibilityLabel={`${lines[li]}. Tap to remove from the order.`}
              onPress={() => setPlaced(placed.filter((x) => x !== li))}
              style={{ paddingVertical: 4 }}>
              <T size={12} color="#cdd6e6" style={{ fontFamily: mono, lineHeight: 18 }}>{lines[li]}</T>
            </Pressable>
          ))
        )}
      </View>
      {/* pool of remaining lines */}
      {!complete && (
        <View style={{ gap: 7 }}>
          {pool.map((li) => (
            <Pressable
              key={li}
              accessibilityRole="button"
              accessibilityLabel={`Add to order: ${lines[li]}`}
              onPress={() => { setPlaced([...placed, li]); haptic.selection(); }}
              style={{ borderWidth: 1.5, borderColor: c.border, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 11 }}>
              <T size={12.5} color={c.fg} style={{ fontFamily: mono }}>{lines[li]}</T>
            </Pressable>
          ))}
        </View>
      )}
      {complete && (
        <CardEnter style={{ gap: 8 }}>
          <T size={14} weight="900" color={correct ? c.success : c.danger}>{correct ? successLabel : '✗ Close — order matters.'}</T>
          {explain}
          {!correct && (
            <Pressable accessibilityRole="button" accessibilityLabel="Try again" hitSlop={8} onPress={() => setPlaced([])} style={{ paddingVertical: 6 }}>
              <T size={12.5} weight="800" color={c.accentInk}>↺ Try again</T>
            </Pressable>
          )}
        </CardEnter>
      )}
    </View>
  );
}

/** Tappable MCQ option list. */
function Choices({ c, opts, picked, onPick }: { c: C; opts: { t: string; ok: boolean }[]; picked: number | null; onPick: (i: number) => void }) {
  const answered = picked !== null;
  return (
    <View style={{ gap: 8 }}>
      {opts.map((o, i) => {
        let bd = c.border;
        let bg = 'transparent';
        if (answered) {
          if (o.ok) { bd = c.success; bg = 'rgba(26,158,87,0.10)'; }
          else if (i === picked) { bd = c.danger; bg = 'rgba(232,69,60,0.09)'; }
        }
        const lt = answered && o.ok ? c.success : answered && i === picked ? c.danger : c.muted;
        const verdict = answered ? (o.ok ? ' (correct)' : i === picked ? ' (incorrect)' : '') : '';
        return (
          <Pressable
            key={i}
            disabled={answered}
            accessibilityRole="button"
            accessibilityState={{ selected: i === picked, disabled: answered }}
            accessibilityLabel={`${o.t}${verdict}`}
            onPress={() => { onPick(i); haptic.selection(); }}
            style={{
              flexDirection: 'row', gap: 9, alignItems: 'flex-start',
              borderWidth: 1.5, borderColor: bd, backgroundColor: bg,
              borderRadius: radius.md, padding: 12,
              opacity: answered && !o.ok && i !== picked ? 0.55 : 1,
            }}>
            <T weight="900" size={12.5} color={lt}>{String.fromCharCode(65 + i)}</T>
            <T size={13} style={{ flex: 1, lineHeight: 18 }}>{o.t}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Map a role to the onboarding demo family (~40 roles → 4 families). */
function roleFamily(roleKey: string): TryFamily {
  const r = ROLES.find((x) => x.key === roleKey);
  const name = r?.name ?? '';
  // AI / ML (incl. cloud-AI, vendor ML/GenAI, Data Scientist via family 'AI & ML')
  if (r?.family === 'AI & ML' || /\bAI\b|\bML\b|GenAI|Cortex/i.test(name)) return 'ai';
  // App/software engineering (incl. cloud "… Developer")
  if (/Software Engineer|Backend|Developer/i.test(name)) return 'swe';
  // Reliability / infra / architecture / security / admin (incl. cloud architects, Palantir)
  if (r?.family === 'Platform' || /Architect|DevOps|Reliability|SRE|Security|Admin|Platform|Palantir/i.test(name)) return 'platform';
  // Everything else is data/analytics → SQL
  return 'data';
}

/* ── Cloud-native demo (AWS / GCP / Azure) ─────────────────────────────────────
   Cloud Developer/Architect roles shouldn't get a generic backend question — they
   get a cloud-true scenario (cold start → cost/scan → multi-AZ) with that cloud's
   service names swapped in. DE stays SQL and AI stays RAG (genuinely cloud-relevant). */
type CloudId = 'aws' | 'gcp' | 'azure';
const CLOUD_META: Record<CloudId, { label: string; iconBg: string; serverless: string; scan: string; az: string }> = {
  aws: { label: 'AWS', iconBg: '#ff9900', serverless: 'Lambda', scan: 'Athena over S3', az: 'Availability Zone' },
  gcp: { label: 'GCP', iconBg: '#4285f4', serverless: 'Cloud Run', scan: 'BigQuery', az: 'zone' },
  azure: { label: 'Azure', iconBg: '#0078d4', serverless: 'Azure Functions', scan: 'Synapse over ADLS', az: 'Availability Zone' },
};

/** Cloud Developer / Solutions Architect roles → cloud-flavoured demo (others keep their family). */
function roleCloud(roleKey: string): CloudId | null {
  const m = /^(aws|gcp|azure)-(developer|architect)$/.exec(roleKey);
  return m ? (m[1] as CloudId) : null;
}

/** Clamp the full seniority ladder onto the three demo variants (Staff/Principal → the hardest demo). */
const demoLevel = (l: Level | null): DemoLevel => (l === 'Jr' ? 'Jr' : l === 'Mid' || l == null ? 'Mid' : 'Sr');

function cloudTry(cloud: CloudId, level: DemoLevel): TryConfig {
  const m = CLOUD_META[cloud];
  const base = { tool: m.label, icon: '☁️', iconBg: m.iconBg };
  if (level === 'Jr') {
    return {
      ...base,
      q: `Your ${m.serverless} function's first call after it's been idle takes ~3s — then the rest are fast. What is this?`,
      opts: [
        { t: 'A cold start — the runtime had to spin up before your code ran', ok: true },
        { t: `${m.serverless} is throttling your account`, ok: false },
        { t: 'The function just needs more memory', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          The first call after idle pays to <T weight="800">spin up the runtime</T> — a <T weight="800">cold start</T>. Warm
          calls reuse it; keep a few instances warm to kill the lag.
        </T>
      ),
      fixPrompt: 'Order the cold-start fix:',
      fixLines: [
        'Confirm it’s only the first call after idle',
        'Keep instances warm (provisioned / min-instances)',
        'Move heavy init outside the handler',
        'Re-check p99 for cold vs warm calls',
      ],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ No more cold lag.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Pre-warm a few instances and shrink the cold-path init — the first request stops paying the spin-up tax.
        </T>
      ),
    };
  }
  if (level === 'Mid') {
    return {
      ...base,
      q: `A query over years of logs in ${m.scan} scans terabytes and the bill spikes. First fix?`,
      opts: [
        { t: 'Partition by date + store columnar (Parquet) so it prunes and scans far less', ok: true },
        { t: 'Raise the query timeout', ok: false },
        { t: 'Move to a bigger warehouse / more slots', ok: false },
      ],
      verdict: (
        <T size={13} style={{ lineHeight: 20 }}>
          You’re billed for <T weight="800">data scanned</T>. <T weight="800">Partitioning</T> + a{' '}
          <T weight="800">columnar</T> format lets the engine skip most of it — bigger compute just costs more.
        </T>
      ),
      fixPrompt: 'Order the cost fix:',
      fixLines: [
        'Partition the data by date',
        'Store it columnar (Parquet / ORC)',
        'Select only the columns you need',
        'Confirm bytes-scanned dropped',
      ],
      fixPool: [2, 0, 3, 1],
      fixSuccess: '✓ Scans a fraction now.',
      fixExplain: (
        <T size={13} style={{ lineHeight: 20 }}>
          Partition pruning + columnar reads mean the query touches a sliver of the data — cost falls with the scan, not the
          cluster size.
        </T>
      ),
    };
  }
  return {
    ...base,
    q: `A single ${m.az} outage takes your whole app down. Cheapest durable fix?`,
    opts: [
      { t: `Run across 2+ ${m.az}s behind a load balancer with health checks + failover`, ok: true },
      { t: 'Buy one bigger instance', ok: false },
      { t: 'Add more logging', ok: false },
    ],
    verdict: (
      <T size={13} style={{ lineHeight: 20 }}>
        One {m.az} is a <T weight="800">single point of failure</T>. Spreading across {m.az}s with health-checked{' '}
        <T weight="800">failover</T> survives the loss — a bigger box doesn’t.
      </T>
    ),
    fixPrompt: 'Order the resilience plan:',
    fixLines: [
      `Deploy across 2+ ${m.az}s`,
      'Front it with a load balancer + health checks',
      'Use a replicated, multi-zone datastore',
      'Game-day the failover regularly',
    ],
    fixPool: [2, 0, 3, 1],
    fixSuccess: '✓ Survives a zone loss.',
    fixExplain: (
      <T size={13} style={{ lineHeight: 20 }}>
        Redundancy across {m.az}s plus automatic failover keeps you serving when one zone dies; vertical scaling just makes
        the single point bigger.
      </T>
    ),
  };
}

function TryOne({ c, role, level }: { c: C; role: string; level: Level }) {
  const cloud = roleCloud(role);
  const dl = demoLevel(level);
  const cfg = cloud ? cloudTry(cloud, dl) : TRY[roleFamily(role)][dl];
  const [pick1, setPick1] = useState<number | null>(null);
  const a1 = pick1 !== null;
  const ok1 = pick1 === cfg.opts.findIndex((o) => o.ok);
  return (
    <View style={{ gap: space.lg, marginTop: 4 }}>
      <View style={{ gap: 6 }}>
        <T size={11} weight="900" color={c.accentInk} style={{ letterSpacing: 1.2 }}>YOUR TURN</T>
        <T size={22} weight="900" style={{ lineHeight: 29 }}>Answer a real one.</T>
        <T muted size={13} style={{ lineHeight: 19 }}>No typing — tap the answer you&apos;d give. This is what every card feels like.</T>
      </View>

      {/* tappable question + follow-up — same shape as the in-app cards */}
      <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 15, gap: 12 }}>
        <Row style={{ gap: 8 }}>
          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: cfg.iconBg, alignItems: 'center', justifyContent: 'center' }}>
            <T size={13}>{cfg.icon}</T>
          </View>
          <T size={11} weight="800" color={c.muted}>{cfg.tool}</T>
        </Row>
        <T size={15.5} weight="800" style={{ lineHeight: 22 }}>{cfg.q}</T>
        {cfg.code ? (
          <View style={{ backgroundColor: c.navy, borderRadius: radius.sm, paddingVertical: 11, paddingHorizontal: 13 }}>
            <T size={12} color="#cdd6e6" style={{ fontFamily: mono, lineHeight: 19 }}>{cfg.code}</T>
          </View>
        ) : null}
        <Choices c={c} opts={cfg.opts} picked={pick1} onPick={setPick1} />

        {a1 && (
          <CardEnter style={{ gap: 9, marginTop: 2 }}>
            <T size={14} weight="900" color={ok1 ? c.success : c.danger}>{ok1 ? '✓ Exactly.' : '✗ Common trap.'}</T>
            {cfg.verdict}

            {/* follow-up — arrange the fix (tap the lines into order) */}
            <View style={{ height: 1, backgroundColor: c.border, marginTop: 10 }} />
            <T size={10.5} weight="900" color={c.accentInk} style={{ letterSpacing: 0.8 }}>FOLLOW-UP · ARRANGE THE FIX</T>
            <T size={15} weight="800" style={{ lineHeight: 21 }}>{cfg.fixPrompt}</T>
            <ArrangeCode c={c} lines={cfg.fixLines} pool={cfg.fixPool} successLabel={cfg.fixSuccess} explain={cfg.fixExplain} />

            {/* reassurance — branched: celebrate a correct answer, reassure a wrong one */}
            {ok1 ? (
              <Row style={{ gap: 8, alignItems: 'flex-start', backgroundColor: 'rgba(26,158,87,0.10)', borderRadius: radius.sm, padding: 10, marginTop: 2 }}>
                <T size={13}>🎯</T>
                <T size={12} color={c.fg} style={{ flex: 1, lineHeight: 17 }}>
                  Nice — that&apos;s the bar. The cards get deeper from here.
                </T>
              </Row>
            ) : (
              <Row style={{ gap: 8, alignItems: 'flex-start', backgroundColor: c.surface, borderRadius: radius.sm, padding: 10, marginTop: 2 }}>
                <T size={13}>🌱</T>
                <T size={12} color={c.muted} style={{ flex: 1, lineHeight: 17 }}>
                  New to this? Totally fine to miss it — the app starts at the basics and builds you up from there.
                </T>
              </Row>
            )}
          </CardEnter>
        )}
      </View>

      <T muted size={11.5} style={{ textAlign: 'center' }}>
        {a1 ? 'That’s the shape of every card.' : 'Tap one — no typing, just instinct.'}
      </T>
    </View>
  );
}

/* ── Step 3: a short, human founder's note ─────────────────────────────────── */
function FounderNote({ c }: { c: C }) {
  return (
    <View style={{ gap: space.lg, marginTop: 8 }}>
      <Row style={{ gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.navy, alignItems: 'center', justifyContent: 'center' }}>
          <T size={22}>👋</T>
        </View>
        <View style={{ flex: 1 }}>
          <T size={11} weight="900" color={c.accentInk} style={{ letterSpacing: 1 }}>A QUICK NOTE</T>
          <T size={17} weight="900" style={{ marginTop: 2 }}>Why I built this</T>
        </View>
      </Row>

      <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 16, gap: 12 }}>
        <T size={14} style={{ lineHeight: 22 }} color={c.fg}>
          I bombed interviews where I <T weight="800">knew the material</T> but froze the moment someone asked “…but why?”. The grind out there drills trivia, not the production reasoning that actually gets you the offer.
        </T>
        <T size={14} style={{ lineHeight: 22 }} color={c.fg}>
          So I built the prep I wish I&apos;d had: <T weight="800">real questions, the reasoning behind them,</T> and the stuff that shipped last week. Free to start. I hope it gets you the offer.
        </T>
        <T size={13.5} weight="900" color={c.accentInk}>— Chetan, FieldNotes</T>
      </View>

      <T muted size={12} style={{ textAlign: 'center', lineHeight: 18 }}>
        Tap below and your tailored path is ready on the other side.
      </T>
    </View>
  );
}
