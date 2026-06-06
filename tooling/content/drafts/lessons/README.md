# Authoring lessons (the diagnostic / coding card kinds)

Lessons are the richer card kinds — `order | evidence | diag | match | querybuild | choice` —
grouped into **Path units** by their `track` slug. They are a different shape than the flat
fresh card (q/a/fj/fs), so author them as **JSON files in this folder** (not the readline `add.mjs`).

## Flow ("automation proposes, human approves")

1. **Copy** `lesson.template.json` → `my-card.json` in this folder and edit it. (The template is a
   complete, valid `querybuild` worked example; `lesson.template.json` and `_`-prefixed files are
   ignored by the publisher.) Automation _may_ draft a file here from a solution + schema — but it
   never publishes.
2. **Review + publish:** `node ../../publish.mjs` (dry run shows the validation table) →
   `node ../../publish.mjs --yes` to assemble `out/lessons-vN.json`, bump `out/manifest.json`
   (`lessonsUrl`), upload to the content host, and archive the draft to `published/`.
3. The app picks it up on next launch via `contentSync.ts` (no app-store release). Bundled
   `LESSON_SEED` in `mobile/src/lib/lessons.ts` is the offline day-one set.

The validator (`shared.mjs` `validateLesson`) enforces: required fields, a known `kind`, a valid
`tk`, a future `verifyBy` (optional — omit for evergreen), and per-kind structure (≥1 accepted
ordering/solution, a correct option, token positions consistent, `querybuild` has `setup.expected`
+ `webx.problemId`, etc.).

## Required fields (every kind)

`track` (Path unit slug — e.g. `cr-sql`, `spark-oncall`, `airflow-oncall`, `prompt-lab`),
`id` (stable, unique), `kind`, `tk` (track color: spark|kafka|rag|sql|dbt|sysd|eval),
`tool` (badge label), `tag`, `q` (the prompt), `fj` (junior tell), `fs` (senior tell).
Optional: `verifyBy` (ISO; retire after), `sourceUrl`/`sourceLabel`, `incidentId`, `stage`.

## Per-kind payload (the discriminating field)

- **order** → `order: { rows: string[], accepted: number[][], mono?: boolean }` — each `accepted`
  is a valid ordering expressed as the sequence of source-row indices.
- **evidence** → `evidence: { panel: {kind:'table',cells} | {kind:'code',lines,lang}, tells, cause: opt[], why }` —
  `tells` = `[row,col]` pairs for a table, line indices for code; `cause` needs one `ok:true`.
- **diag** → `diag: { steps: DiagStep[], webx }` — each step is `inspect|infer|fix|verify` (with
  `opts`, optional `consequence`) or `evidence` (with `panel`+`tells`); every step needs a `why`.
- **match** → `match: { template, blank: opt[] }` (fill-the-blank) OR
  `match: { bank: {t,pos}[], acceptedSeqs: number[][] }` (assemble; `pos` is the canonical index,
  `-1` = distractor; each accepted sequence lists the positional tokens in order).
- **querybuild** → `querybuild: { setup:{schema,rows,expected}, hints, beats: DiagStep[],
  assemble:{bank}, acceptedSeqs, webx }` — the full faded-scaffold lesson.
- **choice** → top-level `opts: {t,ok,why?}[]` + optional `lines`/`lang` code panel + `strict:true`.

See `mobile/src/lib/lessons.ts` for live, valid examples of every kind.
