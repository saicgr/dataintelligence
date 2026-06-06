import { cookies } from "next/headers";
import { getServerSupabase } from "./supabase-server";
import { hasSupabase } from "./env";
import { allSheets } from "./catalog";
import type { Level } from "./types";

export interface CurrentUser {
  authenticated: boolean;
  isDemo: boolean;
  id: string | null;
  email: string | null;
  interviewDate: string | null;
  hasFullBundle: boolean;
  practicePro: boolean; // Practice Pro subscription active
  owned: Set<string>; // "tool:level"
}

export const sheetKey = (tool: string, level: Level | string) =>
  `${tool}:${level}`;

/** Cookie that marks a demo session (set/cleared via /api/demo). */
export const DEMO_COOKIE = "fn_demo";

/** Demo/test account credentials (override via env in real deployments). */
export const DEMO_EMAIL = process.env.DEMO_EMAIL || "g@g.com";
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "test1234";

/** Demo user — signed in via the demo button; owns everything so the app is fully explorable. */
function demoUser(): CurrentUser {
  return {
    authenticated: true,
    isDemo: true,
    id: "demo-user",
    email: "demo@fieldnotes.app",
    interviewDate: null,
    hasFullBundle: true,
    practicePro: true,
    owned: new Set(allSheets().map((s) => sheetKey(s.tool, s.level))),
  };
}

/** Anonymous visitor — not signed in. Preview-only: owns nothing, no Practice Pro. */
function anonymousUser(): CurrentUser {
  return {
    authenticated: false,
    isDemo: false,
    id: null,
    email: null,
    interviewDate: null,
    hasFullBundle: false,
    practicePro: false,
    owned: new Set(),
  };
}

/**
 * Resolve the current user + their entitlements.
 * - A demo session cookie always grants full access (works with or without Supabase).
 * - With no Supabase configured, visitors are anonymous (preview only) until they sign in.
 * - Live mode: reads the auth session + entitlements table.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const jar = await cookies();
  if (jar.get(DEMO_COOKIE)?.value === "1") return demoUser();

  if (!hasSupabase) return anonymousUser();

  const supabase = await getServerSupabase();
  if (!supabase) return anonymousUser();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authenticated: false,
      isDemo: false,
      id: null,
      email: null,
      interviewDate: null,
      hasFullBundle: false,
      practicePro: false,
      owned: new Set(),
    };
  }

  const [{ data: profile }, { data: ents }] = await Promise.all([
    supabase
      .from("users")
      .select("interview_date, has_full_bundle, email, practice_pro")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("entitlements").select("tool_id, level").eq("user_id", user.id),
  ]);

  const owned = new Set<string>();
  // entitlements store tool_id (int); we keep a parallel slug map server-side via the tools table.
  if (ents && ents.length) {
    const { data: tools } = await supabase.from("tools").select("id, slug");
    const idToSlug = new Map((tools || []).map((t) => [t.id, t.slug]));
    for (const e of ents) {
      const slug = idToSlug.get(e.tool_id);
      if (slug) owned.add(sheetKey(slug, e.level));
    }
  }

  const hasFullBundle = Boolean(profile?.has_full_bundle);
  if (hasFullBundle) {
    for (const s of allSheets()) owned.add(sheetKey(s.tool, s.level));
  }

  return {
    authenticated: true,
    isDemo: false,
    id: user.id,
    email: profile?.email || user.email || null,
    interviewDate: profile?.interview_date || null,
    hasFullBundle,
    practicePro: Boolean(profile?.practice_pro),
    owned,
  };
}

export function ownsSheet(
  user: CurrentUser,
  tool: string,
  level: Level
): boolean {
  return user.hasFullBundle || user.owned.has(sheetKey(tool, level));
}

/** First sheet the user owns, for /dashboard redirect. Null if none. */
export function firstOwnedSheet(
  user: CurrentUser
): { tool: string; level: Level } | null {
  for (const s of allSheets()) {
    if (ownsSheet(user, s.tool, s.level)) return s;
  }
  return null;
}
