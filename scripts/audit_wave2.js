export const meta = {
  name: 'content-audit-wave2',
  description: 'Adversarial factual audit of remaining core/role content tracks',
  phases: [{ title: 'Audit', detail: 'one skeptical interviewer per track file' }],
}

const TRACKS = ["aep", "agentic-ai", "agents", "agile-pm", "ai-product-mgmt", "airflow", "apis", "architecture", "aws", "azure", "behavioral", "bi", "bizops", "business-analysis", "cicd", "coding-cpp", "coding-go", "coding-java", "coding-nodejs", "coding-pyspark", "coding-rust", "coding-scala", "coding-typescript", "consulting-frameworks", "cost-engineer", "cpp", "customer-success", "data-governance", "data-integration", "data-reliability", "databases", "databricks", "dbt-metricflow", "dbt-semantic-layer", "dbt", "deep-learning", "docker", "evals", "finance-fundamentals", "finops", "flutter", "gcp", "git", "go", "hex", "java", "kafka", "kubernetes", "leadership", "llms", "looker", "markdown", "mlsys", "modeling", "nodejs", "observability", "pre-sales", "product-management", "program-management", "prompt", "pyspark", "python", "rag", "risk-compliance", "rust", "scala", "security", "snowflake", "spark", "sql", "stakeholder-mgmt", "statistics", "supply-chain", "sysd", "tableau", "trading", "typescript", "vectordb", "voice-ai"]

const ISSUE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['track','cardsAudited','issues','note'],
  properties: {
    track: { type: 'string' },
    cardsAudited: { type: 'integer' },
    note: { type: 'string' },
    issues: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['cardIndex','field','severity','claim','problem','fix','confidence'],
      properties: {
        cardIndex: { type: 'integer' },
        field: { type: 'string' },
        severity: { type: 'string', enum: ['wrong','misleading','outdated','polarity','weak'] },
        claim: { type: 'string' },
        problem: { type: 'string' },
        fix: { type: ['string','null'] },
        confidence: { type: 'string', enum: ['high','medium','low'] },
      } } },
  },
}

const PROMPT = (track) => `You are a SKEPTICAL senior interviewer auditing ONE interview-prep content file for FACTUAL errors. Find wrong, misleading, or outdated answers — do NOT praise, reword, or pad. Assume the content was AI-generated and may contain confident-but-wrong claims. Default to suspicion.

Read the file: src/lib/generated/${track}.json
Cards are an array (index = position). Each card has: q, a (model answer), fs (the STRONG answer to give), fj (the WEAK/junky answer to AVOID), level, followups[] (q/a). Coding cards instead have: lines (code), opts[] ({t, ok, why}), why.

For EVERY card and EVERY followup, check:
1. FACTUAL CORRECTNESS — true as of 2026? Verify version-specific claims (API names, defaults, limits, flags, behavior).
2. OUTDATED — deprecated/renamed services, changed defaults, EOL'd features.
3. FJ/FS POLARITY — fj must be the WRONG/weak take and fs the strong one. Swapped or non-wrong fj = severity "polarity".
4. SCENARIO INTEGRITY — for "what's happening / debug this" cards, does the answer actually solve the stated scenario?
5. CODING CARDS — mentally execute the code; confirm exactly one opt has ok:true and each wrong opt's "why" is correct.

HARD RULES:
- Do NOT flag style. Only substantive errors. severity "weak" only for a genuinely thin/non-answer, used sparingly.
- If not confident a claim is wrong, set confidence:"low" and fix:null — flag for human review, never guess a fix you can't defend.
- When you DO provide a fix, it MUST be drop-in REPLACEMENT TEXT for the quoted claim (not an instruction like "remove X"). If you can only describe the fix, set fix:null.
- Quote the offending text verbatim in "claim". A clean file returning issues:[] is the expected GOOD result; do NOT manufacture issues.

Set cardsAudited to the total number of cards reviewed. Return track="${track}".`

phase('Audit')
const results = await parallel(TRACKS.map((t) => () =>
  agent(PROMPT(t), { label: `audit:${t}`, phase: 'Audit', schema: ISSUE_SCHEMA, model: 'sonnet' })
))
const ok = results.filter(Boolean)
const totalCards = ok.reduce((s, r) => s + (r.cardsAudited || 0), 0)
const hard = ok.flatMap((r)=>r.issues||[]).filter((i)=>i.severity==='wrong'||i.severity==='polarity').length
log(`Audited ${ok.length}/${TRACKS.length} tracks, ${totalCards} cards, ${hard} hard errors`)
return { audited: ok.length, requested: TRACKS.length, totalCards, hard, results: ok }
