# Adds the shading and texture back to the Prionosuchus's rig (the part pictures inside a rigger project JSON, tools/rigger/prionosuchus/).
# The rig's parts are flat base colors, so the animal lost what tools/pixelprio_shade.py gives the strips: this runs that script's rules (a lit edge along the back, the snout and the tail's top,
# shadow under the flank, the belly, the jaw and the tail) over each part in its own frame, since parts turn with the animal. Edges that sit on a joint (the body's right edge under the head,
# the tail's root) are left alone, so no seam shows when a part turns. The near legs (body colored) get a lit left edge and a shaded right one; the far (dark) legs and the feet stay flat.
# Spots, eye and nostril are left exactly as they are, and every pixel keeps its place. Shaded colors are read back to their base colors first, so running it again gives the same result.
# Usage: python3 -I tools/pixelprio_rig_shade.py IN.json [OUT.json]   (gen-clips.js runs it on the flat rig, tools/rigger/prionosuchus/prionosuchus-rig.json)
import sys, os, io, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from pixelprio_shade import BASE, ALL, ROOT, REV

def shade_part(grid, name):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]
    head, jaw, leg = "HEAD" in name, "JAW" in name, "LEGS" in name
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c not in BASE: continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c
            if jaw:                                                    # a thin strip under the head: only its underside is in shade
                if dn is None: n = "bodylo"
            elif leg:                                                  # near legs: a lit left edge, a shaded right one
                if c == "body":
                    if lf is None: n = "bodyhi"
                    elif rt is None: n = "bodylo"
            elif c == "body":
                if up in (None, "tail"): n = "bodyhi"                                                  # a clean lit edge along the back and the snout
                elif dn in ("belly", None, "jaw") or (head and rt is None): n = "bodylo"                # one band of shade where the flank turns under (and at the snout tip)
            elif c == "tail":
                if up is None: n = "tailhi"
                elif dn is None or (dn in ("body", "bodylo") and rt in ("body", "bodyhi", "bodylo")): n = "taillo"
            elif c == "belly":
                if dn is None: n = "bellylo"
            elif c == "jaw":
                if dn is None: n = "jawlo"
            if n != c: out[y][x] = n
    return out

def main(src, dst):
    proj = json.load(open(src)); done = {}
    for n in proj["nodes"]:
        nm, a = n["name"].upper(), n["asset"]
        if "FEET" in nm or "BEHIND" in nm or a in done: continue    # feet are a few pixels and the far legs are the dark ones: left flat
        im = Image.open(io.BytesIO(base64.b64decode(proj["assets"][a].split(",", 1)[1]))).convert("RGBA"); px = im.load()
        grid = [[None] * im.width for _ in range(im.height)]
        for y in range(im.height):
            for x in range(im.width):
                r, gg, b, al = px[x, y]
                if al: k = REV.get((r, gg, b)); grid[y][x] = ROOT.get(k, k) if k else (r, gg, b)       # spots, eye and nostril stay as they are
        res = shade_part(grid, nm)
        out = Image.new("RGBA", im.size, (0, 0, 0, 0)); chg = tot = 0
        for y in range(im.height):
            for x in range(im.width):
                c = res[y][x]
                if c is None: continue
                out.putpixel((x, y), (ALL[c] if isinstance(c, str) else c) + (255,)); tot += 1; chg += c != grid[y][x]
        for y in range(im.height):
            for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
        buf = io.BytesIO(); out.save(buf, "PNG"); proj["assets"][a] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(); done[a] = 1
        print(f"{n['name']}: {tot} pixels, {chg} shaded")
    proj["shaded"] = "pixelprio_rig_shade"
    json.dump(proj, open(dst, "w"), separators=(",", ":"))

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "rigger", "prionosuchus", "prionosuchus-rig.json")
    main(src, sys.argv[2] if len(sys.argv) > 2 else src)
