import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { DiagStep, SessionCard } from '../lib/content';
import { useStore } from '../lib/store';
import { Rating } from '../lib/srs';
import { radius, useTheme } from '../lib/theme';
import { CellState, MetricTable } from './MetricTable';
import { CodeBlock, LineState } from './CodeBlock';
import { Card, Chip, RedFlag, Row, T, TrackBadge } from './kit';
import { ResultFooter } from './ResultFooter';
import { OptionList } from './Options';
import { WebCrossSell } from './WebCrossSell';

type Tapped = { r: number; col: number } | number | null;

/**
 * `diag` — the flagship: work the whole loop one COMMITTED beat at a time
 * (inspect → read-evidence → infer → fix → verify). Each beat gates the next; a wrong
 * INSPECT shows its consequence (you feel the cost). The five booleans collapse to ONE
 * `store.rate()`; the card ends on a web cross-sell (the live rep).
 */
export function DiagView({ card }: { card: SessionCard }) {
  const { c, track } = useTheme();
  const rate = useStore((s) => s.rate);
  const col = track(card.tk);
  const steps = card.diag!.steps;
  const webx = card.diag!.webx;

  const [committed, setCommitted] = useState<boolean[]>(() => steps.map(() => false));
  const [correct, setCorrect] = useState<boolean[]>(() => steps.map(() => false));
  const [chosen, setChosen] = useState<(number | null)[]>(() => steps.map(() => null));
  const [tapped, setTapped] = useState<Tapped[]>(() => steps.map(() => null));

  useEffect(() => {
    setCommitted(steps.map(() => false));
    setCorrect(steps.map(() => false));
    setChosen(steps.map(() => null));
    setTapped(steps.map(() => null));
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeStep = committed.indexOf(false);
  const allDone = activeStep === -1;

  const setAt = <T,>(arr: T[], i: number, v: T) => arr.map((x, j) => (j === i ? v : x));

  const commitMCQ = (i: number, ok: boolean, idx: number) => {
    setChosen((a) => setAt(a, i, idx));
    setCorrect((a) => setAt(a, i, ok));
    setCommitted((a) => setAt(a, i, true));
  };
  const commitEvidence = (i: number, hit: boolean, t: Tapped) => {
    setTapped((a) => setAt(a, i, t));
    setCorrect((a) => setAt(a, i, hit));
    setCommitted((a) => setAt(a, i, true));
  };

  const rating: Rating = useMemo(() => {
    if (correct.every(Boolean)) return 'easy';
    const inferIdx = steps.findIndex((s) => s.kind === 'infer');
    const fixIdx = steps.findIndex((s) => s.kind === 'fix');
    const inferOk = inferIdx < 0 || correct[inferIdx];
    const fixOk = fixIdx < 0 || correct[fixIdx];
    return inferOk && fixOk ? 'good' : 'again';
  }, [correct, steps]);
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

      {steps.map((step, i) => {
        if (i > activeStep && !allDone) return null;
        return (
          <StepBody
            key={i}
            step={step}
            n={i + 1}
            accent={col}
            committed={committed[i]}
            correct={correct[i]}
            chosen={chosen[i]}
            tapped={tapped[i]}
            onChooseMCQ={(idx, ok) => commitMCQ(i, ok, idx)}
            onTapTell={(hit, t) => commitEvidence(i, hit, t)}
          />
        );
      })}

      {allDone ? (
        <View style={{ marginTop: 14 }}>
          <T weight="800" size={15} color={good ? c.success : c.danger} style={{ marginBottom: 6 }}>
            {rating === 'easy' ? '⚡ Clean diagnosis' : good ? '✅ Root cause + fix' : '✗ Missed the root cause'}
          </T>
          <RedFlag fj={card.fj} fs={card.fs} />
          {webx ? <WebCrossSell webx={webx} /> : null}
          <ResultFooter ok={rating !== 'again'} continueLabel="Save & schedule" onContinue={() => rate(rating)} />
        </View>
      ) : null}
    </Card>
  );
}

function StepBody({
  step,
  n,
  accent,
  committed,
  correct,
  chosen,
  tapped,
  onChooseMCQ,
  onTapTell,
}: {
  step: DiagStep;
  n: number;
  accent: string;
  committed: boolean;
  correct: boolean;
  chosen: number | null;
  tapped: Tapped;
  onChooseMCQ: (idx: number, ok: boolean) => void;
  onTapTell: (hit: boolean, t: Tapped) => void;
}) {
  const { c } = useTheme();

  const head = (
    <Row style={{ marginTop: 16, marginBottom: 8 }}>
      <View
        style={{
          width: 21,
          height: 21,
          borderRadius: 7,
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <T color="#fff" weight="900" size={10.5}>
          {String(n)}
        </T>
      </View>
      <T weight="800" size={13} style={{ flex: 1 }}>
        {step.prompt}
      </T>
    </Row>
  );

  const isEvidence = step.kind === 'evidence';

  let body: React.ReactNode = null;
  if (isEvidence && step.panel) {
    const isTable = step.panel.kind === 'table';
    const tableTells = (step.tells ?? []) as Array<[number, number]>;
    const codeTells = (step.tells ?? []) as number[];
    const cellState = (r: number, colIdx: number): CellState => {
      if (!committed) return undefined;
      if (tableTells.some(([tr, tc]) => tr === r && tc === colIdx)) return 'hit';
      if (tapped && typeof tapped === 'object' && tapped.r === r && tapped.col === colIdx) return 'miss';
      return undefined;
    };
    const lineState = (idx: number): LineState => {
      if (!committed) return undefined;
      if (codeTells.includes(idx)) return 'goodbug';
      if (tapped === idx) return 'bug';
      return undefined;
    };
    body = isTable ? (
      <MetricTable
        cells={(step.panel as { kind: 'table'; cells: string[][] }).cells}
        tappable={!committed}
        onTapCell={(r, colIdx) => onTapTell(tableTells.some(([tr, tc]) => tr === r && tc === colIdx), { r, col: colIdx })}
        cellState={cellState}
      />
    ) : (
      <CodeBlock
        lines={(step.panel as { kind: 'code'; lines: string[] }).lines}
        tappable={!committed}
        onTapLine={(idx) => onTapTell(codeTells.includes(idx), idx)}
        lineState={lineState}
      />
    );
  } else if (step.opts) {
    body = (
      <OptionList
        opts={step.opts}
        chosen={chosen}
        revealed={committed}
        onChoose={(idx) => onChooseMCQ(idx, !!step.opts![idx]?.ok)}
      />
    );
  }

  return (
    <View>
      {head}
      {body}
      {committed && step.kind === 'inspect' && !correct && step.consequence ? (
        <View
          style={{
            marginTop: 9,
            borderLeftWidth: 3,
            borderLeftColor: c.danger,
            backgroundColor: 'transparent',
            paddingLeft: 11,
          }}>
          <T size={12} color={c.danger} style={{ lineHeight: 18 }}>
            {step.consequence}
          </T>
        </View>
      ) : null}
      {committed ? (
        <T size={12.5} style={{ lineHeight: 19, marginTop: 9 }}>
          {step.why}
        </T>
      ) : null}
    </View>
  );
}
