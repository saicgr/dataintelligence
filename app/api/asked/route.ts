import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

interface Body {
  questionId?: number;
}

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* ignore */
  }

  const { questionId } = body;

  const sb = await getServerSupabase();
  if (sb && typeof questionId === "number") {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user) {
      const { error } = await sb
        .from("interview_asks")
        .insert({ user_id: user.id, question_id: questionId });
      // only bump the global count for a genuinely new ask (ignore conflicts)
      if (!error) {
        await sb.rpc("bump_asked_count", { qid: questionId });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
