import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { tracksForRole } from '../../lib/content';
import { haptic, sfx } from '../../lib/feedback';
import { useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { CardEnter, PressableScale, Shake } from '../../ui/anim';
import { Card, H2, Row, Screen, T } from '../../ui/kit';

export default function Practice() {
  const router = useRouter();
  const { c } = useTheme();
  const role = useStore((s) => s.role);
  const startTrack = useStore((s) => s.startTrack);
  const startWeakspot = useStore((s) => s.startWeakspot);
  const unlocked = useStore((s) => s.unlocked);
  const tracks = tracksForRole(role);

  const drill = (slug: string) => {
    haptic.light();
    sfx.tap();
    startTrack(slug);
    router.push('/');
  };
  // Distinct from the scheduled daily queue: an off-schedule random topic from your prep.
  const surprise = () => {
    if (tracks.length === 0) return;
    drill(tracks[Math.floor(Math.random() * tracks.length)].slug);
  };

  return (
    <Screen>
      <H2>Drill on demand</H2>
      <T muted size={12} style={{ lineHeight: 18 }}>
        Home is your scheduled queue — what&apos;s due today. Here you grind whatever you pick, off-schedule.
        Practising here doesn&apos;t touch your review dates.
      </T>

      {/* Free + in-place: pick any topic and drill it right now (no detour through Library). */}
      <CardEnter>
        <Card style={{ padding: 14, gap: 11 }}>
          <Row style={{ gap: 9 }}>
            <T size={22}>🎯</T>
            <View style={{ flex: 1 }}>
              <T weight="800" size={15}>Drill a topic</T>
              <T muted size={12}>Free-practice any track, right now — just tap one</T>
            </View>
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {tracks.map((t) => (
              <PressableScale key={t.slug} onPress={() => drill(t.slug)} hapticStyle="selection" scaleTo={0.93}>
                <Row
                  style={{
                    gap: 5,
                    borderWidth: 1.5,
                    borderColor: c.border,
                    backgroundColor: c.card,
                    borderRadius: 999,
                    paddingVertical: 7,
                    paddingHorizontal: 11,
                  }}>
                  <T size={13}>{t.icon}</T>
                  <T weight="700" size={12}>{t.name}</T>
                </Row>
              </PressableScale>
            ))}
            {tracks.length === 0 && <T muted size={12}>No tracks for this role yet.</T>}
          </View>
        </Card>
      </CardEnter>

      {/* Free quick mix — genuinely different from Home's scheduled review. */}
      <CardEnter delay={40}>
        <Mode
          icon="🎲"
          title="Surprise me"
          sub="A random topic from your prep — quick off-schedule reps"
          cta="Go ▶"
          onPress={surprise}
        />
      </CardEnter>

      {/* Free, fully automated — no human. Timed, scored, no peeking. */}
      <CardEnter delay={60}>
        <Mode
          icon="⏱️"
          title="Mock interview"
          sub="Timed rapid-fire round — scored, no peeking"
          cta="Start ▶"
          onPress={() => router.push('/mock' as Href)}
        />
      </CardEnter>

      {/* Free, hands-free — answer out loud on a walk/commute. */}
      <CardEnter delay={80}>
        <Mode
          icon="🎧"
          title="Commute mode"
          sub="Hands-free: questions read aloud, answer out loud"
          cta="Listen ▶"
          onPress={() => router.push('/audio-session' as Href)}
        />
      </CardEnter>

      {/* Pro tier, clearly fenced below the free value. */}
      <Row style={{ gap: 10, marginTop: 6, marginBottom: 2 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <T size={10.5} weight="900" color={c.muted} style={{ letterSpacing: 1 }}>PRO</T>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </Row>

      <CardEnter delay={80}>
        <LockedMode
          icon="📝"
          title="Paste a job description"
          sub="Match it to your prep tracks + see what you're missing"
          unlocked={unlocked}
          unlockedCta="Analyze ▶"
          onUnlocked={() => router.push('/jd' as unknown as Href)}
          onLocked={() => router.push('/paywall')}
        />
      </CardEnter>
      <CardEnter delay={120}>
        <LockedMode
          icon="🧠"
          title="Weak-spots drill"
          sub="The cards you keep missing — weakest first (adaptive)"
          unlocked={unlocked}
          unlockedCta="Drill ▶"
          onUnlocked={() => {
            startWeakspot();
            router.push('/');
          }}
          onLocked={() => router.push('/paywall')}
        />
      </CardEnter>
    </Screen>
  );
}

function Mode({
  icon,
  title,
  sub,
  cta,
  onPress,
}: {
  icon: string;
  title: string;
  sub: string;
  cta: string;
  onPress: () => void;
}) {
  const { track } = useTheme();
  return (
    <PressableScale onPress={onPress} sound>
      <Card style={{ padding: 16 }}>
        <Row>
          <T size={26}>{icon}</T>
          <Row style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <T weight="800" size={15}>{title}</T>
            <T muted size={12}>{sub}</T>
          </Row>
          <T weight="800" color={track('spark')}>{cta}</T>
        </Row>
      </Card>
    </PressableScale>
  );
}

/** A Pro-gated card: full Mode when unlocked; otherwise a locked card that shakes + buzzes on tap. */
function LockedMode({
  icon,
  title,
  sub,
  unlocked,
  unlockedCta,
  onUnlocked,
  onLocked,
}: {
  icon: string;
  title: string;
  sub: string;
  unlocked: boolean;
  unlockedCta: string;
  onUnlocked: () => void;
  onLocked: () => void;
}) {
  const { track } = useTheme();
  const [shake, setShake] = useState(0);
  if (unlocked) return <Mode icon={icon} title={title} sub={sub} cta={unlockedCta} onPress={onUnlocked} />;
  return (
    <Shake trigger={shake}>
      <PressableScale
        hapticStyle="none"
        onPress={() => {
          setShake((n) => n + 1);
          haptic.error();
          onLocked();
        }}>
        <Card style={{ padding: 16 }}>
          <Row>
            <T size={26}>{icon}</T>
            <Row style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <T weight="800" size={15}>{title}</T>
              <T muted size={12}>{sub}</T>
            </Row>
            <Row style={{ gap: 3 }}>
              <T size={12}>🔒</T>
              <T weight="900" size={12.5} color={track('spark')}>Pro</T>
            </Row>
          </Row>
        </Card>
      </PressableScale>
    </Shake>
  );
}
