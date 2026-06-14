#!/usr/bin/env python3
"""Generate scripts/rewrite.js for the content-rewrite swarm over a given track list.

Usage:
  python3 scripts/gen_rewrite_workflow.py spark workfront      # specific tracks (smoke)
  python3 scripts/gen_rewrite_workflow.py --all                # all 127
  python3 scripts/gen_rewrite_workflow.py --respin             # only tracks not 'validated'
Then run the Workflow tool with scriptPath=scripts/rewrite.js
"""
import json, glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'src', 'lib', 'generated')
STATUS = os.path.join(ROOT, 'scripts', 'rewrite-status')

def all_tracks():
    return [os.path.basename(f)[:-5] for f in sorted(glob.glob(os.path.join(GEN, '*.json')))]

def respin_tracks():
    out = []
    for t in all_tracks():
        sp = os.path.join(STATUS, t + '.json')
        if not os.path.exists(sp):
            out.append(t); continue
        if json.load(open(sp)).get('status') != 'validated':
            out.append(t)
    return out

args = sys.argv[1:]
if args == ['--all']:
    tracks = all_tracks()
elif args == ['--respin']:
    tracks = respin_tracks()
else:
    tracks = args
tracks = [t for t in tracks if os.path.exists(os.path.join(GEN, t + '.json'))]

PROMPT = r'''You are rewriting ONE interview-prep content file so cards read clearly and quiz correctly. Read-modify-WRITE the file in place. PRESERVE card COUNT and ORDER exactly — card identity is positional, so never add, remove, or reorder cards.

FILE: src/lib/generated/__TRACK__.json  (a JSON array of cards)
Card shape: { q, a, fs, fj, level, followups?:[{q,a}], code?:[...], opts?:[{t,ok,why}], why?, lines?, asked?, certDomain? }

For EACH card:

A) If the card HAS `opts` (multiple-choice / coding card): do NOT add `recall`. Verify the options — exactly one `ok:true`, the correct one truly answers `q`, and EVERY option carries a one-sentence `why` (add/fix missing ones). Keep `lines`/`code` as-is unless factually wrong. You may lightly reformat `a`/`why`.

B) Otherwise (FLIP card): produce a coherent, question-anchored set:
  1. `a` — must DIRECTLY and CORRECTLY answer `q`. Reformat for scannability using this light markdown (the app renders it):
       - optional short bold lead: **one-sentence TL;DR.**
       - `- ` bullet lines for the components / steps / types the question asks about.
       - fenced code where it clarifies: a line with ```lang , then code lines, then a line with ```
       - wrap the 2-4 genuinely key terms in **double asterisks** — these are the ONLY highlights, so pick the terms that matter for THIS question (e.g. for "the five module types", bold the five type NAMES, not incidental words like CSV).
     Keep it tight — no wall of text.
  2. `recall` — ADD this field: an array of EXACTLY 3 options [{t, ok, why}]:
       - exactly one `ok:true` = the correct, concise ANSWER to `q` (a sentence a candidate would actually say);
       - two `ok:false` = plausible WRONG answers — real misconceptions about THIS question (NOT off-topic facts about something else);
       - every option gets a one-sentence `why` explaining why it holds up or fails.
     Options must all be answers to `q`, similar length, no "all/none of the above", no meta narration.
  3. `fs` — a ONE-LINE strong/correct answer to `q` (UI shows it as "Strong answer:").
  4. `fj` — a ONE-LINE common mistake about `q` (UI shows it as "Common mistake:").
  5. `followups[].a` — reformat for readability (bullets / `**` / fenced code allowed); keep correct and answering their own `q`.

PRESERVE on every card: `level`, `code`, `lines`, `asked`, `certDomain`, and the `q` text (do NOT reword questions). Verify every claim is correct as of 2026. Output VALID JSON (2-space indent).

After writing the file, also write scripts/rewrite-status/__TRACK__.json with exactly: {"track":"__TRACK__","status":"written","cards":<the card count>}
Return {track, cards, note}.'''

SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'required': ['track', 'cards', 'note'],
    'properties': {
        'track': {'type': 'string'},
        'cards': {'type': 'integer'},
        'note': {'type': 'string'},
    },
}

js = '''export const meta = {
  name: 'content-rewrite',
  description: 'Rewrite cards: align answer↔question, author recall MCQ + why, structure + highlight',
  phases: [{ title: 'Rewrite', detail: 'one agent per track file, edits in place' }],
}

const TRACKS = %s
const SCHEMA = %s
const PROMPT_TMPL = %s
const PROMPT = (track) => PROMPT_TMPL.split('__TRACK__').join(track)

phase('Rewrite')
const results = await parallel(TRACKS.map((t) => () =>
  agent(PROMPT(t), { label: `rewrite:${t}`, phase: 'Rewrite', schema: SCHEMA, model: 'sonnet' })
))
const ok = results.filter(Boolean)
log(`Rewrote ${ok.length}/${TRACKS.length} tracks`)
return { tracks: ok.length, requested: TRACKS.length, results: ok }
''' % (json.dumps(tracks), json.dumps(SCHEMA), json.dumps(PROMPT))

open(os.path.join(ROOT, 'scripts', 'rewrite.js'), 'w').write(js)
print(f"wrote scripts/rewrite.js for {len(tracks)} tracks: {tracks if len(tracks) <= 8 else tracks[:8] + ['...']}")
