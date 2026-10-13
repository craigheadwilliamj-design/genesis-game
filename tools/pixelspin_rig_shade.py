# Adds the flat-style shading, texture and detail to the Spinosaurus's rig (the part pictures inside a rigger project JSON, tools/rigger/spinosaurus/), keeping its colors.
# Every pixel keeps its own color family: nothing is recolored, a pixel is only made a step lighter or darker than it already is. On top of the hand-painted hide it adds what the other rigs have:
# a lit top and left edge (light comes from the top left), shade under the flank, the belly, the jaw and on the right side, rows of short scute dashes, dark osteoderm studs along the back's top edge,
# ventral bands on the belly, and a lit left edge on each sail stripe. Parts turn with the animal, so every part is shaded in its own frame. Far limbs, the eye, the claws and the head's crest stay as painted,
# and edges that sit on a joint (the tail's ends, the neck's ends) are left alone, so no seam shows when a part turns.
# It refuses a project it already shaded. Usage: python3 -I tools/pixelspin_rig_shade.py IN.json OUT.json   (IN is tools/rigger/spinosaurus/spinosaurus-source.json)
import sys, io, json, base64
from PIL import Image

CREAM = {(208, 206, 173), (118, 119, 78), (154, 155, 102)}
LIT, SHADOW, DASH, BAND_BELLY = 1.2, .74, .86, .9

def role(px):
    r, g, b, a = px
    if a < 128: return None
    c = (r, g, b)
    if c in ((255, 255, 255), (0, 0, 0)): return "eye"
    if c == (223, 115, 44): return "orange"
    if c in CREAM: return "belly"
    if r <= 10 and g <= 30: return "dark"
    return "body"

# the hide's own colors, darkest to lightest, and the belly's: shading steps a pixel along its ramp, so light and shade use colors already in the picture
HIDE = [(7, 17, 12), (8, 29, 18), (51, 67, 26), (76, 100, 38), (115, 118, 22), (167, 170, 30)]
BELLY = [(118, 119, 78), (154, 155, 102), (208, 206, 173)]

def step(c, n):
    for ramp in (HIDE, BELLY):
        if c in ramp: return ramp[max(0, min(len(ramp) - 1, ramp.index(c) + n))]
    return tone(c, 1.2 if n > 0 else .74)

def tone(c, k):
    # a step lighter (k > 1) or darker (k < 1) of the same color, hue kept; light steps also lift the darkest colors a little so they show
    r, g, b = c
    if k > 1: r, g, b = (min(255, int(v * k + 6)) for v in (r, g, b))
    else: r, g, b = (int(v * k) for v in (r, g, b))
    return (r, g, b)

def despeckle(grid, cols, name):
    # lone single pixels in the hide's mottle (no side neighbor of the same color, three or four sides one other color) take that color: blotches stay, the sandpaper goes
    if "FAR_" in name: return cols
    h, w = len(grid), len(grid[0]); out = [row[:] for row in cols]
    for y in range(h):
        for x in range(w):
            if grid[y][x] not in ("body", "dark") or cols[y][x] not in HIDE: continue
            nb = [cols[yy][xx] for xx, yy in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)) if 0 <= xx < w and 0 <= yy < h and grid[yy][xx] in ("body", "dark")]
            if len(nb) < 4 or cols[y][x] in nb: continue
            top = max(set(nb), key=nb.count)
            if nb.count(top) >= 3: out[y][x] = top
    return out

