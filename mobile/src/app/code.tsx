/**
 * Code Lab — the interactive code judge surface (plan GAP 1). A real editor + Run + result that
 * can't fit a swipe card, so it lives on its own screen. SQL runs fully offline (expo-sqlite);
 * Python & PySpark run in Pyodide (needs network on first use). Grading is deterministic
 * output-match — no AI — honoring the Web-Pro moat; the `webProblemId` deep-link is the path to
 * full-fidelity execution + AI follow-ups on the web.
 *
 * Entry: Practice → "💻 Code drills" with ?lang=sql|python|pyspark (optionally &problem=<id>).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { type CodeLang, type CodeProblem, problemsForLang, CODE_PROBLEMS } from '../lib/codeProblems';
import { type JudgeResult } from '../lib/judge';
import { judgeSql } from '../lib/judge/sql';
import { buildProgram, judgeFromStdout, PyodideHost, type PyodideHandle } from '../lib/judge/pyodide';
import { haptic, sfx } from '../lib/feedback';
import { FREE_CODE_RUNS, useStore } from '../lib/store';
import { mono, radius, useTheme } from '../lib/theme';
import { Confetti } from '../ui/anim';
import { CodeBlock } from '../ui/CodeBlock';
import { Btn, Card, Chip, H2, Row, Screen, T, TrackBadge } from '../ui/kit';

const LANG_LABEL: Record<CodeLang, string> = { sql: 'SQL', python: 'Python', pyspark: 'PySpark' };

export default function CodeLab() {
  const { c } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ lang?: string; problem?: string }>();
  const lang = (['sql', 'python', 'pyspark'].includes(params.lang ?? '') ? params.lang : 'sql') as CodeLang;
  const list = useMemo(() => problemsForLang(lang), [lang]);

  const initial = params.problem ? CODE_PROBLEMS.find((p) => p.id === params.problem) ?? null : null;
  const [problem, setProblem] = useState<CodeProblem | null>(initial);
  const hostRef = useRef<PyodideHandle>(null);

  return (
    <Screen>
      <Pressable onPress={() => (problem ? setProblem(null) : router.back())}>
        <T muted weight="700" size={13}>
          {problem ? '‹ All problems' : '‹ Close'}
        </T>
      </Pressable>

      {/* Python/PySpark need the Pyodide host mounted; SQL ignores it. */}
      {lang !== 'sql' && <PyodideHost ref={hostRef} />}

      {problem ? (
        <Editor key={problem.id} problem={problem} hostRef={hostRef} onWeb={() => router.push('/paywall')} />
      ) : (
        <>
          <H2>{LANG_LABEL[lang]} code drills</H2>
          <T muted size={12} style={{ lineHeight: 18 }}>
            Write real code and Run it — graded by output, not multiple choice.
            {lang === 'sql' ? ' Runs fully offline.' : ' Python runtime loads on first run, then works offline.'}
          </T>
          {list.map((p) => (
            <Pressable key={p.id} onPress={() => setProblem(p)}>
              <Card style={{ gap: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <TrackBadge label={p.tool} color={c.navy} />
                  <T muted size={12} weight="800">Solve ▶</T>
                </Row>
                <T weight="800" size={15}>{p.title}</T>
                <T muted size={12.5} style={{ lineHeight: 18 }}>{p.prompt}</T>
              </Card>
            </Pressable>
          ))}
          {list.length === 0 && <T muted size={13}>No problems for {LANG_LABEL[lang]} yet.</T>}
        </>
      )}
    </Screen>
  );
}

