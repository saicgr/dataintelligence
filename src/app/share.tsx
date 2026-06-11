import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useEffect } from 'react';
import { Pressable, Share, View } from 'react-native';

import { track } from '../lib/analytics';
import { createInviteLink } from '../lib/attribution';
import { TRACKS } from '../lib/content';
import { level, useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { Btn, Row, Screen, T } from '../ui/kit';

const KNOWN: Record<string, number> = { spark: 64, rag: 48, kafka: 30, sql: 22, dbt: 12 };

function topTrack(): { name: string; p: number } | null {
  let best: { name: string; p: number } | null = null;
  for (const t of TRACKS) {
    const p = KNOWN[t.slug];
    if (p != null && (!best || p > best.p)) best = { name: t.name, p };
  }
  return best;
}

export default function ShareCard() {
  const { c } = useTheme();
  const router = useRouter();
  const streak = useStore((s) => s.streak);
  const xp = useStore((s) => s.xp);
  const userId = useStore((s) => s.userId);

  useEffect(() => {
    track('share_card_viewed');
  }, []);

  // Never lead with a weak stat: streak headline is always strong; the third tile
  // shows the top-track % only if it's flattering, else falls back to volume.
  const tt = topTrack();
  const tiles: { b: string; s: string }[] = [
    { b: '5/5', s: 'cleared today' },
    { b: `Lv ${level(xp)}`, s: `${xp} XP` },
    tt && tt.p >= 40 ? { b: `${tt.name} ${tt.p}%`, s: 'top track' } : { b: '142', s: 'cards mastered' },
  ];

  async function shareCard() {
    track('invite_link_clicked');
    const link = await createInviteLink(userId);
    await Share.share({
      message: `I'm on a ${streak}-day senior-correct streak prepping AI & Data-Engineering interviews on ByteShards.${
        link ? ' ' + link : ''
      }`,
    });
  }

  return (
    <Screen>
      <Pressable onPress={() => safeBack(router)}>
        <T muted weight="700" size={13}>‹ Close</T>
      </Pressable>

      <View
        style={{
          borderRadius: radius.xl,
          padding: 22,
          backgroundColor: '#f76707',
          overflow: 'hidden',
        }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T color="#fff" weight="800" size={16}>
            Field<T color="#ffe08a" weight="800" size={16}>Notes</T>
          </T>
          <View style={{ backgroundColor: 'rgba(255,255,255,.22)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
            <T color="#fff" weight="800" size={10.5}>SENIOR PREP</T>
          </View>
        </Row>
        <T color="#fff" weight="900" size={25} style={{ marginTop: 18, lineHeight: 29 }}>
          🔥 {streak}-day{'\n'}Senior-correct streak
        </T>
        <Row style={{ marginTop: 18, gap: 10 }}>
          {tiles.map((t, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,.17)', borderRadius: 13, padding: 10, alignItems: 'center' }}>
              <T color="#fff" weight="900" size={15}>{t.b}</T>
              <T color="#fff" weight="700" size={9.5} style={{ opacity: 0.9, marginTop: 2 }}>{t.s}</T>
            </View>
          ))}
        </Row>
        <T color="#fff" weight="700" size={11.5} style={{ opacity: 0.92, marginTop: 16, textAlign: 'center' }}>
          Drilling senior AI &amp; Data-Engineering interviews
        </T>
      </View>

      <T muted size={12} style={{ textAlign: 'center', lineHeight: 18 }}>
        Post your streak — anyone who joins through your link gets the founder price too.
      </T>
      <Btn label="📤 Share my card" onPress={shareCard} />
      <Btn label="🔗 Copy invite link" variant="ghost" onPress={shareCard} />
    </Screen>
  );
}
