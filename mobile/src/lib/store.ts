import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { track } from './analytics';
import {
  bankForTrack,
  buildSessionDeck,
  dailyPoolForRole,
  deckCounts,
  findCardById,
  freshSessionCards,
  type Level,
  lessonDeck,
  roleDomain,
  SessionCard,
  trackBySlug,
  weakSpotDeck,
} from './content';
import { basicsForRole } from './basics';
import { companyBank } from './companySets';
import { incidentDeck } from './incidents';
import { maybeRequestReview } from './review';
import { buyProduct, type PurchaseResult, restoreAll } from './iap';
import { BASE_PRODUCT_ID, PRO_PRODUCT_IDS, SUBSCRIPTION_IDS } from './products';
import { setDailyReminder } from './reminders';
import type { RoleKey } from './roles';
import { CardState, initCard, Rating, schedule } from './srs';
import type { AccentKey } from './theme';
import { upsertWeeklyXp, weekKey } from './leagues';
import { questMetricForSession } from './quests';
import { touchFriendActivity } from './friends';
import { scheduleStreakReminder } from './notifications';
import { syncWidget } from './widget';
import {
  DebriefInput,
  insertDebrief,
  listUserEntitlements,
  pullFeedback,
  pullProgress,
  pushFeedback,
  pushProgress,
  pushStats,
  writeEntitlement,
} from './sync';

export type Role = RoleKey;
export type Mode = 'cram' | 'maintain';
type SessionKind = 'daily' | 'track' | 'fresh' | 'weakspot' | 'lesson' | 'basics' | 'saved' | 'company' | 'incident' | 'diagnostic';

/** Duolingo-style feedback events emitted by the store, consumed by the FeedbackBridge. */
export type FeedbackKind = 'correct' | 'wrong' | 'complete' | 'streak' | 'levelUp';
export interface FeedbackEvent {
  kind: FeedbackKind;
  at: number;
}

