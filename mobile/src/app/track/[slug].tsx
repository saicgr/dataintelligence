import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { QRow, questionsFor, trackBySlug } from '../../lib/content';
import { useStore } from '../../lib/store';
import { radius, useTheme } from '../../lib/theme';
import { Btn, Card, H2, Row, Screen, T } from '../../ui/kit';

const LEVELS = ['All', 'Jr', 'Mid', 'Sr'] as const;

export default function TrackDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { c, track } = useTheme();
  const startTrack = useStore((s) => s.startTrack);
  const unlocked = useStore((s) => s.unlocked);
  const [lvl, setLvl] = useState<(typeof LEVELS)[number]>('All');

  const t = trackBySlug(slug ?? '');
  if (!t) return null;
  const col = track(t.color);
  const rows = questionsFor(t.slug);
  const filtered = rows.filter((r) => lvl === 'All' || r[1] === lvl);

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <T muted weight="700" size={13}>‹ Library</T>
      </Pressable>

      <Row style={{ gap: 12 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            backgroundColor: col,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <T size={22}>{t.icon}</T>
        </View>
        <View>
          <T size={20} weight="900">{t.name}</T>
          <T muted size={12.5}>{t.q} questions · all levels</T>
        </View>
      </Row>

      <H2>Levels</H2>
      <Row style={{ gap: 9 }}>
        {(['Jr', 'Mid', 'Sr'] as const).map((lv) => (
          <View
            key={lv}
            style={{
              flex: 1,
              backgroundColor: c.card,
              borderColor: c.border,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingVertical: 12,
              alignItems: 'center',
            }}>
            <T weight="900" size={19} color={col}>{rows.filter((r) => r[1] === lv).length}</T>
            <T weight="700" size={11.5} color={c.muted} style={{ marginTop: 3 }}>
              {lv === 'Jr' ? 'Junior' : lv === 'Mid' ? 'Mid' : 'Senior'}
            </T>
          </View>
        ))}
      </Row>
      <Pressable onPress={() => router.push('/track/behavioral')}>
        <Row
          style={{
            justifyContent: 'space-between',
            backgroundColor: c.card,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 12,
          }}>
          <T weight="700" size={13}>🗣️ Behavioral &amp; leadership prep</T>
          <T weight="800" color={c.muted}>›</T>
        </Row>
      </Pressable>

      <Btn
        label="▶ Start a session for this track"
        onPress={() => {
          startTrack(t.slug);
          router.push('/');
        }}
      />

      <H2>Questions</H2>
      <Row>
        {LEVELS.map((l) => (
          <Pressable
            key={l}
            onPress={() => setLvl(l)}
            style={{
              borderWidth: 1.5,
              borderColor: lvl === l ? c.fg : c.border,
              backgroundColor: lvl === l ? c.fg : c.card,
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 12,
            }}>
            <T weight="700" size={12} color={lvl === l ? c.card : c.muted}>
              {l === 'All' ? 'All levels' : l}
            </T>
          </Pressable>
        ))}
      </Row>

      {filtered.map((r, i) => (
        <QRowItem key={i} row={r} color={col} locked={i >= 2 && !unlocked} onLocked={() => router.push('/paywall')} />
      ))}
    </Screen>
  );
}

function QRowItem({
  row,
  color,
  locked,
  onLocked,
}: {
  row: QRow;
  color: string;
  locked: boolean;
  onLocked: () => void;
}) {
  const { track } = useTheme();
  return (
    <Pressable onPress={() => locked && onLocked()}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            backgroundColor: color + '29',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <T weight="800" size={11} color={color}>{row[1]}</T>
        </View>
        <T size={13} weight="600" style={{ flex: 1, lineHeight: 17 }}>{row[0]}</T>
        {locked ? (
          <T weight="800" size={10} color={track('rag')}>Pro</T>
        ) : (
          <T muted weight="800">›</T>
        )}
      </Card>
    </Pressable>
  );
}
