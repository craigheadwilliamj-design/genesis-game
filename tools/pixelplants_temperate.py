# Draws the temperate Quaternary landscape plants in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_wetland.py, because -I scripts can't import each other):
# flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges. Leaves lean fresh green for the temperate woods.
#   qua-temperate-small   Trillium: a whorl of three broad leaves under one white three-petaled flower
#   qua-temperate-medium  Corylus (hazel): a many-stemmed rounded shrub hung with yellow catkins
#   qua-temperate-large   Tilia (linden): a straight trunk under a broad dense dome of leaf clumps, pale bracts among them
#   q-<name>              the seven temperate Park Plants (PARK_PLANTS in data.js): White Oak, Sugar Maple, Dawn Redwood, Japanese Cherry, Rose Bush, Ginkgo, Lilac
# Usage: python3 -I tools/pixelplants_temperate.py [outdir]
import sys, math
from PIL import Image

def mix(a, b, t): return tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))
def tones(base): return (base, mix(base, (255, 255, 255), .22), mix(base, (0, 0, 0), .32))   # base, lit, shaded
OLIVE = (97, 111, 34)   # the Dimetrodon's olive; each size steps a little darker, small to large
STEM = tones((96, 64, 34))
SEED = tones((178, 110, 20))   # rust orange / amber, from the Dimetrodon family

class Sprite:
    def __init__(s, w, h, leaf):
        s.w, s.h = w, h; s.g = [[None] * w for _ in range(h)]
        lf = tones(leaf)
        s.C = {"leaf": lf[0], "leafhi": lf[1], "leaflo": lf[2], "rib": mix(leaf, (235, 240, 150), .5),
               "stem": STEM[0], "stemhi": STEM[1], "stemlo": STEM[2], "seed": SEED[0], "seedhi": SEED[1], "seedlo": SEED[2]}
    def put(s, x, y, c):
        x, y = int(math.floor(x + .5)), int(math.floor(y + .5))
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = c
    def get(s, x, y): return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else None
    def line(s, x0, y0, x1, y1, c, r=0):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for k in range(n + 1):
            t = k / n; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            if r <= .5: s.put(x, y, c)
            else:
                for dy in range(-int(r) - 1, int(r) + 2):
                    for dx in range(-int(r) - 1, int(r) + 2):
                        if dx * dx + dy * dy <= r * r: s.put(x + dx, y + dy, c)
    def fill(s, cx, cy, rx, ry, c):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1: s.put(x, y, c)
    def shade(s):
        # a lit upper and left edge, shadow on undersides and right edges, from the neighbours of each filled pixel (the same rules as pixelplant_flat.py)
        out = [r[:] for r in s.g]
        for y in range(s.h):
            for x in range(s.w):
                c = s.g[y][x]
                if c is None or c.endswith(("hi", "lo")) or c + "hi" not in s.C: continue   # any color with a hi and lo ramp is shaded
                hi, lo = c + "hi", c + "lo"; up, dn, lf, rt = s.get(x, y - 1), s.get(x, y + 1), s.get(x - 1, y), s.get(x + 1, y)
                if up is None and (x + y) % 3 != 0: out[y][x] = hi
                elif lf is None and y % 2 == 0: out[y][x] = hi
                elif dn is None or (rt is None and y % 2 == 0): out[y][x] = lo
                elif dn == c and s.get(x, y + 2) is None and (x + y) % 2 == 0: out[y][x] = lo
        s.g = out
    def save(s, path):
        s.shade(); im = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0))
        for y in range(s.h):
            for x in range(s.w):
                if s.g[y][x]: im.putpixel((x, y), s.C[s.g[y][x]] + (255,))
        im.save(path); print(path, im.size, len({v for r in s.g for v in r if v}), "colors")

