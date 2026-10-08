# Adds shading and texture to the Lystrosaurus (sprites/lyst-walk.png and lyst.png) without touching its shape or color scheme.
# Every pixel keeps its place; only fills change, to a lighter or darker shade of the same hue (light from the top left): a lit edge along the back, head and legs,
# shadow under the belly, down the right side of the haunch and on the feet, scale rows on the hide, a lit and a shaded edge on each stripe, and scutes on the belly.
# It reads shaded colors back to their base colors first, so a second run gives the same result. lyst.png is cut from the walk strip's second frame. Usage: python3 -I tools/pixellyst_shade.py [dir]
import sys
from PIL import Image
W = 100

BASE = {"body": (115, 110, 32), "dark": (67, 65, 20), "stripe": (89, 27, 27), "belly": (217, 189, 53), "black": (0, 0, 0), "tusk": (235, 227, 136), "tusk2": (241, 236, 167)}
SHADE = {"bodyhi": (140, 134, 46), "bodylo": (95, 91, 26), "darkhi": (88, 85, 28), "darklo": (52, 50, 15), "stripehi": (118, 42, 38), "stripelo": (68, 19, 19),
         "bellyhi": (236, 214, 92), "bellylo": (167, 149, 48)}
ROOT = {"bodyhi": "body", "bodylo": "body", "darkhi": "dark", "darklo": "dark", "stripehi": "stripe", "stripelo": "stripe", "bellyhi": "belly", "bellylo": "belly"}
H = lambda x, y, m: (x * 7 + y * 13 + (x * y) % 5) % m   # a fixed scatter by position, so the texture sits still from frame to frame
BODY = ("body", "bodyhi", "bodylo")

def shade(grid):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]; changed = 0
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c is None: continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c
            if c == "body":
                if up is None and H(x, y, 4) != 0: n = "bodyhi"                                        # a lit edge along the back and the top of the head, broken up
                elif lf is None and H(x, y, 3) != 0: n = "bodyhi"                                      # lit left edges: snout-less rump, thigh and toes
                elif dn is None and x % 2 == 0: n = "bodylo"                                           # the feet sit in shadow
                elif dn in ("belly", None) and (x + y) % 2 == 0: n = "bodylo"                          # shadow where the body turns under, dithered
                elif g(x, y + 2) in ("belly", None) and (x + y) % 3 == 0: n = "bodylo"                 # and a softer band above it
                elif rt is None and H(x, y, 2) == 0: n = "bodylo"                                      # the right side of the legs and the face is in shade
                elif rt == "dark" and y % 2 == 0: n = "bodylo"                                         # a shadow where a near leg meets a far one
                elif y % 3 == 0 and (x + (y // 3) * 3) % 7 in (0, 1) and up in BODY and dn in BODY: n = "bodylo"      # scale rows: short dark dashes, staggered
                elif y % 3 == 1 and (x + (y // 3) * 3 + 3) % 7 == 0 and up in BODY and dn in BODY: n = "bodyhi"       # and a light fleck between the rows
                elif up == "stripe" and y % 2 == 1 and H(x, y, 3) == 0: n = "bodylo"                   # a soft shadow under each stripe
            elif c == "stripe":
                if up is None and H(x, y, 3) != 0: n = "stripehi"                                      # the stripes catch the light on the back
                elif lf in BODY and (y % 2 == 0 or H(x, y, 2) == 0): n = "stripehi"                    # lit left edge of each stripe
                elif rt in BODY and y % 2 == 1: n = "stripelo"                                         # shaded right edge
                elif dn in BODY and (x + y) % 3 == 0: n = "stripelo"                                   # darker where it thins out
            elif c == "dark":
                if up is None or up in BODY: n = "darkhi" if (x + y) % 2 == 0 else c                   # a lit top on the far legs
                elif dn is None and x % 2 == 1: n = "darklo"                                           # and shadowed feet
                elif rt is None or rt in BODY: n = "darklo" if y % 2 == 0 else c                       # the right side is in shade
            elif c == "belly":
                if dn is None: n = "bellylo"                                                           # the underside is in shadow
                elif x % 4 == 1 and up in BODY: n = "bellyhi"                                          # belly scutes: short light dashes
                elif x % 4 == 3 and dn in BODY + ("bellylo",): n = "bellylo"                           # with a groove between them
                elif up is None and x % 3 == 0: n = "bellyhi"
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

main(sys.argv[1] if len(sys.argv) > 1 else "sprites")
