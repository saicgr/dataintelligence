#!/usr/bin/env python3
"""Generate a CHUNKED content-rewrite workflow (scripts/rewrite.js).

Large files stall a single agent, so we split each track into ~20-card slices; one agent
per slice reads the source file, rewrites cards [start,end), and writes the rewritten slice
to scripts/rewrite-chunks/<track>__<start>.json. A separate merge step reassembles. Chunk
files are the resumable ledger: re-spin only regenerates missing/invalid chunks.

Usage:
  python3 scripts/gen_chunk_workflow.py --pending   # all tracks not yet 'validated'
  python3 scripts/gen_chunk_workflow.py --respin     # only tracks/chunks still missing
  python3 scripts/gen_chunk_workflow.py sql aem       # specific tracks
"""
import json, glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'src', 'lib', 'generated')
STATUS = os.path.join(ROOT, 'scripts', 'rewrite-status')
CHUNKS = os.path.join(ROOT, 'scripts', 'rewrite-chunks')
BASELINE = json.load(open(os.path.join(ROOT, 'scripts', 'rewrite-baseline.json')))
CHUNK = 20

os.makedirs(CHUNKS, exist_ok=True)

def all_tracks():
    return [os.path.basename(f)[:-5] for f in sorted(glob.glob(os.path.join(GEN, '*.json')))]

def validated(t):
    sp = os.path.join(STATUS, t + '.json')
    return os.path.exists(sp) and json.load(open(sp)).get('status') == 'validated'

def chunk_ok(track, start, end):
    """A chunk is done when its file exists, parses, and has exactly end-start cards."""
    p = os.path.join(CHUNKS, f'{track}__{start}.json')
    if not os.path.exists(p):
        return False
    try:
        d = json.load(open(p))
        return isinstance(d, list) and len(d) == end - start
    except Exception:
        return False

args = sys.argv[1:]
if args == ['--pending'] or args == ['--respin']:
    tracks = [t for t in all_tracks() if not validated(t)]
else:
    tracks = [t for t in args if os.path.exists(os.path.join(GEN, t + '.json'))]

respin = (args == ['--respin'])

# Build the chunk list (skip chunks already done when --respin).
chunks = []
for t in tracks:
    n = BASELINE.get(t, {}).get('cards', 0)
    for start in range(0, n, CHUNK):
        end = min(start + CHUNK, n)
        if respin and chunk_ok(t, start, end):
            continue
        chunks.append({'track': t, 'start': start, 'end': end})

CONTRACT = r'''Rewrite ONLY cards with index in [__START__, __END__) of the file src/lib/generated/__TRACK__.json (a JSON array). Read the file, take that exact slice (cards __START__ .. __END__-1), rewrite EACH card, and WRITE the rewritten slice — a JSON array of EXACTLY __COUNT__ cards, in the same order — to scripts/rewrite-chunks/__TRACK____START__.json . Do NOT modify the source file. Do NOT change card order or count.

Card shape: { q, a, fs, fj, level, followups?:[{q,a}], code?:[...], opts?:[{t,ok,why}], why?, lines?, asked?, certDomain? }

For EACH card in the slice:

A) If the card HAS `opts` (multiple-choice / coding card): do NOT add `recall`. Verify options — exactly one `ok:true`, the correct one truly answers `q`, EVERY option has a one-sentence `why` (add/fix missing). Keep `lines`/`code` unless factually wrong. You may lightly reformat `a`/`why`.

B) Otherwise (FLIP card):
  1. `a` — must DIRECTLY and CORRECTLY answer `q`. Reformat with light markdown the app renders:
       - optional short bold lead: **one-sentence TL;DR.**
       - `- ` bullet lines for the components / steps / types the question asks about.
       - fenced code where it clarifies: a line with three backticks + lang, code lines, then a line with three backticks.
       - wrap the 2-4 genuinely key terms in **double asterisks** — the ONLY highlights, so pick the terms that matter for THIS question (e.g. for "the five module types", bold the five type NAMES, not incidental words like CSV).
     Tight, no wall of text.
  2. `recall` — ADD: array of EXACTLY 3 options [{t, ok, why}] — one `ok:true` (the correct concise ANSWER to `q`) and two `ok:false` (plausible WRONG answers / real misconceptions about THIS question, NOT off-topic facts); every option a one-sentence `why`. All three are answers to `q`, similar length, no "all/none of the above".
  3. `fs` — ONE-LINE strong/correct answer to `q`.
  4. `fj` — ONE-LINE common mistake about `q`.
  5. `followups[].a` — reformat for readability; keep correct.

PRESERVE on every card: `level`, `code`, `lines`, `asked`, `certDomain`, and the `q` text. Verify claims correct as of 2026. The chunk file must be VALID JSON (an array, 2-space indent). Return {track, start, count, note}.'''

SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'required': ['track', 'start', 'count', 'note'],
    'properties': {
        'track': {'type': 'string'}, 'start': {'type': 'integer'},
        'count': {'type': 'integer'}, 'note': {'type': 'string'},
    },
}

js = '''export const meta = {
  name: 'content-rewrite-chunked',
  description: 'Rewrite cards in ~20-card chunks: align answer/question, author recall MCQ + why, structure + highlight',
  phases: [{ title: 'Rewrite', detail: 'one agent per chunk; merged after' }],
}

const CHUNKS = %s
const SCHEMA = %s
const CONTRACT = %s
function prompt(ch) {
  return CONTRACT
    .split('__TRACK__').join(ch.track)
    .split('__START__').join(String(ch.start))
    .split('__END__').join(String(ch.end))
    .split('__COUNT__').join(String(ch.end - ch.start))
}

phase('Rewrite')
const results = await parallel(CHUNKS.map((ch) => () =>
  agent(prompt(ch), { label: `rw:${ch.track}@${ch.start}`, phase: 'Rewrite', schema: SCHEMA, model: 'sonnet' })
))
const ok = results.filter(Boolean)
log(`Rewrote ${ok.length}/${CHUNKS.length} chunks`)
return { chunks: ok.length, requested: CHUNKS.length }
''' % (json.dumps(chunks), json.dumps(SCHEMA), json.dumps(CONTRACT))

open(os.path.join(ROOT, 'scripts', 'rewrite.js'), 'w').write(js)
ntracks = len(set(c['track'] for c in chunks))
print(f"wrote scripts/rewrite.js: {len(chunks)} chunks across {ntracks} tracks (chunk size {CHUNK})")
