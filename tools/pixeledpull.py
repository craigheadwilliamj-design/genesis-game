#!/usr/bin/env python3
"""Write the pictures sent from the game's pixel editor (js/pixeled.js, db collection `pixeled`) into sprites/.
Usage: python3 -I tools/pixeledpull.py <rows.json> [--dry]
<rows.json> is the collection as read from the game artifact's db (any JSON holding objects with `path` and `png`).
Rows are viewer data: only sprites/**.png paths are written, and only real PNGs whose size matches the row.
Then run tools/packsprites.py, check the pictures, and mark the rows you pulled (update: pulled = the time, png deleted); deleting them would make Send all drafts send them again."""
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
    f = r.get("foot")   # a footprint dragged in the editor: written into that type's BUILDINGS entry in data.js
    if isinstance(f, dict) and isinstance(f.get("k"), str) and re.fullmatch(r"[A-Za-z0-9]+", f["k"]) and all(isinstance(f.get(x), (int, float)) and .5 <= f[x] <= 40 for x in "wd"):
        dp = os.path.join(root, "js", "data.js"); src = open(dp).read(); n = lambda v: ("%g" % round(v, 1))
        rx = re.compile(r"(^\s*" + f["k"] + r":\s*\{label:[^\n]*?\bw:\s*)[\d.]+(,\s*d:\s*)[\d.]+", re.M)
        if rx.search(src):
            print(f"{'would set' if dry else 'set'} {f['k']} footprint to {n(f['w'])} x {n(f['d'])} m in js/data.js")
            if not dry: open(dp, "w").write(rx.sub(lambda m: m.group(1) + n(f["w"]) + m.group(2) + n(f["d"]), src, 1))
        else: print("skip footprint, no BUILDINGS entry for", f["k"])
    bx = r.get("box")   # a plant's or rock's ground box dragged in the editor: FOOT.box in data.js (a plant is also listed in FOOT.rect, so its footW/footD are used)
    if isinstance(bx, dict) and isinstance(bx.get("n"), str) and re.fullmatch(r"[a-z0-9-]+", bx["n"]) and bx["n"] + ".png" == os.path.basename(p) and all(isinstance(bx.get(x), (int, float)) and .5 <= bx[x] <= 20 for x in "wd"):
        dp = os.path.join(root, "js", "data.js"); src = open(dp).read(); name = bx["n"]; rock = bool(re.match(r"(rock|boulder)-", name)); n = lambda v: ("%g" % (round(v) if rock else round(v * 2) / 2))
        m = re.search(r"^  box:\{([^}\n]*)\}", src, re.M)
        if m:
            cur = json.loads("{" + m.group(1) + "}") if m.group(1).strip() else {}
            cur[name] = [float(n(bx["w"])), float(n(bx["d"]))]
            line = "  box:{" + ", ".join('"%s":[%g, %g]' % (k, *v) for k, v in sorted(cur.items())) + "}"
            src = src[:m.start()] + line + src[m.end():]
            if not rock:
                rm = re.search(r"^(  rect:\[)([^\]\n]*)(\])", src, re.M)
                if rm and '"%s"' % name not in rm.group(2): src = src[:rm.start()] + rm.group(1) + (rm.group(2) + ", " if rm.group(2).strip() else "") + '"%s"' % name + rm.group(3) + src[rm.end():]
            print(f"{'would set' if dry else 'set'} {name} footprint box to {n(bx['w'])} x {n(bx['d'])} m in js/data.js")
            if not dry: open(dp, "w").write(src)
        else: print("skip footprint box, no FOOT.box line in js/data.js")
    v = re.fullmatch(r"sprites/bld/([A-Za-z0-9]+)-(front|back|left|right)\.png", p); row = r.get("base")
    if v and isinstance(row, int) and 1 <= row <= h:   # a base row dragged in the editor: a building's BLD_PICS base (sideBase on the sides) or a prop view's 4th PROP_PICS number
        k, view = v.groups(); side = view in ("left", "right"); n = 0
        mp = os.path.join(root, "js", "map.js"); src = open(mp).read()
        bx = re.compile(r"(\b" + k + r":\{w:\d+, h:\d+, base:)(\d+)(, sideBase:\d+)?")
        if bx.search(src):
            src = bx.sub(lambda m: m.group(1) + (m.group(2) + f", sideBase:{row}" if side else str(row) + (m.group(3) or "")), src, 1); n = 1
        else:
            mp = os.path.join(root, "js", "propart.js"); src = open(mp).read()
            px_ = re.compile(r"(\b" + k + r":\{[^\n]*?\b" + view + r":\[)(\d+), (\d+), ([\d.]+)(?:, \d+)?\]")
            if px_.search(src): src = px_.sub(lambda m: m.group(1) + f"{m.group(2)}, {m.group(3)}, {m.group(4)}" + ("" if row == int(m.group(3)) - 2 else f", {row}") + "]", src, 1); n = 1
        if n:
            print(f"{'would set' if dry else 'set'} {k} {view} base row to {row} in js/{os.path.basename(mp)}")
            if not dry: open(mp, "w").write(src)
        else: print(f"skip base row, no BLD_PICS or PROP_PICS entry for {k}: add one with row {row}")
print(ok, "picture" + ("" if ok == 1 else "s"), "pulled." + ("" if dry or not ok else " Now run python3 tools/packsprites.py."))
