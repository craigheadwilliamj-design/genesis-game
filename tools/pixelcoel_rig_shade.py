# Adds the flat-style shading, texture and detail to the Coelophysis's rig (the part pictures inside a rigger project JSON, tools/rigger/coelophysis/), keeping its colors, shape and stripes.
# Every pixel keeps its own color family: nothing is recolored, a pixel is only made a step lighter or darker than it already is, so the rust hide, the paler dorsal stripes and the orange belly stay where they were painted.
# On top it adds what the other rigs have: a lit top and left edge (light comes from the top left), shade where the flank turns under, along the belly's lower edge and on the right side,
# a lit left edge on each dorsal stripe, short scale dashes on the lower flank and the thigh, ventral bands across the belly, a shaded throat and lower jaw, and claws with a shaded right edge.
# Parts turn with the animal, so every part is shaded in its own frame. Far limbs and the eye stay as painted, and edges that sit on a joint (the neck's and tail's ends) are left alone, so no seam shows when a part turns.
# It refuses a project it already shaded. Usage: python3 -I tools/pixelcoel_rig_shade.py IN.json OUT.json   (IN is tools/rigger/coelophysis/coelophysis-rig.json, the flat parts)
import sys, io, json, base64
from PIL import Image

LIT, SHADOW, DASH, BAND = 1.2, .74, .86, .9
ROLES = {(135, 39, 10): "body", (156, 71, 25): "stripe", (227, 141, 26): "belly", (212, 192, 131): "claw", (143, 119, 50): "claw", (0, 0, 0): "eye", (255, 255, 255): "eye"}

def role(px):
    if px[3] < 128: return None
    return ROLES.get(px[:3], "body")

def tone(c, k):
    # a step lighter (k > 1) or darker (k < 1) of the same color, hue kept; light steps also lift the darkest colors a little so they show
    r, g, b = c
    if k > 1: return tuple(min(255, int(v * k + 6)) for v in (r, g, b))
    return tuple(int(v * k) for v in (r, g, b))

def shade_part(grid, cols, name):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in cols]
    if "FAR_" in name: return out                                        # far limbs stay as painted, dark behind the body
    limb = any(k in name for k in ("THIGH", "LEG", "ARM", "FOOT"))
    head, jaw, neck, tail, body = "HEAD" in name, "JAW" in name, "NECK" in name, "TAIL" in name, name.endswith("BODY")
    xs = [x for y in range(h) for x in range(w) if grid[y][x] is not None]; x0, x1 = min(xs), max(xs)
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c is None or c == "eye": continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); k = None
            joint_end = (tail and x >= x1 - 1) or (neck and (y == h - 1 or x <= x0)) or ("TAIL_END" in name and x >= x1 - 1)
            if c == "claw": k = SHADOW + .1 if rt is None else None      # the claws: a shaded right edge
            elif joint_end: k = None
            elif c == "belly":
                if jaw: k = .88 if dn is None and up == "belly" else 1.08 if up is None else None
                elif dn is None and up == "belly": k = .84                # the belly's lower edge turns under (a one-pixel orange line stays as painted)
                elif up not in ("belly", None) and not neck: k = 1.08     # where the belly meets the flank, lit
                elif body and x % 3 == 1: k = BAND                        # ventral bands
                elif neck and rt is None: k = SHADOW + .1                 # the throat's far side
            elif c == "stripe":
                if lf not in ("stripe", None) and up == "stripe": k = 1.1  # each stripe lit on its left edge
                elif dn == "body" and rt == "body" and lf == "stripe": k = .9   # and a step darker at its foot
            else:                                                         # the rust hide
                if limb:
                    if lf is None or up is None: k = 1.12                 # a lit left and top edge
                    elif rt is None or dn is None: k = SHADOW             # a shaded right and lower edge
                    elif "THIGH" in name and y % 3 == 1 and (x + y // 3) % 4 < 2: k = DASH   # rows of short scale dashes
                elif head:
                    if up is None: k = LIT
                    elif dn is None: k = SHADOW
                    elif rt is None: k = SHADOW + .08
                elif up is None: k = 1.12                                 # a lit back
                elif dn is None or dn == "belly": k = SHADOW + .06        # shade where the flank turns under
                elif neck and rt in ("belly", None): k = SHADOW + .1
                elif body and up == "body" and dn == "body" and not any(g(x, yy) == "stripe" for yy in range(y)) and y % 2 == 1 and (x + y) % 5 < 2: k = DASH   # short scale dashes on the lower flank, under the stripes
            if k: out[y][x] = tone(cols[y][x], k)
    return out

def main():
    src, dst = sys.argv[1], sys.argv[2]
    proj = json.load(open(src))
    if proj.get("shaded") == "pixelcoel_rig_shade": sys.exit("already shaded: run it on tools/rigger/coelophysis/coelophysis-rig.json")
    names = {n["asset"]: n["name"] for n in proj["nodes"]}
    for aid, data in proj["assets"].items():
        if aid not in names: continue
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
    proj["shaded"] = "pixelcoel_rig_shade"
    json.dump(proj, open(dst, "w"), separators=(",", ":"))
    print("shaded", len(names), "parts ->", dst)

if __name__ == "__main__": main()
