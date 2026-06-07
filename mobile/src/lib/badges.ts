/** Achievement badges (plan #8) — derived from live state, not separately persisted. */
import { CardState } from './srs';

export interface Badge {
  id: string;
  icon: string;
  label: string;
  earned: boolean;
}

export function computeBadges(args: {
  streak: number;
  xp: number;
  progress: Record<string, CardState>;
  lastMockScore: number | null;
  trackCoverage: { slug: string; name: string; pct: number }[];
}): Badge[] {
  const reviewed = Object.keys(args.progress).length;
  const lvl = Math.floor(args.xp / 1000) + 1;
  const mastered = args.trackCoverage.find((t) => t.pct >= 100);
  return [
    { id: 'streak7', icon: '🔥', label: '7-day streak', earned: args.streak >= 7 },
    { id: 'streak30', icon: '🌟', label: '30-day streak', earned: args.streak >= 30 },
    { id: 'streak100', icon: '💯', label: '100-day streak', earned: args.streak >= 100 },
    { id: 'lvl5', icon: '⭐', label: 'Level 5', earned: lvl >= 5 },
    { id: 'lvl10', icon: '🏅', label: 'Level 10', earned: lvl >= 10 },
    { id: 'reviewed100', icon: '🧠', label: '100 cards', earned: reviewed >= 100 },
    { id: 'reviewed500', icon: '📚', label: '500 cards', earned: reviewed >= 500 },
    { id: 'mockPass', icon: '🎯', label: 'Mock passed', earned: (args.lastMockScore ?? 0) >= 80 },
    { id: 'trackMastery', icon: '🏆', label: mastered ? `${mastered.name} mastered` : 'Master a track', earned: !!mastered },
  ];
}
