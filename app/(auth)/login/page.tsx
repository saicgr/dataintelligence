"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { getBrowserSupabase } from "@/lib/supabase";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const demoHref = `/api/demo?action=login&next=${encodeURIComponent(next)}`;
  const dest = next.startsWith("/") ? next : "/dashboard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const sb = getBrowserSupabase();

    // Magic-link path: only when Supabase is configured AND no password was typed.
    if (sb && !password) {
      setLoading(true);
      try {
        const { error: otpError } = await sb.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}${dest}` },
        });
        if (otpError) setError(otpError.message);
        else setSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Email + password (test/demo account) — works with or without Supabase.
    setLoading(true);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = dest;
        return;
      }
      setError(data.error || "Wrong email or password.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="w-full max-w-md">
        <div className="space-y-3 text-center">
          <h1 className="text-xl font-bold text-fg">Check your email</h1>
          <p className="text-sm text-muted">
            Check your email for the magic link. It was sent to{" "}
            <span className="font-medium text-fg">{email}</span>.
          </p>
          <button
            type="button"
            className="text-sm text-muted underline hover:text-fg"
            onClick={() => {
              setSent(false);
            }}
          >
            Use a different email
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-fg">Sign in to FieldNotes</h1>
          <p className="text-sm text-muted">
            Enter your email and password.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-fg">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-fg">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <ButtonLink href={demoHref} variant="outline" className="w-full">
          Continue as demo user →
        </ButtonLink>
        <p className="text-center text-xs text-muted">
          Just exploring? The demo unlocks every cheat sheet and all of Practice.
        </p>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full max-w-md">
          <p className="text-sm text-muted">Loading…</p>
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
