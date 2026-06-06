"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  SHEET_PRICE,
  TOOL_PACK_PRICE,
  BUNDLE_PRICE,
  isValidTool,
  isValidLevel,
  sheetTitle,
  TOOLS,
} from "@/lib/catalog";
import type { Level } from "@/lib/types";

interface CheckoutResponse {
  url?: string;
  seed?: boolean;
  message?: string;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-sm text-muted">
      {items.map((it) => (
        <li key={it} className="flex items-start gap-2">
          <span className="mt-0.5 text-amber">✓</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function PaywallInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const toolParam = searchParams.get("tool") || undefined;
  const levelParam = searchParams.get("level") || undefined;

  const isToolPack = !!toolParam && levelParam === "all" && isValidTool(toolParam);
  const hasSpecificSheet =
    !!toolParam && !!levelParam && isValidTool(toolParam) && isValidLevel(levelParam);
  const hasSelection = isToolPack || hasSpecificSheet;
  const toolName = TOOLS.find((t) => t.slug === toolParam)?.name ?? toolParam ?? "";

  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function checkout(key: string, body: { tool?: string; level?: string; bundle?: boolean }) {
    setPending(key);
    setNote(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: CheckoutResponse = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.seed) {
        setNote("Stripe isn't configured in seed mode — sign in with the demo account for full access. Opening dashboard…");
        router.push("/dashboard");
        return;
      }
      setNote(data.message || "Could not start checkout. Please try again.");
      setPending(null);
    } catch {
      setNote("Could not start checkout. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="w-full max-w-3xl space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">Unlock your cheat sheets</h1>
        <p className="text-sm text-muted">One-time payment. No subscription. Lifetime access to what you buy.</p>
      </div>

      {note && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm text-fg">{note}</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* The chosen sheet — a single level, or a whole-tool pack (all levels) */}
        {hasSelection ? (
          <Card>
            <div className="flex h-full flex-col">
              <div>
                <Badge tone="amber">{isToolPack ? "Your tool pack" : "Your sheet"}</Badge>
                <h2 className="mt-2 text-lg font-bold text-fg">
                  {isToolPack ? `${toolName} — all levels` : sheetTitle(toolParam!, levelParam as Level)}
                </h2>
                <p className="text-sm text-muted">{isToolPack ? "one tool · all 3 levels" : "one tool · one level"}</p>
                <p className="mt-3 text-3xl font-bold text-fg">{isToolPack ? TOOL_PACK_PRICE : SHEET_PRICE}</p>
                <Bullets
                  items={
                    isToolPack
                      ? [
                          `Every ${toolName} question across Junior, Mid and Senior`,
                          "Full answers + the Interviewer's Lens",
                          "Lifetime access — yours to keep",
                        ]
                      : [
                          "Every question for this tool at this level",
                          "Full senior-level answers + Interviewer's Lens",
                          "Lifetime access — yours to keep",
                        ]
                  }
                />
              </div>
              <div className="mt-6">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={pending !== null}
                  onClick={() => checkout("sheet", { tool: toolParam, level: levelParam })}
                >
                  {pending === "sheet"
                    ? "Loading…"
                    : isToolPack
                      ? `Get all ${toolName} levels — ${TOOL_PACK_PRICE}`
                      : `Get this sheet — ${SHEET_PRICE}`}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex h-full flex-col">
              <div>
                <h3 className="text-lg font-bold text-fg">A single sheet</h3>
                <p className="text-sm text-muted">one tool · one level</p>
                <p className="mt-3 text-3xl font-bold text-fg">{SHEET_PRICE}</p>
                <Bullets
                  items={[
                    "Pick any one tool at one level",
                    "Full answers + the Interviewer's Lens",
                    "Lifetime access — yours to keep",
                  ]}
                />
              </div>
              <div className="mt-6">
                <Button variant="outline" className="w-full" disabled onClick={() => {}}>
                  Choose a skill on the pricing page
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Full access bundle */}
        <Card className="border-amber/40">
          <div className="flex h-full flex-col">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-fg">Full Access</h3>
                <Badge tone="amber">Best value</Badge>
              </div>
              <p className="text-sm text-muted">every tool · every level</p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-base font-medium text-muted line-through">$120</span>
                <span className="text-3xl font-bold text-fg">{BUNDLE_PRICE}</span>
              </div>
              <Bullets
                items={[
                  "All tools and all levels — every sheet unlocked",
                  "All future sheets included as we add them",
                  "Best value by far",
                  "Lifetime access — yours to keep",
                ]}
              />
            </div>
            <div className="mt-6">
              <Button
                variant="amber"
                className="w-full"
                disabled={pending !== null}
                onClick={() => checkout("bundle", { bundle: true })}
              >
                {pending === "bundle" ? "Loading…" : `Get Full Access — ${BUNDLE_PRICE}`}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <p className="text-center text-xs text-muted">
        Looking for interactive practice instead? <a href="/pricing" className="underline">See Practice plans →</a>
      </p>
    </div>
  );
}

export default function BuyPage() {
  return (
    <Suspense fallback={<Card className="w-full max-w-md"><p className="text-sm text-muted">Loading…</p></Card>}>
      <PaywallInner />
    </Suspense>
  );
}
