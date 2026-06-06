import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { hasSupabase, hasSupabaseAdmin } from "./env";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** Browser client — null in seed mode. Safe to import from client components. */
export function getBrowserSupabase() {
  if (!hasSupabase) return null;
  return createBrowserClient(url, anonKey);
}

/** Service-role client for webhooks / privileged writes. Server-only; null if not configured. */
export function getAdminSupabase() {
  if (!hasSupabaseAdmin) return null;
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// NOTE: the cookie-aware server client lives in ./supabase-server (it imports
// next/headers, which must never enter a client bundle).