const DAY = 86_400_000;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Production formats (do, not just recognize) earn more XP — reward the harder work (plan #21). */
const PRODUCTION_KINDS = new Set(['scenario', 'diag', 'querybuild', 'match', 'evidence', 'order', 'classify']);
/** Free code-drill runs per day. Pro removes the cap. Runs are 100% on-device (no server cost) — this is purely an upgrade hook. */
export const FREE_CODE_RUNS = 3;
const xpFor = (kind: string | undefined, rating: Rating): number => {
  const prod = kind ? PRODUCTION_KINDS.has(kind) : false;
  if (rating === 'again') return prod ? 8 : 5;
  return prod ? 20 : 10; // good / easy
};

/** True if every calendar day skipped between `lastDay` and `today` was a scheduled rest day. */
function restDaysCover(lastDay: string, today: string, restDays: number[]): boolean {
  if (!restDays.length) return false;
  const start = Date.parse(lastDay + 'T00:00:00Z');
  const end = Date.parse(today + 'T00:00:00Z');
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return false;
  for (let t = start + DAY; t < end; t += DAY) {
    if (!restDays.includes(new Date(t).getUTCDay())) return false;
  }
  return true;
}

/** Free taste of the weekly "stay current" stream; the full stream is Pro (subscription). */
const FREE_FRESH_PREVIEW = 3;

/** SOLE writer of `owned`/`unlocked`. Never `set({ owned })` directly — route through here
 *  so the derived `unlocked` gate (used in 11 places) can never go stale. */
const withOwned = (owned: Record<string, boolean>) => ({
  owned,
  // Pro = any live entitlement: a Pro subscription OR the one-time lifetime unlock.
  unlocked: PRO_PRODUCT_IDS.some((id) => !!owned[id]),
});

interface State {
  // persisted
  role: Role;
  mode: Mode;
  owned: Record<string, boolean>; // product id → owned
  unlocked: boolean; // derived: owned[BASE_PRODUCT_ID]; never persisted
  streak: number;
  freezes: number;
  xp: number;
  lastActiveDay: string | null;
  dailyGoal: number;
  cardsToday: number; // = reviewedTodayIds.length (unique cards today)
  reviewedTodayIds: string[];
  goalDay: string | null;
  playful: boolean;
  onboarded: boolean; // first-run flow completed
  reminders: boolean;
  targetCompany: string;
  interviewIn: number | null;
  progress: Record<string, CardState>;
  // Per-card reactions (persisted, local-first; synced to card_feedback when signed in).
  // `feedback` and `savedIds` are independent — a card can be Saved AND Disliked at once.
  feedback: Record<string, 'like' | 'dislike'>;
  savedIds: string[];
  // Duolingo feel — persisted toggles (default on, full energy)
  sound: boolean;
  haptics: boolean;
  // Accent theme (Pro + account gated for non-default swatches; see resolveAccent in theme.ts)
  accentKey: AccentKey;
  // Scheduled rest days (UTC weekday 0=Sun..6=Sat) — skipped rest days don't break the streak.
  restDays: number[];
  // Weekly league XP (resets each ISO week) — feeds the leaderboard.
  weeklyXp: number;
  weeklyXpWeek: string | null;
  // Daily quests — per-day counters for diag/fresh/lesson completions (other quests derive from cardsToday).
  questDay: string | null;
  questProgress: Partial<Record<'diag' | 'fresh' | 'lesson', number>>;
  // Interview-date mode: the actual calendar date (interviewIn is a derived day-count for legacy consumers).
  interviewDate: string | null;
  // Last mock-interview score (0..100).
  lastMockScore: number | null;
  // Passed chapter checkpoints, keyed `${slug}:${chapterIdx}` (plan #25).
  checkpointsDone: string[];
  // Whether we've shown the notification-permission priming row (after first session, not onboarding).
  notifAsked: boolean;
  // Code-drill run quota: free users get FREE_CODE_RUNS/day (Pro = unlimited). Resets on a new day.
  codeRunDay: string | null;
  codeRunsToday: number;
  // Developer view: reveals all stages/questions unlocked. Only ever active when __DEV__
  // (see `isDev`), so a production build can never expose it regardless of this flag.
  devMode: boolean;

  // auth (from Supabase session; not persisted here)
  userId: string | null;

  // transient feedback signal (NOT persisted) — consumed + cleared by the FeedbackBridge
  lastEvent: FeedbackEvent | null;
  levelUpTo: number | null;

  // transient session
  sessionKind: SessionKind;
  trackSlug: string | null;
  companyKey: string | null;
  incidentId: string | null;
  lessonIdx: number | null;
  sessionLevel: Level | null; // optional difficulty filter for a track session (track screen selector)
  userLevel: Level | null; // PERSISTED default level (Junior/Senior/Pro) chosen at onboarding → filters daily/role sessions
  sessionDeck: SessionCard[];
  sessionMeta: { due: number; fresh: number };
  idx: number;
  reveal: boolean;
  lastChoice: number | null;
  inSession: boolean; // playing a deck (vs browsing the Learn path)

  // actions
  setRole: (r: Role) => void;
  setMode: (m: Mode) => void;
  setInterview: (days: number | null, company?: string) => void;
  setPlayful: (v: boolean) => void;
  setSound: (v: boolean) => void;
  setHaptics: (v: boolean) => void;
  setAccent: (k: AccentKey) => void;
  setRestDays: (days: number[]) => void;
  setInterviewDate: (iso: string | null) => void;
  bumpQuest: (metric: 'diag' | 'fresh' | 'lesson', n?: number) => void;
  /** Record one code-drill run (resets the counter on a new day). Returns false if the free quota is spent. */
  bumpCodeRun: () => boolean;
  recordMock: (score: number, missedIds: string[]) => void;
  completeCheckpoint: (key: string) => void;
  setNotifAsked: (v: boolean) => void;
  setDevMode: (v: boolean) => void;
  emit: (kind: FeedbackKind) => void;
  clearEvent: () => void;
  clearLevelUp: () => void;
  setReminders: (v: boolean) => void;
  setDailyGoal: (n: number) => void;
  applyHintCost: (n: number) => void;
  startDaily: () => void;
  startTrack: (slug: string, level?: Level) => void;
  startFresh: () => void;
  startSaved: () => void;
  startWeakspot: () => void;
  startBasics: () => void;
  startCompany: (key: string) => void;
  startIncident: (id: string) => void;
  startDiagnostic: () => void;
  startLesson: (slug: string, lessonIdx: number) => void;
  exitTrack: () => void;
  endSession: () => void;
  completeOnboarding: (role: Role, mode: Mode, level?: Level | null) => void;
  setUserLevel: (l: Level | null) => void;
  restartOnboarding: () => void;
  rebuildSession: () => void;
  doReveal: () => void;
  choose: (i: number) => void;
  rate: (r: Rating) => void;
  toggleSave: (id: string) => void;
  setFeedback: (id: string, v: 'like' | 'dislike') => void;
  replay: () => void;
  // backend-wired
  setUserId: (id: string | null) => void;
  hydrateFromCloud: () => Promise<void>;
  purchase: (productId?: string) => Promise<PurchaseResult>;
  restore: () => Promise<boolean>;
  submitDebrief: (d: DebriefInput) => Promise<void>;
}

type DeckInputs = Pick<
  State,
  'sessionKind' | 'trackSlug' | 'companyKey' | 'incidentId' | 'lessonIdx' | 'sessionLevel' | 'userLevel' | 'role' | 'unlocked' | 'devMode' | 'progress' | 'feedback' | 'savedIds'
>;

/** Ids the user disliked — buildSessionDeck pushes these to the back so they surface less (never hidden). */
const dislikedSet = (feedback: Record<string, 'like' | 'dislike'>): Set<string> =>
  new Set(Object.keys(feedback).filter((id) => feedback[id] === 'dislike'));

function buildDeck(s: DeckInputs): { deck: SessionCard[]; meta: { due: number; fresh: number } } {
  const now = Date.now();
  // Dev mode lifts the same gates Pro does (unlimited decks, smart scheduling), but only in dev builds.
  const unlockAll = s.unlocked || (__DEV__ && s.devMode);
  const adaptive = unlockAll; // Pro "smart scheduling": weakest-first + unlimited
  const down = dislikedSet(s.feedback);
  let deck: SessionCard[];
  if (s.sessionKind === 'weakspot') {
    deck = weakSpotDeck(dailyPoolForRole(s.role, now), s.progress, now, unlockAll ? 30 : 10);
    // Brand-new user has no weak cards yet → don't show an empty session; fall back to a normal one.
    if (deck.length === 0) {
      deck = buildSessionDeck(dailyPoolForRole(s.role, now), s.progress, now, unlockAll ? 40 : 15, adaptive, down);
    }
  } else if (s.sessionKind === 'lesson' && s.trackSlug && s.lessonIdx != null) {
    deck = lessonDeck(s.trackSlug, s.lessonIdx);
  } else if (s.sessionKind === 'track' && s.trackSlug) {
    const pool = bankForTrack(s.trackSlug);
    const scoped = s.sessionLevel ? pool.filter((cd) => cd.level === s.sessionLevel) : pool;
    deck = buildSessionDeck(scoped.length ? scoped : pool, s.progress, now, unlockAll ? Infinity : 50, adaptive, down);
  } else if (s.sessionKind === 'company' && s.companyKey) {
    deck = buildSessionDeck(companyBank(s.companyKey), s.progress, now, unlockAll ? Infinity : 50, adaptive, down);
  } else if (s.sessionKind === 'incident' && s.incidentId) {
    // Production incidents are free + short — run the whole on-call deck, weakest-first when adaptive.
    deck = buildSessionDeck(incidentDeck(s.incidentId), s.progress, now, Infinity, adaptive, down);
  } else if (s.sessionKind === 'diagnostic') {
    // "Finish a diagnostic" quest — diag-format cards from the role pool (so completing it credits
    // the diag quest). Falls back to the full daily pool if the role has no diag cards.
    const pool = dailyPoolForRole(s.role, now).filter((cd) => cd.kind === 'diag');
    deck = buildSessionDeck(pool.length ? pool : dailyPoolForRole(s.role, now), s.progress, now, unlockAll ? 30 : 12, adaptive, down);
  } else if (s.sessionKind === 'fresh') {
    // Pillar 2 "stay current" — the weekly fresh stream is the subscription's headline value.
    // Free users still taste it (the daily fresh trickle + a short preview here so the screen
    // never dead-ends); Pro unlocks the full stream. The home pill routes locked users to the
    // paywall, so this cap is mainly a safety net for deep links / dev.
    deck = freshSessionCards(now, roleDomain(s.role), unlockAll ? Infinity : FREE_FRESH_PREVIEW);
  } else if (s.sessionKind === 'saved') {
    // Resolve saved ids to live cards, skipping any that expired / were removed by OTA.
    deck = s.savedIds.map((id) => findCardById(id)).filter((cd): cd is SessionCard => !!cd);
  } else if (s.sessionKind === 'basics') {
    deck = buildSessionDeck(basicsForRole(s.role), s.progress, now, Infinity, false, down);
  } else {
    // Daily: respect the user's chosen level (Junior/Senior/Pro → Jr/Mid/Sr). Fall back to the
    // full pool if filtering leaves too little (never starve the daily queue).
    const pool = dailyPoolForRole(s.role, now);
    const scoped = s.userLevel ? pool.filter((cd) => cd.level === s.userLevel) : pool;
    deck = buildSessionDeck(scoped.length >= 5 ? scoped : pool, s.progress, now, unlockAll ? 40 : 15, adaptive, down);
  }
  return { deck, meta: deckCounts(deck, s.progress, now) };
}

const initial = buildDeck({
  sessionKind: 'daily',
  trackSlug: null,
  companyKey: null,
  incidentId: null,
  lessonIdx: null,
  sessionLevel: null,
  userLevel: null,
  role: 'de',
  unlocked: false,
  devMode: false,
  progress: {},
  feedback: {},
  savedIds: [],
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      role: 'de',
      mode: 'maintain',
      owned: {},
      unlocked: false,
      streak: 0,
      freezes: 0,
      xp: 0,
      lastActiveDay: null,
      dailyGoal: 10,
      cardsToday: 0,
      reviewedTodayIds: [],
      goalDay: null,
      playful: true,
      sound: true,
      haptics: true,
      accentKey: 'classic',
      restDays: [],
      weeklyXp: 0,
      weeklyXpWeek: null,
      questDay: null,
      questProgress: {},
      codeRunDay: null,
      codeRunsToday: 0,
      interviewDate: null,
      lastMockScore: null,
      checkpointsDone: [],
      notifAsked: false,
      devMode: false,
      onboarded: false,
      reminders: true,
      targetCompany: '',
      interviewIn: null,
      progress: {},
      feedback: {},
      savedIds: [],
      userId: null,
      lastEvent: null,
      levelUpTo: null,

      sessionKind: 'daily',
      trackSlug: null,
      companyKey: null,
      incidentId: null,
      lessonIdx: null,
      sessionLevel: null,
      userLevel: null,
      sessionDeck: initial.deck,
      sessionMeta: initial.meta,
      idx: 0,
      reveal: false,
      lastChoice: null,
      inSession: false,

      rebuildSession: () => {
        const { deck, meta } = buildDeck(get());
        set({ sessionDeck: deck, sessionMeta: meta });
      },

      setRole: (role) => {
        set({ role, idx: 0, reveal: false, lastChoice: null });
        get().rebuildSession();
      },
      setMode: (mode) => set({ mode }),
      setInterview: (days, company) =>
        set((s) => ({
          interviewIn: days,
          targetCompany: company ?? s.targetCompany,
          mode: days != null && days <= 14 ? 'cram' : s.mode,
        })),
      setPlayful: (playful) => set({ playful }),
      setSound: (sound) => set({ sound }),
      setHaptics: (haptics) => set({ haptics }),
      setAccent: (accentKey) => set({ accentKey }),
      setRestDays: (restDays) => set({ restDays }),
      setInterviewDate: (interviewDate) => set({ interviewDate }),
      bumpQuest: (metric, n = 1) => {
        const st = get();
        const today = dayKey(Date.now());
        const base = st.questDay === today ? st.questProgress : {};
        set({ questDay: today, questProgress: { ...base, [metric]: (base[metric] ?? 0) + n } });
      },
      bumpCodeRun: () => {
        const st = get();
        const today = dayKey(Date.now());
        const used = st.codeRunDay === today ? st.codeRunsToday : 0; // reset on a new day
        if (!st.unlocked && used >= FREE_CODE_RUNS) return false; // free quota spent
        set({ codeRunDay: today, codeRunsToday: used + 1 });
        return true;
      },
      recordMock: (score, missedIds) => {
        const st = get();
        const now = Date.now();
        const progress = { ...st.progress };
        // Push missed cards toward weak-spot by registering a lapse + making them due now.
        for (const id of missedIds) progress[id] = schedule(progress[id] ?? initCard(), 'again', now);
        set({ lastMockScore: score, progress });
        if (st.userId) void pushProgress(st.userId, progress);
        // High moment → maybe ask for a store review (throttled + capped internally).
        if (score >= 80) void maybeRequestReview();
      },
      completeCheckpoint: (key) => {
        const st = get();
        if (st.checkpointsDone.includes(key)) return;
        set({ checkpointsDone: [...st.checkpointsDone, key], xp: st.xp + 50 });
      },
      setNotifAsked: (notifAsked) => set({ notifAsked }),
      setDevMode: (devMode) => set({ devMode }),
      emit: (kind) => set({ lastEvent: { kind, at: Date.now() } }),
      clearEvent: () => set({ lastEvent: null }),
      clearLevelUp: () => set({ levelUpTo: null }),
      setReminders: (reminders) => {
        set({ reminders });
        void setDailyReminder(reminders);
      },
      setDailyGoal: (dailyGoal) => set({ dailyGoal }),
      applyHintCost: (n) => set((s) => ({ xp: Math.max(0, s.xp - n) })),

      startDaily: () => {
        track('session_started', { kind: 'daily' });
        set({ sessionKind: 'daily', trackSlug: null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null, inSession: true });
        get().rebuildSession();
      },
      startTrack: (slug, level) => {
        track('session_started', { kind: 'track', track: slug, level: level ?? 'all' });
        set({ sessionKind: 'track', trackSlug: slug, sessionLevel: level ?? null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null, inSession: true });
        get().rebuildSession();
      },
      startFresh: () => {
        track('session_started', { kind: 'fresh' });
        set({ sessionKind: 'fresh', trackSlug: null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null, inSession: true });
        get().rebuildSession();
      },
      startSaved: () => {
        track('session_started', { kind: 'saved' });
        set({ sessionKind: 'saved', trackSlug: null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null, inSession: true });
        get().rebuildSession();
      },
      startWeakspot: () => {
        track('session_started', { kind: 'weakspot' });
        set({ sessionKind: 'weakspot', trackSlug: null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null, inSession: true });
        get().rebuildSession();
      },
      startBasics: () => {
        track('session_started', { kind: 'basics' });
        set({ sessionKind: 'basics', trackSlug: null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null, inSession: true });
        get().rebuildSession();
      },
      startCompany: (key) => {
        track('session_started', { kind: 'company', company: key });
        set({ sessionKind: 'company', companyKey: key, trackSlug: null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null, inSession: true });
        get().rebuildSession();
      },
      startIncident: (id) => {
        track('session_started', { kind: 'incident', incident: id });
        set({ sessionKind: 'incident', incidentId: id, trackSlug: null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null, inSession: true });
        get().rebuildSession();
      },
      startDiagnostic: () => {
        track('session_started', { kind: 'diagnostic' });
        set({ sessionKind: 'diagnostic', trackSlug: null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null, inSession: true });
        get().rebuildSession();
      },
      startLesson: (slug, lessonIdx) => {
        track('session_started', { kind: 'lesson', track: slug, lesson: lessonIdx });
        set({ sessionKind: 'lesson', trackSlug: slug, lessonIdx, idx: 0, reveal: false, lastChoice: null, inSession: true });
        get().rebuildSession();
      },
      exitTrack: () => {
        set({ sessionKind: 'daily', trackSlug: null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null });
        get().rebuildSession();
      },
      endSession: () => {
        set({ inSession: false, sessionKind: 'daily', trackSlug: null, lessonIdx: null, idx: 0, reveal: false, lastChoice: null });
        get().rebuildSession();
      },
      completeOnboarding: (role, mode, level) => {
        track('onboarded', { role, mode, level: level ?? 'all' });
        set({ role, mode, userLevel: level ?? null, onboarded: true, idx: 0, reveal: false, lastChoice: null });
        get().rebuildSession();
      },
      setUserLevel: (userLevel) => {
        set({ userLevel });
        get().rebuildSession();
      },
      // Dev affordance: re-show the first-run flow (the (tabs) layout redirects to /onboarding when false).
      restartOnboarding: () => set({ onboarded: false }),

      doReveal: () => set({ reveal: true }),
      choose: (i) => set({ reveal: true, lastChoice: i }),

      rate: (r) => {
        const st = get();
        const deck = st.sessionDeck;
        const card = deck[st.idx];
        const now = Date.now();
        const today = dayKey(now);
        const progress = { ...st.progress };
        if (card) progress[card.id] = schedule(progress[card.id], r, now);
        const nextIdx = st.idx + 1;
        const gain = xpFor(card?.kind, r);
        const xp = st.xp + gain;
        // Weekly league XP (resets each ISO week).
        const wk = weekKey(now);
        const weeklyXp = (st.weeklyXpWeek === wk ? st.weeklyXp : 0) + gain;

        // daily goal = UNIQUE cards reviewed today (re-rating the same card doesn't double-count)
        let reviewedTodayIds = st.goalDay === today ? st.reviewedTodayIds : [];
        if (card && !reviewedTodayIds.includes(card.id)) reviewedTodayIds = [...reviewedTodayIds, card.id];
        const cardsToday = reviewedTodayIds.length;
        const goalDay = today;

        // streak + freezes, settled once per completed-session-day
        let streak = st.streak;
        let freezes = st.freezes;
        let lastActiveDay = st.lastActiveDay;
        const done = nextIdx >= deck.length;
        if (done && lastActiveDay !== today) {
          if (lastActiveDay === dayKey(now - DAY)) {
            streak += 1;
          } else if (lastActiveDay && restDaysCover(lastActiveDay, today, st.restDays)) {
            streak += 1; // only scheduled rest days were skipped — streak stays intact
          } else if (freezes > 0) {
            freezes -= 1; // a freeze forgives the gap
            streak += 1;
          } else {
            streak = 1;
          }
          lastActiveDay = today;
          if (streak % 5 === 0) freezes = Math.min(2, freezes + 1); // earn a freeze every 5 days
        }

        set({
          progress,
          idx: nextIdx,
          reveal: false,
          lastChoice: null,
          xp,
          weeklyXp,
          weeklyXpWeek: wk,
          streak,
          freezes,
          lastActiveDay,
          cardsToday,
          reviewedTodayIds,
          goalDay,
          sessionMeta: deckCounts(deck, progress, now),
        });

        // Duolingo feedback events → FeedbackBridge plays sound/haptic + level-up overlay.
        const streakBumped = done && streak > st.streak;
        // Milestone streaks are a high moment → maybe ask for a store review (throttled internally).
        if (streakBumped && (streak === 7 || streak === 30 || streak === 100)) void maybeRequestReview();
        if (streakBumped) get().emit('streak');
        else if (done) get().emit('complete');
        if (level(xp) > level(st.xp)) {
          set({ levelUpTo: level(xp) });
          get().emit('levelUp');
        }

        if (done) {
          // Daily quest credit for completing a diag/fresh/lesson session.
          const metric = questMetricForSession(st.sessionKind, deck);
          if (metric === 'diag' || metric === 'fresh' || metric === 'lesson') get().bumpQuest(metric);
          // Re-engagement: reschedule the streak-at-risk nudge (no-op without notif permission).
          void scheduleStreakReminder(streak, st.restDays);
          if (st.userId) void touchFriendActivity(st.userId);
          track('session_completed', { kind: st.sessionKind, count: deck.length });
        }

        if (st.userId) {
          void pushProgress(st.userId, progress);
          void pushStats(st.userId, streak, xp);
          void upsertWeeklyXp(st.userId, weeklyXp, 'You');
        }
        // Keep the home-screen widget fresh (no-op when no native widget present).
        void syncWidget(get());
      },

      toggleSave: (id) => {
        const st = get();
        const has = st.savedIds.includes(id);
        const savedIds = has ? st.savedIds.filter((x) => x !== id) : [...st.savedIds, id];
        set({ savedIds });
        track('card_saved', { saved: !has });
        if (st.userId) void pushFeedback(st.userId, id, !has, st.feedback[id] ?? null);
      },
      setFeedback: (id, v) => {
        const st = get();
        const feedback = { ...st.feedback };
        if (feedback[id] === v) delete feedback[id]; // tapping the active reaction clears it
        else feedback[id] = v;
        set({ feedback });
        track('card_feedback', { value: feedback[id] ?? 'clear' });
        // Deprioritization takes effect on the NEXT session build — never reorder the deck mid-session
        // (it would desync the current idx). SRS schedule is untouched here.
        if (st.userId) void pushFeedback(st.userId, id, st.savedIds.includes(id), feedback[id] ?? null);
      },

      replay: () => {
        set({ idx: 0, reveal: false, lastChoice: null });
        get().rebuildSession();
      },

      setUserId: (userId) => set({ userId }),

      hydrateFromCloud: async () => {
        const uid = get().userId;
        if (!uid) return;
        const remote = await pullProgress(uid);
        set((s) => ({ progress: { ...remote, ...s.progress } }));
        // Reactions: remote as base, local wins on conflict (mirrors progress); savedIds is a union.
        const remoteFb = await pullFeedback(uid);
        set((s) => ({
          feedback: { ...remoteFb.feedback, ...s.feedback },
          savedIds: [...new Set([...remoteFb.savedIds, ...s.savedIds])],
        }));
        // merge server-side entitlements so a signed-in user keeps Pro/packs cross-device
        // Only sync PERMANENT entitlements from the server (lifetime, packs). A subscription's
        // status is the store's to decide — never resurrect a cancelled sub from a stale row.
        const serverIds = (await listUserEntitlements(uid)).filter((id) => !SUBSCRIPTION_IDS.includes(id));
        if (serverIds.length) {
          const owned = { ...get().owned };
          for (const id of serverIds) owned[id] = true;
          set(withOwned(owned));
        }
        get().rebuildSession();
      },

      purchase: async (productId = BASE_PRODUCT_ID) => {
        const r = await buyProduct(productId);
        if (r.ok || r.mock) {
          set(withOwned({ ...get().owned, [r.productId]: true }));
          track('purchase', { mock: Boolean(r.mock), productId: r.productId, platform: r.platform });
          get().rebuildSession();
          const uid = get().userId;
          if (uid && r.ok) await writeEntitlement(uid, r.productId, r.platform, r.receipt);
        }
        return r;
      },

      restore: async () => {
        // Authoritative reconcile (the "Restore purchases" path). storeIds is live store truth:
        // one-time purchases + ACTIVE subscriptions only (a lapsed sub won't appear).
        const storeIds = await restoreAll();
        const uid = get().userId;
        const serverIds = uid ? await listUserEntitlements(uid) : [];
        const subSet = new Set(SUBSCRIPTION_IDS);
        const owned = { ...get().owned };
        // Permanent entitlements (lifetime, packs) are additive from either source.
        for (const id of [...storeIds, ...serverIds]) if (!subSet.has(id)) owned[id] = true;
        // Subscriptions reflect LIVE store state only — revoke a lapsed sub even if a stale
        // entitlements row still names it (the table never expires; the store is the truth).
        for (const subId of SUBSCRIPTION_IDS) owned[subId] = storeIds.includes(subId);
        set(withOwned(owned));
        get().rebuildSession();
        return PRO_PRODUCT_IDS.some((id) => owned[id]) || Object.values(owned).some(Boolean);
      },

      submitDebrief: async (d) => {
        track('debrief_submitted', { topics: d.topics.length, outcome: d.outcome });
        set({ targetCompany: d.company });
        const uid = get().userId;
        if (uid) await insertDebrief(uid, d);
      },
    }),
    {
      name: 'fieldnotes-v1',
      version: 11,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        role: s.role,
        mode: s.mode,
        owned: s.owned,
        streak: s.streak,
        freezes: s.freezes,
        xp: s.xp,
        lastActiveDay: s.lastActiveDay,
        dailyGoal: s.dailyGoal,
        cardsToday: s.cardsToday,
        reviewedTodayIds: s.reviewedTodayIds,
        goalDay: s.goalDay,
        playful: s.playful,
        sound: s.sound,
        haptics: s.haptics,
        accentKey: s.accentKey,
        restDays: s.restDays,
        userLevel: s.userLevel,
        weeklyXp: s.weeklyXp,
        weeklyXpWeek: s.weeklyXpWeek,
        questDay: s.questDay,
        questProgress: s.questProgress,
        codeRunDay: s.codeRunDay,
        codeRunsToday: s.codeRunsToday,
        interviewDate: s.interviewDate,
        lastMockScore: s.lastMockScore,
        checkpointsDone: s.checkpointsDone,
        notifAsked: s.notifAsked,
        devMode: s.devMode,
        onboarded: s.onboarded,
        reminders: s.reminders,
        targetCompany: s.targetCompany,
        interviewIn: s.interviewIn,
        progress: s.progress,
        feedback: s.feedback,
        savedIds: s.savedIds,
      }),
      // v1 stored a boolean `unlocked`; map it to owned[BASE] so Pro users aren't downgraded.
      // v3 moved from the 3-value Role to the RoleKey catalog + added sound/haptics.
      migrate: (persisted: unknown, from: number) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        if (from < 2) {
          p.owned = p.unlocked ? { [BASE_PRODUCT_ID]: true } : {};
          delete p.unlocked;
          if (!Array.isArray(p.reviewedTodayIds)) p.reviewedTodayIds = [];
        }
        if (from < 3) {
          const roleMap: Record<string, string> = { 'AI Engineer': 'ai', 'Data Engineer': 'de', Both: 'all' };
          p.role = roleMap[p.role as string] ?? 'de';
          if (typeof p.sound !== 'boolean') p.sound = true;
          if (typeof p.haptics !== 'boolean') p.haptics = true;
          if (typeof p.playful !== 'boolean') p.playful = true;
        }
        if (from < 4) {
          // v4 added per-card reactions; init empty so existing users keep everything else.
          if (typeof p.feedback !== 'object' || p.feedback === null) p.feedback = {};
          if (!Array.isArray(p.savedIds)) p.savedIds = [];
        }
        if (from < 5) {
          // v5 added the developer view toggle; default off.
          if (typeof p.devMode !== 'boolean') p.devMode = false;
        }
        if (from < 6) {
          // v6 added the Pro accent picker; default everyone to the free "Classic" accent.
          if (typeof p.accentKey !== 'string') p.accentKey = 'classic';
          // v6 also added scheduled rest days; default none.
          if (!Array.isArray(p.restDays)) p.restDays = [];
        }
        if (from < 7) {
          // v7 added weekly-league XP, daily quests, interview-date mode, and mock scores.
          if (typeof p.weeklyXp !== 'number') p.weeklyXp = 0;
          if (typeof p.weeklyXpWeek !== 'string') p.weeklyXpWeek = null;
          if (typeof p.questDay !== 'string') p.questDay = null;
          if (typeof p.questProgress !== 'object' || p.questProgress === null) p.questProgress = {};
          if (typeof p.interviewDate !== 'string') p.interviewDate = null;
          if (typeof p.lastMockScore !== 'number') p.lastMockScore = null;
        }
        if (from < 8) {
          // v8 added chapter checkpoint tests.
          if (!Array.isArray(p.checkpointsDone)) p.checkpointsDone = [];
        }
        if (from < 9) {
          // v9 moved the notification-permission ask out of onboarding to a post-first-session prime.
          if (typeof p.notifAsked !== 'boolean') p.notifAsked = false;
        }
        if (from < 10) {
          // v10 added a default difficulty level chosen at onboarding.
          const valid = ['Jr', 'Mid', 'Sr', 'Staff', 'Principal'];
          if (!valid.includes(p.userLevel as string)) p.userLevel = null;
        }
        if (from < 11) {
          // v11 added the code-drill daily run quota.
          if (typeof p.codeRunDay !== 'string') p.codeRunDay = null;
          if (typeof p.codeRunsToday !== 'number') p.codeRunsToday = 0;
        }
        return p;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.unlocked = !!state.owned?.[BASE_PRODUCT_ID];
        state.rebuildSession();
      },
    }
  )
);

/** The deck currently in play. */
export function activeDeck(s: State): SessionCard[] {
  return s.sessionDeck;
}

export function useActiveDeck(): SessionCard[] {
  return useStore(activeDeck);
}

export const isPro = (s: State) => s.unlocked;
/** Developer view is active only in dev builds — `__DEV__` guards it so production users never see it. */
export const isDev = (s: State) => __DEV__ && s.devMode;
export const ownsPack = (packId: string) => (s: State) => !!s.owned[packId];
export const level = (xp: number) => Math.floor(xp / 1000) + 1;
export const xpInLevel = (xp: number) => xp % 1000;
export const trackName = (slug: string | null) => (slug ? trackBySlug(slug)?.name ?? slug : '');
