import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SessionCard } from '../lib/content';
import { useStore } from '../lib/store';
import { Rating } from '../lib/srs';
import { radius, useTheme } from '../lib/theme';
import { CellState, MetricTable } from './MetricTable';
import { CodeBlock, LineState } from './CodeBlock';
import { Card, Chip, RedFlag, Row, T, TrackBadge } from './kit';
import { ResultFooter } from './ResultFooter';
import { OptionList } from './Options';

type Tapped = { r: number; col: number } | number | null;

/**
 * `evidence` — read a panel (synthetic metric table OR code), tap the "tell" past the
 * red herring, then name the cause. Graded fully offline: tappedTell ∈ tells AND cause.ok.
 * Collapses to one `store.rate()` on Continue.
 */
export function EvidenceView({ card }: { card: SessionCard }) {
  const { c, track } = useTheme();
  const rate = useStore((s) => s.rate);
  const col = track(card.tk);
  const ev = card.evidence!;
  const isTable = ev.panel.kind === 'table';

  const [phase, setPhase] = useState<'tap' | 'cause' | 'revealed'>('tap');
  const [tellHit, setTellHit] = useState(false);
  const [tapped, setTapped] = useState<Tapped>(null);
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    setPhase('tap');
    setTellHit(false);
    setTapped(null);
    setChosen(null);
  }, [card.id]);

  const tableTells = ev.tells as Array<[number, number]>;
  const codeTells = ev.tells as number[];

  const tapCell = (r: number, colIdx: number) => {
    if (phase !== 'tap') return;
    const hit = tableTells.some(([tr, tc]) => tr === r && tc === colIdx);
    setTapped({ r, col: colIdx });
    setTellHit(hit);
    setPhase('cause');
  };
  const tapLine = (i: number) => {
    if (phase !== 'tap') return;
    const hit = codeTells.includes(i);
    setTapped(i);
    setTellHit(hit);
    setPhase('cause');
  };

  const cellState = (r: number, colIdx: number): CellState => {
    if (phase === 'tap') return undefined;
    if (tableTells.some(([tr, tc]) => tr === r && tc === colIdx)) return 'hit';
    if (tapped && typeof tapped === 'object' && tapped.r === r && tapped.col === colIdx) return 'miss';
    return undefined;
  };
  const lineState = (i: number): LineState => {
    if (phase === 'tap') return undefined;
    if (codeTells.includes(i)) return 'goodbug';
    if (tapped === i) return 'bug';
    return undefined;
  };

  const causeOk = chosen != null && !!ev.cause[chosen]?.ok;
  const rating: Rating = tellHit && causeOk ? 'good' : 'again';
  const good = rating !== 'again';

  const choose = (i: number) => {
    if (phase !== 'cause') return;
    setChosen(i);
    setPhase('revealed');
  };

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

      <View style={{ marginTop: 13 }}>
        {isTable ? (
          <MetricTable
            cells={(ev.panel as { kind: 'table'; cells: string[][] }).cells}
            tappable={phase === 'tap'}
            onTapCell={tapCell}
            cellState={cellState}
          />
        ) : (
          <CodeBlock
            lines={(ev.panel as { kind: 'code'; lines: string[] }).lines}
            tappable={phase === 'tap'}
            onTapLine={tapLine}
            lineState={lineState}
          />
        )}
      </View>

      {phase === 'tap' ? (
        <T muted size={11.5} style={{ textAlign: 'center', marginTop: 11 }}>
          tap the cell{isTable ? '' : '/line'} that points to the cause
        </T>
      ) : (
        <View style={{ marginTop: 14 }}>
          <T weight="800" size={13} color={tellHit ? c.success : c.danger} style={{ marginBottom: 8 }}>
            {tellHit ? '🎯 That’s the tell' : '✗ Not that one — the real tell is highlighted in green'}
          </T>
          <T weight="800" size={12} color={c.muted} style={{ letterSpacing: 0.4, marginBottom: 4 }}>
            WHAT DOES IT TELL YOU?
          </T>
          <OptionList opts={ev.cause} chosen={chosen} revealed={phase === 'revealed'} onChoose={choose} />
        </View>
      )}

      {phase === 'revealed' ? (
        <View style={{ marginTop: 13 }}>
          {/* Three states, not two — "right cause but missed the tell" used to render a flat ✗
              next to a green-highlighted correct option, which read as a contradiction. */}
          <T weight="800" size={15} color={good ? c.success : causeOk ? c.warn : c.danger} style={{ marginBottom: 7 }}>
            {good
              ? '🎉 Read it right'
              : causeOk
                ? '△ Right cause — but you tapped the wrong tell. Scheduling a rep.'
                : '✗ Wrong cause — re-read the panel'}
          </T>
          <T size={13} style={{ lineHeight: 20 }}>
            {ev.why}
          </T>
          <RedFlag fj={card.fj} fs={card.fs} />
          <ResultFooter ok={rating !== 'again'} continueLabel="Continue →" onContinue={() => rate(rating)} />
        </View>
      ) : null}
    </Card>
  );
}
