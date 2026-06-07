import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SessionCard } from '../lib/content';
import { useStore } from '../lib/store';
import { Rating } from '../lib/srs';
import { mono, radius, useTheme } from '../lib/theme';
import { Btn, Card, Chip, RedFlag, Row, T, TrackBadge } from './kit';
import { ResultFooter } from './ResultFooter';

const arrEq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * `match` — fill-the-blank (tap one chip into a hole) OR assemble (tap chunked tokens
 * into a sequence). Assemble is multi-solution: the tapped tokens' `pos` sequence must
 * match any `acceptedSeqs` entry. One `store.rate()` on Continue.
 */
export function MatchView({ card }: { card: SessionCard }) {
  const { c, track } = useTheme();
  const rate = useStore((s) => s.rate);
  const col = track(card.tk);
  const m = card.match!;
  const isFill = !!m.blank;

  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<number | null>(null); // fill: chosen chip
  const [used, setUsed] = useState<number[]>([]); // assemble: bank indices in tapped order
  const [rating, setRating] = useState<Rating>('again');

  useEffect(() => {
    setRevealed(false);
    setPicked(null);
    setUsed([]);
    setRating('again');
  }, [card.id]);

  const pickChip = (i: number) => {
    if (revealed || !m.blank) return;
    setPicked(i);
    setRating(m.blank[i].ok ? 'good' : 'again');
    setRevealed(true);
  };

  const tapTok = (bi: number) => {
    if (revealed || used.includes(bi)) return;
    setUsed((u) => [...u, bi]);
  };
  const untap = (bi: number) => {
    if (revealed) return;
    setUsed((u) => u.filter((x) => x !== bi));
  };
  const checkAsm = () => {
    if (revealed || !m.bank) return;
    const posSeq = used.map((bi) => m.bank![bi].pos);
    const ok = (m.acceptedSeqs ?? []).some((s) => arrEq(s, posSeq));
    setRating(ok ? 'good' : 'again');
    setRevealed(true);
  };

  const good = rating !== 'again';
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
        <Chip label={card.tag} />
      </Row>
      <T size={17} weight="700" style={{ lineHeight: 24 }}>
        {card.q}
      </T>

      {isFill ? (
        <View style={{ marginTop: 14 }}>
          <View style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: 12 }}>
            <T size={13} style={{ fontFamily: mono, lineHeight: 22 }}>
              {m.template?.[0] ?? ''}
              <T
                size={13}
                weight="800"
                style={{ fontFamily: mono }}
                color={revealed ? (m.blank![picked!].ok ? c.success : c.danger) : col}>
                {picked != null ? m.blank![picked].t : '____'}
              </T>
              {m.template?.slice(1).join('') ?? ''}
            </T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 }}>
            {m.blank!.map((chip, i) => {
              const bd = revealed ? (chip.ok ? c.success : i === picked ? c.danger : c.border) : c.border;
              return (
                <Pressable
                  key={i}
                  disabled={revealed}
                  onPress={() => pickChip(i)}
                  style={{ ...tokenStyle, borderColor: bd }}>
                  <T size={11.5} weight="700" style={{ fontFamily: mono }}>
                    {chip.t}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 14 }}>
          <View
            style={{
              minHeight: 44,
              borderWidth: 2,
              borderStyle: revealed ? 'solid' : 'dashed',
              borderColor: revealed ? (good ? c.success : c.danger) : c.border,
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
                  {m.bank![bi].t}
                </T>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
            {m.bank!.map((tok, bi) => {
              const isUsed = used.includes(bi);
              return (
                <Pressable
                  key={bi}
                  disabled={isUsed || revealed}
                  onPress={() => tapTok(bi)}
                  style={{ ...tokenStyle, opacity: isUsed ? 0.3 : 1 }}>
                  <T size={11.5} weight="700" style={{ fontFamily: mono }}>
                    {tok.t}
                  </T>
                </Pressable>
              );
            })}
          </View>
          {!revealed ? (
            <Btn label="Check" variant="navy" style={{ marginTop: 12 }} onPress={checkAsm} />
          ) : null}
        </View>
      )}

      {revealed ? (
        <View style={{ marginTop: 13 }}>
          <T weight="800" size={15} color={good ? c.success : c.danger}>
            {good ? '🎉 Senior answer' : '✗ Not quite'}
          </T>
          {m.why ? (
            <T size={13} style={{ lineHeight: 20, marginTop: 6 }}>
              {m.why}
            </T>
          ) : null}
          <RedFlag fj={card.fj} fs={card.fs} />
          <ResultFooter ok={rating !== 'again'} continueLabel="Continue →" onContinue={() => rate(rating)} />
        </View>
      ) : null}
    </Card>
  );
}
