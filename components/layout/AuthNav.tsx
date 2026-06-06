"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { getBrowserSupabase } from "@/lib/supabase";

interface Me {
  authenticated: boolean;
  isDemo: boolean;
  email: string | null;
}

export function AuthNav() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => { if (live) setMe(d); })
      .catch(() => { if (live) setMe({ authenticated: false, isDemo: false, email: null }); });
    return () => { live = false; };
  }, []);

  async function signOut() {
    try { await getBrowserSupabase()?.auth.signOut(); } catch { /* ignore */ }
    window.location.href = "/api/demo?action=logout";
  }

  // Pre-hydration / loading: render the signed-out layout so there's no flicker of wrong state.
  if (!me || !me.authenticated) {
    return (
      <>
        <Link href="/login" className="hidden text-sm font-medium text-muted hover:text-fg sm:block">
          Sign in
        </Link>
        <ButtonLink href="/login" size="sm">
          Sign in
        </ButtonLink>
      </>
    );
  }

  return (
    <>
      <span className="hidden text-sm font-medium text-muted sm:flex sm:items-center sm:gap-1.5">
        {me.isDemo && <span className="rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber">Demo</span>}
        <span className="max-w-[140px] truncate">{me.email}</span>
      </span>
      <button onClick={signOut} className="hidden text-sm font-medium text-muted hover:text-fg sm:block">
        Sign out
      </button>
      <ButtonLink href="/dashboard" size="sm">
        Open Cheat Sheet
      </ButtonLink>
    </>
  );
}