def bez(p0, p1, p2, t): return tuple((1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c for a, b, c in zip(p0, p1, p2))
def tangent(p0, p1, p2, t): return tuple(2 * (1 - t) * (b - a) + 2 * t * (c - b) for a, b, c in zip(p0, p1, p2))

def lens(sp, x0, y0, x1, y1, w, teeth=True):
    # one lanceolate pinna: a pointed lens along a line, a little toothed on both edges, with a lighter rib down the middle
    dx, dy = x1 - x0, y1 - y0; d = math.hypot(dx, dy) or 1; nx, ny = -dy / d, dx / d; n = int(d * 2) + 2
    for i in range(n + 1):
        t = i / n; hw = w * math.sin(math.pi * min(max(t, .06), .97)) ** .8 + (.4 if teeth and w > 1.8 and int(t * d) % 3 == 0 and .15 < t < .85 else 0)
        for k in range(-int(hw * 2) - 1, int(hw * 2) + 2):
            if abs(k / 2) <= hw: sp.put(x0 + dx * t + nx * k / 2, y0 + dy * t + ny * k / 2, "leaf")
    if d > 5:
        for i in range(2, n - 1): t = i / n; sp.put(x0 + dx * t, y0 + dy * t, "rib")

def stem(sp, pts, r0, r1):
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]; n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for k in range(n + 1):
            t = k / n; r = r0 + (r1 - r0) * ((i + t) / (len(pts) - 1)); x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for dy in range(-3, 4):
                for dx in range(-3, 4):
                    if dx * dx + dy * dy <= r * r: sp.put(x + dx, y + dy, "stem")

FERN = mix(OLIVE, (40, 130, 100), .3)   # the wetland leaf: the olive pulled toward teal
def blade(sp, x0, y0, x1, y1, w, bowx=0, bowy=0):   # a long narrow leaf along a bent curve (grass, reed, strap), a lens in short runs with a rib
    c = ((x0 + x1) / 2 + bowx, (y0 + y1) / 2 + bowy); n = max(3, int(math.hypot(x1 - x0, y1 - y0) / 4))
    for i in range(n):
        a = bez((x0, y0), c, (x1, y1), i / n); b = bez((x0, y0), c, (x1, y1), (i + 1) / n); lens(sp, *a, *b, w * (1 - .55 * i / n), teeth=False)


LEAF = mix(OLIVE, (50, 150, 60), .35)   # the temperate leaf: the olive pulled toward fresh green
WHITE = tones((240, 238, 226))   # trillium petals: base, lit, shaded

def clump(sp, cx, cy, rx, ry, dash=True):   # a leaf mass with its underside in rows of dark dashes
    sp.fill(cx, cy, rx, ry, "leaf")
    if not dash: return
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if sp.get(x, y) == "leaf" and y > cy + ry * .35 and (x + y // 2) % 3 == 0: sp.put(x, y, "leaflo")

def trillium():   # small: a whorl of three broad leaves under one white three-petaled flower
    sp = Sprite(44, 40, mix(LEAF, (255, 255, 255), .08)); sp.C.update(white=WHITE[0], whitehi=WHITE[1], whitelo=WHITE[2]); bx, by = 22, 38
    sp.line(bx, by + 1, bx, by - 22, "stem", 1)
    for cx, cy, rx, ry in ((-11, 14, 10, 5.5), (11, 14, 10, 5.5), (0, 8, 8, 6)):   # the three leaves, ovate, tips out
        sp.fill(bx + cx, by - cy, rx, ry, "leaf")
        for x in range(int(bx + cx - rx * .6), int(bx + cx + rx * .5)): sp.put(x, by - cy, "rib")
    for dx in range(-7, 8, 2): sp.put(bx + dx, by - 12 + abs(dx) // 3, "leaflo")   # the shadow where they meet
    fy = by - 28
    for px, py, rx, ry in ((0, -5, 2.6, 4), (-5, 0, 4, 2.6), (5, 0, 4, 2.6)): sp.fill(bx + px, fy + py, rx, ry, "white")
    for dx, dy in ((0, -8), (-1, -7), (-8, -1), (-7, -2), (-3, -4), (-2, -5)): sp.put(bx + dx, fy + dy, "whitehi")
    for dx, dy in ((9, 1), (8, 2), (4, 2), (5, 2), (2, 3), (-2, 3), (-8, 2)): sp.put(bx + dx, fy + dy, "whitelo")
    sp.fill(bx, fy, 1.6, 1.4, "seed"); sp.put(bx - 1, fy - 1, "seedhi")
    return sp

def corylus():   # medium: a many-stemmed rounded shrub hung with yellow catkins
    sp = Sprite(64, 52, mix(LEAF, (0, 0, 0), .05)); sp.C.update(cat=(214, 190, 84), cathi=(236, 218, 122), catlo=(160, 138, 54)); bx, by = 32, 50
    for tx, tl in ((-14, -4), (-6, -1), (0, 0), (7, 2), (15, 5)): stem(sp, [(bx + tx * .5, by + 1), (bx + tx * .8, by - 12), (bx + tx + tl, by - 24)], 1.8, 1.2)
    for x in range(bx - 10, bx + 11): sp.put(x, by + 1, "stem")
    for cx, cy, rx, ry in sorted(((-18, 26, 11, 8), (18, 26, 11, 8), (-9, 36, 12, 8), (9, 36, 12, 8), (0, 28, 14, 9), (0, 41, 10, 6), (-22, 20, 7, 5), (22, 20, 7, 5)), key=lambda c: c[1]):
        clump(sp, bx + cx, by - cy, rx, ry)
    for x in range(bx - 20, bx + 20, 6):   # the toothed double-edged leaf margins along the crown's lit edge
        sp.put(x, by - 44 + abs(x - bx) // 4, "leafhi")
    for tx, ty, h in ((-20, 17, 8), (-12, 22, 9), (-4, 20, 8), (5, 21, 9), (13, 20, 8), (21, 17, 8)):   # catkins dangling below the crown
        sp.line(bx + tx, by - ty, bx + tx, by - ty + h, "cat", 1); sp.put(bx + tx - 1, by - ty + 1, "cathi"); sp.put(bx + tx + 1, by - ty + h - 2, "catlo")
    return sp

def tilia():   # large: a linden, a straight trunk under a broad dense dome, pale bracts hanging among the leaves
    sp = Sprite(72, 92, mix(LEAF, (0, 0, 0), .04)); sp.C.update(bract=(206, 214, 130), bracthi=(228, 232, 166), bractlo=(160, 168, 90)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx, by - 40)], 4.2, 2.4)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 36, -3): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y + 1, "stemlo")   # bark furrows
    for lx, ly in ((-14, 52), (-8, 58), (8, 58), (14, 52)): stem(sp, [(bx, by - 38), (bx + lx, by - ly)], 1.6, 1.1)
    for cx, cy, rx, ry in sorted(((-22, 58, 12, 9), (22, 58, 12, 9), (-15, 70, 14, 10), (15, 70, 14, 10), (0, 76, 16, 10), (-26, 48, 8, 6), (26, 48, 8, 6), (0, 62, 13, 9), (-8, 82, 10, 6), (8, 82, 10, 6), (0, 50, 11, 6)), key=lambda c: c[1]):
        clump(sp, bx + cx, by - cy, rx, ry)
    for x, y in ((-18, 52), (-6, 56), (8, 54), (20, 60), (-12, 64), (4, 66)):   # a pale hanging bract with its flower cluster
        sp.line(bx + x, by - y, bx + x, by - y + 7, "bract", 0); sp.fill(bx + x, by - y + 9, 1.4, 2.4, "bracthi")
    return sp

