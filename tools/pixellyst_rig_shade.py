# Adds the flat-style shading, texture and detail to the Lystrosaurus's rig (the part pictures inside a rigger project JSON, tools/rigger/lystrosaurus/), keeping its colors, shape and blotches.
# Every pixel keeps its own color family: nothing is recolored, a pixel is only made a step lighter or darker than it already is, so the olive hide, the tan-ringed brown blotches and the pale belly stay where they were painted.
# On top it adds what the other rigs have: a lit top and left edge (light comes from the top left), shade where the flank turns under, along the belly's lower edge and on the right side, rows of short scale dashes on the flank and the thighs,
# a lit rim on the upper-left of each blotch and a shaded lower-right, ventral bands across the belly, a lit crown and shaded jaw on the head, and a shaded sole on each foot.
# Parts turn with the animal, so every part is shaded in its own frame. Far limbs and the eye stay as painted, and edges that sit on a joint (the top of a thigh, the ends of a leg) are left alone, so no seam shows when a part turns.
# It refuses a project it already shaded. Usage: python3 -I tools/pixellyst_rig_shade.py IN.json OUT.json   (IN is a project whose parts are flat, like tools/rigger/lystrosaurus/lystrosaurus-clips.json)
import sys, io, json, base64
from PIL import Image

LIT, SHADOW, DASH, BAND = 1.16, .76, .88, .9
ROLES = {(111, 111, 55): "hide", (181, 182, 94): "belly", (106, 50, 34): "blotch", (160, 123, 52): "ring", (70, 60, 32): "beak", (38, 38, 14): "beak", (205, 202, 134): "claw", (189, 182, 90): "claw", (0, 0, 0): "eye", (255, 255, 255): "eye"}

def role(px):
    if px[3] < 128: return None
    return ROLES.get(px[:3], "hide")

def tone(c, k):
    # a step lighter (k > 1) or darker (k < 1) of the same color, hue kept; light steps also lift the darkest colors a little so they show
    r, g, b = c
    if k > 1: return tuple(min(255, int(v * k + 6)) for v in (r, g, b))
    return tuple(int(v * k) for v in (r, g, b))

def shade_part(grid, cols, name):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in cols]
    if "FAR_" in name: return out                                        # far limbs stay as painted, dark behind the body
    thigh, leg, foot = "THIGH" in name, name.endswith("_LEG"), name.endswith("FOOT")
    head, jaw, body = name.endswith("HEAD"), name.endswith("JAW"), name.endswith("BODY")
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c is None or c == "eye": continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); k = None
            if c == "claw": k = SHADOW + .1 if rt is None else None      # toes and the tusk: a shaded right edge
            elif c == "beak":
                if up is None: k = 1.25 if cols[y][x] == (70, 60, 32) else 1.8   # the beak's crown, lit
                elif dn is None or rt is None: k = .8
            elif c == "belly":
                if jaw: k = .88 if dn is None else 1.08 if up is None else None
                elif dn is None and up == "belly": k = .84                # the belly's lower edge turns under (a one-pixel line stays as painted)
                elif up not in ("belly", None): k = 1.08                  # where the belly meets the flank, lit
                elif body and x % 3 == 1: k = BAND                        # ventral bands
            elif c == "blotch":
                if lf not in ("blotch", "ring") and up not in ("blotch", "ring"): k = 1.12     # a blotch's lit upper-left
                elif rt in ("hide", None) and dn in ("hide", None): k = .86                    # and a shaded lower-right
            elif c == "ring":
                if up == "hide" and lf == "hide": k = 1.1                 # the tan ring is lit where it faces the light
            else:                                                         # the olive hide
                if foot:
                    if dn is None: k = SHADOW                             # a shaded sole
                    elif lf is None: k = 1.1
                elif thigh or leg:
                    if lf is None: k = LIT                                # a lit left edge
                    elif rt is None: k = SHADOW                           # a shaded right edge
                    elif thigh and y % 3 == 1 and (x + y // 3) % 4 < 2: k = DASH   # rows of short scale dashes
                elif jaw: k = None
                elif head:
                    if up is None: k = LIT
                    elif dn is None: k = SHADOW
                    elif rt is None or dn == "beak": k = SHADOW + .08
                elif up is None: k = LIT                                  # a lit back
                elif g(x, y - 2) is None: k = 1.08                        # and a second lit row
                elif dn is None or dn == "belly": k = SHADOW + .08        # shade where the flank turns under
                elif g(x, y + 2) in ("belly", None) and (x + y) % 2 == 0: k = .92   # a broken second shade row above it
                elif body and "blotch" not in (up, dn, lf, rt) and y % 3 == 1 and (x + 2 * (y // 3)) % 5 < 2: k = DASH   # staggered rows of short scale dashes
            if k: out[y][x] = tone(cols[y][x], k)
    return out

def main():
    src, dst = sys.argv[1], sys.argv[2]
    proj = json.load(open(src))
    if proj.get("shaded") == "pixellyst_rig_shade": sys.exit("already shaded: run it on the flat project (tools/rigger/lystrosaurus/lystrosaurus-clips.json)")
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
    proj["shaded"] = "pixellyst_rig_shade"
    json.dump(proj, open(dst, "w"), separators=(",", ":"))
    print("shaded", len(names), "parts ->", dst)

if __name__ == "__main__": main()
