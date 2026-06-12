#!/usr/bin/env python3
"""Render CONTENT-AUDIT.md from generated/*.json (card counts) + audit-results.json (findings).
The tracker is a VIEW over audit-results.json so it never drifts from reality.
Re-run after each audit wave: python3 scripts/render_audit.py
"""
import json, glob, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, 'src', 'lib', 'generated')
RESULTS = os.path.join(ROOT, 'scripts', 'audit-results.json')
OUT = os.path.join(ROOT, 'CONTENT-AUDIT.md')

RISKY = {'aem','palantir','snaplogic','workfront','bedrock','vertex-ai','azure-ai',
         'cortex','mosaic','terraform'}

def cards(d):
    return d if isinstance(d, list) else (d.get('cards') or d.get('questions') or [])

def count(f):
    try: return len(cards(json.load(open(f))))
    except Exception: return -1

inv = {}
for f in sorted(glob.glob(os.path.join(GEN, '*.json'))):
    name = os.path.basename(f)[:-5]
    inv[name] = count(f)
    if name.startswith('cert-'):
        RISKY.add(name)

results = {}
if os.path.exists(RESULTS):
    results = json.load(open(RESULTS))

SEV = ['wrong', 'misleading', 'outdated', 'polarity', 'weak']

def status_for(name):
    r = results.get(name)
    if not r:
        return '⬜ pending'
    issues = [i for i in r.get('issues', []) if not i.get('dismissed')]
    remaining = [i for i in issues if not i.get('applied')]
    hard = [i for i in remaining if i.get('severity') in ('wrong', 'polarity')]
    if not issues:
        return '✅ clean'
    if hard:
        return '⚠️ issues'
    if not remaining:
        return '🔧 fixed'
    return '🟡 minor'

def err_rate(name):
    r = results.get(name)
    if not r: return ''
    n = r.get('cardsAudited') or inv.get(name, 0)
    if not n: return ''
    iss = [i for i in r.get('issues', []) if not i.get('dismissed')]
    found = sum(1 for i in iss if i.get('severity') in ('wrong', 'polarity'))
    left = sum(1 for i in iss if i.get('severity') in ('wrong', 'polarity') and not i.get('applied'))
    if not found:
        return '0'
    return f"{left} left / {found} ({100*left/n:.1f}%)"

# ---- aggregate totals
audited_tracks = [n for n in inv if n in results]
total_cards = sum(c for c in inv.values() if c > 0)
audited_cards = sum(results[n].get('cardsAudited', inv.get(n, 0)) for n in audited_tracks)
all_issues = [i for n in audited_tracks for i in results[n].get('issues', [])
              if not i.get('dismissed')]
dismissed_total = sum(1 for n in audited_tracks for i in results[n].get('issues', []) if i.get('dismissed'))
by_sev = {s: sum(1 for i in all_issues if i.get('severity') == s) for s in SEV}
hard_total = by_sev['wrong'] + by_sev['polarity']
applied_total = sum(1 for i in all_issues if i.get('applied'))
flagged_total = sum(1 for i in all_issues if not i.get('applied'))
hard_remaining = sum(1 for i in all_issues
                     if i.get('severity') in ('wrong', 'polarity') and not i.get('applied'))

lines = []
lines.append('# Content Audit Tracker')
lines.append('')
lines.append('> Adversarial factual audit of every content card. This file is **generated** from '
             '`scripts/audit-results.json` — do not edit by hand; re-run `python3 scripts/render_audit.py`.')
lines.append('')
lines.append('**Legend:** ⬜ pending · 🔍 auditing · ✅ clean · 🟡 minor (style/weak only) · '
             '⚠️ issues (wrong/polarity) · 🔧 fixed')
lines.append('')
lines.append('## Summary')
lines.append('')
lines.append(f'- **Tracks:** {len(audited_tracks)}/{len(inv)} audited')
lines.append(f'- **Cards:** {audited_cards}/{total_cards} audited')
lines.append(f'- **Hard errors found (wrong + polarity):** {hard_total}'
             + (f' → {100*hard_total/audited_cards:.2f}% of cards' if audited_cards else ''))
lines.append(f'- **Hard errors REMAINING:** {hard_remaining}'
             + (f' → **{100*hard_remaining/audited_cards:.2f}%** residual rate' if audited_cards else ''))
lines.append(f'- **By severity (found):** wrong {by_sev["wrong"]} · misleading {by_sev["misleading"]} · '
             f'outdated {by_sev["outdated"]} · polarity {by_sev["polarity"]} · weak {by_sev["weak"]}')
lines.append(f'- **Fixes:** 🔧 {applied_total} applied · 🔎 {flagged_total} flagged for manual review · '
             f'🚫 {dismissed_total} dismissed (false positives)')
lines.append('')

# ---- per-track table, risky first
lines.append('## Tracks')
lines.append('')
lines.append('| Track | Cards | Status | Hard err | wrong/mis/out/pol/weak | Notes |')
lines.append('|---|--:|---|---|---|---|')

def row(name):
    r = results.get(name, {})
    issues = r.get('issues', [])
    sevc = '·'.join(str(sum(1 for i in issues if i.get('severity') == s)) for s in SEV)
    note = r.get('note', '')
    risky_mark = ' 🎯' if name in RISKY else ''
    return f"| `{name}`{risky_mark} | {inv.get(name,'?')} | {status_for(name)} | {err_rate(name)} | {sevc if issues or name in results else ''} | {note} |"

ordered = sorted(inv, key=lambda n: (n not in RISKY, n))
for name in ordered:
    lines.append(row(name))

lines.append('')
lines.append('🎯 = risky long-tail track (vendor / cert / niche) — audited first.')
lines.append('')

# ---- open issues detail (hard errors first)
lines.append('## Open issues (hard errors first)')
lines.append('')
if not all_issues:
    lines.append('_None recorded yet._')
else:
    sev_rank = {s: i for i, s in enumerate(SEV)}
    flat = sorted(
        [(n, i) for n in audited_tracks for i in results[n].get('issues', [])],
        key=lambda x: sev_rank.get(x[1].get('severity'), 9))
    lines.append('| Track | Card | Field | Sev | Conf | Problem | Status |')
    lines.append('|---|--:|---|---|---|---|---|')
    for n, i in flat:
        status = '🔧 fixed' if i.get('applied') else ('🔎 ' + (i.get('applyNote') or 'review'))
        prob = (i.get('problem') or '').replace('|', '\\|')[:88]
        lines.append(f"| `{n}` | {i.get('cardIndex','?')} | {i.get('field','?')} | {i.get('severity')} | "
                     f"{i.get('confidence','?')} | {prob} | {status} |")
lines.append('')

with open(OUT, 'w') as fh:
    fh.write('\n'.join(lines) + '\n')
print(f"wrote {OUT}: {len(audited_tracks)}/{len(inv)} tracks, {hard_total} hard errors")
