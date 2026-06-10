import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { computeBadges } from '../../lib/badges';
import { tracksForRole } from '../../lib/content';
import { mostAskedAtCompany, type MostAskedTopic } from '../../lib/peerAnswers';
import { readinessForRole, readinessLabel } from '../../lib/readiness';
import { ROLES } from '../../lib/roles';
import { level, useStore, xpInLevel } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { AnimatedProgressBar } from '../../ui/anim';
import { Btn, Card, Chip, H2, Row, Screen, T } from '../../ui/kit';
import { StreakHero } from '../../ui/StreakHero';

export default function Progress() {
  const router = useRouter();
  const xp = useStore((s) => s.xp);
  const role = useStore((s) => s.role);
  const progress = useStore((s) => s.progress);
  const streak = useStore((s) => s.streak);
  const lastMockScore = useStore((s) => s.lastMockScore);
  const savedIds = useStore((s) => s.savedIds);
  const checkpointsDone = useStore((s) => s.checkpointsDone);
  const voiceTried = useStore((s) => s.voiceTried);
  const markBadgesSeen = useStore((s) => s.markBadgesSeen);
  const company = useStore((s) => s.targetCompany);
  const [asked, setAsked] = useState<MostAskedTopic[]>([]);
  useEffect(() => {
    mostAskedAtCompany(company).then(setAsked).catch(() => {});
  }, [company]);

  // Real coverage from actual study progress (bank card ids are `${slug}-${i}`).
  const seenByTrack = (slug: string) =>
    Object.keys(progress).filter((k) => k.startsWith(`${slug}-`)).length;
  const covTracks = tracksForRole(role).filter((t) => t.q > 0);
  const trackCoverage = covTracks.map((t) => ({
    slug: t.slug,
    name: t.name,
    pct: t.q ? Math.min(100, Math.round((seenByTrack(t.slug) / t.q) * 100)) : 0,
  }));
  const badges = computeBadges({
    streak,
    xp,
    progress,
    lastMockScore,
    trackCoverage,
    savedCount: savedIds.length,
    checkpointsDone: checkpointsDone.length,
    voiceTried,
  });
  // The badge grid is on screen here — anything earned counts as seen (no toast needed).
  const earnedIds = badges.filter((b) => b.earned).map((b) => b.id);
  useEffect(() => {
    if (earnedIds.length) markBadgesSeen(earnedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earnedIds.join(',')]);

  // Certificate eligibility: a fully-covered track, else interview-ready role readiness.
  const mastered = trackCoverage.find((t) => t.pct >= 100);
  const ready = readinessForRole(role, progress, Date.now()) >= 0.8;

  return (
    <Screen>
      <H2>Your progress</H2>
      <StreakHero variant="hero" />
      <ReadinessCard role={role} progress={progress} />
      <BadgesCard badges={badges} />
      <Card style={{ gap: 11 }}>
        <T muted size={12.5} style={{ textAlign: 'center' }}>
          Level {level(xp)} · {xpInLevel(xp)}/1000 XP to Level {level(xp) + 1}
        </T>
        <Btn label="🏆 Weekly league" variant="navy" onPress={() => router.push('/league' as Href)} />
        {mastered ? (
          <Btn
            label={`🏅 Claim ${mastered.name} certificate`}
            variant="green"
            onPress={() => router.push(`/certificate?kind=track&track=${mastered.slug}` as Href)}
          />
        ) : ready ? (
          <Btn label="🏅 Claim readiness certificate" variant="green" onPress={() => router.push('/certificate' as Href)} />
        ) : null}
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
        {asked.length > 0 ? (
          <View style={{ marginTop: 14, gap: 7 }}>
            <T weight="800" size={12.5}>Most asked at {company || 'this company'}</T>
            {asked.map((a) => (
              <Row key={a.topic} style={{ justifyContent: 'space-between' }}>
                <Chip label={a.topic} />
                <T muted size={12} weight="800">{Math.round(a.share * 100)}%</T>
              </Row>
            ))}
          </View>
        ) : (
          <T muted size={11.5} style={{ marginTop: 12, lineHeight: 17 }}>
            No debriefs yet — your logged interviews and an anonymized &ldquo;most-asked at &lt;company&gt;&rdquo; list
            (shown only after 20+ debriefs) will appear here.
          </T>
        )}
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

/** Achievement badges (plan #8) — earned ones in full color, locked ones dimmed. */
function BadgesCard({ badges }: { badges: ReturnType<typeof computeBadges> }) {
  const { c } = useTheme();
  const earned = badges.filter((b) => b.earned).length;
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T weight="800" size={13.5}>Achievements</T>
        <T muted size={12} weight="800">{earned}/{badges.length}</T>
      </Row>
      <Row style={{ flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {badges.map((b) => (
          <View key={b.id} style={{ alignItems: 'center', width: 72, opacity: b.earned ? 1 : 0.32 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: b.earned ? c.accent + '22' : c.border,
                borderWidth: 1.5,
                borderColor: b.earned ? c.accent : c.border,
              }}>
              <T size={22}>{b.earned ? b.icon : '🔒'}</T>
            </View>
            <T size={10} weight="700" muted style={{ marginTop: 5, textAlign: 'center' }}>
              {b.label}
            </T>
          </View>
        ))}
      </Row>
    </Card>
  );
}

/** Interview Readiness gauge (plan #17) — a single decaying north-star per role. */
function ReadinessCard({ role, progress }: { role: string; progress: Parameters<typeof readinessForRole>[1] }) {
  const { c } = useTheme();
  // Recompute when progress changes; pRecall is time-based so it naturally drifts between sessions.
  const r = useMemo(() => readinessForRole(role, progress, Date.now()), [role, progress]);
  const pct = Math.round(r * 100);
  const roleName = ROLES.find((x) => x.key === role)?.name ?? 'this role';
  const tone = r >= 0.8 ? c.success : r >= 0.3 ? c.accent : c.warn;
  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <T muted size={11.5} weight="800" style={{ letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Interview readiness
          </T>
          <T size={13.5} weight="700" style={{ marginTop: 2 }}>{roleName} screen</T>
        </View>
        <T size={30} weight="900" color={tone}>{pct}%</T>
      </Row>
      <AnimatedProgressBar value={r} color={tone} track={c.border} height={10} />
      <T muted size={11.5} style={{ lineHeight: 16 }}>
        {readinessLabel(r)} · readiness slides if you stop reviewing — keep your due cards clear to hold it.
      </T>
    </Card>
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