def ramp(sp, name, rgb): t = tones(rgb); sp.C.update({name: t[0], name + "hi": t[1], name + "lo": t[2]})   # a new shaded color

def spray(sp, x, y, side, L, drop, w=1.3):   # a feathery drooping spray of scale-leaf shoots: a stem with short blades hanging off it
    ex, ey = x + side * L, y + drop; sp.line(x, y, ex, ey, "leaf")
    for t in (.3, .55, .8, 1.0): bx_, by_ = x + (ex - x) * t, y + (ey - y) * t; blade(sp, bx_, by_, bx_ + side * 2, by_ + 7 - 2 * t, w, bowx=side * 1)

def crown(sp, bx, by, spec, key="leaf", dash=True):   # leaf clumps back to front, each (dx, up, rx, ry)
    for cx, cy, rx, ry in sorted(spec, key=lambda c: c[1]): clump(sp, bx + cx, by - cy, rx, ry, dash) if key == "leaf" else sp.fill(bx + cx, by - cy, rx, ry, key)

def q_white_oak():   # large: a broad spreading oak, a thick trunk, heavy limbs, a wide lobed crown, a few acorns
    sp = Sprite(72, 92, mix((78, 138, 58), (0, 0, 0), .02)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 16), (bx - 1, by - 32)], 5.2, 3.2)
    for x in range(bx - 9, bx + 10): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 30, -3): sp.put(bx - 2, y, "stemlo"); sp.put(bx + 2, y + 1, "stemlo")
    for lx, ly in ((-20, 46), (-9, 52), (10, 52), (21, 46)): stem(sp, [(bx - 1, by - 30), (bx + lx * .5, by - ly + 10), (bx + lx, by - ly)], 2.4, 1.3)
    crown(sp, bx, by, ((-26, 42, 10, 7), (26, 42, 10, 7), (-17, 52, 13, 9), (17, 52, 13, 9), (0, 58, 16, 10), (-28, 54, 8, 6), (28, 54, 8, 6), (-8, 66, 12, 8), (9, 66, 12, 8), (0, 76, 12, 7)))
    for x in range(bx - 30, bx + 31, 5): sp.put(x, by - 38 + (abs(x - bx) // 7), "leaflo")   # lobed hem under the crown
    for x, y in ((-21, 40), (-6, 46), (14, 44), (24, 40)): sp.put(bx + x, by - y, "seed"); sp.put(bx + x, by - y + 1, "seedlo")   # acorns
    return sp

def q_sugar_maple():   # large: an oval maple in autumn, a red-orange crown with golden clumps and a few red ones
    sp = Sprite(64, 92, (206, 92, 36)); ramp(sp, "gold", (240, 168, 48)); bx, by = 32, 90
    sp.C.update(seed=sp.C["gold"], seedhi=sp.C["goldhi"], seedlo=sp.C["goldlo"])
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx, by - 36)], 3.8, 2.2)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    for lx, ly in ((-9, 52), (9, 52), (0, 58)): stem(sp, [(bx, by - 34), (bx + lx, by - ly)], 1.6, 1.1)
    spec = ((-14, 52, 11, 9), (14, 52, 11, 9), (0, 60, 13, 10), (-10, 68, 12, 9), (10, 68, 12, 9), (0, 76, 11, 9), (-17, 62, 8, 6), (17, 62, 8, 6), (0, 49, 9, 6))
    crown(sp, bx, by, spec)
    for cx, cy, rx, ry in ((-8, 70, 6, 4), (10, 58, 6, 4), (-14, 54, 4, 3), (3, 78, 5, 3)): sp.fill(bx + cx, by - cy, rx, ry, "seed")   # gold clumps
    for cx, cy in ((-11, 63), (12, 70), (1, 66)): sp.fill(bx + cx, by - cy, 3, 2, "gold")
    return sp

