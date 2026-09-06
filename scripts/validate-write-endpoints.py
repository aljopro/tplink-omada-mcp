#!/usr/bin/env python3
"""Check every write method's HTTP verb + path against the bundled OpenAPI specs.

Run from anywhere:  python3 scripts/validate-write-endpoints.py

Exists because 13 of 31 ported write methods called verbs or paths the API
does not expose - they compiled, registered, and returned 405 at runtime.
See docs/PORTING-NOTES.md."""
import glob
import json
import os
import re

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- build the set of (METHOD, normalised path) the controller actually offers
# Prefer the live spec pulled from a real controller - it carries ~640 more
# paths than the bundled docs, which is why updateSwitchPort looked broken when
# it was in fact correct. Refresh it with:
#   curl -sk https://<controller>/v3/api-docs/00%20All -o docs/openapi-live/<name>.json
SPEC_GLOBS = [f"{R}/docs/openapi-live/*.json", f"{R}/docs/openapi/*.json"]

valid = set()
for f in [p for g in SPEC_GLOBS for p in glob.glob(g)]:
    try:
        d = json.load(open(f))
    except Exception:
        continue
    for path, ops in (d.get("paths") or {}).items():
        # strip the /openapi/vN/{omadacId} prefix that buildOmadaPath adds
        p = re.sub(r"^/openapi/v\d+/\{omadacId\}", "", path)
        p = re.sub(r"\{[^}]+\}", "{}", p)
        for meth in ops:
            if meth.lower() in ("get", "put", "post", "patch", "delete"):
                valid.add((meth.upper(), p))

# --- extract what each ported method calls ---------------------------------
def norm(tpl):
    # `${encodeURIComponent(x)}` -> {}
    s = re.sub(r"\$\{[^}]*\}", "{}", tpl)
    return s

findings = []
for src in ("action.ts", "switch.ts", "network.ts", "client.ts", "generic.ts"):
    fp = f"{R}/src/omadaClient/{src}"
    if not os.path.exists(fp):
        continue
    text = open(fp).read()
    for m in re.finditer(
        r"public\s+async\s+([a-zA-Z][A-Za-z0-9_]*)\s*\([^)]*\)[^{]*\{(.*?)\n    \}",
        text, re.S):
        name, body = m.group(1), m.group(2)
        if not re.match(r"^(set|update|create|delete|block|unblock|reconnect|reboot|adopt|start|batch)", name):
            continue
        pm = re.search(r"buildPath\(\s*`([^`]+)`", body)
        if not pm:
            continue
        path = norm(pm.group(1))
        # RequestHandler exposes get/post/put/patch/delete helpers as well as the
        # generic request({method}). Miss one of these and correct code reads as
        # a mismatch - setClientRateLimit did exactly that until .patch was added.
        hm = re.search(r"this\.request\.(post|put|patch|delete|get)\b", body)
        if hm:
            meth = hm.group(1).upper()
        else:
            mm = re.search(r"method:\s*'([A-Z]+)'", body)
            meth = mm.group(1) if mm else "?"
        ok = (meth, path) in valid
        alt = sorted(mth for (mth, p) in valid if p == path) if not ok else []
        findings.append((src, name, meth, path, ok, alt))

bad = [f for f in findings if not f[4]]
print(f"  checked {len(findings)} ported write methods against the spec")
print(f"  MISMATCHED: {len(bad)}\n")
for src, name, meth, path, ok, alt in bad:
    print(f"    {name}  ({src})")
    print(f"      calls    : {meth} {path}")
    if alt:
        print(f"      spec has : {', '.join(alt)} on that exact path")
    else:
        # look for near misses
        near = sorted({p for (mth, p) in valid if path.rstrip('/') in p or p.startswith(path.rstrip('/'))})[:4]
        print(f"      spec has : nothing on that path")
        for n in near:
            ms = sorted(mth for (mth, p) in valid if p == n)
            print(f"                 candidate: {'/'.join(ms)} {n}")
    print()

good = [f for f in findings if f[4]]
if good:
    print(f"  OK ({len(good)}):")
    for src, name, meth, path, ok, alt in good:
        print(f"    {name:<32} {meth} {path}")
