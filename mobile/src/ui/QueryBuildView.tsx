import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CODE_PROBLEMS } from '../lib/codeProblems';
import { SessionCard } from '../lib/content';
import { useStore } from '../lib/store';
import { Rating, strength } from '../lib/srs';
import { mono, radius, useTheme } from '../lib/theme';
import { CodeBlock } from './CodeBlock';
import { Btn, Card, Chip, RedFlag, Row, T, TrackBadge } from './kit';
import { ResultFooter } from './ResultFooter';
import { OptionList } from './Options';
import { WebCrossSell } from './WebCrossSell';

const arrEq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const HINT_COST = 5;

type Tier = 'full' | 'assemble' | 'recall';

/**
 * `querybuild` — one full "write the query/transform/prompt" problem decomposed into a
 * faded-scaffold lesson. Tier is chosen from the EXISTING SM-2 history (expertise-reversal):
 *   reps 0 → full lesson (hints → gated beats → token-bank capstone)
 *   seen, strength < .6 → assemble-only
 *   mastered → free-recall checklist
 * Multi-solution capstone (acceptedSeqs), show-the-result on success, hint ladder (XP cost),
 * and the web cross-sell for the live Run/AI-grade. One `store.rate()`.
 */
export function QueryBuildView({ card }: { card: SessionCard }) {
  const { c, track } = useTheme();
  const router = useRouter();
  const rate = useStore((s) => s.rate);
  const applyHintCost = useStore((s) => s.applyHintCost);
  const st = useStore((s) => s.progress[card.id]);
  const col = track(card.tk);
  const qb = card.querybuild!;
  const bank = qb.assemble.bank ?? [];
  // If this card maps to a real executable problem, offer the on-device "Solve & run" handoff.
  const runnable = CODE_PROBLEMS.find((p) => p.id === qb.webx?.problemId);

  const tier: Tier = (st?.reps ?? 0) === 0 ? 'full' : strength(st) < 0.6 ? 'assemble' : 'recall';
  const showBeats = tier === 'full';
  const beats = useMemo(() => (showBeats ? qb.beats : []), [showBeats, qb.beats]);

  // hint ladder (full + assemble)
  const [hintsShown, setHintsShown] = useState(0);

  // gated beats (full only)
  const [bCommitted, setBCommitted] = useState<boolean[]>(() => beats.map(() => false));
  const [bChosen, setBChosen] = useState<(number | null)[]>(() => beats.map(() => null));
  const [bCorrect, setBCorrect] = useState<boolean[]>(() => beats.map(() => false));

  // assemble capstone (full + assemble)
  const [used, setUsed] = useState<number[]>([]);
  const [asmRevealed, setAsmRevealed] = useState(false);
  const [asmOk, setAsmOk] = useState(false);

  // recall checklist (mastery)
  const recallItems = useMemo(
    () =>
      bank
        .filter((t) => t.pos >= 0)
        .sort((a, b) => a.pos - b.pos)
        .map((t) => t.t),
    [bank]
  );
  const [checked, setChecked] = useState<boolean[]>(() => recallItems.map(() => false));
  const [recallRevealed, setRecallRevealed] = useState(false);

  useEffect(() => {
    setHintsShown(0);
    setBCommitted(beats.map(() => false));
    setBChosen(beats.map(() => null));
    setBCorrect(beats.map(() => false));
    setUsed([]);
    setAsmRevealed(false);
    setAsmOk(false);
    setChecked(recallItems.map(() => false));
    setRecallRevealed(false);
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const giveHint = () => {
    if (hintsShown >= qb.hints.length) return;
    applyHintCost(HINT_COST);
    setHintsShown((n) => n + 1);
  };

  const setAt = <V,>(arr: V[], i: number, v: V) => arr.map((x, j) => (j === i ? v : x));
  const activeBeat = bCommitted.indexOf(false);
  const beatsDone = beats.length === 0 || activeBeat === -1;
  const commitBeat = (i: number, idx: number, ok: boolean) => {
    setBChosen((a) => setAt(a, i, idx));
    setBCorrect((a) => setAt(a, i, ok));
    setBCommitted((a) => setAt(a, i, true));
  };

  const tapTok = (bi: number) => {
    if (asmRevealed || used.includes(bi)) return;
    setUsed((u) => [...u, bi]);
  };
  const untap = (bi: number) => {
    if (asmRevealed) return;
    setUsed((u) => u.filter((x) => x !== bi));
  };
  const checkAsm = () => {
    if (asmRevealed) return;
    const posSeq = used.map((bi) => bank[bi].pos);
    setAsmOk(qb.acceptedSeqs.some((s) => arrEq(s, posSeq)));
    setAsmRevealed(true);
  };

  const hit = checked.filter(Boolean).length;
  const recallRatio = recallItems.length ? hit / recallItems.length : 0;

  const asmRating: Rating = !asmOk
    ? 'again'
    : hintsShown === 0 && (tier !== 'full' || bCorrect.every(Boolean))
      ? 'easy'
      : 'good';
  const recallRating: Rating = recallRatio >= 1 ? 'easy' : recallRatio >= 0.6 ? 'good' : 'again';

  const tokenStyle = {
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: c.card,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 8,
  } as const;

  return (
    <Card style={{ borderRadius: radius.xl, overflow: 'hidden', minHeight: 230 }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: col }} />
      <Row style={{ marginBottom: 11, flexWrap: 'wrap' }}>
        <TrackBadge label={card.tool} color={col} />
        <Chip label={tier === 'full' ? 'Full lesson' : tier === 'assemble' ? 'Assemble · faded' : 'Recall · mastery'} />
      </Row>
      <T size={17} weight="700" style={{ lineHeight: 24 }}>
        {card.q}
      </T>

      {/* setup / schema + example rows */}
      <View style={{ marginTop: 12 }}>
        <CodeBlock lines={[qb.setup.schema, ...qb.setup.rows]} />
      </View>

      {/* hint ladder (full + assemble) */}
      {tier !== 'recall' ? (
        <View style={{ marginTop: 12 }}>
          <Pressable
            onPress={giveHint}
            disabled={hintsShown >= qb.hints.length}
            style={{
              alignSelf: 'flex-start',
              borderWidth: 1.5,
              borderColor: c.border,
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 12,
              opacity: hintsShown >= qb.hints.length ? 0.5 : 1,
            }}>
            <T size={12} weight="800" color={c.accentInk}>
              💡 Gimme a Hint{hintsShown < qb.hints.length ? `  −${HINT_COST} XP` : ' (no more)'}
            </T>
          </Pressable>
          {qb.hints.slice(0, hintsShown).map((h, i) => (
            <T key={i} size={12.5} style={{ lineHeight: 18, marginTop: 7 }}>
              Hint {i + 1} — {h}
            </T>
          ))}
        </View>
      ) : null}

      {/* gated beats (full only) */}
      {showBeats
        ? beats.map((beat, i) => {
            if (i > activeBeat && !beatsDone) return null;
            return (
              <View key={i} style={{ marginTop: 16 }}>
                <T weight="800" size={13} style={{ marginBottom: 7 }}>
                  {beat.prompt}
                </T>
                <OptionList
                  opts={beat.opts ?? []}
                  chosen={bChosen[i]}
                  revealed={bCommitted[i]}
                  onChoose={(idx) => commitBeat(i, idx, !!beat.opts?.[idx]?.ok)}
                />
                {bCommitted[i] ? (
                  <T size={12.5} style={{ lineHeight: 19, marginTop: 8 }}>
                    {beat.why}
                  </T>
                ) : null}
              </View>
            );
          })
        : null}

      {/* capstone — assemble (full + assemble), after beats are done */}
      {tier !== 'recall' && beatsDone ? (
        <View style={{ marginTop: 16 }}>
          <T weight="800" size={13} style={{ marginBottom: 8 }}>
            Assemble the whole query
          </T>
          <View
            style={{
              minHeight: 44,
              borderWidth: 2,
              borderStyle: asmRevealed ? 'solid' : 'dashed',
              borderColor: asmRevealed ? (asmOk ? c.success : c.danger) : c.border,
              borderRadius: radius.md,
              padding: 9,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              alignContent: 'flex-start',
            }}>
            {used.map((bi) => (
              <Pressable
                key={bi}
                onPress={() => untap(bi)}
                style={{
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 9,
                  paddingHorizontal: 9,
                  paddingVertical: 6,
                }}>
                <T size={11.5} weight="700" style={{ fontFamily: mono }}>
                  {bank[bi].t}
                </T>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
            {bank.map((tok, bi) => {
              const isUsed = used.includes(bi);
              return (
                <Pressable
                  key={bi}
                  disabled={isUsed || asmRevealed}
                  onPress={() => tapTok(bi)}
                  style={{ ...tokenStyle, opacity: isUsed ? 0.3 : 1 }}>
                  <T size={11.5} weight="700" style={{ fontFamily: mono }}>
                    {tok.t}
                  </T>
                </Pressable>
              );
            })}
          </View>
          {!asmRevealed ? <Btn label="Check query" variant="navy" style={{ marginTop: 12 }} onPress={checkAsm} /> : null}
        </View>
      ) : null}

      {/* recall checklist (mastery) */}
      {tier === 'recall' ? (
        <View style={{ marginTop: 14 }}>
          <T weight="800" size={12} color={c.muted} style={{ letterSpacing: 0.4, marginBottom: 8 }}>
            FREE RECALL — tick every clause you&apos;d write
          </T>
          {recallItems.map((it, i) => {
            const on = checked[i];
            return (
              <Pressable
                key={i}
                onPress={() => setChecked((cur) => setAt(cur, i, !cur[i]))}
                disabled={recallRevealed}
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
                <T size={12.5} style={{ flex: 1, lineHeight: 18, fontFamily: mono }}>
                  {it}
                </T>
              </Pressable>
            );
          })}
          {!recallRevealed ? (
            <Btn label="Reveal" variant="navy" style={{ marginTop: 4 }} onPress={() => setRecallRevealed(true)} />
          ) : null}
        </View>
      ) : null}

      {/* finale — show-the-result + cross-sell + one rate() */}
      {(tier !== 'recall' && asmRevealed) || (tier === 'recall' && recallRevealed) ? (
        <View style={{ marginTop: 14 }}>
          {(() => {
            const finalRating = tier === 'recall' ? recallRating : asmRating;
            const ok = finalRating !== 'again';
            return (
              <>
                <T weight="800" size={15} color={ok ? c.success : c.danger}>
                  {finalRating === 'easy' ? '⚡ Strong answer' : ok ? '✅ That works' : '✗ Not quite — review'}
                </T>
                {ok ? (
                  <View
                    style={{
                      marginTop: 9,
                      backgroundColor: c.surface,
                      borderRadius: radius.sm,
                      paddingVertical: 8,
                      paddingHorizontal: 11,
                    }}>
                    <T size={12} style={{ fontFamily: mono }}>
                      ▶ runs on the example → {qb.setup.expected}
                    </T>
                  </View>
                ) : null}
                <RedFlag fj={card.fj} fs={card.fs} />
                {runnable ? (
                  <Btn
                    label="▶ Solve & run it for real"
                    variant="navy"
                    style={{ marginTop: 10 }}
                    onPress={() => router.push(`/code?lang=${runnable.lang}&problem=${runnable.id}` as Href)}
                  />
                ) : null}
                <WebCrossSell webx={qb.webx} />
                <ResultFooter
                  ok={ok}
                  continueLabel="Save & schedule"
                  onContinue={() => rate(finalRating)}
                />
              </>
            );
          })()}
        </View>
      ) : null}
    </Card>
  );
}
