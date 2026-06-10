#!/usr/bin/env python3
"""
Deterministic merge-writer for tooling/content/jd-terms.md.

The LLM swarm extracts terms from JDs (fuzzy work). THIS script does the merge —
a pure upsert: look up each term's coverage in the mobile JSONs, grade it, union
the demand labels, re-grade every existing row, rebuild the tables, write once.
No LLM, no per-term subprocess: one pass over the JSONs, runs in ~1s.

Usage:
  python3 tooling/content/jd_merge.py path/to/extracted.json
where extracted.json = [{"jd_label": "...", "terms": ["...", ...]}, ...]
Run from the repo root.
"""
import json, glob, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MD = os.path.join(ROOT, "tooling/content/jd-terms.md")
GEN = os.path.join(ROOT, "mobile/src/lib/generated")
CONTENT_TS = os.path.join(ROOT, "mobile/src/lib/content.ts")
LEVELS = ["Jr", "Mid", "Sr", "Staff", "Prin"]
JSON_LEVELS = {"Jr": "Jr", "Mid": "Mid", "Sr": "Sr", "Staff": "Staff", "Prin": "Principal"}
TRACK_MIN = 25       # min cards per track
SUBTOPIC_MIN = 10    # min dedicated cards for a sub-topic to be "covered"

# Critical aliases applied on top of the file's registry (canonical: [variants]).
ALIAS_EXTRA = {
    "GCP": ["google cloud platform", "google cloud", "gcp"],
    "LLM": ["llms", "large language models", "large language model", "llm"],
    "Generative AI": ["genai", "gen ai", "generative ai"],
    "AI Agents": ["ai agents", "ai/llm agents", "ai / llm agents", "llm agents", "ai agent"],
    "Agentic AI": ["agentic ai", "agentic workflows", "agentic"],
    "MDM": ["master data management", "mdm"],
    "Azure ML": ["azure machine learning", "azure ml"],
    "Redshift": ["aws redshift", "amazon redshift", "redshift"],
    "Kafka": ["apache kafka", "kafka"],
    "Spark": ["apache spark", "spark"],
    "Azure Data Factory": ["adf", "azure data factory"],
    "scikit-learn": ["sklearn", "scikit learn", "scikit-learn"],
    # ── duplicate JD terms whose concept is already covered under another name ──
    # (each canonical verified to have >=10 dedicated cards, or is a track name)
    "Kinesis": ["aws kinesis", "kinesis data streams", "amazon kinesis"],
    "Pub/Sub": ["google cloud pub/sub", "gcp pub/sub", "cloud pub/sub", "pubsub"],
    "Vertex AI": ["google cloud ai", "google vertex ai", "vertex"],
    "EHR": ["emr/ehr", "ehr/emr", "emr"],
    "OneLake": ["azure onelake", "ms onelake"],
    "SLO": ["slis/slos", "sli/slo", "slos", "slis", "service level objectives"],
    "Cost Monitoring": ["warehouse cost optimization", "warehouse cost", "credit monitoring"],
    "cluster policies": ["workspace guardrails", "databricks workspace guardrails"],
    "Foundry": ["palantir foundry", "palantir fde", "foundry ontology"],
    "Power BI": ["business intelligence"],
    "Unity Catalog": ["databricks administration", "databricks admin"],
    "Entra ID": ["azure administration", "azure ad administration"],
    "Tableau": ["tableau ai", "tableau pulse"],
    "GitHub Copilot": ["ai tools", "ai coding tools", "ai coding assistant"],
    "Kubernetes": ["cka", "certified kubernetes administrator"],
    "REST API": ["backend development", "backend dev"],
    "message queue": ["ibm mq", "websphere mq", "ibm websphere mq"],
}

def load_md():
    with open(MD) as f:
        return f.read()

def section(txt, start, end):
    """Return (before, inner, after) around a marker pair."""
    a = txt.index(start); b = txt.index(end)
    head_end = txt.index("\n", a) + 1          # keep the start-marker line
    return txt[:head_end], txt[head_end:b], txt[b:]

def parse_rows(inner):
    rows = []
    for line in inner.splitlines():
        s = line.strip()
        if not s.startswith("|") or set(s) <= set("|- "):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        rows.append(cells)
    return rows  # first row is the header

def build_aliases(txt):
    alias = {}
    a = txt.index("ALIAS-REGISTRY-START"); b = txt.index("ALIAS-REGISTRY-END")
    for line in txt[a:b].splitlines():
        if "←" in line:
            canon, rest = line.split("←", 1)
            canon = canon.lstrip("- ").strip()
            alias[canon.lower()] = canon
            for v in rest.split(","):
                v = v.strip()
                if v:
                    alias[v.lower()] = canon
    for canon, variants in ALIAS_EXTRA.items():
        alias[canon.lower()] = canon
        for v in variants:
            alias[v.lower()] = canon
    return alias

