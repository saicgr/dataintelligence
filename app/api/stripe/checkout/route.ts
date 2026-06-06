import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { SITE_URL } from "@/lib/env";
import {
  BUNDLE_PRICE_CENTS,
  SHEET_PRICE_CENTS,
  TOOL_PACK_PRICE_CENTS,
  PRACTICE_PRO_PRICE_CENTS,
  PRACTICE_PRO_ANNUAL_CENTS,
  isValidLevel,
  isValidTool,
  sheetTitle,
  TOOLS,
} from "@/lib/catalog";
import type { Level } from "@/lib/types";

interface CheckoutBody {
  tool?: string;
  level?: string;
  bundle?: boolean;
  practicePro?: boolean;
  plan?: "monthly" | "annual";
}

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ seed: true, message: "Stripe not configured" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as CheckoutBody;
    const { tool, level, bundle, practicePro, plan } = body;

    // Practice Pro — a subscription (monthly or annual). Cheat sheets stay one-time.
    if (practicePro) {
      const annual = plan === "annual";
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `FieldNotes — Practice Pro (${annual ? "annual" : "monthly"})` },
              unit_amount: annual ? PRACTICE_PRO_ANNUAL_CENTS : PRACTICE_PRO_PRICE_CENTS,
              recurring: { interval: annual ? "year" : "month" },
            },
            quantity: 1,
          },
        ],
        metadata: { practice_pro: "1", plan: annual ? "annual" : "monthly" },
        success_url: `${SITE_URL}/practice`,
        cancel_url: `${SITE_URL}/practice`,
      });
      return NextResponse.json({ url: session.url });
    }

    // One tool, all levels — a "tool pack" ($29).
    const isToolPack =
      bundle !== true && !!tool && level === "all" && isValidTool(tool);

    const isBundle =
      bundle === true ||
      (!isToolPack && !(tool && level && isValidTool(tool) && isValidLevel(level)));

    let productName: string;
    let unitAmount: number;
    let metadata: Record<string, string>;

    if (isToolPack) {
      const name = TOOLS.find((t) => t.slug === tool)?.name ?? tool!;
      productName = `FieldNotes — ${name} (all levels)`;
      unitAmount = TOOL_PACK_PRICE_CENTS;
      metadata = { tool: tool!, all_levels: "1" };
    } else if (isBundle) {
      productName = "FieldNotes — Full Access";
      unitAmount = BUNDLE_PRICE_CENTS;
      metadata = { bundle: "1" };
    } else {
      productName = `FieldNotes — ${sheetTitle(tool!, level as Level)}`;
      unitAmount = SHEET_PRICE_CENTS;
      metadata = { tool: tool!, level: level! };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: productName },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${SITE_URL}/dashboard`,
      cancel_url: `${SITE_URL}/buy`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
