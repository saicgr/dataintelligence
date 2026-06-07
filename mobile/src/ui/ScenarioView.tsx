import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { SessionCard } from '../lib/content';
import { type PeerAnswer, submitScenarioAnswer, topPeerAnswers, upvotePeerAnswer } from '../lib/peerAnswers';
import { useStore } from '../lib/store';
import { Rating } from '../lib/srs';
import { radius, useTheme } from '../lib/theme';
import { Btn, Card, Chip, Row, T, TrackBadge } from './kit';
import { RichAnswer } from './RichAnswer';

const THINK_SECONDS = 90;

/** Auto-detect which key points the typed answer covers (offline text parse, adjustable). */
function coverage(text: string, rubric: string[]): boolean[] {
  const txt = text.toLowerCase();
  if (!txt.trim()) return rubric.map(() => false);
  return rubric.map((item) => {
    const kws = item.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? [];
    if (!kws.length) return false;
    const hits = kws.filter((k) => txt.includes(k)).length;
    return hits >= Math.min(2, kws.length);
  });
}

/**
 * Produce-before-reveal articulation card. Write (or dictate) your answer, commit, then the
 * model answer unlocks and we auto-tick the key points your text covered (you can adjust).
 * Coverage ratio feeds the spaced-repetition scheduler via store.rate().
 */
