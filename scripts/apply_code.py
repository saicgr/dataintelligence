#!/usr/bin/env python3
"""Apply code-fix swarm edits (card-scoped verbatim find/replace + optional ok-flip).

Usage: python3 scripts/apply_code.py <task-output.json>
Each fix: {track, issueRef, cardIndex, edits:[{find,replace}], setOkIndex}.
- find/replace applied only when `find` occurs EXACTLY ONCE among the card's string
  leaves (uniqueness guard) and the splice introduces no duplicated context.
- setOkIndex flips card.opts[*].ok so only that index is true.
Marks the matching issue applied in audit-results.json. Monotonic; safe to re-run.
"""
import json, os, re, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'src', 'lib', 'generated')
RESULTS = os.path.join(ROOT, 'scripts', 'audit-results.json')

def _sh(t, n=7):
    w = re.findall(r'\w+', (t or '').lower())
    return Counter(tuple(w[i:i+n]) for i in range(len(w)-n+1))

def introduces_dup(old, new):
    if len(re.findall(r'\w+', new)) < 8:
        return '., ' in new and '., ' not in old
    o, nn = _sh(old), _sh(new)
    return any(c >= 2 and o.get(s, 0) < c for s, c in nn.items()) or ('., ' in new and '., ' not in old)

def leaves(node):
    """Yield (container, key) for every string leaf under node."""
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, str): yield (node, k)
            else: yield from leaves(v)
    elif isinstance(node, list):
        for idx, v in enumerate(node):
            if isinstance(v, str): yield (node, idx)
            else: yield from leaves(v)

def find_results(o):
    if isinstance(o, dict):
        if 'results' in o and isinstance(o['results'], list): return o['results']
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
        if not os.path.exists(path): skip['no_file'] += 1; continue
        if track not in cache: cache[track] = json.load(open(path))
        cards = cache[track]
        cards = cards if isinstance(cards, list) else (cards.get('cards') or cards.get('questions'))
        issues = store.get(track, {}).get('issues', [])

        for fx in tr.get('fixes', []):
            ci = fx.get('cardIndex'); ref = fx.get('issueRef')
            if not isinstance(ci, int) or ci < 0 or ci >= len(cards): skip['bad_index'] += 1; continue
            card = cards[ci]
            did = False

            # option-correctness flip
            ok_i = fx.get('setOkIndex')
            if isinstance(ok_i, int):
                opts = card.get('opts')
                if isinstance(opts, list) and 0 <= ok_i < len(opts):
                    for j, o in enumerate(opts):
                        if isinstance(o, dict) and 'ok' in o: o['ok'] = (j == ok_i)
                    did = True

            # verbatim card-scoped edits
            for ed in fx.get('edits', []):
                find, repl = ed.get('find'), ed.get('replace')
                if not find or repl is None: continue
                hits = [(c, k) for (c, k) in leaves(card) if find in c[k]]
                if len(hits) != 1: skip['not_unique' if len(hits) > 1 else 'not_located'] += 1; continue
                c, k = hits[0]; cur = c[k]; new = cur.replace(find, repl, 1)
                if introduces_dup(cur, new): skip['dup_splice'] += 1; continue
                c[k] = new; did = True

            if did:
                applied += 1
                if isinstance(ref, int) and 0 <= ref < len(issues):
                    issues[ref]['applied'] = True
                    issues[ref]['applyNote'] = 'applied (code)'
            else:
                skip['no_edit'] += 1

    for track, data in cache.items():
        with open(os.path.join(GEN, track + '.json'), 'w') as fh:
            fh.write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    json.dump(store, open(RESULTS, 'w'), indent=1, ensure_ascii=False)
    print(f"CODE FIXES APPLIED: {applied} cards across {len(cache)} files")
    print("SKIPPED:", dict(skip))

if __name__ == '__main__':
    main()
