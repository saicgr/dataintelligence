export const meta = {
  name: 'content-rewrite-recovery',
  description: 'Turn recoverable audit flags into verbatim drop-in find/replace fixes',
  phases: [{ title: 'Rewrite', detail: 'one agent per track re-reads cards, emits find/replace' }],
}

const TRACKS = ["aem", "aep", "agile-pm", "azure-ai", "bedrock", "business-analysis", "cert-aws-ai-practitioner", "cert-aws-data-engineer-associate", "cert-aws-generative-ai-developer-professional", "cert-aws-machine-learning-engineer-associate", "cert-azure-ai-103", "cert-azure-ai-200", "cert-azure-ai-300", "cert-azure-ai-900", "cert-azure-dp-300", "cert-azure-dp-420", "cert-azure-dp-600", "cert-azure-dp-700", "cert-azure-dp-800", "cert-azure-dp-900", "cert-databricks-context-engineer", "cert-databricks-de-associate", "cert-databricks-de-professional", "cert-databricks-genai-associate", "cert-databricks-ml-professional", "cert-databricks-spark-developer", "cert-gcp-associate-data-practitioner", "cert-gcp-generative-ai-leader", "cert-gcp-professional-cloud-database-engineer", "cert-gcp-professional-data-engineer", "cert-gcp-professional-ml-engineer", "cert-snowflake-advanced-architect", "cert-snowflake-advanced-data-analyst", "cert-snowflake-advanced-data-engineer", "cert-snowflake-advanced-data-scientist", "cert-snowflake-advanced-mlops-engineer", "cert-snowflake-specialty-gen-ai", "cert-snowflake-specialty-snowpark", "cicd", "coding-cpp", "coding-nodejs", "coding-pyspark", "coding-typescript", "consulting-frameworks", "cortex", "cost-engineer", "cpp", "data-governance", "databases", "dbt", "dbt-metricflow", "dbt-semantic-layer", "flutter", "java", "looker", "modeling", "mosaic", "observability", "pre-sales", "risk-compliance", "rust", "security", "snaplogic", "sql", "terraform", "workfront"]

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['track','fixes'],
  properties: {
    track: { type: 'string' },
    fixes: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['issueRef','cardIndex','field','find','replace','confidence','note'],
      properties: {
        issueRef: { type: 'integer', description: 'the issueRef from the flag list' },
        cardIndex: { type: 'integer' },
        field: { type: 'string' },
        find: { type: ['string','null'], description: 'EXACT verbatim substring currently in that field to replace, or null if not safely fixable' },
        replace: { type: ['string','null'], description: 'corrected drop-in text to substitute for find' },
        confidence: { type: 'string', enum: ['high','medium','low'] },
        note: { type: 'string' },
      } } },
  },
}

const PROMPT = (track) => `You are correcting confirmed factual errors in ONE interview-prep content file, producing SAFE drop-in edits.

1. Read the flag list: scripts/recover_flags.json — use ONLY the entries whose key is "${track}". Each flag has: issueRef, cardIndex, field, severity, claim (the wrong text the original auditor saw), problem (why it is wrong), badFix (a prior fix attempt that was NOT directly appliable).
2. Read the content file: src/lib/generated/${track}.json (cards are an array; index = position).

For EACH flag, open the exact card[cardIndex] and the named field (a | fs | fj | why | followups[i].a). Then:
- Find the CURRENT erroneous text in that field. Copy it VERBATIM (exact characters, including punctuation) into "find". It MUST be an exact substring of the current field value — if you are unsure it is verbatim, set find=null.
- Write "replace": the corrected text. CRITICAL: change ONLY the wrong span. Keep it as SHORT as possible and DO NOT restate words that appear immediately before/after your find span, or you will create duplication. replace should slot in where find was and read grammatically.
- Verify the correction is actually true as of 2026 (the problem field tells you what is wrong). If you cannot produce a confident correct fix, set find=null, replace=null, confidence="low" and explain in note.
- For polarity flags (fj should be the WRONG answer): fix by making fj genuinely wrong/weak again, or moving the correct claim out of fj — whatever the card needs.

Return track="${track}" and one fixes[] entry per flag (same issueRef). Prefer a real fix; use null only when you genuinely cannot.`

phase('Rewrite')
const results = await parallel(TRACKS.map((t) => () =>
  agent(PROMPT(t), { label: `rewrite:${t}`, phase: 'Rewrite', schema: SCHEMA, model: 'sonnet' })
))
const ok = results.filter(Boolean)
const fixes = ok.reduce((s,r)=>s+(r.fixes||[]).filter((f)=>f.find&&f.replace).length,0)
log(`Rewrote ${ok.length}/${TRACKS.length} tracks, ${fixes} drop-in fixes produced`)
return { tracks: ok.length, fixes, results: ok }