def canonical(term, alias):
    return alias.get(term.strip().lower(), term.strip())

# ---- mobile content index -------------------------------------------------
def load_tracks():
    """slug -> {total, levels{...}, text:[lowercased card json per card]}."""
    tracks = {}
    for f in sorted(glob.glob(os.path.join(GEN, "*.json"))):
        slug = os.path.basename(f)[:-5]
        try:
            cards = json.load(open(f))
        except Exception:
            continue
        if not isinstance(cards, list):
            continue
        text = [json.dumps(c).lower() for c in cards]
        lv = {L: 0 for L in LEVELS}
        for c in cards:
            jl = c.get("level")
            for L, name in JSON_LEVELS.items():
                if jl == name:
                    lv[L] += 1
        tracks[slug] = {"total": len(cards), "levels": lv, "text": text}
    return tracks

def track_names():
    """lowercased {name/slug -> slug} from RAW_TRACKS for track-name detection."""
    names = {}
    try:
        src = open(CONTENT_TS).read()
    except Exception:
        return names
    for m in re.finditer(r"slug:\s*'([^']+)',\s*name:\s*'([^']+)'", src):
        slug, name = m.group(1), m.group(2)
        names[slug.lower()] = slug
        names[name.lower()] = slug
    return names

def mention_counts(term, tracks):
    """{slug: n} cards mentioning term. Word-boundary for short/ambiguous terms."""
    t = term.lower()
    if len(t) <= 3 or t in ("go", "r", "ai", "ml", "bi", "java"):
        pat = re.compile(r"(?<![a-z0-9])" + re.escape(t) + r"(?![a-z0-9])")
        match = lambda s: bool(pat.search(s))
    else:
        match = lambda s: t in s
    out = {}
    for slug, d in tracks.items():
        n = sum(1 for s in d["text"] if match(s))
        if n:
            out[slug] = n
    return out

# ---- grading --------------------------------------------------------------
def grade(term, tracks, tnames):
    counts = mention_counts(term, tracks)
    total_mentions = sum(counts.values())
    is_track = term.lower() in tnames
    if not counts and not is_track:
        return {"track": "", "qa": "", "status": "⬜ missing", "action": "author 5",
                "notes": "no cards mention it yet"}
    if is_track:
        slug = tnames[term.lower()]
        tot = tracks.get(slug, {}).get("total", 0)
        qa = counts.get(slug, total_mentions)
        if tot >= TRACK_MIN:
            return {"track": slug, "qa": qa, "status": "✅ covered",
                    "action": "skip — covered", "notes": ""}
        return {"track": slug, "qa": qa, "status": "🟡 thin",
                "action": f"author {TRACK_MIN - tot} more to 25", "notes": f"track under {TRACK_MIN}"}
    # sub-topic: grade on its own dedicated count, NOT the parent track size
    best = max(counts, key=counts.get)
    n = counts[best]
    ranked = sorted(counts.values(), reverse=True)
    ambiguous = len(ranked) > 1 and ranked[0] - ranked[1] <= 1 and n <= 2
    track = best + ("?" if ambiguous else "")
    if n >= SUBTOPIC_MIN:
        return {"track": track, "qa": n, "status": "✅ covered",
                "action": "skip — covered", "notes": f"lives in {best}"}
    return {"track": track, "qa": n, "status": "🟡 thin",
            "action": f"author {SUBTOPIC_MIN - n} more in {best}", "notes": f"lives in {best}"}

STATUS_RANK = {"⬜ missing": 0, "🟡 thin": 1, "🔵 untracked": 1, "✅ covered": 3}

