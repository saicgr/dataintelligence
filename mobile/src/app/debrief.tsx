import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { Btn, Card, Chip, H2, Row, Screen, T } from '../ui/kit';

const TOPICS = ['Spark', 'RAG', 'Kafka', 'SQL', 'dbt', 'System design', 'Python', 'Behavioral'];
const LEVELS = ['Mid', 'Senior', 'Staff'];
const OUTCOMES = ['Nailed it', 'Solid', 'Shaky', 'Bombed'];

export default function Debrief() {
  const { c } = useTheme();
  const router = useRouter();
  const submitDebrief = useStore((s) => s.submitDebrief);
  const company0 = useStore((s) => s.targetCompany);

  const [company, setCompany] = useState(company0.split(',')[0]?.trim() ?? '');
  const [level, setLevel] = useState('Senior');
  const [outcome, setOutcome] = useState('Solid');
  const [topics, setTopics] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);

  const toggle = (t: string) =>
    setTopics((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  if (done) {
    const co = company.trim() || 'that company';
    const n = topics.length || 3;
    return (
      <Screen>
        <Card style={{ alignItems: 'center', padding: 26 }}>
          <T size={46}>🧭</T>
          <T size={21} weight="900" style={{ marginTop: 6 }}>Debrief saved</T>
          <T muted size={13} style={{ marginTop: 7, textAlign: 'center', lineHeight: 20 }}>
            Deck re-ranked toward{' '}
            <T weight="800" size={13}>{topics.length ? topics.join(', ') : 'what they asked'}</T> — {n * 2}{' '}
            cards moved up for your next loop.
          </T>
          <Row style={{ marginTop: 14, justifyContent: 'center' }}>
            <Chip label="＋ saved to your history" kind="green" />
            <Chip label="+30 XP" kind="amber" />
          </Row>
          <T muted size={11.5} style={{ marginTop: 15, textAlign: 'center', lineHeight: 18 }}>
            Anonymized, this feeds the “most-asked at {co}” list — shown only after 20+ debriefs, so it&apos;s
            never one person&apos;s interview.
          </T>
          <Btn label="Back to today" style={{ marginTop: 16, alignSelf: 'stretch' }} onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => safeBack(router)}>
        <T muted weight="700" size={13}>‹ Close</T>
      </Pressable>
      <T size={21} weight="900">Interview debrief</T>
      <T muted size={12.5} style={{ lineHeight: 19 }}>
        2 minutes while it&apos;s fresh. Re-ranks your deck toward what they asked. Anonymized, it feeds the
        “most-asked” list — shown only once 20+ people log a company, so it can never surface one
        identifiable interview.
      </T>

      <H2>Company</H2>
      <TextInput
        value={company}
        onChangeText={setCompany}
        placeholder="e.g. Databricks"
        placeholderTextColor={c.muted}
        autoCapitalize="words"
        style={{ borderWidth: 2, borderColor: c.border, borderRadius: radius.md, padding: 12, color: c.fg, backgroundColor: c.surface }}
      />

      <H2>Level</H2>
      <Row style={{ flexWrap: 'wrap' }}>
        {LEVELS.map((l) => (
          <SelPill key={l} label={l} on={level === l} onPress={() => setLevel(l)} />
        ))}
      </Row>

      <H2>How did it go?</H2>
      <Row style={{ flexWrap: 'wrap' }}>
        {OUTCOMES.map((o) => (
          <SelPill key={o} label={o} on={outcome === o} onPress={() => setOutcome(o)} />
        ))}
      </Row>

      <H2>What did they actually ask? (tap all)</H2>
      <Row style={{ flexWrap: 'wrap' }}>
        {TOPICS.map((t) => (
          <SelPill key={t} label={t} on={topics.includes(t)} onPress={() => toggle(t)} multi />
        ))}
      </Row>

      <H2>What tripped you up? (optional)</H2>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="e.g. couldn't articulate exactly-once vs at-least-once cleanly"
        placeholderTextColor={c.muted}
        multiline
        style={{
          borderWidth: 2,
          borderColor: c.border,
          borderRadius: radius.md,
          padding: 12,
          color: c.fg,
          backgroundColor: c.surface,
          minHeight: 64,
          textAlignVertical: 'top',
        }}
      />

      <Btn
        label="Save debrief & re-rank my deck"
        onPress={async () => {
          await submitDebrief({ company, level, outcome, topics, notes });
          setDone(true);
        }}
      />
    </Screen>
  );
}

function SelPill({
  label,
  on,
  onPress,
  multi,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  const { c } = useTheme();
  const accent = multi ? c.navy : '#7048e8';
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 2,
        borderColor: on ? accent : c.border,
        backgroundColor: on ? accent : c.card,
        borderRadius: multi ? 999 : 13,
        paddingVertical: multi ? 8 : 10,
        paddingHorizontal: multi ? 13 : 14,
      }}>
      <T weight="700" size={12.5} color={on ? '#fff' : c.fg}>{label}</T>
    </Pressable>
  );
}
