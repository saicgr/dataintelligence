export const meta = {
  name: 'content-triage',
  description: 'Deep triage of remaining hard-error flags: fix, mark manual, or dismiss',
  phases: [{ title: 'Triage', detail: 'one agent per track resolves remaining hard flags' }],
}

const TRACKS = ["aem", "aep", "agentic-ai", "agents", "ai-product-mgmt", "airflow", "architecture", "azure", "azure-ai", "bedrock", "behavioral", "bi", "bizops", "cert-aws-generative-ai-developer-professional", "cert-aws-machine-learning-engineer-associate", "cert-azure-ai-103", "cert-azure-ai-900", "cert-azure-dp-300", "cert-azure-dp-420", "cert-azure-dp-600", "cert-azure-dp-700", "cert-azure-dp-750", "cert-azure-dp-900", "cert-databricks-context-engineer", "cert-databricks-data-analyst", "cert-databricks-de-associate", "cert-databricks-de-professional", "cert-databricks-genai-associate", "cert-databricks-ml-associate", "cert-databricks-ml-professional", "cert-databricks-spark-developer", "cert-gcp-professional-cloud-database-engineer", "cert-gcp-professional-ml-engineer", "cert-snowflake-advanced-architect", "cert-snowflake-advanced-data-analyst", "cert-snowflake-advanced-data-engineer", "cert-snowflake-advanced-data-scientist", "cert-snowflake-advanced-mlops-engineer", "cert-snowflake-specialty-gen-ai", "cicd", "coding-java", "coding-nodejs", "cortex", "cost-engineer", "cpp", "customer-success", "data-governance", "databricks", "dbt-metricflow", "dbt-semantic-layer", "deep-learning", "docker", "evals", "finops", "gcp", "git", "go", "kafka", "kubernetes", "llms", "looker", "modeling", "mosaic", "nodejs", "observability", "palantir", "pre-sales", "product-management", "python", "rag", "rust", "scala", "snowflake", "spark", "supply-chain", "tableau", "terraform", "typescript", "vectordb", "voice-ai"]

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['track','items'],
  properties: {
    track: { type: 'string' },
    items: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['issueRef','cardIndex','disposition','edits','setOkIndex','recommendation','confidence','note'],
      properties: {
        issueRef: { type: 'integer' },
        cardIndex: { type: 'integer' },
        disposition: { type: 'string', enum: ['fix','manual','dismiss'] },
        edits: { type: 'array', description: 'verbatim card-scoped find/replace (only when disposition=fix)',
          items: { type: 'object', additionalProperties: false, required: ['find','replace'],
            properties: { find: { type: 'string' }, replace: { type: 'string' } } } },
        setOkIndex: { type: ['integer','null'] },
        recommendation: { type: 'string', description: 'when disposition=manual: the concrete correct answer a human should write' },
        confidence: { type: 'string', enum: ['high','medium','low'] },
        note: { type: 'string' },
      } } },
  },
}

const PROMPT = (track) => `You are doing FINAL triage on the hard-error flags an earlier audit could not auto-fix in ONE content file. Resolve each flag decisively.

1. Read scripts/remaining_hard.json — use ONLY entries keyed "${track}". Each: issueRef, cardIndex, field, severity, claim (wrong text), problem (why), badFix, applyNote (why it was not auto-fixed).
2. Read src/lib/generated/${track}.json. Cards are an array. Coding cards: { lines OR code:[{lang,lines}], opts:[{t,ok,why}], why }. Prose cards: { q, a, fs, fj, followups:[{q,a}] }.

For EACH flag, VERIFY the claim against your own knowledge as of 2026 (think hard about version-specific facts), then choose ONE disposition:
- "fix": you are confident of the correction AND can express it as verbatim card-scoped edits. Provide edits:[{find,replace}] where find is an EXACT current substring occurring exactly ONCE in that card; keep replace minimal so it slots in without duplicating nearby words. If the wrong OPTION is marked correct, set setOkIndex to the index that should be ok:true. Prefer this whenever you can.
- "manual": the fix needs human judgment or a structural rewrite you cannot express as a clean splice. Put the CONCRETE correct answer in "recommendation" (what the human should write), so triage is one copy-paste away. edits:[], setOkIndex:null.
- "dismiss": the flag is a FALSE POSITIVE — the original content is actually correct as of 2026. Explain why in note. edits:[], setOkIndex:null. Be willing to dismiss; earlier auditors sometimes hallucinated bugs.

Return track="${track}", one items[] entry per flag (same issueRef). Accuracy over throughput.`

phase('Triage')
const results = await parallel(TRACKS.map((t) => () =>
  agent(PROMPT(t), { label: `triage:${t}`, phase: 'Triage', schema: SCHEMA, model: 'sonnet' })
))
const ok = results.filter(Boolean)
const c = { fix:0, manual:0, dismiss:0 }
ok.forEach((r)=>(r.items||[]).forEach((i)=>{ c[i.disposition]=(c[i.disposition]||0)+1 }))
log(`Triaged ${ok.length}/${TRACKS.length} tracks — fix:${c.fix} manual:${c.manual} dismiss:${c.dismiss}`)
return { tracks: ok.length, counts: c, results: ok }
