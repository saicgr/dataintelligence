import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  daysLeftInWeek,
  fetchLeaderboard,
  Leaderboard,
  nextWeekTier,
  tierForRank,
  TIER_META,
  weekKey,
  zoneForRank,
} from '../lib/leagues';
import { hasMockDeck } from '../lib/mock';
import { useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { Btn, Card, H2, Row, Screen, T } from '../ui/kit';
import { LeagueBoard, TierBadge } from '../ui/LeagueBoard';

export default function League() {
  const { c } = useTheme();
  const router = useRouter();
  const week = weekKey();
  // THIS week's XP (resets each ISO week) — total xp on a weekly board overstated everyone.
  const weeklyXp = useStore((s) => (s.weeklyXpWeek === week ? s.weeklyXp : 0));
  const role = useStore((s) => s.role);
  const userId = useStore((s) => s.userId);
  const recordLeagueSnapshot = useStore((s) => s.recordLeagueSnapshot);

  const [board, setBoard] = useState<Leaderboard | null>(null);
  const daysLeft = daysLeftInWeek();

  useEffect(() => {
    let alive = true;
    // fetchLeaderboard gracefully returns a local sample board when offline / signed out.
    void fetchLeaderboard(userId, weeklyXp, 'You', week).then((b) => {
      if (!alive) return;
      setBoard(b);
      // Live standings feed the week-rollover result moment (#15).
      if (b.live && b.me) {
        recordLeagueSnapshot({ week: b.week, rank: b.me.rank, tier: tierForRank(b.me.rank, b.rows.length), size: b.rows.length });
      }
    });
    return () => {
      alive = false;
    };
  }, [userId, weeklyXp, week, recordLeagueSnapshot]);

  const me = board?.me ?? null;
  const myTier = me ? tierForRank(me.rank, board?.rows.length) : 'Bronze';
  const myZone = me ? zoneForRank(me.rank, board?.rows.length) : 'hold';
  const myNext = me ? nextWeekTier(me.rank, board?.rows.length) : myTier;

  const zoneCopy =
    myZone === 'promote'
      ? { color: c.success, text: `In the promotion zone — finish top 5 to reach ${myNext}.` }
      : myZone === 'relegate'
        ? { color: c.danger, text: `In the relegation zone — climb out to avoid dropping to ${myNext}.` }
        : { color: c.muted, text: 'Holding steady. Earn XP to climb into the promotion zone.' };

  return (
    <Screen>
      <Pressable onPress={() => safeBack(router)}>
        <T muted weight="700" size={13}>
          ‹ Close
        </T>
      </Pressable>

      <H2>Weekly league</H2>

      {/* Current-tier header */}
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <T muted size={11.5} weight="800" style={{ letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Your tier
            </T>
            <Row style={{ gap: 8, marginTop: 6 }}>
              <T size={26}>{TIER_META[myTier].emoji}</T>
              <View>
                <T size={20} weight="900">
                  {myTier}
                </T>
                <T muted size={11.5}>
                  {TIER_META[myTier].blurb}
                </T>
              </View>
            </Row>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T size={30} weight="900" color={c.accentInk}>
              {daysLeft}
            </T>
            <T muted size={11} weight="700">
              {daysLeft === 1 ? 'day left' : 'days left'} this week
            </T>
          </View>
        </Row>

        {me && (
          <Row style={{ gap: 8 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: c.surface,
                borderRadius: radius.sm,
                padding: 10,
                alignItems: 'center',
              }}>
              <T size={17} weight="900">
                #{me.rank}
              </T>
              <T muted size={10.5} weight="700">
                your rank
              </T>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: c.surface,
                borderRadius: radius.sm,
                padding: 10,
                alignItems: 'center',
              }}>
              <T size={17} weight="900">
                {me.xp}
              </T>
              <T muted size={10.5} weight="700">
                XP this week
              </T>
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <TierBadge tier={myNext} />
              <T muted size={10} weight="700" style={{ marginTop: 4 }}>
                next week
              </T>
            </View>
          </Row>
        )}

        <View style={{ borderLeftWidth: 3, borderLeftColor: zoneCopy.color, paddingLeft: 10 }}>
          <T size={12.5} weight="700" style={{ lineHeight: 18 }}>
            {zoneCopy.text}
          </T>
        </View>
      </Card>

      {/* Honest sample-board banner (#15): say it's practice BEFORE the rows, with the fix. */}
      {board && !board.live && (
        <Card style={{ gap: 10 }}>
          <Row style={{ gap: 9, alignItems: 'flex-start' }}>
            <T size={18}>👀</T>
            <View style={{ flex: 1 }}>
              <T weight="800" size={13.5}>Practice board — these are sample players</T>
              <T muted size={11.5} style={{ lineHeight: 16, marginTop: 2 }}>
                Your XP is real; the rivals aren&apos;t yet. Sign in to compete on the live weekly board.
              </T>
            </View>
          </Row>
          <Btn label="Sign in to compete live →" variant="primary" onPress={() => router.push('/profile')} />
        </Card>
      )}

      {/* The ranked board */}
      <Card style={board && !board.live ? { opacity: 0.8 } : undefined}>
        {board ? (
          <LeagueBoard board={board} />
        ) : (
          <T muted size={13} style={{ textAlign: 'center', paddingVertical: 20 }}>
            Loading the league…
          </T>
        )}
      </Card>

      {/* The contest reuses the mock deck — only advertise it to roles that can actually enter. */}
      {hasMockDeck(role) && (
        <Btn label="⚡ Enter the weekly contest" variant="navy" onPress={() => router.push('/contest')} />
      )}
      <Btn label="Keep studying →" variant="primary" onPress={() => safeBack(router)} />
    </Screen>
  );
}
