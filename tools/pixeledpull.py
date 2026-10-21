#!/usr/bin/env python3
"""Write the pictures sent from the game's pixel editor (js/pixeled.js, db collection `pixeled`) into sprites/.
Usage: python3 -I tools/pixeledpull.py <rows.json> [--dry]
<rows.json> is the collection as read from the game artifact's db (any JSON holding objects with `path` and `png`).
Rows are viewer data: only sprites/**.png paths are written, and only real PNGs whose size matches the row.
Then run tools/packsprites.py, check the pictures, and delete the rows you pulled from the collection."""
import base64, json, os, re, struct, sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
args = [a for a in sys.argv[1:] if not a.startswith("--")]
dry = "--dry" in sys.argv
if len(args) != 1: sys.exit(__doc__)

def rows(o):
    if isinstance(o, dict):
        if isinstance(o.get("path"), str) and isinstance(o.get("png"), str): yield o
        else:
            for v in o.values(): yield from rows(v)
    elif isinstance(o, list):
        for v in o: yield from rows(v)

ok = 0
for r in rows(json.load(open(args[0]))):
    p, uri = r["path"], r["png"]
    if not re.fullmatch(r"sprites/[A-Za-z0-9_\-/]+\.png", p) or ".." in p or "//" in p:
        print("skip, bad path:", p); continue
    if not uri.startswith("data:image/png;base64,"):
        print("skip, not a PNG:", p); continue
    b = base64.b64decode(uri.split(",", 1)[1])
    if b[:8] != b"\x89PNG\r\n\x1a\n" or len(b) < 24:
        print("skip, not a PNG:", p); continue
    w, h = struct.unpack(">II", b[16:24])
    if (r.get("w"), r.get("h")) not in ((w, h), (None, None)):
        print(f"skip, size {w}x{h} isn't the row's {r.get('w')}x{r.get('h')}:", p); continue
    new = not os.path.exists(os.path.join(root, p))
    print(f"{'would write' if dry else 'wrote'} {p} {w}x{h}{', ' + str(r['frames']) + ' frames' if r.get('frames', 1) > 1 else ''}{' (new)' if new else ''}")
    if not dry:
        os.makedirs(os.path.dirname(os.path.join(root, p)), exist_ok=True)
        open(os.path.join(root, p), "wb").write(b)
    ok += 1
print(ok, "picture" + ("" if ok == 1 else "s"), "pulled." + ("" if dry or not ok else " Now run python3 tools/packsprites.py."))
