// Author one fresh card EXTRACTIVELY from a fetched source (no outside knowledge).
// Returns { card, claims } or null. Mirrors .claude/agents/content/question-author.md voice.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.CONTENT_MODEL || 'claude-sonnet-4-6';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const SYSTEM = `You author ONE interview "stay current" flashcard from a single source, for senior AI/Data engineers.
RULES:
- Use ONLY facts literally present in the provided SOURCE TEXT. Invent nothing.
- Do NOT include any model name, GA-vs-preview status, number, limit, or price that is not verbatim in the source.
- The card teaches the SENIOR takeaway (when would a senior reach for this, what it replaces, the trade-off), not a headline.
- Also return a claims[] array: every model name / GA-or-preview status / number / price you used, each with the exact verbatim substring from the source that supports it.
Return STRICT JSON only: {"card":{"q","a","fj","fs"},"claims":[{"type","value","quote"}]} or {"card":null} if nothing card-worthy.`;

function parseJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

export async function authorCard(entry) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `TOOL: ${entry.tool}\nSOURCE URL: ${entry.url}\n\nSOURCE TEXT:\n"""\n${entry.text}\n"""\n\nAuthor at most one card.`,
      },
    ],
  });
  const text = msg.content?.map((b) => (b.type === 'text' ? b.text : '')).join('') ?? '';
  const out = parseJSON(text);
  if (!out?.card) return null;
  return {
    card: {
      tool: entry.tool,
      domain: entry.domain,
      tk: entry.tk,
      sourceUrl: entry.url,
      sourceLabel: entry.tool,
      ...out.card,
    },
    claims: Array.isArray(out.claims) ? out.claims : [],
  };
}
