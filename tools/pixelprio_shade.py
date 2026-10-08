# Adds shading and texture to Prionosuchus (sprites/prio.png, prio-walk.png, prio-idle.png, prio-swim.png) without touching its shape or its colors' hues (same idea as tools/pixelcoty_shade.py).
# Every pixel keeps its place and stays opaque or clear; only fills inside the shapes change, to a lighter or darker shade of the same color (light from the top left): a lit edge along the back,
# the snout and the tail's top, shadow under the belly and down the right side, rows of short dashes on the hide, ridges down the tail, scutes on the belly, and a lit edge on each leg.
# Spots, eye, nostril and the swim strip's water are left exactly as they are. It reads shaded colors back to their base colors first, so running it twice gives the same result.
# Usage: python3 -I tools/pixelprio_shade.py [dir]
import sys
from PIL import Image

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
W, WHITE, BLACK = 100, (255, 255, 255), (0, 0, 0)
BASE = {"body": (225, 196, 51), "tail": (89, 68, 8), "belly": (186, 143, 16), "jaw": (162, 139, 24), "leg": (175, 151, 26)}   # the colors the sprite is drawn with
HI = {"body": .22, "tail": .2, "belly": .2, "jaw": .18, "leg": .18}; LO = {"body": .2, "tail": .35, "belly": .25, "jaw": .22, "leg": .22}
SHADE = {}
for k, c in BASE.items(): SHADE[k + "hi"] = mix(c, WHITE, HI[k]); SHADE[k + "lo"] = mix(c, BLACK, LO[k])
ALL = {**BASE, **SHADE}; ROOT = {k: k[:-2] for k in SHADE}; REV = {v: k for k, v in ALL.items()}
assert len(REV) == len(ALL), "a shade landed on another color"
H = lambda x, y, m: (x * 7 + y * 13 + (x * y) % 5) % m   # a fixed scatter by position, so the texture sits still from frame to frame

def classify(im):
    px = im.load(); g = [[None] * im.width for _ in range(im.height)]
    for y in range(im.height):
        for x in range(im.width):
            r, gg, b, a = px[x, y]
            if a: k = REV.get((r, gg, b)); g[y][x] = ROOT.get(k, k) if k else (r, gg, b)   # spots, eye, nostril and water stay exactly as they are
    return g

def shade(grid):
    h, w = len(grid), len(grid[0]); g = lambda x, y: grid[y][x] if 0 <= x < w and 0 <= y < h else None
    out = [row[:] for row in grid]
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c not in BASE: continue
            up, dn, lf, rt = g(x, y - 1), g(x, y + 1), g(x - 1, y), g(x + 1, y); n = c
            ur = g(x + 1, y - 1)
            if c == "body":
                if (up is None or up == "tail") and H(x, y, 4) != 0: n = "bodyhi"                                  # a lit edge along the back and the snout, broken up
                elif lf is None and y % 2 == 0: n = "bodyhi"
                elif dn in ("belly", None, "jaw") and (x + y) % 2 == 0: n = "bodylo"                              # shadow where the flank turns under, dithered
                elif rt is None and y % 2 == 0: n = "bodylo"                                                      # the right edge (rump, snout tip) is in shade
                elif y % 3 == 0 and (x + (y // 3) * 2) % 5 in (0, 1) and up == "body" and dn in ("body", "belly"): n = "bodylo"   # scale rows: short darker dashes, staggered
                elif y % 3 == 1 and (x + (y // 3) * 2 + 3) % 5 == 0 and up == "body" and dn == "body": n = "bodyhi"   # and a lighter fleck beside each
            elif c == "tail":
                if up is None and H(x, y, 3) != 0: n = "tailhi"                                                   # the tail's top catches the light
                elif lf is None and y % 2 == 1: n = "tailhi"
                elif dn in (None, "body", "bodylo") and (x + y) % 2 == 0: n = "taillo"                            # shade under the tail
                elif rt in ("body", "bodyhi", "bodylo") and y % 2 == 0: n = "taillo"
                elif (x + y) % 4 == 0 and up == "tail" and dn == "tail" and x % 2 == 0: n = "tailhi"              # ridges: short diagonal dashes down the tail
                elif (x - y) % 6 == 0 and up == "tail": n = "taillo"                                              # with a groove beside each
            elif c == "belly":
                if dn is None and (x + y) % 3 != 0: n = "bellylo"                                                 # the underside is in shadow
                elif x % 3 == 0 and up in ("body", "bodylo", "bodyhi", "belly") and dn == "belly": n = "bellyhi"   # belly scutes: short light dashes
                elif up in ("body", "bodylo", "bodyhi") and x % 2 == 1: n = "bellylo"                             # shadow where it meets the flank
            elif c == "jaw":
                if up is None and H(x, y, 3) == 0: n = "jawhi"                                                    # a lit edge on the long jaw
                elif dn is None and x % 2 == 0: n = "jawlo"                                                       # its underside in shade
                elif x % 6 == 2: n = "jawlo"                                                                      # and tooth gaps along the jaw line
            elif c == "leg":
                if lf is None and y % 2 == 0: n = "leghi"                                                         # a lit left edge on each leg
                elif rt is None: n = "leglo"                                                                      # the right side in shade
            if n != c: out[y][x] = n
    return out

def process(path):
    im = Image.open(path).convert("RGBA"); n = im.width // W
    out = Image.new("RGBA", im.size, (0, 0, 0, 0)); changed = total = 0
    for i in range(n):
        fr = im.crop((i * W, 0, (i + 1) * W, im.height)); grid = classify(fr); res = shade(grid)
        for y in range(fr.height):
            for x in range(fr.width):
                c = res[y][x]
                if c is None: continue
                total += 1; changed += c != grid[y][x]
                out.putpixel((i * W + x, y), (ALL[c] if isinstance(c, str) else c) + (255,))
    for y in range(im.height):   # the shape must be exactly where it was
        for x in range(im.width): assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
    out.save(path); print(path, f"{changed} of {total} pixels shaded ({100 * changed // max(total, 1)}%)")

d = sys.argv[1] if len(sys.argv) > 1 else "sprites"
for f in ("prio", "prio-walk", "prio-idle", "prio-swim"): process(f"{d}/{f}.png")
