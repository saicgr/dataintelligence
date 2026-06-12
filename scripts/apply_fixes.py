#!/usr/bin/env python3
"""Apply audited fixes to src/lib/generated/*.json.

Applies ONLY: severity in {wrong, polarity}, confidence in {high, medium}, and a
clean drop-in `fix` (the quoted `claim` is found verbatim in the target field and
the fix is replacement text, not an instruction). Everything else is left as a flag.

Annotates each issue in audit-results.json with `applied` (bool) + `applyNote`,
so the tracker reflects exactly what changed. Re-run render_audit.py after.
"""
import json, os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'src', 'lib', 'generated')
RESULTS = os.path.join(ROOT, 'scripts', 'audit-results.json')

APPLY_SEV = {'wrong', 'polarity'}
APPLY_CONF = {'high', 'medium'}

# A "fix" that is really an instruction, not replacement text.
INSTRUCTIONAL = re.compile(
    r'^\s*(remove\b|split\b|replace\b|change\b|move\b|drop\b|swap\b|reword|delete\b|'
    r'correct the|see\b|flag\b|clarify|fix:|add a note|the fix\b)', re.I)
INSTRUCTIONAL_SUB = re.compile(
    r'\bthe fj\b|\bthe fs\b|\bthis card\b|\bthe claim\b|should be moved|split the', re.I)

def _shingles(text, n=7):
    w = re.findall(r'\w+', (text or '').lower())
    from collections import Counter
    return Counter(tuple(w[i:i + n]) for i in range(len(w) - n + 1))

def introduces_dup(old, new):
    """True if `new` repeats a 7-word run that wasn't repeated in `old` — the
    telltale of a splice that duplicated surrounding context."""
    if len(re.findall(r'\w+', new)) < 8:
        return False
    o, n = _shingles(old), _shingles(new)
    for sh, c in n.items():
        if c >= 2 and o.get(sh, 0) < c:
            return True
    return '., ' in new and '., ' not in old

def get_field(card, field):
    """Return (container, key) so caller can read/write, or None if unsupported."""
    m = re.match(r'followup\[(\d+)\]\.(\w+)', field)
    if m:
        i = int(m.group(1)); k = m.group(2)
        fu = card.get('followups') or []
        if i < len(fu):
            return (fu[i], k)
        return None
    if field in ('a', 'fs', 'fj', 'why', 'q'):
        return (card, field)
    return None  # opts and anything else -> manual

def main():
    store = json.load(open(RESULTS))
    cache = {}  # track -> parsed json
    applied_total = 0
    skipped = {'instructional': 0, 'not_located': 0, 'unsupported_field': 0,
               'no_fix': 0, 'low_conf_or_soft': 0, 'bad_index': 0, 'dup_splice': 0}

    for track, rec in store.items():
        path = os.path.join(GEN, track + '.json')
        if track not in cache:
            cache[track] = json.load(open(path))
        cards = cache[track]
        cards = cards if isinstance(cards, list) else (cards.get('cards') or cards.get('questions'))

        for issue in rec.get('issues', []):
            issue['applied'] = False
            sev, conf, fix = issue.get('severity'), issue.get('confidence'), issue.get('fix')
            claim = issue.get('claim') or ''
            if sev not in APPLY_SEV or conf not in APPLY_CONF:
                issue['applyNote'] = 'flag only (soft/low-conf)'; skipped['low_conf_or_soft'] += 1; continue
            if not fix or not fix.strip():
                issue['applyNote'] = 'no replacement text'; skipped['no_fix'] += 1; continue
            if INSTRUCTIONAL.search(fix) or INSTRUCTIONAL_SUB.search(fix):
                issue['applyNote'] = 'instructional fix — manual'; skipped['instructional'] += 1; continue
            ci = issue.get('cardIndex')
            if not isinstance(ci, int) or ci < 0 or ci >= len(cards):
                issue['applyNote'] = 'card index out of range'; skipped['bad_index'] += 1; continue
            tgt = get_field(cards[ci], issue.get('field', ''))
            if tgt is None:
                issue['applyNote'] = 'field not auto-editable (opts/other)'; skipped['unsupported_field'] += 1; continue
            container, key = tgt
            cur = container.get(key, '')
            if not isinstance(cur, str):
                issue['applyNote'] = 'field not a string'; skipped['not_located'] += 1; continue
            if claim not in cur:
                # idempotency: a prior run already spliced this fix in
                if fix.strip() and fix in cur:
                    issue['applied'] = True; issue['applyNote'] = 'applied (prior run)'; applied_total += 1; continue
                issue['applyNote'] = 'claim text not located verbatim'; skipped['not_located'] += 1; continue
            new = cur.replace(claim, fix, 1)
            if introduces_dup(cur, new):
                issue['applyNote'] = 'splice duplicated context — manual'; skipped['dup_splice'] += 1; continue
            container[key] = new
            issue['applied'] = True
            issue['applyNote'] = 'applied'
            applied_total += 1

    # write modified JSON files (byte-stable formatting)
    for track, data in cache.items():
        with open(os.path.join(GEN, track + '.json'), 'w') as fh:
            fh.write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    json.dump(store, open(RESULTS, 'w'), indent=1, ensure_ascii=False)

    print(f"APPLIED: {applied_total} fixes across {len(cache)} files")
    print("SKIPPED:", skipped)

if __name__ == '__main__':
    main()
