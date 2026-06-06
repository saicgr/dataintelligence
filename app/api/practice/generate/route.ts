import { NextResponse } from "next/server";
import { geminiGenerate } from "@/lib/gemini";
import { hasGemini } from "@/lib/env";
import { getCurrentUser, ownsSheet } from "@/lib/entitlements";
import { retrieve, parseSkills, conciseAnswer } from "@/lib/generator/retrieve";
import { TOOL_BY_SLUG, SHEET_PRICE, TOOL_PACK_PRICE } from "@/lib/catalog";
import type { Level } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  jd?: string;
  company?: string;
  role?: string;
  level?: Level;
  resume?: string;
}

interface OutQuestion {
  id: number;
  question: string;
  risk: string;
  answer: string | null; // concise grounded answer when unlocked/owned
  owned: boolean;
  href: string; // dashboard (owned) or buy link
}
interface OutSection {
  tool: string;
  toolName: string;
  questions: OutQuestion[];
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const level: Level = body.level ?? "mid";
  const text = (body.jd || `${body.role || ""} ${body.company || ""}`).trim();
  if (!text) {
    return NextResponse.json({ error: "Paste a job description (or a role) to generate." }, { status: 400 });
  }

  const user = await getCurrentUser();
  const unlocked = user.practicePro; // generator is a Pro tool
  const locked = !unlocked;

  // 1) Grounded retrieval over the real bank.
  const { matchedTools, sections: raw } = retrieve({ text, level });

  // 2) Decorate with entitlements + concise grounded answers.
  const sections: OutSection[] = raw.map((s) => ({
    tool: s.tool,
    toolName: s.toolName,
    questions: s.questions.map((q): OutQuestion => {
      const owned = ownsSheet(user, q.toolSlug, q.level);
      const show = unlocked || owned;
      return {
        id: q.id,
        question: q.questionText,
        risk: q.riskLevel,
        answer: show ? conciseAnswer(q.answerStructured) : null,
        owned,
        href: owned ? `/dashboard/${q.toolSlug}/${q.level}/${q.id}` : `/buy?tool=${q.toolSlug}&level=all`,
      };
    }),
  }));

  // 3) Résumé gap analysis + readiness (deterministic).
  const matchedSlugs = matchedTools.map((m) => m.slug);
  const resumeSlugs = body.resume ? new Set(parseSkills(body.resume).map((m) => m.slug)) : null;
  let covered: string[];
  if (resumeSlugs) {
    covered = matchedSlugs.filter((s) => resumeSlugs.has(s));
  } else {
    covered = matchedSlugs.filter((s) => ownsSheet(user, s, level));
  }
  const missing = matchedSlugs.filter((s) => !covered.includes(s));
  const readiness = matchedSlugs.length ? Math.round((covered.length / matchedSlugs.length) * 100) : 0;
  const gaps = missing.map((s) => {
    const name = TOOL_BY_SLUG[s]?.name ?? s;
    return resumeSlugs
      ? `${name}: in the JD but not on your résumé — drill it.`
      : `${name}: a focus area for this role.`;
  });

  // 4) Cross-sell: which sheets cover the matched skills.
  const crossSell = matchedTools.slice(0, 6).map((m) => {
    const owned = ownsSheet(user, m.slug, level);
    return {
      tool: m.slug,
      toolName: m.name,
      owned,
      href: `/buy?tool=${m.slug}&level=all`,
      price: TOOL_PACK_PRICE,
    };
  });

  // 5) Narrative wrapper (LLM optional; never invents questions — only frames them).
  let summary = "";
  let companyAngle: string | null = null;
  let source: "ai" | "rule" = "rule";

  if (hasGemini) {
    const sys = `You are a senior interview coach. You are given a target role and the candidate's matched/missing skill areas. Write a tight, motivating focus note. DO NOT invent interview questions or claim a company asks specific questions — speak in patterns only. Respond with ONLY minified JSON: {"summary":"2-3 sentences on what to prioritize","companyAngle":"1-2 sentences on this company's typical loop patterns, or empty string"}`;
    const ctx = `Target: ${body.role || "Data/AI Engineer"}${body.company ? ` at ${body.company}` : ""} (${level}).
Strong/known areas: ${covered.map((s) => TOOL_BY_SLUG[s]?.name ?? s).join(", ") || "none yet"}.
Focus/gap areas: ${missing.map((s) => TOOL_BY_SLUG[s]?.name ?? s).join(", ") || "none"}.`;
    try {
      const out = await geminiGenerate({ system: sys, messages: [{ role: "user", content: ctx }], json: true, maxTokens: 400 });
      if (out) {
        const p = JSON.parse(out.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
        summary = String(p.summary || "");
        companyAngle = p.companyAngle ? String(p.companyAngle) : null;
        source = "ai";
      }
    } catch {
      /* fall through to rule-based */
    }
  }

  if (!summary) {
    const focus = missing.map((s) => TOOL_BY_SLUG[s]?.name ?? s).slice(0, 3).join(", ");
    summary = `A ${level}-level ${body.role || "data/AI engineering"} loop${body.company ? ` at ${body.company}` : ""}. ${
      focus ? `Prioritize ${focus} — that's where the gap is.` : "You cover the core skills; sharpen depth and trade-offs."
    } Below are the real questions from the bank that map to this role.`;
  }

  return NextResponse.json({
    locked,
    source,
    readiness,
    summary,
    companyAngle,
    matchedTools: matchedTools.slice(0, 8).map((m) => ({ slug: m.slug, name: m.name })),
    sections,
    gaps,
    crossSell,
    sheetPrice: SHEET_PRICE,
  });
}
