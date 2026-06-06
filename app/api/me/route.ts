import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight auth-state probe for client components (keeps pages static). */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    authenticated: user.authenticated,
    isDemo: user.isDemo,
    email: user.email,
    hasFullBundle: user.hasFullBundle,
    practicePro: user.practicePro,
  });
}
