// Adversarial entailment check — a SEPARATE model call (independent of the author).
// Mirrors .claude/agents/content/answer-verifier.md. Returns per-claim verdicts.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.VERIFY_MODEL || 'claude-opus-4-8';
const client = new Anthropic();

const SYSTEM = `You are an adversarial fact-checker. For each CLAIM, decide whether it is supported by the SOURCE TEXT.
Be strict: a claim is ENTAILED only if the source clearly states it. Otherwise NOT_ENTAILED; if the source says the opposite, CONTRADICTED.
Return STRICT JSON only: {"verdicts":[{"value","verdict":"ENTAILED|NOT_ENTAILED|CONTRADICTED"}]} in the same order as the claims given.`;

function parseJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

export async function verifyClaims(card, claims, sourceText) {
  if (!claims.length) return [];
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `SOURCE TEXT:\n"""\n${sourceText}\n"""\n\nCARD: ${card.q}\n\nCLAIMS:\n${claims
          .map((c, i) => `${i + 1}. [${c.type}] ${c.value}`)
          .join('\n')}`,
      },
    ],
  });
  const text = msg.content?.map((b) => (b.type === 'text' ? b.text : '')).join('') ?? '';
  return parseJSON(text)?.verdicts ?? [];
}
