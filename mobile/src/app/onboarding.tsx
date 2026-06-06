import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mode, useStore } from '../lib/store';
import { radius, space, useTheme } from '../lib/theme';
import { CardEnter } from '../ui/anim';
import { Btn, Row, Segmented, T } from '../ui/kit';
import { RoleSelect } from '../ui/RoleSelect';

const ORANGE = '#f76707';
const STEPS = 5;

/**
 * First-run flow that sells before it asks: showcase → name the pain → let them FEEL a
 * real question → tailor → a short founder's note → in. Role + goal are captured at the
 * tailor step. "Skip" jumps straight to tailor.
 */
export default function Onboarding() {
  const { c } = useTheme();
  const router = useRouter();
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string>('de');
  const [mode, setMode] = useState<Mode>('cram');

  const finish = () => {
    complete(role, mode);
    router.replace('/');
  };

  // Primary CTA per step: [label, action].
  const cta: Record<number, { label: string; onPress: () => void }> = {
    0: { label: 'Show me →', onPress: () => setStep(1) },
    1: { label: "I'm ready →", onPress: () => setStep(2) },
    2: { label: 'Tailor my prep →', onPress: () => setStep(3) },
    3: { label: 'Almost there →', onPress: () => setStep(4) },
    4: { label: "Let's go →", onPress: finish },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface }}>
      {/* Top bar: back · progress dots · skip */}
      <Row style={{ paddingHorizontal: space.md, paddingTop: 6, height: 34 }}>
        {step > 0 ? (
          <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={10}>
            <T size={15} weight="900" color={c.muted}>‹ Back</T>
          </Pressable>
        ) : (
          <View style={{ width: 52 }} />
        )}
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {Array.from({ length: STEPS }, (_, i) => (
            <Dot key={i} active={i === step} c={c} />
          ))}
        </View>
        {step < 3 ? (
          <Pressable onPress={() => setStep(3)} hitSlop={10}>
            <T size={13} weight="800" color={c.muted}>Skip</T>
          </Pressable>
        ) : (
          <View style={{ width: 52 }} />
        )}
      </Row>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}>
        <CardEnter key={step}>
          {step === 0 && <Showcase c={c} />}
          {step === 1 && <Frustration c={c} />}
          {step === 2 && <TryOne c={c} />}
          {step === 3 && <Tailor c={c} role={role} setRole={setRole} mode={mode} setMode={setMode} />}
          {step === 4 && <FounderNote c={c} />}
        </CardEnter>
      </ScrollView>

      {/* Bottom CTA bar */}
      <View style={{ paddingHorizontal: space.lg, paddingBottom: 10, paddingTop: 6 }}>
        <Btn label={cta[step].label} variant="primary" onPress={cta[step].onPress} />
        {step === 4 && (
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

/** Gently floating mascot badge — bobs ~6px on a slow loop (alive, not bouncy). */
function FloatBadge() {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.value = withRepeat(withTiming(-6, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduced, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      style={[
        st,
        {
          width: 92,
          height: 92,
          borderRadius: 46,
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
      ]}>
      <T size={48}>🎯</T>
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

/* ── Step 0: showcase what you get ─────────────────────────────────────────── */
function Showcase({ c }: { c: C }) {
  const features = [
    { icon: '🧭', accent: '#4263eb', tint: 'rgba(66,99,235,0.10)', bd: 'rgba(66,99,235,0.28)', title: 'A path, not a pile', sub: 'Bite-size lessons from fundamentals to mastery, tuned to your exact role.' },
    { icon: '🔁', accent: ORANGE, tint: 'rgba(247,103,7,0.10)', bd: 'rgba(247,103,7,0.30)', title: 'Drills that test the why', sub: 'Flip cards that push past recognition to the senior reasoning interviewers probe.' },
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
        <T size={10.5} weight="900" color="rgba(255,255,255,0.92)" style={{ letterSpacing: 1.6, marginTop: 14 }}>
          DATA &amp; AI · LEVEL UP
        </T>
      </View>

      {/* Wordmark + rotating motivation + a real, exciting credibility stat */}
      <View style={{ alignItems: 'center', gap: 5, marginTop: 2 }}>
        <T size={28} weight="900">
          Field<T size={28} weight="900" color={ORANGE}>Notes</T>
        </T>
        <T size={11.5} weight="900" color={c.muted} style={{ letterSpacing: 1, marginTop: 2 }}>WHETHER YOU&apos;RE</T>
        <RotatingPhrase color={ORANGE} items={['interviewing soon', 'breaking into Data/AI', 'keeping up with tech', 'chasing a promotion']} />
        <T size={14.5} weight="800" style={{ marginTop: 1 }}>FieldNotes gets you sharp.</T>
        <Row style={{ gap: 7, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, marginTop: 6 }}>
          <T size={11.5} weight="900" color={ORANGE}>1,700+ cards</T>
          <T size={11.5} weight="900" color={c.border}>•</T>
          <T size={11.5} weight="900">47 tracks</T>
          <T size={11.5} weight="900" color={c.border}>•</T>
          <T size={11.5} weight="900" color="#1a9e57">weekly fresh</T>
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

/* ── Step 1: name + visualize the frustration ──────────────────────────────── */
function Frustration({ c }: { c: C }) {
  return (
    <View style={{ gap: space.lg, marginTop: 4 }}>
      <View style={{ gap: 6 }}>
        <T size={22} weight="900" style={{ lineHeight: 29 }}>
          Knowing the answer isn&apos;t the hard part.
        </T>
        <T muted size={13.5} style={{ lineHeight: 20 }}>
          Interviews don&apos;t test recall — they test whether you can reason about production under pressure.
        </T>
      </View>

      {/* The freeze moment, visualized as a mock exchange */}
      <View style={{ gap: 9 }}>
        <Bubble c={c} who="Interviewer" tint={c.navy} fg="#fff" text="“You'd use Kafka here — why? What about exactly-once and ordering?”" align="left" />
        <Bubble c={c} who="You" tint={c.card} fg={c.muted} text="“…uh… because it's… scalable?”  😬" align="right" border />
      </View>

      {/* before → after */}
      <View style={{ gap: 8 }}>
        <PillLine c={c} mark="✕" color="#e8453c" label="Recognized the tool. Froze on the why." />
        <PillLine c={c} mark="✓" color={c.success} label="Idempotent producer, acks=all, keyed partitions for ordering — and the trade-offs." />
      </View>

      <T size={13.5} weight="700" style={{ lineHeight: 20 }}>
        FieldNotes drills exactly that gap — the reasoning that separates a hire from a maybe.
      </T>
    </View>
  );
}

function Bubble({ c, who, tint, fg, text, align, border }: { c: C; who: string; tint: string; fg: string; text: string; align: 'left' | 'right'; border?: boolean }) {
  return (
    <View style={{ alignItems: align === 'left' ? 'flex-start' : 'flex-end' }}>
      <T muted size={10.5} weight="800" style={{ marginBottom: 3, marginHorizontal: 4 }}>{who}</T>
      <View
        style={{
          maxWidth: '88%',
          backgroundColor: tint,
          borderRadius: 16,
          borderWidth: border ? 1 : 0,
          borderColor: c.border,
          paddingVertical: 10,
          paddingHorizontal: 13,
        }}>
        <T size={13} color={fg} style={{ lineHeight: 19 }}>{text}</T>
      </View>
    </View>
  );
}

function PillLine({ c, mark, color, label }: { c: C; mark: string; color: string; label: string }) {
  return (
    <Row style={{ gap: 9, alignItems: 'flex-start' }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <T size={11} weight="900" color="#fff">{mark}</T>
      </View>
      <T size={13} style={{ flex: 1, lineHeight: 19 }} color={c.fg}>{label}</T>
    </Row>
  );
}

/* ── Step 2: let them FEEL a real, hard question (pays off the freeze) ──────── */
function TryOne({ c }: { c: C }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={{ gap: space.lg, marginTop: 4 }}>
      <View style={{ gap: 6 }}>
        <T size={11} weight="900" color={ORANGE} style={{ letterSpacing: 1.2 }}>ROUND 2 · YOUR SHOT</T>
        <T size={22} weight="900" style={{ lineHeight: 29 }}>Okay — so answer it.</T>
        <T muted size={13} style={{ lineHeight: 19 }}>The exact question you just froze on. Take 10 seconds, then reveal how a senior answers.</T>
      </View>

      {/* the question card */}
      <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 15, gap: 12 }}>
        <Row style={{ gap: 8 }}>
          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: c.navy, alignItems: 'center', justifyContent: 'center' }}>
            <T size={13}>📨</T>
          </View>
          <T size={11} weight="800" color={c.muted}>Kafka · Senior</T>
        </Row>
        <T size={15.5} weight="800" style={{ lineHeight: 22 }}>
          Why Kafka here — and how do you actually get exactly-once with correct ordering?
        </T>

        {!revealed ? (
          <Pressable
            onPress={() => setRevealed(true)}
            style={{ borderWidth: 1.5, borderColor: ORANGE, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center', marginTop: 2 }}>
            <T weight="900" size={13.5} color={ORANGE}>Reveal the senior answer ↓</T>
          </Pressable>
        ) : (
          <CardEnter style={{ gap: 11, marginTop: 2 }}>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <T size={13.5} style={{ lineHeight: 20 }} color={c.fg}>
              Enable the <T weight="800">idempotent producer</T> (acks=all) so retries don&apos;t duplicate, and wrap the produce + offset-commit in a <T weight="800">transaction</T> for end-to-end exactly-once. Ordering is <T weight="800">per-partition</T>, so <T weight="800">key by entity</T> to keep an id&apos;s events on one partition. Consumers commit offsets only after the write lands.
            </T>
            <View style={{ backgroundColor: 'rgba(232,69,60,0.10)', borderRadius: radius.sm, padding: 9 }}>
              <T size={12} color={c.fg}><T weight="900" color="#e8453c">Junior tell: </T>“Kafka is exactly-once by default.”</T>
            </View>
            <View style={{ backgroundColor: 'rgba(26,158,87,0.10)', borderRadius: radius.sm, padding: 9 }}>
              <T size={12} color={c.fg}><T weight="900" color="#1a9e57">Senior tell: </T>Exactly-once is opt-in (idempotent producer + transactions); ordering is per-partition, so you key by entity.</T>
            </View>
          </CardEnter>
        )}
      </View>

      <T muted size={11.5} style={{ textAlign: 'center' }}>
        {revealed ? 'That’s one of 1,700+. The rest are waiting.' : 'No typing needed — just think it through.'}
      </T>
    </View>
  );
}

/* ── Step 3: tailor it (inclusive — not everyone is interviewing) ──────────── */
function Tailor({ c, role, setRole, mode, setMode }: { c: C; role: string; setRole: (r: string) => void; mode: Mode; setMode: (m: Mode) => void }) {
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
        <T weight="800" size={13}>How soon do you need it?</T>
        <Segmented
          options={[
            { label: '🎯 Soon — cram', value: 'cram' },
            { label: '🧭 Ongoing — keep sharp', value: 'maintain' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
        />
        <T muted size={11.5} style={{ lineHeight: 16 }}>
          Cram surfaces high-yield cards first. Keep-sharp paces you with spaced review to stay current.
        </T>
      </View>
    </View>
  );
}

/* ── Step 4: a short, human founder's note ─────────────────────────────────── */
function FounderNote({ c }: { c: C }) {
  return (
    <View style={{ gap: space.lg, marginTop: 8 }}>
      <Row style={{ gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.navy, alignItems: 'center', justifyContent: 'center' }}>
          <T size={22}>👋</T>
        </View>
        <View style={{ flex: 1 }}>
          <T size={11} weight="900" color={ORANGE} style={{ letterSpacing: 1 }}>A QUICK NOTE</T>
          <T size={17} weight="900" style={{ marginTop: 2 }}>Why I built this</T>
        </View>
      </Row>

      <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 16, gap: 12 }}>
        <T size={14} style={{ lineHeight: 22 }} color={c.fg}>
          I bombed interviews where I <T weight="800">knew the material</T> but froze the moment someone asked “…but why?”. The grind out there drills trivia, not the production reasoning that actually gets you the offer.
        </T>
        <T size={14} style={{ lineHeight: 22 }} color={c.fg}>
          So I built the prep I wish I&apos;d had: <T weight="800">real questions, the senior reasoning,</T> and the stuff that shipped last week. Free to start. I hope it gets you the yes.
        </T>
        <T size={13.5} weight="900" color={ORANGE}>— Chetan, FieldNotes</T>
      </View>

      <T muted size={12} style={{ textAlign: 'center', lineHeight: 18 }}>
        Tap below and your tailored path is ready on the other side.
      </T>
    </View>
  );
}
