import { NextResponse } from "next/server";
import { getQuiz } from "@/lib/data";
import { isValidTool, isValidLevel } from "@/lib/catalog";

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tool = searchParams.get("tool") ?? "";
  const level = searchParams.get("level") ?? "";

  if (!isValidTool(tool) || !isValidLevel(level)) {
    return NextResponse.json(
      { error: "Invalid tool or level" },
      { status: 400 }
    );
  }

  return NextResponse.json(getQuiz(tool, level));
}
