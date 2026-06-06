import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED = ["/dashboard"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Demo session unlocks everything (works with or without Supabase).
  if (req.cookies.get("fn_demo")?.value === "1") return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Seed mode: no Supabase configured → mock user owns everything, allow through.
  if (!url || !anon) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          req.cookies.set(name, value)
        );
        res = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirect = req.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  // Has session — check at least one entitlement (zero → /buy).
  const { count } = await supabase
    .from("entitlements")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { data: profile } = await supabase
    .from("users")
    .select("has_full_bundle")
    .eq("id", user.id)
    .maybeSingle();

  const owns = (count ?? 0) > 0 || Boolean(profile?.has_full_bundle);
  if (!owns && pathname !== "/buy") {
    const redirect = req.nextUrl.clone();
    redirect.pathname = "/buy";
    return NextResponse.redirect(redirect);
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
