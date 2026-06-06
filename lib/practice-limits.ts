"use client";

import { useCallback, useEffect, useState } from "react";
import { FREE_SUBMITS_PER_DAY, FREE_AI_MSGS_PER_DAY } from "./catalog";

const KEY = "fieldnotes_practice_usage_v1";

interface Usage {
  date: string;
  submits: number;
  asks: number;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function read(): Usage {
  try {
    const u = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (u && u.date === today()) return u;
  } catch {}
  return { date: today(), submits: 0, asks: 0 };
}
function write(u: Usage) {
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
  } catch {}
}

/**
 * Client-side daily caps for free users (Practice Pro = unlimited).
 * A pragmatic approximation; real enforcement would also live server-side.
 */
export function usePracticeLimits(pro: boolean) {
  const [usage, setUsage] = useState<Usage>({ date: "", submits: 0, asks: 0 });
  useEffect(() => setUsage(read()), []);

  const useSubmit = useCallback((): boolean => {
    if (pro) return true;
    const u = read();
    if (u.submits >= FREE_SUBMITS_PER_DAY) return false;
    u.submits += 1;
    write(u);
    setUsage({ ...u });
    return true;
  }, [pro]);

  const useAsk = useCallback((): boolean => {
    if (pro) return true;
    const u = read();
    if (u.asks >= FREE_AI_MSGS_PER_DAY) return false;
    u.asks += 1;
    write(u);
    setUsage({ ...u });
    return true;
  }, [pro]);

  return {
    submitsLeft: pro ? Infinity : Math.max(0, FREE_SUBMITS_PER_DAY - usage.submits),
    asksLeft: pro ? Infinity : Math.max(0, FREE_AI_MSGS_PER_DAY - usage.asks),
    useSubmit,
    useAsk,
  };
}
