import { NextResponse } from "next/server";
import { DEMO_COOKIE, DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

function safeNext(next: string | null): string {
  // Only allow same-site relative paths.
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

/** GET /api/demo?action=login|logout&next=/path — sets or clears the demo session cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const logout = action === "logout";
  const dest = logout ? "/" : safeNext(url.searchParams.get("next"));

  const res = NextResponse.redirect(new URL(dest, url.origin));
  if (logout) {
    res.cookies.set(DEMO_COOKIE, "", { path: "/", maxAge: 0 });
  } else {
    res.cookies.set(DEMO_COOKIE, "1", COOKIE_OPTS);
  }
  return res;
}

/** POST { email, password } — validates the test credentials, then starts the demo session. */
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (email !== DEMO_EMAIL.toLowerCase() || password !== DEMO_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Wrong email or password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_COOKIE, "1", COOKIE_OPTS);
  return res;
}
