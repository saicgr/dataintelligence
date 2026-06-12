import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { computeBadges } from '../../lib/badges';
import { buildCheatSheet } from '../../lib/cheatsheet';
import { tracksForRole } from '../../lib/content';
import { alertInfo, confirmAsync } from '../../lib/dialog';
import { exportSheet } from '../../lib/exportPdf';
import { daysLeftInWeek, fetchLeaderboard, type Leaderboard, tierForRank, weekKey } from '../../lib/leagues';
import { mostAskedAtCompany, type MostAskedTopic } from '../../lib/peerAnswers';
import { readinessAxes, readinessForRole, readinessLabel } from '../../lib/readiness';
import { buildReadinessReport } from '../../lib/readinessReport';
import { ROLES } from '../../lib/roles';
import { isProActive, level, useStore, xpInLevel } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { AnimatedProgressBar } from '../../ui/anim';
import { Btn, Card, Chip, H2, Row, Screen, T } from '../../ui/kit';
import { StreakHero } from '../../ui/StreakHero';
import { Icon } from '../../ui/Icon';

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
  const proActive = useStore(isProActive);
  const readinessTrend = useStore((s) => s.readinessTrend);
  const leagueSnapshot = useStore((s) => s.leagueSnapshot);
  const jdGapTracks = useStore((s) => s.jdGapTracks);
  const targetCompanyKey = useStore((s) => s.targetCompanyKey);

  // Pro readiness report: axes + league percentile + trend + focus tracks, as a PDF.
  const exportReadiness = () => {
    if (!proActive) {
      void confirmAsync(
        'Readiness report is Pro',
        'Export a PDF snapshot — per-axis breakdown, percentile vs this week’s league, and your trend.',
        'See plans'
      ).then((go) => go && router.push('/paywall'));
      return;
    }
    const html = buildReadinessReport({
      role,
      progress,
      trend: readinessTrend,
      league: leagueSnapshot,
      jdGapTracks,
      targetCompanyKey,
    });
    void exportSheet(html).then((r) => {
      if (!r.ok && r.error) alertInfo('Couldn’t export', r.error);
    });
  };

  // Pro cheat-sheet export: seen cards only (key points + tells, never the full Q&A).
  const exportTrack = (slug: string, name: string) => {
    if (!proActive) {
      void confirmAsync(
        'Cheat-sheet export is Pro',
        `Export your studied ${name} cards as a one-page PDF recap — key points + senior tells.`,
        'See plans'
      ).then((go) => {
        if (go) router.push('/paywall');
      });
      return;
    }
    const sheet = buildCheatSheet(slug, progress);
    if (!sheet) return alertInfo('Nothing to export yet', `Drill a few ${name} cards first — the sheet covers what you've studied.`);
    void exportSheet(sheet.html).then((r) => {
      if (!r.ok && r.error) alertInfo('Couldn’t export', r.error);
    });
  };
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
      <Btn label="📊 Export readiness report (Pro)" variant="ghost" onPress={exportReadiness} />
      <BadgesCard badges={badges} />
      <Card style={{ gap: 11 }}>
        <T muted size={12.5} style={{ textAlign: 'center' }}>
          Level {level(xp)} · {xpInLevel(xp)}/1000 XP to Level {level(xp) + 1}
        </T>
        <LeagueStrip onOpen={() => router.push('/league' as Href)} />
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
          <Icon name="pencil" size={23} />
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

      {/* "tracks with questions in your prep", not "skills" — the Library's Skills count is the
          full catalog (incl. empty tracks), so the two numbers are different metrics by design. */}
      <H2>Your coverage · {covTracks.length} tracks with questions in your prep</H2>
      <T muted size={11.5} style={{ lineHeight: 16 }}>
        Tap 📄 on a studied track to export a cheat-sheet PDF — key points &amp; senior tells from the
        cards you&apos;ve covered (Pro).
      </T>
      {covTracks.map((t) => {
        const total = t.q;
        const seen = seenByTrack(t.slug);
        const pct = total ? Math.min(100, Math.round((seen / total) * 100)) : 0;
        return (
          <CoverageRow
            key={t.slug}
            name={t.name}
            color={t.color}
            pct={pct}
            seen={seen}
            total={total}
            onExport={seen > 0 ? () => exportTrack(t.slug, t.name) : undefined}
          />
        );
      })}
    </Screen>
  );
}

/** Live league position surfaced on Progress (#15) — rank · tier · XP · time left, one tap to the board. */
function LeagueStrip({ onOpen }: { onOpen: () => void }) {
  const week = weekKey();
  const weeklyXp = useStore((s) => (s.weeklyXpWeek === week ? s.weeklyXp : 0));
  const userId = useStore((s) => s.userId);
  const recordLeagueSnapshot = useStore((s) => s.recordLeagueSnapshot);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchLeaderboard(userId, weeklyXp, 'You', week).then((b) => {
      if (!alive) return;
      setBoard(b);
      if (b.live && b.me) {
        recordLeagueSnapshot({ week: b.week, rank: b.me.rank, tier: tierForRank(b.me.rank, b.rows.length), size: b.rows.length });
      }
    });
    return () => {
      alive = false;
    };
  }, [userId, weeklyXp, week, recordLeagueSnapshot]);
  const me = board?.me ?? null;
  const label =
    board && me
      ? `🏆 #${me.rank} in ${tierForRank(me.rank, board.rows.length)} · ${me.xp} XP · ${daysLeftInWeek()}d left${board.live ? '' : ' · practice'} ›`
      : '🏆 Weekly league';
  return <Btn label={label} variant="navy" onPress={onOpen} />;
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
              {b.earned ? <T size={22}>{b.icon}</T> : <Icon name="lock" size={22} color={c.muted} />}
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
  // Multi-axis breakdown (#9): the same score split into what interviews actually test.
  const axes = useMemo(() => readinessAxes(role, progress, Date.now()), [role, progress]);
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
      {axes.length > 1 && (
        <View style={{ gap: 7, marginTop: 2 }}>
          {axes.map((a) => (
            <Row key={a.axis} style={{ gap: 8 }}>
              <T size={11} weight="800" muted style={{ width: 86 }}>{a.label}</T>
              <View style={{ flex: 1 }}>
                <AnimatedProgressBar
                  value={a.value}
                  color={a.value >= 0.8 ? c.success : a.value >= 0.3 ? c.accent : c.warn}
                  track={c.border}
                  height={6}
                />
              </View>
              <T size={11} weight="800" muted style={{ width: 32, textAlign: 'right' }}>{Math.round(a.value * 100)}%</T>
            </Row>
          ))}
        </View>
      )}
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
  onExport,
}: {
  name: string;
  color: string;
  pct: number;
  seen: number;
  total: number;
  /** Present once the track has ≥1 studied card — exports the cheat-sheet recap (Pro). */
  onExport?: () => void;
}) {
  const { c, track } = useTheme();
  const complete = pct >= 100;
  return (
    <View style={{ marginBottom: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T size={12.5} weight="700">{name}</T>
        <Row style={{ gap: 8 }}>
          {onExport && (
            <Pressable onPress={onExport} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Export ${name} cheat sheet as PDF`}>
              <T size={11.5} weight="800" color={complete ? c.success : c.muted}>
                {complete ? '📄 Cheat sheet ↗' : '📄 ↗'}
              </T>
            </Pressable>
          )}
          <T muted size={12.5}>{seen}/{total} · {pct}%</T>
        </Row>
      </Row>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: c.border, overflow: 'hidden', marginTop: 5 }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: track(color) }} />
      </View>
    </View>
  );
}
