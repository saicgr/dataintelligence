import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase";
import { allSheets, isValidLevel, LEVELS } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    // Seed mode — nothing to verify or persist.
    return NextResponse.json({ received: true });
  }

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json(
      { error: "Missing signature or secret" },
      { status: 400 }
    );
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await fulfill(session);
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }
  } catch {
    // Never throw uncaught — acknowledge so Stripe doesn't hammer us,
    // but signal an internal issue.
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}

/** Keep users.practice_pro in sync with the subscription status. */
async function syncSubscription(sub: Stripe.Subscription) {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return;
  const active = sub.status === "active" || sub.status === "trialing";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEnd = (sub as any).current_period_end as number | undefined;
  await supabase
    .from("users")
    .update({
      practice_pro: active,
      practice_status: sub.status,
      practice_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    })
    .eq("stripe_customer_id", customerId);
}

async function fulfill(session: Stripe.Checkout.Session) {
  const supabase = getAdminSupabase();
  if (!supabase) return; // nothing to persist

  const email =
    session.customer_email ||
    session.customer_details?.email ||
    null;
  if (!email) return;

  const metadata = session.metadata || {};
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : null;

  // Find the user row by email.
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!user) return;
  const userId = user.id as string;

  // Practice Pro subscription — grant access (cheat sheets are separate, one-time).
  if (metadata.practice_pro === "1") {
    await supabase
      .from("users")
      .update({
        practice_pro: true,
        practice_status: "active",
        stripe_customer_id: stripeCustomerId,
      })
      .eq("id", userId);
    return;
  }

  if (metadata.bundle === "1") {
    // Grant full bundle.
    await supabase
      .from("users")
      .update({
        has_full_bundle: true,
        stripe_customer_id: stripeCustomerId,
      })
      .eq("id", userId);

    // Build slug -> tool id map.
    const { data: tools } = await supabase
      .from("tools")
      .select("id,slug");

    const slugToId = new Map<string, string | number>();
    for (const t of tools || []) {
      slugToId.set(t.slug as string, t.id as string | number);
    }

    const rows = allSheets()
      .map((s) => {
        const toolId = slugToId.get(s.tool);
        if (toolId === undefined) return null;
        return {
          user_id: userId,
          tool_id: toolId,
          level: s.level,
          source: "bundle",
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      await supabase
        .from("entitlements")
        .upsert(rows, {
          onConflict: "user_id,tool_id,level",
          ignoreDuplicates: true,
        });
    }
    return;
  }

  // One tool, all levels — a tool pack.
  if (metadata.all_levels === "1" && metadata.tool) {
    const { data: toolRow } = await supabase
      .from("tools")
      .select("id")
      .eq("slug", metadata.tool)
      .maybeSingle();
    if (!toolRow) return;
    if (stripeCustomerId) {
      await supabase
        .from("users")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", userId);
    }
    const rows = LEVELS.map((l) => ({
      user_id: userId,
      tool_id: toolRow.id,
      level: l.slug,
      source: "tool_pack",
    }));
    await supabase
      .from("entitlements")
      .upsert(rows, { onConflict: "user_id,tool_id,level", ignoreDuplicates: true });
    return;
  }

  // Single sheet.
  const tool = metadata.tool;
  const level = metadata.level;
  if (!tool || !level || !isValidLevel(level)) return;

  const { data: toolRow } = await supabase
    .from("tools")
    .select("id")
    .eq("slug", tool)
    .maybeSingle();

  if (!toolRow) return;

  if (stripeCustomerId) {
    await supabase
      .from("users")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", userId);
  }

  await supabase.from("entitlements").upsert(
    {
      user_id: userId,
      tool_id: toolRow.id,
      level,
      source: "sheet",
    },
    { onConflict: "user_id,tool_id,level", ignoreDuplicates: true }
  );
}
