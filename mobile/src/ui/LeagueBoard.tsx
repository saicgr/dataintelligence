import { Fragment } from 'react';
import { View } from 'react-native';

import {
  Leaderboard,
  LeagueRow,
  PROMOTE_COUNT,
  RELEGATE_COUNT,
  Tier,
  tierForRank,
  TIER_META,
} from '../lib/leagues';
import { radius, useTheme } from '../lib/theme';
import { Row, T } from './kit';

/** Resolve a tier's themed color from the palette key it carries. */
function useTierColor(tier: Tier): string {
  const { c } = useTheme();
  const key = TIER_META[tier].colorKey;
  return c[key];
}

/** Small tier pill (emoji + name) tinted to the tier color. */
export function TierBadge({ tier, compact = false }: { tier: Tier; compact?: boolean }) {
  const color = useTierColor(tier);
  const meta = TIER_META[tier];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: color,
        paddingVertical: 3,
        paddingHorizontal: compact ? 7 : 9,
      }}>
      <T size={compact ? 11 : 12}>{meta.emoji}</T>
      {!compact && (
        <T size={11} weight="800" color={color}>
          {tier}
        </T>
      )}
    </View>
  );
}

function ZoneDivider({ label, color }: { label: string; color: string }) {
  return (
    <Row style={{ gap: 8, paddingVertical: 4 }}>
      <View style={{ flex: 1, height: 1.5, backgroundColor: color, opacity: 0.5, borderRadius: 1 }} />
      <T size={10} weight="800" color={color} style={{ letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </T>
      <View style={{ flex: 1, height: 1.5, backgroundColor: color, opacity: 0.5, borderRadius: 1 }} />
    </Row>
  );
}

function RankCell({ rank }: { rank: number }) {
  const { c } = useTheme();
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <View style={{ width: 30, alignItems: 'center' }}>
      {medal ? (
        <T size={16}>{medal}</T>
      ) : (
        <T size={14} weight="800" color={c.muted}>
          {rank}
        </T>
      )}
    </View>
  );
}

function BoardRow({ row, leagueSize }: { row: LeagueRow; leagueSize: number }) {
  const { c } = useTheme();
  const tier = tierForRank(row.rank, leagueSize);
  return (
    <Row
      style={{
        backgroundColor: row.isMe ? c.surface : 'transparent',
        borderWidth: row.isMe ? 1.5 : 0,
        borderColor: row.isMe ? c.accent : 'transparent',
        borderRadius: radius.md,
        paddingVertical: 9,
        paddingHorizontal: 8,
        gap: 8,
      }}>
      <RankCell rank={row.rank} />
      <View style={{ flex: 1 }}>
        <T size={14} weight={row.isMe ? '900' : '700'} color={row.isMe ? c.accentInk : c.fg}>
          {row.displayName}
          {row.isMe ? '  (you)' : ''}
        </T>
      </View>
      <TierBadge tier={tier} compact />
      <View style={{ width: 64, alignItems: 'flex-end' }}>
        <T size={14} weight="900" color={row.isMe ? c.accentInk : c.fg}>
          {row.xp}
        </T>
        <T size={9.5} muted weight="700">
          XP
        </T>
      </View>
    </Row>
  );
}

/**
 * Ranked weekly league list: medal/rank, name, tier badge, weekly XP, with the current
 * user highlighted. Promotion-zone and relegation-zone divider lines mark the top
 * PROMOTE_COUNT and bottom RELEGATE_COUNT rows (Duolingo-style "stay in the green").
 */
export function LeagueBoard({ board }: { board: Leaderboard }) {
  const { c } = useTheme();
  const rows = board.rows;
  const n = rows.length;

  return (
    <View style={{ gap: 2 }}>
      {rows.map((row, i) => {
        // Promotion line sits AFTER the last promoted row; relegation line BEFORE the first relegated row.
        const showPromote = i === PROMOTE_COUNT && n > PROMOTE_COUNT + RELEGATE_COUNT;
        const showRelegate = i === n - RELEGATE_COUNT && n > PROMOTE_COUNT + RELEGATE_COUNT;
        return (
          <Fragment key={row.userId}>
            {showPromote && <ZoneDivider label={`▲ Promotion · top ${PROMOTE_COUNT}`} color={c.success} />}
            {showRelegate && <ZoneDivider label={`▼ Relegation · bottom ${RELEGATE_COUNT}`} color={c.danger} />}
            <BoardRow row={row} leagueSize={n} />
          </Fragment>
        );
      })}
    </View>
  );
}
