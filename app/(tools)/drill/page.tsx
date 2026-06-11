import type { Metadata } from "next";
import { getDrills } from "@/lib/data";
import { BUNDLE_PRICE } from "@/lib/catalog";
import type { Drill } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DrillCard } from "@/components/tools/DrillCard";
import { StreakWidget } from "@/components/tools/StreakWidget";
import { ServiceWorkerRegister } from "@/components/tools/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "The Daily Drill | ByteShards",
  description:
    "Five Data & AI Engineering interview questions a day. Build the streak, earn XP, and stay sharp across every tool.",
};

/** Day-of-year index, so the daily set rotates deterministically. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function dailySet(all: Drill[], n = 5): Drill[] {
  if (all.length <= n) return all;
  const offset = (dayOfYear(new Date()) * n) % all.length;
  const out: Drill[] = [];
  for (let i = 0; i < n; i++) {
    out.push(all[(offset + i) % all.length]);
  }
  return out;
}

export default function DrillPage() {
  const drills = dailySet(getDrills());

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <ServiceWorkerRegister />

      <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
        The Daily Drill
      </h1>
      <p className="mt-2 text-muted">
        5 questions a day across every tool. Build the streak.
      </p>

      <div className="mt-5">
        <StreakWidget />
      </div>

      <p className="mt-4 text-sm text-muted">
        Today&apos;s mix spans both the Data Engineering and AI Engineering
        tracks — Snowflake to RAG.
      </p>

      <div className="mt-6">
        <DrillCard drills={drills} />
      </div>

      <Card className="mt-8 bg-surface">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-fg">
              Going for a Snowflake interview?
            </p>
            <p className="text-sm text-muted">
              Unlock all cheat sheets — {BUNDLE_PRICE}
            </p>
          </div>
          <ButtonLink href="/pricing" variant="amber">
            Unlock the cheat sheet →
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
