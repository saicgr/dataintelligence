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
  savedCount: number;
  checkpointsDone: number;
  voiceTried: boolean;
}): Badge[] {
  const reviewed = Object.keys(args.progress).length;
  const lvl = Math.floor(args.xp / 1000) + 1;
  const mastered = args.trackCoverage.find((t) => t.pct >= 100);
  return [
    // Quick wins first — a day-1 user should unlock 2-4 of these in their first session.
    { id: 'firstCard', icon: '🃏', label: 'First card', earned: reviewed >= 1 },
    { id: 'firstSession', icon: '✅', label: 'First session', earned: args.streak >= 1 },
    { id: 'firstSave', icon: '🔖', label: 'Save a card', earned: args.savedCount >= 1 },
    { id: 'voice', icon: '🎙️', label: 'Try voice recall', earned: args.voiceTried },
    { id: 'streak3', icon: '🔥', label: '3-day streak', earned: args.streak >= 3 },
    { id: 'checkpoint1', icon: '🏁', label: 'Pass a checkpoint', earned: args.checkpointsDone >= 1 },
    // The long game.
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
