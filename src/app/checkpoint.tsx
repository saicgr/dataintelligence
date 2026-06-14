import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CHAPTER_SIZE, checkpointDeck, checkpointKey, lessonCount, type SessionCard } from '../lib/content';
import { answerFeedback, sfx } from '../lib/feedback';
import { useStore } from '../lib/store';
import { space, useTheme } from '../lib/theme';
import { CardEnter, Confetti, CountUp } from '../ui/anim';
import { Btn, Card, Row, Screen, T, TrackBadge } from '../ui/kit';
import { Mascot } from '../ui/Mascot';
import { RichAnswer } from '../ui/RichAnswer';

const PASS = 0.7;

/** Chapter "boss" checkpoint (plan #25): a no-peek, self-graded cumulative review of a chapter.
 *  Pass ≥70% to mark the chapter mastered (+50 XP). Reachable from the Learn path boss nodes. */
export default function Checkpoint() {
  const router = useRouter();
  const { c, track } = useTheme();
  const params = useLocalSearchParams<{ slug?: string; chapter?: string }>();
  const slug = params.slug ?? '';
  const chapter = Number(params.chapter ?? 0) || 0;
  const completeCheckpoint = useStore((s) => s.completeCheckpoint);
  const startLesson = useStore((s) => s.startLesson);
  // First lesson of the next chapter — present when one exists, so a finished chapter flows
  // straight into the next instead of forcing back → track → next.
  const nextLessonIdx = (chapter + 1) * CHAPTER_SIZE;
  const hasNextChapter = nextLessonIdx < lessonCount(slug);
  const goNextChapter = () => { startLesson(slug, nextLessonIdx); router.replace('/'); };

  const deck = useMemo<SessionCard[]>(() => checkpointDeck(slug, chapter), [slug, chapter]);
  const col = track(deck[0]?.tk ?? 'sql');

  const [phase, setPhase] = useState<'intro' | 'quiz' | 'done'>('intro');
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);

  const card = deck[idx];
  const total = deck.length;

  const grade = (ok: boolean) => {
    answerFeedback(ok);
    const nextCorrect = correct + (ok ? 1 : 0);
    setCorrect(nextCorrect);
    if (idx + 1 >= total) {
      const pct = total ? nextCorrect / total : 0;
      if (pct >= PASS) {
        sfx.complete();
        completeCheckpoint(checkpointKey(slug, chapter));
      }
      setPhase('done');
    } else {
      setIdx(idx + 1);
      setRevealed(false);
    }
  };

  if (total === 0) {
    return (
      <Screen>
        <Pressable onPress={() => safeBack(router)}><T muted weight="700" size={13}>‹ Close</T></Pressable>
        <T muted size={13} style={{ marginTop: 20, textAlign: 'center' }}>This chapter isn&apos;t ready yet.</T>
      </Screen>
    );
  }

  if (phase === 'intro') {
    return (
      <Screen>
        <Pressable onPress={() => safeBack(router)}><T muted weight="700" size={13}>‹ Close</T></Pressable>
        <Card style={{ alignItems: 'center', padding: 24, gap: 10, marginTop: 8 }}>
          <Mascot mood="focused" size={88} />
          <T size={22} weight="900">Chapter checkpoint</T>
          <T muted size={13} style={{ textAlign: 'center', lineHeight: 20 }}>
            {total} questions from this chapter — no peeking. Score {Math.round(PASS * 100)}% to mark it mastered
            and bank +50 XP.
          </T>
          <Btn label="Start the checkpoint ▶" onPress={() => setPhase('quiz')} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </Card>
      </Screen>
    );
  }

  if (phase === 'done') {
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const passed = pct >= PASS * 100;
    return (
      <Screen>
        {passed ? <Confetti /> : null}
        <Pressable onPress={() => safeBack(router)}><T muted weight="700" size={13}>‹ Close</T></Pressable>
        <Card style={{ alignItems: 'center', padding: 24, gap: 8, marginTop: 8 }}>
          <Mascot mood={passed ? 'celebrate' : 'sad'} size={88} />
          <CountUp to={pct} style={{ fontSize: 46, fontWeight: '900', color: passed ? c.success : c.warn }} />
          <T weight="900" size={20}>{passed ? 'Chapter mastered!' : 'Almost — keep drilling'}</T>
          <T muted size={13} style={{ textAlign: 'center' }}>{correct} / {total} correct</T>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 14 }}>
            {!passed && (
              <Btn label="↻ Try again" variant="navy" onPress={() => { setIdx(0); setCorrect(0); setRevealed(false); setPhase('quiz'); }} />
            )}
            {passed && hasNextChapter && (
              <Btn label="Next chapter →" variant="green" onPress={goNextChapter} />
            )}
            <Btn label="Back to path" variant={passed && hasNextChapter ? 'ghost' : passed ? 'green' : 'ghost'} onPress={() => safeBack(router)} />
          </View>
        </Card>
      </Screen>
    );
  }

  // quiz
  return (
    <Screen scroll>
      <Pressable onPress={() => safeBack(router)}><T muted weight="700" size={13}>‹ Close</T></Pressable>
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1, height: 8, borderRadius: 999, backgroundColor: c.border, overflow: 'hidden' }}>
          <View style={{ width: `${(idx / total) * 100}%`, height: '100%', backgroundColor: col }} />
        </View>
        <T muted weight="800" size={12}>{idx + 1} / {total}</T>
      </Row>

      <CardEnter key={idx}>
        <Card style={{ gap: 12, marginTop: space.sm }}>
          {card.tool ? <Row><TrackBadge label={card.tool} color={col} /></Row> : null}
          <T size={17} weight="700" style={{ lineHeight: 24 }}>{card.q}</T>

          {!revealed ? (
            <Btn label="Reveal answer" variant="navy" onPress={() => setRevealed(true)} />
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 }}>
                <RichAnswer text={card.a ?? card.why ?? card.opts?.find((o) => o.ok)?.t ?? ''} size={13} />
              </View>
              <T muted size={12} weight="700" style={{ textAlign: 'center' }}>Did you get it right?</T>
              <Row style={{ gap: 10 }}>
                <View style={{ flex: 1 }}><Btn label="✗ Missed it" variant="danger" onPress={() => grade(false)} /></View>
                <View style={{ flex: 1 }}><Btn label="✓ Got it" variant="green" onPress={() => grade(true)} /></View>
              </Row>
            </View>
          )}
        </Card>
      </CardEnter>
    </Screen>
  );
}