export function ScenarioView({ card }: { card: SessionCard }) {
  const { c, track } = useTheme();
  const rate = useStore((s) => s.rate);
  const col = track(card.tk);

  const arc = card.arc ?? [];
  const rubric = card.rubric ?? [];

  const userId = useStore((s) => s.userId);
  const [peers, setPeers] = useState<PeerAnswer[]>([]);
  const [phase, setPhase] = useState<'intro' | 'write' | 'revealed'>('intro');
  const [text, setText] = useState('');
  const [left, setLeft] = useState(THINK_SECONDS);
  const [checked, setChecked] = useState<boolean[]>(() => rubric.map(() => false));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // reset whenever the card changes (next in the session)
  useEffect(() => {
    setPhase('intro');
    setText('');
    setLeft(THINK_SECONDS);
    setChecked(rubric.map(() => false));
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // when the answer is committed, auto-tick the key points the text covered
  useEffect(() => {
    if (phase === 'revealed') setChecked(coverage(text, rubric));
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // On reveal: contribute the (anonymized) answer + load how peers answered (no-op without Supabase).
  useEffect(() => {
    if (phase !== 'revealed') return;
    if (text.trim().length > 20) void submitScenarioAnswer(card.id, text.trim(), userId);
    topPeerAnswers(card.id).then(setPeers).catch(() => {});
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // gentle countdown during the "write" phase; auto-reveals at 0
  useEffect(() => {
    if (phase !== 'write') return;
    timer.current = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(timer.current!);
          setPhase('revealed');
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [phase]);

  const hit = checked.filter(Boolean).length;
  const ratio = rubric.length ? hit / rubric.length : 0;
  const rating: Rating = ratio >= 1 ? 'easy' : ratio >= 0.6 ? 'good' : 'again';

  return (
    <Card style={{ borderRadius: radius.xl, overflow: 'hidden', minHeight: 230 }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: col }} />
      <Row style={{ marginBottom: 11, flexWrap: 'wrap' }}>
        <TrackBadge label={card.tool} color={col} />
        <Chip label="✍️ Explain it" />
      </Row>

      {card.framing ? (
        <View style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: 12, marginBottom: 12 }}>
          <T size={13.5} style={{ lineHeight: 20 }}>
            {card.framing}
          </T>
        </View>
      ) : null}

      <T size={17} weight="700" style={{ lineHeight: 24 }}>
        {card.q}
      </T>

      {phase === 'intro' && (
        <View style={{ marginTop: 16 }}>
          <Btn label="✍️ Write your answer" variant="navy" onPress={() => setPhase('write')} />
          <T muted size={11.5} style={{ textAlign: 'center', marginTop: 10, lineHeight: 17 }}>
            Type it (the keyboard 🎙 works for voice). The answer unlocks only after you commit — no peeking.
          </T>
        </View>
      )}

      {phase === 'write' && (
        <View style={{ marginTop: 14 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <T muted size={12} weight="800">Your answer</T>
            <T weight="900" size={14} color={left <= 10 ? c.danger : c.muted}>
              {left}s
            </T>
          </Row>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder="diagnose first → root cause → fix → trade-off → quantify…"
              placeholderTextColor={c.muted}
              multiline
              style={{
                flex: 1,
                borderWidth: 2,
                borderColor: c.border,
                borderRadius: radius.md,
                padding: 12,
                color: c.fg,
                backgroundColor: c.surface,
                minHeight: 110,
                textAlignVertical: 'top',
                fontSize: 13.5,
              }}
            />
            <Pressable
              onPress={() => inputRef.current?.focus()}
              hitSlop={6}
              style={{
                width: 46,
                height: 46,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: c.border,
                backgroundColor: c.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <T size={20}>🎙</T>
            </Pressable>
          </View>
          <T muted size={10.5} style={{ marginTop: 6 }}>
            Type, or tap 🎙 and use your keyboard&apos;s dictation.
          </T>
          <Btn label="Reveal answer" variant="navy" style={{ marginTop: 12 }} onPress={() => setPhase('revealed')} />
        </View>
      )}

      {phase === 'revealed' && (
        <View style={{ marginTop: 14 }}>
          <T weight="800" size={12} color={col} style={{ letterSpacing: 0.5, marginBottom: 8 }}>
            MODEL ANSWER
          </T>
          {arc.map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 11 }}>
              <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
                <T color="#fff" weight="900" size={11}>{i + 1}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T weight="800" size={13}>{step.label}</T>
                <RichAnswer text={step.body} size={12.5} />
              </View>
            </View>
          ))}

          <T weight="800" size={12} color={c.muted} style={{ letterSpacing: 0.4, marginTop: 6, marginBottom: 8 }}>
            KEY POINTS — we ticked what your answer covered (adjust if off)
          </T>
          {rubric.map((crit, i) => {
            const on = checked[i];
            return (
              <Pressable
                key={i}
                onPress={() => setChecked((cur) => cur.map((v, j) => (j === i ? !v : v)))}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                  borderWidth: 2,
                  borderColor: on ? c.success : c.border,
                  backgroundColor: on ? c.success + '14' : c.card,
                  borderRadius: radius.md,
                  padding: 11,
                  marginBottom: 8,
                }}>
                <T weight="900" size={14} color={on ? c.success : c.muted}>
                  {on ? '☑' : '☐'}
                </T>
                <T size={12.5} style={{ flex: 1, lineHeight: 18 }}>{crit}</T>
              </Pressable>
            );
          })}

          <Row style={{ marginTop: 4, marginBottom: 10 }}>
            <T weight="800" size={13} color={ratio >= 0.6 ? c.success : c.danger}>
              {hit}/{rubric.length} key points
            </T>
            <View style={{ flex: 1 }} />
            <T muted size={11.5} weight="700">
              {rating === 'easy' ? 'nailed it' : rating === 'good' ? 'solid' : 'review again soon'}
            </T>
          </Row>

          {peers.length > 0 && (
            <View style={{ marginTop: 4, marginBottom: 12, gap: 7 }}>
              <T muted weight="800" size={11} style={{ letterSpacing: 0.4 }}>HOW PEERS ANSWERED</T>
              {peers.map((p) => (
                <View key={p.id} style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: 11 }}>
                  <T size={12.5} style={{ lineHeight: 18 }}>{p.body}</T>
                  <Pressable onPress={() => void upvotePeerAnswer(p.id)} hitSlop={6} style={{ marginTop: 6 }}>
                    <T size={11.5} weight="800" color={c.accentInk}>▲ {p.votes} helpful</T>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Btn label="Save & schedule" variant="green" onPress={() => rate(rating)} />

          <T muted size={11} style={{ textAlign: 'center', marginTop: 11, lineHeight: 16 }}>
            Want this graded with AI follow-ups? That&apos;s the web interviewer.
          </T>
        </View>
      )}
    </Card>
  );
}