def shade_part(grid, cols, name):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in cols]
    if "FAR_" in name: return out                                        # far limbs stay as painted
    limb = any(k in name for k in ("THIGH", "LEG", "ARM", "HAND", "FOOT"))
    head, jaw, tail, neck, body = "HEAD" in name, "JAW" in name, "TAIL" in name or "TAL_" in name, "NECK" in name, name.endswith("BODY")
    xs = [x for y in range(h) for x in range(w) if grid[y][x] is not None]; x0, x1 = min(xs), max(xs)
    oy = [y for y in range(h) for x in range(w) if grid[y][x] == "orange"]; sail_y = max(oy) if oy and body else -1
    hide = lambda x, y: g(x, y) in ("body", "dark") and y > sail_y
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c is None or c == "eye": continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); base = cols[y][x]; k = None
            joint_end = (tail and (x >= x1 - 1 or ("TAL_" in name and x >= x1 - 2))) or (neck and (x <= x0 + 1 or x >= x1 - 1))
            if body and y <= sail_y:                                     # the sail: each orange stripe lit on its left edge, its foot a step darker; the membrane stays
                if c == "orange":
                    if lf != "orange": k = LIT
                    elif y == sail_y or dn != "orange": k = SHADOW
            elif c == "orange": continue                                  # the crest
            elif joint_end: k = None
            elif c == "belly":
                if limb: k = SHADOW if rt is None else None              # the claws: a shaded right edge
                elif jaw: k = SHADOW if dn is None else 1.07 if up is None else None
                elif dn is None or dn != "belly": k = SHADOW + .06        # under the belly's lower edge
                elif up != "belly": k = 1.08                              # lit where it meets the flank
                elif not neck and x % 3 == 0: k = BAND_BELLY              # ventral scales, side on: short upright bands
            elif limb:
                if lf is None or up is None: n = 1 if base in HIDE[:3] else 0   # a lit left and top edge (the dark marks lift; the greens are light enough)
                elif rt is None or dn is None: n = -1                     # a shaded right and lower edge
                elif y % 3 == 0: n = -1 if base in HIDE[3:] else 0        # scale bands round the limb
                else: n = 0
                if n: out[y][x] = step(base, n)
            else:
                # form shading on the hide: rows down from the top edge and up from the lower edge in each column, stepped along the hide's ramp
                t = 0
                while hide(x, y - t - 1): t += 1
                b = 0
                while hide(x, y + b + 1): b += 1
                n = 0
                top = not (body and y <= sail_y + 1)
                if head or jaw:
                    if t == 0 and not jaw: n = 1
                    elif b == 0: n = -1
                    elif rt is None: n = -1
                elif t == 0 and top: n = 2 if (x // 2) % 3 == 0 else 1     # a lit dorsal line in a rhythm of scutes
                elif b == 0: n = -1                                        # the flank turns under
                elif b == 1 and base in HIDE[3:]: n = -1                   # a band of shade above it (the light mottle dims)
                elif rt is None: n = -1                                    # the right side away from the light
                elif t == 1 and top and base in HIDE[:2]: n = 1            # light falls on the upper flank
                if n: out[y][x] = step(base, n)
            if k: out[y][x] = tone(base, k)
    return out

def main():
    src, dst = sys.argv[1], sys.argv[2]; clean = "--clean" in sys.argv[3:]
    proj = json.load(open(src))
    if proj.get("shaded") == "pixelspin_rig_shade": sys.exit("already shaded: run it on tools/rigger/spinosaurus/spinosaurus-source.json")
    names = {n["asset"]: n["name"] for n in proj["nodes"]}
    for aid, data in proj["assets"].items():
        im = Image.open(io.BytesIO(base64.b64decode(data.split(",", 1)[1]))).convert("RGBA"); px = im.load()
        box = im.getchannel("A").point(lambda v: 255 if v >= 128 else 0).getbbox()
        if not box: continue
        X0, Y0, X1, Y1 = box
        grid = [[role(px[X0 + x, Y0 + y]) for x in range(X1 - X0)] for y in range(Y1 - Y0)]
        cols = [[px[X0 + x, Y0 + y][:3] for x in range(X1 - X0)] for y in range(Y1 - Y0)]
        if clean: cols = despeckle(grid, cols, names[aid])
        res = shade_part(grid, cols, names[aid])
        for y in range(Y1 - Y0):
            for x in range(X1 - X0):
                if grid[y][x] is not None: px[X0 + x, Y0 + y] = tuple(res[y][x]) + (px[X0 + x, Y0 + y][3],)
        buf = io.BytesIO(); im.save(buf, "PNG"); proj["assets"][aid] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    proj["shaded"] = "pixelspin_rig_shade"
    json.dump(proj, open(dst, "w"), separators=(",", ":"))
    print("shaded", len(proj["assets"]), "parts ->", dst)

if __name__ == "__main__": main()
