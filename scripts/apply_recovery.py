#!/usr/bin/env python3
"""Apply rewrite-recovery find/replace fixes to src/lib/generated/*.json.

Usage: python3 scripts/apply_recovery.py <task-output.json>
Each fix: {track, issueRef, cardIndex, field, find, replace, confidence}.
Applies only verbatim `find` (exact substring present) with no dup-splice, then
marks the matching issue (by issueRef) in audit-results.json applied=True.
"""
import json, os, re, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'src', 'lib', 'generated')
RESULTS = os.path.join(ROOT, 'scripts', 'audit-results.json')

def _shingles(text, n=7):
    w = re.findall(r'\w+', (text or '').lower())
    return Counter(tuple(w[i:i + n]) for i in range(len(w) - n + 1))

def introduces_dup(old, new):
    if len(re.findall(r'\w+', new)) < 8:
        return '., ' in new and '., ' not in old
    o, nn = _shingles(old), _shingles(new)
    for sh, c in nn.items():
        if c >= 2 and o.get(sh, 0) < c:
            return True
    return '., ' in new and '., ' not in old

def get_field(card, field):
    m = re.match(r'followups?\[(\d+)\]\.(\w+)', field or '')
    if m:
        i, k = int(m.group(1)), m.group(2)
        fu = card.get('followups') or []
        return (fu[i], k) if i < len(fu) else None
    if field in ('a', 'fs', 'fj', 'why', 'q'):
        return (card, field)
    return None

def find_results(o):
    if isinstance(o, dict):
        if 'results' in o and isinstance(o['results'], list):
            return o['results']
        for v in o.values():
            r = find_results(v)
            if r: return r
    return None

def main():
    out = json.load(open(sys.argv[1]))
    res = find_results(out) or []
    store = json.load(open(RESULTS))
    cache, applied, skip = {}, 0, Counter()

    for tr in res:
        track = tr.get('track')
        path = os.path.join(GEN, track + '.json')
        if not os.path.exists(path):
            skip['no_file'] += 1; continue
        if track not in cache:
            cache[track] = json.load(open(path))
        cards = cache[track]
        cards = cards if isinstance(cards, list) else (cards.get('cards') or cards.get('questions'))
        issues = store.get(track, {}).get('issues', [])

        for fx in tr.get('fixes', []):
            find, repl = fx.get('find'), fx.get('replace')
            ref = fx.get('issueRef')
            if not find or not repl:
                skip['null_fix'] += 1; continue
            ci = fx.get('cardIndex')
            if not isinstance(ci, int) or ci < 0 or ci >= len(cards):
                skip['bad_index'] += 1; continue
            tgt = get_field(cards[ci], fx.get('field', ''))
            if tgt is None:
                skip['unsupported_field'] += 1; continue
            cont, key = tgt
            cur = cont.get(key, '')
            if not isinstance(cur, str) or find not in cur:
                skip['not_located'] += 1; continue
            new = cur.replace(find, repl, 1)
            if introduces_dup(cur, new):
                skip['dup_splice'] += 1; continue
            cont[key] = new
            applied += 1
            if isinstance(ref, int) and 0 <= ref < len(issues):
                issues[ref]['applied'] = True
                issues[ref]['applyNote'] = 'applied (recovery)'

    for track, data in cache.items():
        with open(os.path.join(GEN, track + '.json'), 'w') as fh:
            fh.write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    json.dump(store, open(RESULTS, 'w'), indent=1, ensure_ascii=False)
    print(f"RECOVERY APPLIED: {applied} fixes across {len(cache)} files")
    print("SKIPPED:", dict(skip))

if __name__ == '__main__':
    main()
