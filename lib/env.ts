/**
 * Central feature-detection for optional services.
 * The app is designed to build and run with ZERO keys (seed mode).
 * Adding the matching env vars flips each subsystem to live with no code change.
 */
export const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const hasSupabaseAdmin = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const hasStripe = Boolean(
  process.env.STRIPE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

export const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

/** Gemini powers the AI interviewer + answer grading. */
export const hasGemini = Boolean(process.env.GEMINI_API_KEY);

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
