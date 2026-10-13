# Adds the flat-style shading, texture and detail to the Spinosaurus's rig (the part pictures inside a rigger project JSON, tools/rigger/spinosaurus/), keeping its colors.
# Every pixel keeps its own color family: nothing is recolored, a pixel is only made a step lighter or darker than it already is. On top of the hand-painted hide it adds what the other rigs have:
# a lit top and left edge (light comes from the top left), shade under the flank, the belly, the jaw and on the right side, rows of short scute dashes, dark osteoderm studs along the back's top edge,
# ventral bands on the belly, and a lit left edge on each sail stripe. Parts turn with the animal, so every part is shaded in its own frame. Far limbs, the eye, the claws and the head's crest stay as painted,
# and edges that sit on a joint (the tail's ends, the neck's ends) are left alone, so no seam shows when a part turns.
# It refuses a project it already shaded. Usage: python3 -I tools/pixelspin_rig_shade.py IN.json OUT.json   (IN is tools/rigger/spinosaurus/spinosaurus-source.json)
import sys, io, json, base64
from PIL import Image

CREAM = {(208, 206, 173), (118, 119, 78), (154, 155, 102)}
LIT, SHADOW, DASH, STUD, BAND_BELLY = 1.2, .74, .86, .62, .93

def role(px):
    r, g, b, a = px
    if a < 128: return None
    c = (r, g, b)
    if c in ((255, 255, 255), (0, 0, 0)): return "eye"
    if c == (223, 115, 44): return "orange"
    if c in CREAM: return "belly"
    if r <= 10 and g <= 30: return "dark"
    return "body"

def tone(c, k):
    # a step lighter (k > 1) or darker (k < 1) of the same color, hue kept; light steps also lift the darkest colors a little so they show
    r, g, b = c
    if k > 1: r, g, b = (min(255, int(v * k + 6)) for v in (r, g, b))
    else: r, g, b = (int(v * k) for v in (r, g, b))
    return (r, g, b)

def shade_part(grid, cols, name):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in cols]
    far = "FAR_" in name
    limb = any(k in name for k in ("THIGH", "LEG", "ARM", "HAND", "FOOT"))
    head, jaw, tail, neck, body = "HEAD" in name, "JAW" in name, "TAIL" in name or "TAL_" in name, "NECK" in name, name.endswith("BODY")
    xs = [x for y in range(h) for x in range(w) if grid[y][x] is not None]; x0, x1 = min(xs), max(xs)
    oy = [y for y in range(h) for x in range(w) if grid[y][x] == "orange"]; sail_y = max(oy) if oy and body else -1
    if far: return out                                                   # far limbs stay as painted
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c is None or c == "eye": continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); base = cols[y][x]; k = None
            joint_end = (tail or neck) and (x <= x0 + 1 or x >= x1 - 1)
            if body and y <= sail_y:                                     # the sail: each orange stripe lit on its left edge, its foot a step darker; the dark membrane stays
                if c == "orange":
                    if lf != "orange": k = LIT
                    elif y == sail_y or dn != "orange": k = SHADOW
            elif c == "orange": continue                                  # the crest
            elif c == "belly":
                if limb: k = SHADOW if rt is None else None              # the claws: a shaded right edge
                elif jaw: k = SHADOW if dn is None else 1.07 if up is None else None
                elif joint_end: k = None
                elif dn is None or dn != "belly": k = SHADOW + .1         # under the belly's lower edge
                elif up != "belly": k = 1.07
                elif y % 2 == 0 and not neck and not tail: k = BAND_BELLY   # ventral bands
            else:                                                        # body hide and dark markings
                if jaw: k = SHADOW if dn is None else None
                elif limb:
                    if lf is None: k = LIT                                # a lit left edge, every row
                    elif rt is None or dn is None: k = SHADOW             # a shaded right edge
                    elif y % 3 == 1 and (x % 4) < 2 and c == "body": k = DASH
                elif joint_end: k = None
                elif up is None:
                    k = STUD if (x % 3 == 0 and not head and c == "body") else LIT   # a lit back edge, studded with osteoderms
                elif dn is None or (dn == "belly" and not head): k = SHADOW   # shade where the flank turns under
                elif head and rt is None: k = SHADOW
                elif y % 3 == 1 and ((x + 2 * (y // 3)) % 4) < 2 and c == "body": k = DASH   # rows of short dashes
            if k: out[y][x] = tone(base, k)
    return out

def main():
    src, dst = sys.argv[1], sys.argv[2]
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
        res = shade_part(grid, cols, names[aid])
        for y in range(Y1 - Y0):
            for x in range(X1 - X0):
                if grid[y][x] is not None: px[X0 + x, Y0 + y] = tuple(res[y][x]) + (px[X0 + x, Y0 + y][3],)
        buf = io.BytesIO(); im.save(buf, "PNG"); proj["assets"][aid] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    proj["shaded"] = "pixelspin_rig_shade"
    json.dump(proj, open(dst, "w"), separators=(",", ":"))
    print("shaded", len(proj["assets"]), "parts ->", dst)

if __name__ == "__main__": main()
