export const meta = {
  name: 'content-code-fix',
  description: 'Fix confirmed code/structural bugs in coding cards as verbatim edits',
  phases: [{ title: 'CodeFix', detail: 'one agent per track re-executes code, emits edits' }],
}

const TRACKS = ["agentic-ai", "agents", "bedrock", "bi", "coding-java", "coding-rust", "cortex", "dbt-metricflow", "docker", "mlsys", "rag", "spark", "tableau", "vectordb", "voice-ai"]

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['track','fixes'],
  properties: {
    track: { type: 'string' },
    fixes: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['issueRef','cardIndex','edits','setOkIndex','confidence','note'],
      properties: {
        issueRef: { type: 'integer' },
        cardIndex: { type: 'integer' },
        edits: { type: 'array', description: 'verbatim find/replace pairs, applied card-scoped',
          items: { type: 'object', additionalProperties: false, required: ['find','replace'],
            properties: { find: { type: 'string' }, replace: { type: 'string' } } } },
        setOkIndex: { type: ['integer','null'], description: 'if the WRONG option is marked correct: index of the option that SHOULD be ok:true (others set false); else null' },
        confidence: { type: 'string', enum: ['high','medium','low'] },
        note: { type: 'string' },
      } } },
  },
}

const PROMPT = (track) => `You are fixing CONFIRMED code/structural bugs in coding cards of ONE content file. Be precise and conservative.

1. Read the flag list: scripts/code_flags.json — use ONLY entries keyed "${track}". Each: issueRef, cardIndex, field, claim (the buggy text seen), problem (why it is wrong), badFix.
2. Read the content file: src/lib/generated/${track}.json. Coding cards look like: { kind, q, lines OR code:[{lang,lines:[...]}], opts:[{t,ok,why}], why, followups:[...] }.

For EACH flag, open card[cardIndex] and produce the MINIMAL correct fix:
- MENTALLY EXECUTE / verify the code against the problem statement. Confirm the bug is real as of 2026 before fixing.
- Express the fix as one or more "edits": each {find, replace} where find is the EXACT VERBATIM current substring (a code line, an option label, a why-string fragment, an API name) and replace is the corrected text. find MUST occur exactly ONCE within that card (make it specific enough to be unique). Change only the wrong characters; keep surrounding code intact.
- If the bug is that the WRONG option is marked correct (ok:true on a wrong answer), set setOkIndex to the 0-based index of the option that should be ok:true. Otherwise setOkIndex=null.
- If you cannot produce a confident, verbatim fix, return edits:[] and setOkIndex:null with confidence:"low" and explain in note.

Return track="${track}", one fixes[] entry per flag (same issueRef). Correctness over completeness — a wrong code fix is worse than a flag.`

phase('CodeFix')
const results = await parallel(TRACKS.map((t) => () =>
  agent(PROMPT(t), { label: `codefix:${t}`, phase: 'CodeFix', schema: SCHEMA, model: 'sonnet' })
))
const ok = results.filter(Boolean)
const n = ok.reduce((s,r)=>s+(r.fixes||[]).filter((f)=>(f.edits&&f.edits.length)||f.setOkIndex!=null).length,0)
log(`Code-fixed ${ok.length}/${TRACKS.length} tracks, ${n} cards with edits`)
return { tracks: ok.length, edited: n, results: ok }
