import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { tracksForRole } from '../../lib/content';
import { level, useStore, xpInLevel } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { Btn, Card, H2, Row, Screen, T } from '../../ui/kit';
import { StreakHero } from '../../ui/StreakHero';

export default function Progress() {
  const router = useRouter();
  const xp = useStore((s) => s.xp);
  const role = useStore((s) => s.role);
  const progress = useStore((s) => s.progress);

  // Real coverage from actual study progress (bank card ids are `${slug}-${i}`).
  const seenByTrack = (slug: string) =>
    Object.keys(progress).filter((k) => k.startsWith(`${slug}-`)).length;
  const covTracks = tracksForRole(role).filter((t) => t.q > 0);

  return (
    <Screen>
      <H2>Your progress</H2>
      <StreakHero variant="hero" />
      <Card style={{ gap: 11 }}>
        <T muted size={12.5} style={{ textAlign: 'center' }}>
          Level {level(xp)} · {xpInLevel(xp)}/1000 XP to Level {level(xp) + 1}
        </T>
        <Btn label="📣 Share my streak card" variant="ghost" onPress={() => router.push('/share')} />
      </Card>

      <H2>Interview debriefs</H2>
      <Card>
        <Row>
          <T size={23}>📝</T>
          <View style={{ flex: 1 }}>
            <T weight="800" size={14.5}>Had a round? Log a debrief</T>
            <T muted size={12}>2 min while it&apos;s fresh · re-ranks your deck to what they asked</T>
          </View>
        </Row>
        <Btn label="＋ Log an interview" variant="navy" style={{ marginTop: 12 }} onPress={() => router.push('/debrief')} />
        <T muted size={11.5} style={{ marginTop: 12, lineHeight: 17 }}>
          No debriefs yet — your logged interviews and an anonymized &ldquo;most-asked at &lt;company&gt;&rdquo; list
          (shown only after 20+ debriefs) will appear here.
        </T>
      </Card>

      <H2>Your coverage · {covTracks.length} tracks for this role</H2>
      {covTracks.map((t) => {
        const total = t.q;
        const seen = seenByTrack(t.slug);
        const pct = total ? Math.min(100, Math.round((seen / total) * 100)) : 0;
        return <CoverageRow key={t.slug} name={t.name} color={t.color} pct={pct} seen={seen} total={total} />;
      })}
    </Screen>
  );
}

function CoverageRow({
  name,
  color,
  pct,
  seen,
  total,
}: {
  name: string;
  color: string;
  pct: number;
  seen: number;
  total: number;
}) {
  const { c, track } = useTheme();
  return (
    <View style={{ marginBottom: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T size={12.5} weight="700">{name}</T>
        <T muted size={12.5}>{seen}/{total} · {pct}%</T>
      </Row>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: c.border, overflow: 'hidden', marginTop: 5 }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: track(color) }} />
      </View>
    </View>
  );
}
