"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Confidence } from "@/lib/types";

interface QuestionProgress {
  practiced: boolean;
  confidence: Confidence | null;
  lastStudiedAt: string | null; // ISO
}

interface PracticeSolve {
  category: string;
  solvedAt: string; // ISO
}

interface ProgressState {
  questions: Record<number, QuestionProgress>;
  asked: Record<number, boolean>;
  interviewDate: string | null; // ISO date
  drillXp: number;
  drillStreak: number;
  lastDrillDate: string | null;
  // Practice workspace
  practiceSolves: Record<string, PracticeSolve>; // keyed by item id
  practiceStreak: number;
  lastPracticeDate: string | null;
}

const DEFAULT: ProgressState = {
  questions: {},
  asked: {},
  interviewDate: null,
  drillXp: 0,
  drillStreak: 0,
  lastDrillDate: null,
  practiceSolves: {},
  practiceStreak: 0,
  lastPracticeDate: null,
};

const KEY = "fieldnotes_progress_v1";

interface ProgressCtx extends ProgressState {
  ready: boolean;
  togglePracticed: (id: number) => void;
  setConfidence: (id: number, c: Confidence) => void;
  markStudied: (id: number) => void;
  isPracticed: (id: number) => boolean;
  getConfidence: (id: number) => Confidence | null;
  getLastStudied: (id: number) => string | null;
  markAsked: (id: number) => boolean; // returns true if newly asked
  hasAsked: (id: number) => boolean;
  setInterviewDate: (iso: string | null) => void;
  recordDrill: (xp: number, correct: boolean) => void;
  recordPracticeSolve: (category: string, id: string) => void;
  practiceCountByCategory: () => Record<string, number>;
  isPracticeSolved: (id: string) => boolean;
}

const Ctx = createContext<ProgressCtx | null>(null);

function todayISO(): string {
  return new Date().toISOString();
}
function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...DEFAULT, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: ProgressState) => {
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const togglePracticed = useCallback(
    (id: number) => {
      setState((s) => {
        const cur = s.questions[id] ?? {
          practiced: false,
          confidence: null,
          lastStudiedAt: null,
        };
        const next = {
          ...s,
          questions: {
            ...s.questions,
            [id]: {
              ...cur,
              practiced: !cur.practiced,
              lastStudiedAt: todayISO(),
            },
          },
        };
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  const setConfidence = useCallback((id: number, c: Confidence) => {
    setState((s) => {
      const cur = s.questions[id] ?? {
        practiced: false,
        confidence: null,
        lastStudiedAt: null,
      };
      const next = {
        ...s,
        questions: {
          ...s.questions,
          [id]: {
            ...cur,
            practiced: true,
            confidence: c,
            lastStudiedAt: todayISO(),
          },
        },
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const markStudied = useCallback((id: number) => {
    setState((s) => {
      const cur = s.questions[id] ?? {
        practiced: false,
        confidence: null,
        lastStudiedAt: null,
      };
      const next = {
        ...s,
        questions: {
          ...s.questions,
          [id]: { ...cur, lastStudiedAt: todayISO() },
        },
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const markAsked = useCallback((id: number): boolean => {
    let newly = false;
    setState((s) => {
      if (s.asked[id]) return s;
      newly = true;
      const next = { ...s, asked: { ...s.asked, [id]: true } };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    return newly;
  }, []);

  const setInterviewDate = useCallback(
    (iso: string | null) => {
      persist({ ...state, interviewDate: iso });
    },
    [state, persist]
  );

  const recordDrill = useCallback((xp: number, correct: boolean) => {
    setState((s) => {
      const today = todayDate();
      let streak = s.drillStreak;
      if (s.lastDrillDate !== today) {
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .slice(0, 10);
        streak = s.lastDrillDate === yesterday ? s.drillStreak + 1 : 1;
      }
      const next = {
        ...s,
        drillXp: s.drillXp + (correct ? xp : 0),
        drillStreak: streak,
        lastDrillDate: today,
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const recordPracticeSolve = useCallback((category: string, id: string) => {
    setState((s) => {
      const today = todayDate();
      let streak = s.practiceStreak;
      if (s.lastPracticeDate !== today) {
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .slice(0, 10);
        streak = s.lastPracticeDate === yesterday ? s.practiceStreak + 1 : 1;
      }
      const next = {
        ...s,
        practiceSolves: {
          ...s.practiceSolves,
          [id]: { category, solvedAt: todayISO() },
        },
        practiceStreak: streak,
        lastPracticeDate: today,
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const value: ProgressCtx = {
    ...state,
    ready,
    togglePracticed,
    setConfidence,
    markStudied,
    isPracticed: (id) => Boolean(state.questions[id]?.practiced),
    getConfidence: (id) => state.questions[id]?.confidence ?? null,
    getLastStudied: (id) => state.questions[id]?.lastStudiedAt ?? null,
    markAsked,
    hasAsked: (id) => Boolean(state.asked[id]),
    setInterviewDate,
    recordDrill,
    recordPracticeSolve,
    practiceCountByCategory: () => {
      const out: Record<string, number> = {};
      for (const v of Object.values(state.practiceSolves))
        out[v.category] = (out[v.category] ?? 0) + 1;
      return out;
    },
    isPracticeSolved: (id) => Boolean(state.practiceSolves[id]),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProgress(): ProgressCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}
