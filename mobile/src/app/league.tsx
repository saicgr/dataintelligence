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
import { useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { Btn, Card, H2, Row, Screen, T } from '../ui/kit';
import { LeagueBoard, TierBadge } from '../ui/LeagueBoard';

export default function League() {
  const { c } = useTheme();
  const router = useRouter();
  const xp = useStore((s) => s.xp);
  const userId = useStore((s) => s.userId);

  const [board, setBoard] = useState<Leaderboard | null>(null);
  const week = weekKey();
  const daysLeft = daysLeftInWeek();

  useEffect(() => {
    let alive = true;
    // Weekly XP is approximated here from total xp (see INTEGRATION NOTES for a dedicated
    // weeklyXp store field). fetchLeaderboard gracefully returns a local board when offline.
    void fetchLeaderboard(userId, xp, 'You', week).then((b) => {
      if (alive) setBoard(b);
    });
    return () => {
      alive = false;
    };
  }, [userId, xp, week]);

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

      {/* The ranked board */}
      <Card>
        {board ? (
          <LeagueBoard board={board} />
        ) : (
          <T muted size={13} style={{ textAlign: 'center', paddingVertical: 20 }}>
            Loading the league…
          </T>
        )}
      </Card>

      {board && !board.live && (
        <T muted size={11} style={{ textAlign: 'center', lineHeight: 16 }}>
          Showing a sample league. Sign in and configure sync to compete on the live weekly board.
        </T>
      )}

      <Btn label="⚡ Enter the weekly contest" variant="navy" onPress={() => router.push('/contest')} />
      <Btn label="Keep studying →" variant="primary" onPress={() => safeBack(router)} />
    </Screen>
  );
}
