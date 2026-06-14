#!/usr/bin/env python3
"""Merge rewritten chunk files back into src/lib/generated/<track>.json.

For each track that has chunk files: collect them in `start` order, verify the chunks
tile [0, baseline) with no gaps and the right total count, then write the reassembled
array back. Tracks with missing/short chunks are left untouched (re-spin them). Safe to
re-run. After merging, run: python3 scripts/validate_rewrite.py
"""
import json, glob, os, re
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'src', 'lib', 'generated')
CHUNKS = os.path.join(ROOT, 'scripts', 'rewrite-chunks')
BASELINE = json.load(open(os.path.join(ROOT, 'scripts', 'rewrite-baseline.json')))

def main():
    by_track = defaultdict(list)
    for p in glob.glob(os.path.join(CHUNKS, '*.json')):
        m = re.match(r'(.+)__(\d+)\.json$', os.path.basename(p))
        if m:
            by_track[m.group(1)].append((int(m.group(2)), p))

    merged, skipped = 0, []
    for track, parts in by_track.items():
        base = BASELINE.get(track, {}).get('cards')
        parts.sort()
        cards, cursor, ok = [], 0, True
        for start, p in parts:
            if start != cursor:
                ok = False; skipped.append(f'{track}: gap at {cursor} (next chunk {start})'); break
            try:
                d = json.load(open(p))
            except Exception as e:
                ok = False; skipped.append(f'{track}: chunk {start} parse error {e}'); break
            if not isinstance(d, list):
                ok = False; skipped.append(f'{track}: chunk {start} not a list'); break
            cards.extend(d); cursor += len(d)
        if not ok:
            continue
        if base is not None and cursor != base:
            skipped.append(f'{track}: assembled {cursor} != baseline {base}'); continue
        with open(os.path.join(GEN, track + '.json'), 'w') as fh:
            fh.write(json.dumps(cards, indent=2, ensure_ascii=False) + '\n')
        merged += 1

    print(f"merged {merged} tracks")
    if skipped:
        print("skipped (incomplete — re-spin):")
        for s in skipped:
            print("  " + s)

if __name__ == '__main__':
    main()
