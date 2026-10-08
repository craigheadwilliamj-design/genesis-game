# Adds shading and texture to Prionosuchus (sprites/prio.png, prio-walk.png, prio-idle.png, prio-swim.png) without touching its shape or its colors' hues (same idea as tools/pixelcoty_shade.py).
# Every pixel keeps its place and stays opaque or clear; only fills inside the shapes change, to a lighter or darker shade of the same color (light from the top left): a lit edge along the back,
# the snout and the tail's top, shadow under the belly and down the right side, and a lit edge on each leg, kept to a few clean bands so the animal stays sleek.
# Spots, eye, nostril and the swim strip's water are left exactly as they are. It reads shaded colors back to their base colors first, so running it twice gives the same result.
# The walk strip's tail also sways: frame 0 is the reference, and frames 1 to 3 are rebuilt from its tail columns (x below TAIL_X), each column moved up or down a row or two, more toward the tip,
# on a wave that lags toward the tip (sway). The body, legs and head are never touched, and re-running gives the same strip because frame 0 never moves.
# Usage: python3 -I tools/pixelprio_shade.py [dir]
import sys, math
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

TAIL_X, SWAY, LAG = 28, 2.6, 1.3   # tail columns are x < TAIL_X; the tip swings up to SWAY rows; the wave lags LAG radians at the tip
def sway(grid, ref, f, n=4):
    h, w = len(grid), len(grid[0])
    for y in range(h):
        for x in range(TAIL_X): grid[y][x] = None
    prev = 0
    for x in range(TAIL_X - 1, -1, -1):   # from the root out to the tip
        u = (TAIL_X - 1 - x) / (TAIL_X - 1 - 5); a = SWAY * min(u, 1) ** 1.5; lag = LAG * min(u, 1)   # nothing at the root, the most at the tip
        d = round(a * math.sin(2 * math.pi * f / n - lag)) - round(a * math.sin(-lag))                  # frame 0 is the reference pose, so it moves by nothing
        d = max(prev - 1, min(prev + 1, d)); prev = d                                                  # a column never steps more than a row from its neighbor, so the tail stays joined
        for y in range(h):
            if ref[y][x] is not None and 0 <= y + d < h: grid[y + d][x] = ref[y][x]
    return grid

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
            if c == "body":
                if up in (None, "tail"): n = "bodyhi"                                                              # a clean lit edge along the back and the snout
                elif dn in ("belly", None, "jaw") or rt is None: n = "bodylo"                                     # one solid band of shade where the flank turns under and down the right edge
            elif c == "tail":
                if up is None: n = "tailhi"                                                                       # the tail's top catches the light
                elif dn is None or (dn in ("body", "bodylo") and rt in ("body", "bodyhi", "bodylo")): n = "taillo"   # shade under the tail
            elif c == "belly":
                if dn is None: n = "bellylo"                                                                      # the underside is in shadow
            elif c == "jaw":
                if dn is None: n = "jawlo"                                                                        # the long jaw's underside in shade
            elif c == "leg":
                if lf is None: n = "leghi"                                                                        # a lit left edge on each leg
                elif rt is None: n = "leglo"                                                                      # the right side in shade
            if n != c: out[y][x] = n
    return out

def process(path):
    im = Image.open(path).convert("RGBA"); n = im.width // W
    out = Image.new("RGBA", im.size, (0, 0, 0, 0)); changed = total = 0
    for i in range(n):
        fr = im.crop((i * W, 0, (i + 1) * W, im.height)); grid = classify(fr)
        if path.endswith("prio-walk.png"):
            if i == 0: ref = [row[:] for row in grid]
            else: grid = sway(grid, ref, i)
        res = shade(grid)
        for y in range(fr.height):
            for x in range(fr.width):
                c = res[y][x]
                if c is None: continue
                total += 1; changed += c != grid[y][x]
                out.putpixel((i * W + x, y), (ALL[c] if isinstance(c, str) else c) + (255,))
    walk = path.endswith("prio-walk.png")
    for y in range(im.height):   # the shape must be exactly where it was (the swaying tail aside)
        for x in range(im.width):
            if walk and x % W < TAIL_X: continue
            assert out.getpixel((x, y))[3] == im.getpixel((x, y))[3], "the shape changed"
    out.save(path); print(path, f"{changed} of {total} pixels shaded ({100 * changed // max(total, 1)}%)")

d = sys.argv[1] if len(sys.argv) > 1 else "sprites"
for f in ("prio", "prio-walk", "prio-idle", "prio-swim"): process(f"{d}/{f}.png")