def q_dawn_redwood():   # large: a conical deciduous conifer, a straight fluted trunk, flat tiers of feathery sprays
    sp = Sprite(64, 92, (70, 120, 58)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 14), (bx, by - 70)], 4.4, 1.2)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 36, -3): sp.put(bx - 2, y, "stemlo"); sp.put(bx + 2, y + 1, "stemlo")   # flutes
    for h in range(74, 12, -6):   # flat tiers from the top down, each a feathery skirt with blades hanging from its rim
        r = 4 + 24 * (1 - h / 84)
        clump(sp, bx, by - h, r, 3.6)
        for x in range(int(bx - r) + 1, int(bx + r), 2): sp.put(x, by - h - 2, "leafhi")   # a lit top rim on each tier
        for side in (-1, 1):
            for t in (.35, .65, .95): blade(sp, bx + side * r * t, by - h + 2, bx + side * r * t * 1.05, by - h + 9, 1.3, bowx=side)
    for k in range(3): blade(sp, bx, by - 76, bx + (k - 1) * 2, by - 88, 1.2)
    return sp

def q_japanese_cherry():   # medium: a spreading vase-shaped tree in full pink blossom, a dark leaning trunk
    sp = Sprite(64, 50, (232, 160, 188)); ramp(sp, "pale", (250, 220, 232)); bx, by = 32, 48
    stem(sp, [(bx + 1, by + 1), (bx, by - 10), (bx - 2, by - 18)], 3.2, 2.2)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for lx, ly in ((-17, 28), (-8, 32), (9, 32), (18, 27)): stem(sp, [(bx - 2, by - 16), (bx + lx * .6, by - ly + 8), (bx + lx, by - ly)], 1.6, 1.1)
    crown(sp, bx, by, ((-18, 30, 11, 7), (18, 30, 11, 7), (-9, 37, 12, 7), (10, 37, 12, 7), (0, 33, 11, 8), (-24, 25, 6, 4), (25, 25, 6, 4), (0, 42, 9, 5)))
    for x, y in ((-14, 38), (-3, 42), (8, 40), (16, 34), (-20, 31), (2, 34), (-8, 30), (12, 28)): sp.fill(bx + x, by - y, 2, 1.4, "pale")   # white-pink clusters
    for x, y in ((-12, 14), (8, 10), (-4, 7), (14, 5), (-18, 4)): sp.put(bx + x, by - y + 33, "pale")   # fallen petals on the ground
    return sp

