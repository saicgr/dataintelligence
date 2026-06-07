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
 * `order` — reorder rows (↑/↓) into a correct sequence. Accepts ≥1 valid permutation
 * (`order.accepted`), so Parsons-style problems with interchangeable lines aren't punished.
 * Commit ("Check") → reveal why + tell → one `store.rate()` on Continue (scheduler contract).
 */
export function OrderView({ card }: { card: SessionCard }) {
  const { c, track } = useTheme();
  const rate = useStore((s) => s.rate);
  const col = track(card.tk);
  const spec = card.order!;
  const n = spec.rows.length;

  const [cur, setCur] = useState<number[]>(() => spec.rows.map((_, i) => i));
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState<Rating>('again');

  useEffect(() => {
    setCur(spec.rows.map((_, i) => i));
    setRevealed(false);
    setRating('again');
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (pos: number, dir: -1 | 1) => {
    if (revealed) return;
    const j = pos + dir;
    if (j < 0 || j >= n) return;
    setCur((prev) => {
      const next = [...prev];
      [next[pos], next[j]] = [next[j], next[pos]];
      return next;
    });
  };

  const check = () => {
    const ok = spec.accepted.some((seq) => arrEq(seq, cur));
    setRating(ok ? 'good' : 'again');
    setRevealed(true);
  };

  const canonical = spec.accepted[0] ?? [];
  const good = rating !== 'again';

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

      <View style={{ marginTop: 14, gap: 8 }}>
        {cur.map((src, pos) => {
          const isCorrectPos = revealed && canonical[pos] === src;
          const bd = revealed ? (isCorrectPos ? c.success : c.danger) : c.border;
          return (
            <View
              key={src}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 2,
                borderColor: bd,
                backgroundColor: c.card,
                borderRadius: radius.md,
                padding: 9,
              }}>
              <View style={{ gap: 3 }}>
                <Pressable
                  onPress={() => move(pos, -1)}
                  disabled={revealed}
                  style={{ backgroundColor: c.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <T size={11} weight="800" color={c.muted}>
                    ▲
                  </T>
                </Pressable>
                <Pressable
                  onPress={() => move(pos, 1)}
                  disabled={revealed}
                  style={{ backgroundColor: c.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <T size={11} weight="800" color={c.muted}>
                    ▼
                  </T>
                </Pressable>
              </View>
              <T
                size={spec.mono ? 12 : 13}
                style={{ flex: 1, lineHeight: 18, fontFamily: spec.mono ? mono : undefined }}>
                {spec.rows[src]}
              </T>
            </View>
          );
        })}
      </View>

      {!revealed ? (
        <Btn label="Check order" variant="navy" style={{ marginTop: 14 }} onPress={check} />
      ) : (
        <View style={{ marginTop: 14 }}>
          <T weight="800" size={15} color={good ? c.success : c.danger} style={{ marginBottom: 8 }}>
            {good ? '🎉 Right sequence' : '✗ Sequence off'}
          </T>
          {card.why ? (
            <T size={13} style={{ lineHeight: 20 }}>
              {card.why}
            </T>
          ) : null}
          <RedFlag fj={card.fj} fs={card.fs} />
          <ResultFooter ok={rating !== 'again'} continueLabel="Continue →" onContinue={() => rate(rating)} />
        </View>
      )}
    </Card>
  );
}
