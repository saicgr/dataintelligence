import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { answerFeedback, haptic, sfx } from '../lib/feedback';
import { requestPermission } from '../lib/notifications';
import { dueLabel } from '../lib/srs';
import { useActiveDeck, useStore } from '../lib/store';
import { radius, space, useTheme } from '../lib/theme';
import { AnimatedProgressBar, CardEnter, Confetti, FollowUpCue } from './anim';
import { Btn, Card, Chip, Row, T, TrackBadge } from './kit';
import { Mascot } from './Mascot';
import { ResultFooter } from './ResultFooter';
import { StreakHero } from './StreakHero';
import { ClassifyView } from './ClassifyView';
import { CodeBlock } from './CodeBlock';
import { CodePanels } from './CodePanel';
import { DiagView } from './DiagView';
import { EvidenceView } from './EvidenceView';
import { MatchView } from './MatchView';
import { OrderView } from './OrderView';
import { QueryBuildView } from './QueryBuildView';
import { RichAnswer } from './RichAnswer';
import { ScenarioView } from './ScenarioView';

export function SessionView() {
  const deck = useActiveDeck();
  const idx = useStore((s) => s.idx);
  const len = deck.length;

  return (
    <View style={{ gap: space.md }}>
      <ProgressBar value={len ? Math.min(idx, len) / len : 0} label={idx >= len ? 'Done' : `${idx + 1} / ${len}`} />
      {idx >= len ? (
        <Done />
      ) : (
        <CardEnter key={idx}>
          <CardView />
        </CardEnter>
      )}
    </View>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const { c } = useTheme();
  return (
    <Row>
      <AnimatedProgressBar value={value} color={c.success} track={c.border} />
      <T muted weight="800" size={12}>
        {label}
      </T>
    </Row>
  );
}

function CardView() {
  const { c, track } = useTheme();
  const router = useRouter();
  const deck = useActiveDeck();
  const { idx, reveal, lastChoice } = useStore();
  const doReveal = useStore((s) => s.doReveal);
  const choose = useStore((s) => s.choose);
  const rate = useStore((s) => s.rate);
  const unlocked = useStore((s) => s.unlocked);
  const toggleSave = useStore((s) => s.toggleSave);
  const setFeedback = useStore((s) => s.setFeedback);

  const card = deck[idx];
  const saved = useStore((s) => (card ? s.savedIds.includes(card.id) : false));
  const reaction = useStore((s) => (card ? s.feedback[card.id] : undefined));
  const col = track(card?.tk ?? 'spark');
  const nearEnd = !unlocked && idx >= deck.length - 2;
  const swipeable = !!card && card.kind === 'flip' && reveal;

  const [jot, setJot] = useState('');
  const jotRef = useRef<TextInput>(null);
  const tx = useSharedValue(0);
  useEffect(() => {
    tx.value = 0;
    setJot('');
  }, [idx, tx]);

  const pan = Gesture.Pan()
    .enabled(swipeable)
    // Only claim mostly-horizontal drags; let vertical drags scroll the page (fixes long cards).
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      tx.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 110) {
        const ok = e.translationX > 0;
        runOnJS(answerFeedback)(ok);
        runOnJS(rate)(ok ? 'good' : 'again');
        tx.value = 0;
      } else {
        tx.value = withSpring(0);
      }
    });

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { rotate: `${tx.value / 22}deg` }],
    opacity: 1 - Math.min(Math.abs(tx.value) / 320, 0.4),
  }));

  if (!card) return null;

  // Pillar 1 — articulation scenarios get their own produce-before-reveal flow (no swipe).
  if (card.kind === 'scenario') {
    return (
      <View>
        <ScenarioView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }

  // New tap-only diagnostic / coding formats — each its own player, no swipe.
  if (card.kind === 'order') {
    return (
      <View>
        <OrderView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }
  if (card.kind === 'evidence') {
    return (
      <View>
        <EvidenceView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }
  if (card.kind === 'diag') {
    return (
      <View>
        <DiagView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }
  if (card.kind === 'match') {
    return (
      <View>
        <MatchView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }
  if (card.kind === 'querybuild') {
    return (
      <View>
        <QueryBuildView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }
  if (card.kind === 'classify') {
    return (
      <View>
        <ClassifyView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }

  return (
    <View>
      <GestureDetector gesture={pan}>
        <Animated.View style={aStyle}>
          <Card style={{ borderRadius: radius.xl, overflow: 'hidden', minHeight: 230 }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: col }} />
            <Row style={{ marginBottom: 11, flexWrap: 'wrap' }}>
              <TrackBadge label={card.tool} color={col} />
              <Chip label={card.tag} />
            </Row>
            <T size={17} weight="700" style={{ lineHeight: 24 }}>
              {card.q}
            </T>

            {card.kind === 'flip' ? (
              reveal ? (
                <Reveal
                  answer={card.a ?? ''}
                  fj={card.fj}
                  fs={card.fs}
                  code={card.code}
                  followups={card.followups}
                  sourceUrl={card.sourceUrl}
                  sourceLabel={card.sourceLabel}
                  publishedAt={card.publishedAt}>
                  <Row style={{ gap: 9, marginTop: 14 }}>
                    <RateBtn label="🔁 Again" sub={dueLabel('again')} kind="again" onPress={() => { answerFeedback(false); rate('again'); }} />
                    <RateBtn label="✅ Got it" sub={dueLabel('good')} kind="good" onPress={() => { answerFeedback(true); rate('good'); }} />
                    <RateBtn label="⚡ Easy" sub={dueLabel('easy')} kind="easy" onPress={() => { sfx.correct(); haptic.success(); rate('easy'); }} />
                  </Row>
                  <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
                    <T muted size={11.5} weight="800">← swipe: Again</T>
                    <T muted size={11.5} weight="800">Got it: swipe →</T>
                  </Row>
                  <FeedbackRow
                    saved={saved}
                    reaction={reaction}
                    onSave={() => toggleSave(card.id)}
                    onLike={() => setFeedback(card.id, 'like')}
                    onDislike={() => setFeedback(card.id, 'dislike')}
                  />
                </Reveal>
              ) : (
                <View style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
                    <TextInput
                      ref={jotRef}
                      value={jot}
                      onChangeText={setJot}
                      placeholder="Recall it — type or talk your answer (optional)…"
                      placeholderTextColor={c.muted}
                      multiline
                      style={{
                        flex: 1,
                        borderWidth: 1.5,
                        borderColor: c.border,
                        borderRadius: radius.md,
                        padding: 11,
                        color: c.fg,
                        backgroundColor: c.surface,
                        minHeight: 60,
                        textAlignVertical: 'top',
                        fontSize: 13.5,
                      }}
                    />
                    <Pressable
                      onPress={() => jotRef.current?.focus()}
                      hitSlop={6}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: radius.md,
                        borderWidth: 1.5,
                        borderColor: c.border,
                        backgroundColor: c.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <T size={20}>🎙</T>
                    </Pressable>
                  </View>
                  <Btn label="Reveal answer" variant="navy" onPress={doReveal} />
                  <T muted size={11.5} style={{ textAlign: 'center', marginTop: 10 }}>
                    Type, or tap 🎙 and use your keyboard&apos;s dictation — then reveal &amp; rate.
                  </T>
                </View>
              )
            ) : (
              <ChoiceBlock
                card={card}
                reveal={reveal}
                lastChoice={lastChoice}
                onChoose={choose}
                onContinue={() => {
                  const correctIdx = card.opts?.findIndex((o) => o.ok) ?? -1;
                  const wrong = lastChoice != null && lastChoice !== correctIdx;
                  rate(card.strict && wrong ? 'again' : 'good');
                }}
              />
            )}
          </Card>
        </Animated.View>
      </GestureDetector>

      {nearEnd && (
        <Pressable onPress={() => router.push('/paywall')} style={{ marginTop: 12 }}>
          <T muted size={11.5} weight="700" style={{ textAlign: 'center' }}>
            {deck.length - idx} card{deck.length - idx > 1 ? 's' : ''} left in today&apos;s free session ·{' '}
            <T color={track('rag')} weight="800" size={11.5}>
              go unlimited
            </T>
          </T>
        </Pressable>
      )}
    </View>
  );
}

/** Shared "free session almost over" upsell tail, reused by every card-kind branch. */
function PaywallTail({ show, remaining }: { show: boolean; remaining: number }) {
  const router = useRouter();
  const { track } = useTheme();
  if (!show) return null;
  return (
    <Pressable onPress={() => router.push('/paywall')} style={{ marginTop: 12 }}>
      <T muted size={11.5} weight="700" style={{ textAlign: 'center' }}>
        {remaining} card{remaining > 1 ? 's' : ''} left in today&apos;s free session ·{' '}
        <T color={track('rag')} weight="800" size={11.5}>
          go unlimited
        </T>
      </T>
    </Pressable>
  );
}

function ChoiceBlock({
  card,
  reveal,
  lastChoice,
  onChoose,
  onContinue,
}: {
  card: {
    opts?: { t: string; ok: boolean; why?: string }[];
    why?: string;
    fj: string;
    fs: string;
    lines?: string[];
    followups?: { q: string; a: string }[];
  };
  reveal: boolean;
  lastChoice: number | null;
  onChoose: (i: number) => void;
  onContinue: () => void;
}) {
  const { c, scheme } = useTheme();
  const opts = card.opts ?? [];
  const correctIdx = opts.findIndex((o) => o.ok);
  const gotIt = lastChoice === correctIdx;
  const fired = useRef(false);
  useEffect(() => {
    if (reveal && !fired.current) {
      fired.current = true;
      answerFeedback(gotIt);
    } else if (!reveal) {
      fired.current = false;
    }
  }, [reveal, gotIt]);

  return (
    <View style={{ marginTop: 14, gap: 9 }}>
      {card.lines ? <CodeBlock lines={card.lines} /> : null}
      {opts.map((o, i) => {
        let bd = c.border;
        let bg = c.card;
        if (reveal) {
          if (o.ok) {
            bd = c.success;
            bg = scheme === 'dark' ? 'rgba(63,185,80,.10)' : 'rgba(26,158,87,.10)';
          } else if (i === lastChoice) {
            bd = c.danger;
            bg = scheme === 'dark' ? 'rgba(248,81,73,.10)' : 'rgba(232,69,60,.09)';
          }
        }
        return (
          <View key={i}>
            <Pressable
              disabled={reveal}
              onPress={() => onChoose(i)}
              style={{
                flexDirection: 'row',
                gap: 10,
                alignItems: 'flex-start',
                borderWidth: 2,
                borderColor: bd,
                backgroundColor: bg,
                borderRadius: radius.md,
                padding: 13,
                opacity: reveal && !o.ok && i !== lastChoice ? 0.5 : 1,
              }}>
              <View
                style={{
                  width: 23,
                  height: 23,
                  borderRadius: 7,
                  backgroundColor: c.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <T weight="800" size={12}>
                  {String.fromCharCode(65 + i)}
                </T>
              </View>
              <T size={13} style={{ flex: 1, lineHeight: 18 }}>
                {o.t}
              </T>
            </Pressable>
            {reveal && o.why ? (
              <T size={11.5} color={c.muted} style={{ marginTop: 4, marginLeft: 6, lineHeight: 16 }}>
                {o.why}
              </T>
            ) : null}
          </View>
        );
      })}

      {reveal && (
        <View style={{ marginTop: 4 }}>
          <RichAnswer text={card.why ?? ''} size={13} />
          <RedFlag fj={card.fj} fs={card.fs} />
          <StuckHelp followups={card.followups} />
          <ResultFooter
            ok={gotIt}
            message={gotIt ? undefined : 'A common trap — review the explanation above.'}
            continueLabel="Continue →"
            onContinue={onContinue}
          />
        </View>
      )}
    </View>
  );
}

function Reveal({
  answer,
  fj,
  fs,
  code,
  followups,
  sourceUrl,
  sourceLabel,
  publishedAt,
  children,
}: {
  answer: string;
  fj: string;
  fs: string;
  code?: import('../lib/content').CodePanel[];
  followups?: { q: string; a: string }[];
  sourceUrl?: string;
  sourceLabel?: string;
  publishedAt?: string;
  children?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: 14 }}>
      <RichAnswer text={answer} size={13} />
      {code?.length ? <CodePanels panels={code} /> : null}
      <RedFlag fj={fj} fs={fs} />
      {followups?.length ? (
        <>
          <FollowUpCue color={c.accentInk} label="drill deeper" style={{ marginTop: 12 }} />
          <Followups items={followups} />
        </>
      ) : null}
      {sourceUrl ? <SourceRow url={sourceUrl} label={sourceLabel} publishedAt={publishedAt} /> : null}
      {children}
    </View>
  );
}

/** Drill-down: tappable follow-up questions that expand to reveal their answer. */
function Followups({ items, hideHeader }: { items: { q: string; a: string }[]; hideHeader?: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={{ marginTop: hideHeader ? 7 : 13, gap: 7 }}>
      {hideHeader ? null : (
        <T muted weight="800" size={11} style={{ letterSpacing: 0.4 }}>
          DRILL DEEPER
        </T>
      )}
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <Pressable
            key={i}
            onPress={() => {
              haptic.selection();
              setOpen(isOpen ? null : i);
            }}
            style={{
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              padding: 11,
              backgroundColor: isOpen ? c.surface : 'transparent',
            }}>
            <Row style={{ alignItems: 'flex-start', gap: 8 }}>
              <T size={12.5} weight="800" color={c.accentInk}>
                {isOpen ? '▾' : '▸'}
              </T>
              <T size={13} weight="700" style={{ flex: 1, lineHeight: 19 }}>
                {f.q}
              </T>
            </Row>
            {isOpen ? (
              <View style={{ marginTop: 8, paddingLeft: 20 }}>
                <RichAnswer text={f.a} size={12.5} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Tutor-feel expander (no runtime AI): a "still stuck?" affordance that progressively reveals the
 * pre-authored follow-up drill-downs — a different angle on the same idea. Flip cards already show
 * follow-ups inline; this brings the same help to choice/MCQ reveals where they were hidden.
 */
function StuckHelp({ followups }: { followups?: { q: string; a: string }[] }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  if (!followups?.length) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Pressable
        onPress={() => {
          haptic.selection();
          setOpen((o) => !o);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.md,
          paddingVertical: 11,
          paddingHorizontal: 12,
          backgroundColor: open ? c.surface : 'transparent',
        }}>
        <T size={14}>🤔</T>
        <T size={13} weight="800" style={{ flex: 1 }}>
          Still stuck? Explain it another way
        </T>
        <T size={12.5} weight="800" color={c.accentInk}>
          {open ? '▾' : '▸'}
        </T>
      </Pressable>
      {open ? <Followups items={followups} hideHeader /> : null}
    </View>
  );
}

function SourceRow({ url, label, publishedAt }: { url: string; label?: string; publishedAt?: string }) {
  const { scheme } = useTheme();
  const link = scheme === 'dark' ? '#4dabf7' : '#1c7ed6';
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={{
        marginTop: 11,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: scheme === 'dark' ? 'rgba(77,171,247,.10)' : 'rgba(28,126,214,.08)',
        borderRadius: radius.sm,
        paddingVertical: 8,
        paddingHorizontal: 11,
      }}>
      <T size={12}>🔗</T>
      <T size={11.5} weight="800" color={link} style={{ flex: 1 }}>
        Verified · {label ?? 'official source'}
        {publishedAt ? `  ·  ${publishedAt}` : ''}
      </T>
      <T size={11.5} weight="800" color={link}>open ↗</T>
    </Pressable>
  );
}

function RedFlag({ fj, fs }: { fj: string; fs: string }) {
  const { c } = useTheme();
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: c.danger, paddingLeft: 12, marginTop: 11 }}>
      <T size={12.5} style={{ lineHeight: 19 }}>
        <T color={c.danger} weight="800" size={12.5}>
          Junior:{' '}
        </T>
        {fj}
      </T>
      <T size={12.5} style={{ lineHeight: 19 }}>
        <T color={c.success} weight="800" size={12.5}>
          Senior:{' '}
        </T>
        {fs}
      </T>
    </View>
  );
}

function RateBtn({
  label,
  sub,
  kind,
  onPress,
}: {
  label: string;
  sub: string;
  kind: 'again' | 'good' | 'easy';
  onPress: () => void;
}) {
  const { c, scheme } = useTheme();
  const color = { again: c.danger, good: c.success, easy: '#1c7ed6' }[kind];
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: radius.md,
        paddingVertical: 12,
        paddingHorizontal: 6,
        backgroundColor: scheme === 'dark' ? color + '24' : color + '1f',
        alignItems: 'center',
      }}>
      <T weight="800" size={13} color={color}>
        {label}
      </T>
      <T size={10} weight="700" color={color} style={{ opacity: 0.8, marginTop: 2 }}>
        {sub}
      </T>
    </Pressable>
  );
}

/** Save / Like / Dislike — a content-quality + bookmark row below the SRS grade buttons.
 *  Save is independent of like/dislike; tapping the active reaction clears it (handled in the store). */
function FeedbackRow({
  saved,
  reaction,
  onSave,
  onLike,
  onDislike,
}: {
  saved: boolean;
  reaction: 'like' | 'dislike' | undefined;
  onSave: () => void;
  onLike: () => void;
  onDislike: () => void;
}) {
  const { c, scheme } = useTheme();
  const pill = (active: boolean, color: string) => ({
    flex: 1 as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    borderRadius: radius.md,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: active ? color : c.border,
    backgroundColor: active ? (scheme === 'dark' ? color + '24' : color + '1a') : 'transparent',
  });
  const save = '#1c7ed6';
  return (
    <Row style={{ gap: 9, marginTop: 12 }}>
      <Pressable onPress={onSave} style={pill(saved, save)}>
        <T size={12.5}>{saved ? '🔖' : '💾'}</T>
        <T size={12} weight="800" color={saved ? save : c.muted}>{saved ? 'Saved' : 'Save'}</T>
      </Pressable>
      <Pressable onPress={onLike} style={pill(reaction === 'like', c.success)}>
        <T size={12.5}>👍</T>
        <T size={12} weight="800" color={reaction === 'like' ? c.success : c.muted}>Like</T>
      </Pressable>
      <Pressable onPress={onDislike} style={pill(reaction === 'dislike', c.danger)}>
        <T size={12.5}>👎</T>
        <T size={12} weight="800" color={reaction === 'dislike' ? c.danger : c.muted}>Dislike</T>
      </Pressable>
    </Row>
  );
}

/** Push-permission priming (plan #4): asked AFTER a completed session, not during onboarding. */
function NotifPrime() {
  const notifAsked = useStore((s) => s.notifAsked);
  const setNotifAsked = useStore((s) => s.setNotifAsked);
  if (notifAsked) return null;
  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <T size={20}>🔔</T>
        <View style={{ flex: 1 }}>
          <T weight="800" size={14}>Keep your streak alive?</T>
          <T muted size={12} style={{ lineHeight: 17, marginTop: 2 }}>
            One gentle daily nudge — no spam. Change it anytime in Profile.
          </T>
        </View>
      </Row>
      <Row style={{ gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Btn label="Not now" variant="ghost" onPress={() => setNotifAsked(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Enable" variant="primary" onPress={() => { void requestPermission(); setNotifAsked(true); }} />
        </View>
      </Row>
    </Card>
  );
}

function Done() {
  const router = useRouter();
  const replay = useStore((s) => s.replay);
  const freezes = useStore((s) => s.freezes);
  const playful = useStore((s) => s.playful);
  const cardsToday = useStore((s) => s.cardsToday);
  const dailyGoal = useStore((s) => s.dailyGoal);
  const goalMet = cardsToday >= dailyGoal;
  return (
    <View style={{ gap: space.md }}>
      {playful ? <Confetti /> : null}
      <StreakHero variant="compact" />
      <NotifPrime />
      <Card style={{ alignItems: 'center', padding: 24 }}>
      {playful ? <Mascot mood="celebrate" size={96} /> : <T size={38}>✓</T>}
      <T size={22} weight="900" style={{ marginTop: 6 }}>
        {goalMet ? 'Daily goal complete' : 'All caught up for today'}
      </T>
      <T muted size={13} style={{ marginTop: 5, textAlign: 'center', lineHeight: 20 }}>
        Nothing else is due — your next cards are scheduled for tomorrow.
      </T>
      <Row style={{ marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Chip label={`📈 ${Math.min(cardsToday, dailyGoal)}/${dailyGoal} today`} kind="amber" />
        {freezes > 0 && <Chip label={`🧊 ${freezes} freeze${freezes > 1 ? 's' : ''}`} kind="amber" />}
      </Row>
      <View style={{ marginTop: 18, alignSelf: 'stretch', gap: 10 }}>
        <Btn label="📣 Share my streak" variant="navy" onPress={() => router.push('/share')} />
        <Btn label="📝 Just interviewed? Log a debrief" variant="ghost" onPress={() => router.push('/debrief')} />
        <Btn label="📚 Browse the library" variant="ghost" onPress={() => router.push('/library')} />
        <Btn label="↻ Replay this set" variant="ghost" onPress={replay} />
      </View>
      </Card>
    </View>
  );
}
