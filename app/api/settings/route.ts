import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

interface Body {
  interviewDate?: string | null;
}

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* ignore */
  }

  const sb = await getServerSupabase();
  if (sb) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user) {
      await sb
        .from("users")
        .update({ interview_date: body.interviewDate ?? null })
        .eq("id", user.id);
    }
  }

  return NextResponse.json({ ok: true });
}