def q_rose_bush():   # medium: a rounded mound of dark leaves, thorny canes, a dozen red roses
    sp = Sprite(56, 44, (74, 124, 56)); ramp(sp, "rose", (216, 52, 74)); bx, by = 28, 42
    for tx, tl in ((-16, -2), (-8, -1), (0, 0), (9, 1), (17, 2)): stem(sp, [(bx + tx * .6, by + 1), (bx + tx, by - 8)], 1.0, .8)
    crown(sp, bx, by, ((-14, 12, 10, 8), (14, 12, 10, 8), (0, 18, 12, 9), (-8, 7, 10, 6), (9, 7, 10, 6), (0, 10, 9, 6)))
    for x, y in ((-18, 9), (-10, 20), (-2, 25), (6, 18), (13, 23), (19, 11), (-4, 11), (9, 9), (-12, 11), (2, 16), (-16, 16), (16, 16)):
        sp.fill(bx + x, by - y, 2.4, 2.2, "rose"); sp.put(bx + x, by - y, "rosehi"); sp.put(bx + x + 1, by - y + 1, "roselo")   # a rose, lit top-left
    return sp

def fan(sp, x, y, r, key="leaf"):   # a ginkgo leaf: a wedge fan on a short stalk, notched at the top
    sp.line(x, y + r * .3, x, y + r * .8, "stem", 0)
    for k in range(-5, 6):
        a = k / 5 * 1.05; L = r * (1 - (.5 if k == 0 else 0))
        sp.line(x, y, x + math.sin(a) * L, y - math.cos(a) * L, key, 0)
    for dy in range(1, int(r)): sp.put(x - 1, y - dy, key); sp.put(x + 1, y - dy, key)

def q_ginkgo():   # medium: an upright tree, a straight trunk, a crown of golden-green fan leaves
    sp = Sprite(64, 52, (136, 178, 74)); ramp(sp, "gold", (232, 202, 84)); bx, by = 32, 50
    stem(sp, [(bx, by + 1), (bx, by - 12), (bx, by - 26)], 2.8, 1.6)
    for x in range(bx - 5, bx + 6): sp.put(x, by + 1, "stem")
    for lx, ly in ((-12, 34), (12, 34), (-5, 40), (5, 40)): stem(sp, [(bx, by - 22), (bx + lx, by - ly)], 1.2, 1.0)
    crown(sp, bx, by, ((-14, 26, 10, 7), (14, 26, 10, 7), (0, 32, 12, 8), (-7, 22, 9, 5), (8, 22, 9, 5), (0, 38, 8, 5)))
    for dx, dy, r in ((-20, 28, 6), (-14, 35, 6), (-6, 41, 6), (3, 42, 6), (11, 38, 6), (19, 30, 6), (22, 24, 5), (-23, 23, 5), (-8, 24, 5), (8, 26, 5)): fan(sp, bx + dx, by - dy, r, "gold")   # fans on the rim
    for dx, dy, r in ((-17, 32, 5), (-1, 46, 5), (15, 36, 5), (-11, 39, 5), (17, 24, 5)): fan(sp, bx + dx, by - dy, r)
    return sp

def q_lilac():   # medium: a many-stemmed shrub of heart-shaped leaves, upright cone panicles of purple blossom
    sp = Sprite(56, 50, (108, 154, 78)); ramp(sp, "lilac", (178, 138, 214)); bx, by = 28, 48
    for tx, tl in ((-12, -2), (-5, -1), (4, 1), (11, 2)): stem(sp, [(bx + tx * .5, by + 1), (bx + tx, by - 10)], 1.4, 1.0)
    crown(sp, bx, by, ((-12, 12, 10, 8), (12, 12, 10, 8), (0, 18, 12, 9), (-6, 8, 9, 6), (7, 8, 9, 6)))
    for x, y, h in ((-14, 20, 11), (-6, 27, 13), (3, 28, 14), (11, 23, 12), (-1, 19, 9), (17, 15, 8), (-19, 14, 7)):   # a cone of small flowers, wide at the base
        for k in range(h):
            w = (k + 1) * .32 + .4; yy = by - y - h + k + 2
            sp.fill(bx + x, yy, w, .9, "lilac")
        sp.put(bx + x, by - y - h + 1, "lilachi")
    return sp


out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("qua-temperate-small", trillium), ("qua-temperate-medium", corylus), ("qua-temperate-large", tilia)):
    fn().save(f"{out}/{key}.png")
REG = [("q-white-oak", q_white_oak), ("q-sugar-maple", q_sugar_maple), ("q-dawn-redwood", q_dawn_redwood), ("q-japanese-cherry", q_japanese_cherry),
       ("q-rose-bush", q_rose_bush), ("q-ginkgo", q_ginkgo), ("q-lilac", q_lilac)]
for key, fn in REG: fn().save(f"{out}/{key}.png")
