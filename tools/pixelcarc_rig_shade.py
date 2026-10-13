# Adds the flat-style shading and texture to the Carcharodontosaurus's rig (the part pictures inside a rigger project JSON, tools/rigger/carcharodontosaurus/).
# The rig's parts are flat base colors (slate hide, pale belly, dark back markings), so this gives them what the Dimetrodon has: a lit top edge (light comes from the top left),
# shadow under the flank, the tail, the jaw and the neck, rows of short dashes for scales, and a ribbed belly. Parts turn with the animal, so every part is shaded in its own frame.
# Limbs get a lit left edge and a shaded right one; the far (dark) limbs and the feet stay flat. Back markings, eye and nostril are left exactly as they are, and every pixel keeps its place.
# Edges that sit on a joint (the tail's root, the neck's ends) are left alone, so no seam shows when a part turns. It refuses a project it already shaded.
# Usage: python3 -I tools/pixelcarc_rig_shade.py IN.json [OUT.json]   (gen-clips.js runs it on the flat rig, tools/rigger/carcharodontosaurus/carcharodontosaurus-rig.json)
import sys, os, io, json, base64
from PIL import Image

BASE = {"body": (97, 107, 118), "belly": (206, 206, 206), "dark": (33, 48, 64), "far": (62, 68, 77), "farlt": (150, 150, 150), "hi": (118, 131, 142)}
SHADE = {"bodyhi": (121, 134, 146), "bodylo": (76, 85, 96), "scale": (86, 96, 107), "bellylo": (166, 172, 180), "bellyhi": (226, 228, 230), "rib": (184, 189, 196)}
ALL = {**BASE, **SHADE}
REV = {v: k for k, v in BASE.items()}

def shade_part(grid, name):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]
    limb = "THIGH" in name or "LEG" in name or "FOREARM" in name
    jaw, head, tail, neck = "JAW" in name, "HEAD" in name, "TAIL" in name, "NECK" in name
    # joint edges: the tail's left end (where it joins the body), the neck's ends, the body's ends under the neck and tail
    xs = [x for y in range(h) for x in range(w) if grid[y][x] is not None]; x0, x1 = min(xs), max(xs)
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c not in ("body", "belly"): continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c
            if jaw:                                                    # a thin strip under the head: lit along its top, shaded underneath
                if dn is None: n = "bellylo"
                elif up is None: n = "bellyhi"
            elif limb:
                if c == "body":
                    if lf is None: n = "bodyhi"                        # a lit left edge, every row
                    elif rt is None: n = "bodylo"                      # a shaded right edge
                elif c == "belly" and rt is None: n = "bellylo"
            elif c == "body":
                if up is None: n = "bodyhi"                            # a clean lit edge along the back, the snout and the tail's top
                elif dn is None or (dn == "belly" and head): n = "bodylo"    # shade where the flank turns under
                elif head and rt is None: n = "bodylo"
                elif (not head) and y % 3 == 1 and ((x + 2 * (y // 3)) % 4) < 2 and up != "dark" and dn != "dark": n = "scale"   # rows of short dashes
            elif c == "belly":
                if dn is None: n = "bellylo"                           # the underside is in shade
                elif up in ("body", "dark", None) and not head: n = "bellyhi"   # a lit line where the belly meets the flank
                elif x % 3 == 1 and not head and dn == "belly" and not tail and not neck: n = "rib"    # belly ribs: short grooves
                elif tail and dn is None: n = "bellylo"
            if n != c: out[y][x] = n
    return out

def main(src, dst):
    proj = json.load(open(src))
    if proj.get("shaded"): sys.exit(f"{src} is already shaded; shade the flat rig")
    for n in proj["nodes"]:
        nm, a = n["name"].upper(), n["asset"]
        if "FOOT" in nm or "FAR" in nm: continue                       # feet are a few pixels and the far limbs are the dark ones: left flat
        im = Image.open(io.BytesIO(base64.b64decode(proj["assets"][a].split(",", 1)[1]))).convert("RGBA"); px = im.load()
        grid = [[None] * im.width for _ in range(im.height)]
        for y in range(im.height):
            for x in range(im.width):
                r, gg, b, al = px[x, y]
                if al: k = REV.get((r, gg, b)); grid[y][x] = k if k else (r, gg, b)   # markings, eye and nostril stay as they are
        res = shade_part(grid, nm)
        out = Image.new("RGBA", im.size, (0, 0, 0, 0)); chg = tot = 0
        for y in range(im.height):
            for x in range(im.width):
                c = res[y][x]
                if c is None: continue
                out.putpixel((x, y), (ALL[c] if isinstance(c, str) else c) + (255,)); tot += 1; chg += c != grid[y][x]
        for y in range(im.height):
            for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
        buf = io.BytesIO(); out.save(buf, "PNG"); proj["assets"][a] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        print(f"{n['name']}: {tot} pixels, {chg} shaded")
    proj["shaded"] = "pixelcarc_rig_shade"
    json.dump(proj, open(dst, "w"), separators=(",", ":"))

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "rigger", "carcharodontosaurus", "carcharodontosaurus-rig.json")
    main(src, sys.argv[2] if len(sys.argv) > 2 else src)
