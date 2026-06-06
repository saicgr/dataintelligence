import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import type { Confidence } from "@/lib/types";

interface Body {
  questionId?: number;
  practiced?: boolean;
  confidence?: Confidence;
}

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* ignore */
  }

  const { questionId, practiced, confidence } = body;

  const sb = await getServerSupabase();
  if (sb && typeof questionId === "number") {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user) {
      const now = new Date().toISOString();
      const row: Record<string, unknown> = {
        user_id: user.id,
        question_id: questionId,
        last_studied_at: now,
      };
      if (practiced) row.practiced_at = now;
      if (confidence) row.confidence = confidence;
      await sb
        .from("user_progress")
        .upsert(row, { onConflict: "user_id,question_id" });
    }
  }

  return NextResponse.json({ ok: true });
}
