import { NextResponse } from "next/server";
import { getPracticeItem } from "@/lib/data/practice";
import { getIncidentScenario } from "@/lib/data/practice/incidents.server";
import { getCurrentUser } from "@/lib/entitlements";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the reference solution SQL — but ONLY to entitled users. This is the
 * gate that the old client-side "Reveal solution" lacked: the answer key now
 * lives server-side and is released only after the Pro check, so it can't be
 * read from the page bundle.
 */
export async function POST(req: Request) {
  let body: { problemId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const item = body?.problemId ? getPracticeItem(body.problemId) : null;
  if (!item) return NextResponse.json({ error: "unknown problem" }, { status: 404 });

  const user = await getCurrentUser();
  const rl = rateLimit(clientKey(user.id, req), 60, 60_000, Date.now());
  if (!rl.ok) return NextResponse.json({ error: "rate limited" }, { status: 429, headers: { "retry-after": String(rl.retryAfter) } });

  const entitled = user.practicePro || user.hasFullBundle || user.isDemo;
  if (!entitled) return NextResponse.json({ error: "Practice Pro required" }, { status: 403 });

  // Incident → assemble the model post-mortem from the server-only scenario.
  if (item.category === "incident") {
    const sc = getIncidentScenario(body.problemId!);
    if (sc) {
      const answer = [
        `## Root cause\n${sc.actualRootCause}`,
        `\n## Fix\n${sc.actualFix}`,
        sc.contributingFactors?.length ? `\n## Contributing factors\n${sc.contributingFactors.map((f) => `- ${f}`).join("\n")}` : "",
        sc.triageOrder?.length ? `\n## Triage order\n${sc.triageOrder.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "",
        sc.redHerrings?.length ? `\n## Red herrings (don't get fooled)\n${sc.redHerrings.map((r) => `- ${r}`).join("\n")}` : "",
      ].filter(Boolean).join("\n");
      return NextResponse.json({ answer, referenceSolution: answer });
    }
  }

  // SQL → referenceSolution; everything else → idealAnswer (the model answer).
  const answer = item.category === "sql" ? item.referenceSolution : item.idealAnswer;
  return NextResponse.json({ answer, referenceSolution: answer });
}