# ---- main -----------------------------------------------------------------
def main():
    if len(sys.argv) < 2:
        print("usage: jd_merge.py extracted.json"); sys.exit(1)
    batch = json.load(open(sys.argv[1]))
    today = datetime.date.today().isoformat()

    txt = load_md()
    alias = build_aliases(txt)
    tracks = load_tracks()
    tnames = track_names()

    # parse existing term rows -> key(lower) -> dict
    head1, terms_inner, after1 = section(txt, "TERMS-TABLE-START", "TERMS-TABLE-END")
    rows = parse_rows(terms_inner)[1:]  # drop header
    existing = {}
    for c in rows:
        if len(c) < 9:
            continue
        cterm = canonical(c[0], alias)          # collapse aliases -> canonical
        key = cterm.lower()
        seen = [x.strip() for x in c[7].split(",") if x.strip()]
        if key in existing:                     # two rows fold into one (dedupe)
            e = existing[key]
            e["seen"] = sorted(set(e["seen"]) | set(seen))
            dates = [d for d in (e.get("date"), c[6]) if d]
            e["date"] = min(dates) if dates else c[6]
            if not e.get("notes"):
                e["notes"] = c[8]
        else:
            existing[key] = {"term": cterm, "date": c[6], "seen": seen, "notes": c[8]}

    # batch term -> set(labels)
    batch_labels = {}
    canon_display = {}
    for jd in batch:
        lbl = jd["jd_label"].strip()
        for raw in jd.get("terms", []):
            cterm = canonical(raw, alias)
            key = cterm.lower()
            canon_display.setdefault(key, cterm)
            batch_labels.setdefault(key, set()).add(lbl)

    # full key set = existing ∪ batch
    keys = set(existing) | set(batch_labels)
    out_rows = []
    for key in keys:
        disp = existing.get(key, {}).get("term") or canon_display.get(key) or key
        g = grade(disp, tracks, tnames)
        seen = set(existing.get(key, {}).get("seen", [])) | batch_labels.get(key, set())
        date = existing.get(key, {}).get("date") or today
        out_rows.append({
            "term": disp, "track": g["track"], "qa": g["qa"], "status": g["status"],
            "jds": len(seen), "action": g["action"], "date": date,
            "seen": sorted(seen), "notes": g["notes"],
        })

    out_rows.sort(key=lambda r: (STATUS_RANK.get(r["status"].split("·")[0].strip(), 2),
                                 -r["jds"], r["term"].lower()))

    # rebuild terms table
    tlines = ["| Technical Term | Track | # Q&A | Status | # JDs | Suggested Action | Date Added | Seen in JD | Notes |",
              "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for r in out_rows:
        tlines.append("| {term} | {track} | {qa} | {status} | {jds} | {action} | {date} | {seen} | {notes} |".format(
            term=r["term"], track=r["track"], qa=r["qa"], status=r["status"], jds=r["jds"],
            action=r["action"], date=r["date"], seen=", ".join(r["seen"]), notes=r["notes"]))
    new_terms_inner = "\n".join(tlines) + "\n"

    # rebuild track coverage table for every track referenced
    used = sorted({r["track"].rstrip("?") for r in out_rows if r["track"].rstrip("?")})
    klines = ["| Track | Total | Jr | Mid | Sr | Staff | Prin | Status |",
              "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    cov = []
    for slug in used:
        d = tracks.get(slug)
        if not d:
            continue
        lv = d["levels"]; tot = d["total"]
        empty = [L for L in LEVELS if lv[L] == 0]
        if tot < TRACK_MIN:
            status = f"⬜ +{TRACK_MIN - tot} to 25"; rank = 0
        elif empty:
            status = "🟡 25+ · gaps: " + ", ".join(empty); rank = 1
        else:
            status = "✅ 25+ balanced"; rank = 2
        cov.append((rank, tot, slug, lv, status))
    cov.sort(key=lambda x: (x[0], x[1]))
    for rank, tot, slug, lv, status in cov:
        klines.append(f"| {slug} | {tot} | {lv['Jr']} | {lv['Mid']} | {lv['Sr']} | {lv['Staff']} | {lv['Prin']} | {status} |")
    new_tracks_inner = "\n".join(klines) + "\n"

    # splice back (tracks table comes before terms table in the file)
    head0, tracks_inner, after0 = section(txt, "TRACKS-TABLE-START", "TRACKS-TABLE-END")
    txt2 = head0 + new_tracks_inner + after0
    head1, terms_inner, after1 = section(txt2, "TERMS-TABLE-START", "TERMS-TABLE-END")
    txt2 = head1 + new_terms_inner + after1

    # invariant self-check
    bad = [r["term"] for r in out_rows if r["jds"] != len(r["seen"])]
    assert not bad, f"jds mismatch: {bad}"
    assert len(set(r["term"].lower() for r in out_rows)) == len(out_rows), "duplicate term"

    with open(MD, "w") as f:
        f.write(txt2)

    # report
    from collections import Counter
    dist = Counter(r["status"] for r in out_rows)
    print(f"rows={len(out_rows)} tracks={len(cov)}")
    print("status:", dict(dist))
    new = len([r for r in out_rows if r["term"].lower() in batch_labels and r["term"].lower() not in existing])
    upd = len([r for r in out_rows if r["term"].lower() in batch_labels and r["term"].lower() in existing])
    print(f"new={new} updated={upd}")
    top = sorted(out_rows, key=lambda r: -r["jds"])[:12]
    print("top demand:", [(r["term"], r["jds"]) for r in top])

if __name__ == "__main__":
    main()
