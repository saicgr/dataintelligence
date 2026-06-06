import { hasGemini } from "./env";

/**
 * Minimal Gemini client over the REST API (no SDK dependency).
 * Powers the AI interviewer (Dawn) and answer grading. Returns null when
 * GEMINI_API_KEY is absent so callers fall back to a scripted experience.
 */
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export interface GenMsg {
  role: "user" | "assistant";
  content: string;
}

export async function geminiGenerate(opts: {
  system?: string;
  messages: GenMsg[];
  json?: boolean;
  maxTokens?: number;
}): Promise<string | null> {
  if (!hasGemini) return null;
  const key = process.env.GEMINI_API_KEY!;

  // Gemini requires the first content to be role "user".
  const msgs = opts.messages.length
    ? opts.messages
    : [{ role: "user" as const, content: "Let's begin." }];

  const body = {
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    contents: msgs.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 600,
      temperature: 0.5,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text ?? "")
      .join("")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}
