import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SessionCard } from '../lib/content';
import { useStore } from '../lib/store';
import { Rating } from '../lib/srs';
import { radius, useTheme } from '../lib/theme';
import { CodeBlock } from './CodeBlock';
import { MetricTable } from './MetricTable';
import { Btn, Card, Chip, RedFlag, Row, T, TrackBadge } from './kit';

/**
 * `classify` — read an artifact (model output / prompt + context) and tap one label.
 * The truth is pinned by the authored artifact (e.g. faithful vs hallucinated vs
 * should-abstain is decidable from the shown context). One `store.rate()` on Continue.
 */
export function ClassifyView({ card }: { card: SessionCard }) {
  const { c, track, scheme } = useTheme();
  const rate = useStore((s) => s.rate);
  const col = track(card.tk);
  const cl = card.classify!;

  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [card.id]);

  const revealed = picked != null;
  const correct = picked === cl.answer;
  const rating: Rating = correct ? 'good' : 'again';

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

      {cl.context ? (
        <View style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: 12, marginTop: 12 }}>
          <T size={13} style={{ lineHeight: 20 }}>
            {cl.context}
          </T>
        </View>
      ) : null}
      {cl.panel ? (
        <View style={{ marginTop: 12 }}>
          {cl.panel.kind === 'table' ? (
            <MetricTable cells={cl.panel.cells} />
          ) : (
            <CodeBlock lines={cl.panel.lines} />
          )}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {cl.labels.map((label, i) => {
          let bd = c.border;
          let bg = c.card;
          if (revealed) {
            if (i === cl.answer) {
              bd = c.success;
              bg = scheme === 'dark' ? 'rgba(63,185,80,.10)' : 'rgba(26,158,87,.10)';
            } else if (i === picked) {
              bd = c.danger;
              bg = scheme === 'dark' ? 'rgba(248,81,73,.10)' : 'rgba(232,69,60,.09)';
            }
          }
          return (
            <Pressable
              key={i}
              disabled={revealed}
              onPress={() => setPicked(i)}
              style={{
                borderWidth: 2,
                borderColor: bd,
                backgroundColor: bg,
                borderRadius: 999,
                paddingVertical: 9,
                paddingHorizontal: 14,
              }}>
              <T size={13} weight="800">
                {label}
              </T>
            </Pressable>
          );
        })}
      </View>

      {revealed ? (
        <View style={{ marginTop: 14 }}>
          <T weight="800" size={15} color={correct ? c.success : c.danger} style={{ marginBottom: 7 }}>
            {correct ? '🎉 Right call' : '✗ Re-read it'}
          </T>
          <T size={13} style={{ lineHeight: 20 }}>
            {cl.why}
          </T>
          <RedFlag fj={card.fj} fs={card.fs} />
          <Btn label="Continue →" variant="green" style={{ marginTop: 13 }} onPress={() => rate(rating)} />
        </View>
      ) : null}
    </Card>
  );
}
