# Adds shading and texture to the Lystrosaurus (sprites/lyst-walk.png and lyst.png) without touching its shape or color scheme. It is a smooth, leathery dicynodont, so no scales:
# a rounded dither from the lit back to the shaded belly (light from the top left), creased muscle outlines at the thigh and shoulder, wrinkles at the knees and ankles, toe gaps,
# a sparse pebbly grain, soft stripes and a lit lip on the belly. Only fills change, to a lighter or darker shade of the same hue.
# It reads shaded colors back to their base colors first, so a second run gives the same result. lyst.png is cut from the walk strip's second frame. Usage: python3 -I tools/pixellyst_shade.py [dir]
import sys
from PIL import Image
W = 100

BASE = {"body": (115, 110, 32), "dark": (67, 65, 20), "stripe": (89, 27, 27), "belly": (217, 189, 53), "black": (0, 0, 0), "tusk": (235, 227, 136), "tusk2": (241, 236, 167), "eye": (177, 133, 14), "claw": (139, 139, 96)}
SHADE = {"bodyhi": (140, 134, 46), "bodylo": (95, 91, 26), "darkhi": (88, 85, 28), "darklo": (52, 50, 15), "stripehi": (118, 42, 38), "stripelo": (68, 19, 19),
         "bellyhi": (236, 214, 92), "bellylo": (167, 149, 48)}
ROOT = {"bodyhi": "body", "bodylo": "body", "darkhi": "dark", "darklo": "dark", "stripehi": "stripe", "stripelo": "stripe", "bellyhi": "belly", "bellylo": "belly"}
H = lambda x, y, m: (x * 7 + y * 13 + (x * y) % 5) % m   # a fixed scatter by position, so the texture sits still from frame to frame
BODY = ("body", "bodyhi", "bodylo")

def shade(grid):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]; changed = 0
    def run_up(x, y):   # how many pixels of animal sit straight above
        n = 0
        while g(x, y - 1 - n) is not None: n += 1
        return n
    def run_dn(x, y):   # how many body or stripe pixels sit straight below
        n = 0
        while g(x, y + 1 + n) in ("body", "stripe"): n += 1
        return n
    def ring(x, y, cx, cy, r, x0, x1, y0, y1):   # a one pixel arc of a circle, for the muscle outlines
        return x0 <= x <= x1 and y0 <= y <= y1 and abs(((x - cx) ** 2 + ((y - cy) * 1.15) ** 2) ** .5 - r) < .62
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c is None: continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c; t = run_up(x, y); bd = run_dn(x, y)
            if c in ("body", "stripe"):
                hi, lo = ("bodyhi", "bodylo") if c == "body" else ("stripehi", "stripelo")
                torso = 28 <= y <= 43 and x <= 74
                if t == 0 and H(x, y, 4) != 0: n = hi                                                  # the back and crown catch the light
                elif t == 1 and (x + y) % 2 == 0: n = hi                                               # a dithered fall-off, so the hide reads round
                elif t == 2 and H(x, y, 4) == 0: n = hi
                elif lf is None and H(x, y, 3) != 0: n = hi                                            # lit left edges
                elif c == "body" and torso and (ring(x, y, 21, 39, 13, 21, 40, 27, 47) or ring(x, y, 62, 40, 12, 49, 63, 30, 48)): n = "bodylo"   # the thigh and the shoulder, outlined by a skin crease
                elif c == "body" and torso and (ring(x, y, 20, 38, 11, 9, 32, 26, 46) or ring(x, y, 61, 39, 10, 48, 62, 29, 47)) and H(x, y, 3) == 0: n = "bodyhi"   # and lit on the bulge inside it
                elif c == "body" and 44 <= y <= 56 and y in (48, 52) and (x % 11) < 3 and H(x // 11, y, 2) == 0: n = "bodylo"   # wrinkles at the knees and ankles
                elif c == "body" and 44 <= y <= 56 and y in (49, 53) and (x % 11) < 2 and H(x // 11, y - 1, 2) == 0: n = "bodyhi"   # with a lit lip below
                elif c == "body" and y >= 54 and dn is None and x % 4 == 0: n = "bodylo"               # toe gaps
                elif bd <= 1 and dn in ("belly", None): n = lo if (x + y) % 2 == 0 or dn is None else c  # shadow where the body turns under
                elif bd == 2 and dn == "belly" and H(x, y, 3) == 0: n = lo
                elif rt is None and H(x, y, 2) == 0: n = lo                                            # the right side is in shade
                elif c == "body" and H(x, y, 17) == 0 and rt == "body": n = "bodylo"                   # fine pebbly grain: sparse pairs, not rows
                elif c == "body" and H(x, y, 17) == 5 and rt == "body": n = "bodyhi"
                elif c == "stripe" and rt in ("body", "bodylo") and y % 3 == 1: n = "stripelo"        # shaded right edge of a stripe
            elif c == "dark":
                if up is None or up in BODY: n = "darkhi" if (x + y) % 2 == 0 else c                   # a lit top on the far legs
                elif dn is None and x % 2 == 1: n = "darklo"                                           # and shadowed feet
                elif rt is None and y % 2 == 0: n = "darklo"
            elif c == "belly":
                if dn is None: n = "bellylo"                                                           # the soft underside is in shadow
                elif up in ("body", "bodyhi", "bodylo") and (x + y) % 3 != 0: n = "bellyhi"            # a lit lip where the flank rolls onto it
                elif lf is None and H(x, y, 2) == 0: n = "bellyhi"
                elif y > 45 and x % 7 == 3: n = "bellylo"                                              # one or two folds across the belly
            elif c == "tusk" and H(x, y, 2) == 0: n = "tusk2"
            if n != c: out[y][x] = n; changed += 1
    return out, changed

def run(im):
    allc = {**BASE, **SHADE}; rev = {v: k for k, v in allc.items()}; assert len(rev) == len(allc), "a shade landed on another color"
    out = Image.new("RGBA", im.size, (0, 0, 0, 0)); chg = tot = 0
    for i in range(im.width // W):
        fr = im.crop((i * W, 0, (i + 1) * W, im.height)); px = fr.load(); grid = [[None] * fr.width for _ in range(fr.height)]
        for y in range(fr.height):
            for x in range(fr.width):
                r, g_, b, a = px[x, y]
                if a: k = rev.get((r, g_, b)); assert k, (i, x, y, (r, g_, b)); grid[y][x] = ROOT.get(k, k)   # read any earlier shading back to the base color
        res, c = shade(grid); chg += c
        for y in range(fr.height):
            for x in range(fr.width):
                if res[y][x]: tot += 1; out.putpixel((i * W + x, y), allc[res[y][x]] + (255,))
    for y in range(im.height):   # the shape must be exactly where it was
        for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
    print(f"{chg} of {tot} pixels shaded ({100 * chg // max(tot, 1)}%)")
    return out

def main(d):
    path = f"{d}/lyst-walk.png"; out = run(Image.open(path).convert("RGBA")); out.save(path)
    out.crop((W, 0, 2 * W, out.height)).save(f"{d}/lyst.png")

if __name__ == "__main__": main(sys.argv[1] if len(sys.argv) > 1 else "sprites")