function Editor({
  problem,
  hostRef,
  onWeb,
}: {
  problem: CodeProblem;
  hostRef: React.RefObject<PyodideHandle | null>;
  onWeb: () => void;
}) {
  const { c } = useTheme();
  const [code, setCode] = useState(problem.starter);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHints, setShowHints] = useState(false);
  // Free users get FREE_CODE_RUNS runs/day; Pro is unlimited. Runs are 100% on-device — the cap is an upgrade hook.
  const unlocked = useStore((s) => s.unlocked);
  const bumpCodeRun = useStore((s) => s.bumpCodeRun);
  const codeRunsToday = useStore((s) => s.codeRunsToday);
  const codeRunDay = useStore((s) => s.codeRunDay);
  const usedToday = codeRunDay === new Date(Date.now()).toISOString().slice(0, 10) ? codeRunsToday : 0;
  const remaining = Math.max(0, FREE_CODE_RUNS - usedToday);
  const atLimit = !unlocked && remaining <= 0;

  async function run() {
    if (busy) return;
    // Spend a run from the daily quota; bumpCodeRun returns false once a free user is out.
    if (!bumpCodeRun()) {
      haptic.error();
      onWeb(); // → paywall: unlock unlimited runs
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      let r: JudgeResult;
      if (problem.lang === 'sql') {
        r = judgeSql(problem, code);
      } else {
        const res = (await hostRef.current?.run(buildProgram(problem, code))) ?? { error: 'Runtime not ready — check your connection.' };
        r = judgeFromStdout(problem, res);
      }
      setResult(r);
      if (r.ok) {
        sfx.correct();
        haptic.success();
      } else {
        sfx.wrong();
        haptic.error();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {result?.ok && <Confetti />}
      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <TrackBadge label={problem.tool} color={c.navy} />
          <Chip label="✍️ Write & run" />
        </Row>
        <T weight="800" size={16} style={{ lineHeight: 23 }}>{problem.title}</T>
        <T size={13} style={{ lineHeight: 19 }}>{problem.prompt}</T>

        <T muted size={11} weight="800" style={{ letterSpacing: 0.4, marginTop: 4 }}>SETUP</T>
        <CodeBlock lines={problem.setup.split('\n')} />

        <T muted size={11} weight="800" style={{ letterSpacing: 0.4, marginTop: 2 }}>EXPECTED OUTPUT</T>
        <CodeBlock lines={problem.expected.split('\n')} />
      </Card>

      {/* The editor */}
      <Card style={{ gap: 10 }}>
        <T muted size={11} weight="800" style={{ letterSpacing: 0.4 }}>YOUR CODE</T>
        <TextInput
          value={code}
          onChangeText={setCode}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          style={{
            minHeight: 150,
            borderWidth: 1.5,
            borderColor: c.border,
            borderRadius: radius.md,
            padding: 12,
            color: c.fg,
            backgroundColor: c.surface,
            fontFamily: mono,
            fontSize: 13,
            lineHeight: 19,
            textAlignVertical: 'top',
          }}
        />
        <Btn
          label={atLimit ? '🔒 Daily limit reached — unlock Pro' : busy ? 'Running…' : '▶ Run'}
          variant="navy"
          onPress={atLimit ? onWeb : run}
          disabled={busy}
        />
        {!unlocked && (
          <T muted size={11} weight="700" style={{ textAlign: 'center' }}>
            {atLimit
              ? 'Out of free runs today · Pro = unlimited'
              : `${remaining} of ${FREE_CODE_RUNS} free runs left today · Pro = unlimited`}
          </T>
        )}
        {busy && problem.lang !== 'sql' && (
          <Row style={{ gap: 8, justifyContent: 'center' }}>
            <ActivityIndicator color={c.muted} />
            <T muted size={11.5}>Loading the Python runtime can take a few seconds…</T>
          </Row>
        )}
      </Card>

      {result && <ResultPanel result={result} expected={problem.expected} />}

      {/* Hints */}
      <Pressable
        onPress={() => {
          haptic.selection();
          setShowHints((s) => !s);
        }}>
        <Row style={{ gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: 12 }}>
          <T size={14}>💡</T>
          <T size={13} weight="800" style={{ flex: 1 }}>Hints</T>
          <T size={12.5} weight="800" color={c.accentInk}>{showHints ? '▾' : '▸'}</T>
        </Row>
      </Pressable>
      {showHints && (
        <Card style={{ gap: 7 }}>
          {problem.hints.map((h, i) => (
            <Row key={i} style={{ gap: 8, alignItems: 'flex-start' }}>
              <T size={12} weight="900" color={c.accentInk}>{i + 1}</T>
              <T size={12.5} style={{ flex: 1, lineHeight: 18 }}>{h}</T>
            </Row>
          ))}
        </Card>
      )}

      {/* Web Pro deep-link: full-fidelity run + AI-graded follow-ups. */}
      {problem.webProblemId && (
        <Pressable onPress={onWeb}>
          <T muted size={11.5} weight="700" style={{ textAlign: 'center', lineHeight: 17 }}>
            Want it run on real {problem.lang === 'sql' ? 'Postgres' : 'infra'} with AI-graded follow-ups?{' '}
            <T color={c.accentInk} weight="800" size={11.5}>Open on web →</T>
          </T>
        </Pressable>
      )}
    </>
  );
}

function ResultPanel({ result, expected }: { result: JudgeResult; expected: string }) {
  const { c } = useTheme();
  if (result.error) {
    return (
      <Card style={{ borderColor: c.danger, gap: 6 }}>
        <T weight="800" size={13} color={c.danger}>Error</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <T size={12.5} style={{ fontFamily: mono, color: c.fg }}>{result.error}</T>
        </ScrollView>
      </Card>
    );
  }
  if (result.ok) {
    return (
      <Card style={{ borderColor: c.success, gap: 4 }}>
        <T weight="900" size={15} color={c.success}>✓ Correct — output matches</T>
        <T muted size={12}>Nice. Try the next one, or open it on web for AI-graded follow-ups.</T>
      </Card>
    );
  }
  return (
    <Card style={{ borderColor: c.danger, gap: 8 }}>
      <T weight="800" size={13.5} color={c.danger}>Not quite — output differs</T>
      <View>
        <T muted size={11} weight="800" style={{ letterSpacing: 0.4 }}>YOUR OUTPUT</T>
        <CodeBlock lines={(result.actual || '(empty)').split('\n')} />
      </View>
      <View>
        <T muted size={11} weight="800" style={{ letterSpacing: 0.4 }}>EXPECTED</T>
        <CodeBlock lines={expected.split('\n')} />
      </View>
    </Card>
  );
}
