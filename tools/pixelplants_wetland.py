# Draws the Permian and Triassic wetland plants in the Dimetrodon's flat, simple style (same helpers and rules as tools/pixelplants_flat.py, copied because -I scripts can't import each other):
# flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges, a lighter rib and rhythmic grooves. Leaves lean blue-green for the wet ground.
#   per-wetland-small   Annularia: a slender jointed stem with flat whorls of narrow lanceolate leaves
#   per-wetland-medium  Pecopteris: a short trunk with a wide crown of arching bipinnate fronds
#   per-wetland-large   Arthropitys: a tall jointed calamite trunk, ribbed, with whorled branches
#   tri-wetland-small   Equisetites: a clump of jointed horsetail stalks with sheath rings, one cone
#   tri-wetland-medium  Cladophlebis: a broad crown of arching fern fronds with wide pinnae
#   tri-wetland-large   Heidiphyllum: a conifer with a trunk and branches ending in tufts of long strap leaves
#   dev-/car-/jur-/cre-/pal-/neo-/qua-wetland-*  the other periods, drawn in the same way (species named in PLANT_TABLE in data.js)
#   q-<name>             the wetland Park Plants (PARK_PLANTS in data.js): Bald Cypress, Weeping Willow, Mangrove, Cattails, Water Lily, Cypress Knees
# Usage: python3 -I tools/pixelplants_wetland.py [outdir]
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
                if c not in ("leaf", "stem", "seed"): continue
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

def frond(sp, base, ctrl, tip, wmax, pinnae, notch=.5, groove=True):
    # a feathery blade along a curved rachis; the width swells and pinches pinna by pinna (that is the stair-stepped scalloped edge).
    # notch is how deep the pinches go: .5 is a plain scallop, .1 leaves nearly separate pinnules. A groove marks each pinch and a lighter rib runs down the middle.
    n = 200; pts = []
    for k in range(n + 1):
        t = k / n; bx, by = bez(base, ctrl, tip, t); tx, ty = tangent(base, ctrl, tip, t); d = math.hypot(tx, ty) or 1; nx, ny = -ty / d, tx / d
        fr = (t * pinnae) % 1.0; w = wmax * math.sin(math.pi * min(max(t, .04), .98)) ** .6 * (notch + (1 - notch) * (1 - abs(2 * fr - 1)) ** .8)
        pts.append((t, bx, by, nx, ny, w, fr))
    for t, bx, by, nx, ny, w, fr in pts:
        for j in range(-int(w * 2) - 1, int(w * 2) + 2):
            if abs(j / 2) <= w: sp.put(bx + nx * j / 2, by + ny * j / 2, "leaf")
    if groove:
        for t, bx, by, nx, ny, w, fr in pts:
            if fr < .04 and .04 < t < .96:
                for side in (1, -1):
                    for r in range(1, int(w * .85) + 1):
                        px, py = bx + nx * r * side, by + ny * r * side
                        if sp.get(int(math.floor(px + .5)), int(math.floor(py + .5))) == "leaf": sp.put(px, py, "leaflo")
    if wmax >= 2.2:
        for t, bx, by, nx, ny, w, fr in pts:
            if t > .05: sp.put(bx, by, "rib")

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

def whorl(sp, x, y, n, L, w):   # a flat whorl seen from the side: narrow leaves fanned out left and right, drooping a little at the tips
    for i in range(n):
        a = -1.2 + 2.4 * i / (n - 1) if n > 1 else 0
        for side in (-1, 1):
            tx, ty = x + side * math.cos(a * .5) * L, y + a * L * .55 - L * .15
            lens(sp, x, y, tx, ty, w, teeth=False)

def annularia():   # small: whorls of leaves up a jointed stem
    sp = Sprite(40, 46, mix(FERN, (255, 255, 255), .1)); bx, by = 20, 44
    for h, L in ((8, 14), (17, 12), (26, 9), (34, 6)): whorl(sp, bx, by - h, 3, L, 1.3)
    stem(sp, [(bx, by + 1), (bx, by - 40)], 1.3, .8)
    for h in range(6, 40, 5): sp.put(bx, by - h, "stemlo")   # the nodes
    return sp

def pecopteris():   # medium: a short trunk, a crown of arching bipinnate fronds
    sp = Sprite(64, 50, mix(FERN, (0, 0, 0), .04)); bx, by = 32, 48
    stem(sp, [(bx, by + 1), (bx, by - 8)], 2.2, 1.8); top = (bx, by - 8)
    for tx, ty, b in sorted(((-30, 3, -3), (30, 4, 3), (-25, 12, -7), (26, 13, 7), (-16, 19, -5), (17, 20, 5), (-6, 22, -2), (7, 23, 2)), key=lambda f: -abs(f[0])):
        tip = (bx + tx, top[1] - ty); frond(sp, top, ((top[0] + tip[0]) / 2 + b * .3, (top[1] + tip[1]) / 2 - 8), tip, 3.4, 11, .3)
    return sp

def arthropitys():   # large: a tall ribbed jointed trunk with whorled leafy branches
    sp = Sprite(64, 92, mix(FERN, (0, 0, 0), .14)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx + 1, by - 60), (bx + 1, by - 72)], 3.0, 1.6)
    for x in range(bx - 5, bx + 6): sp.put(x, by + 1, "stem")
    for h in range(4, 72, 6):   # node rings, and a rib line down the lit side
        for dx in (-2, -1, 0, 1, 2): sp.put(bx + dx * (1 if h < 40 else .6), by - h, "stemlo")
    for side, h, rch, rise in ((-1, 14, 22, 8), (1, 22, 22, 9), (-1, 32, 19, 10), (1, 40, 18, 10), (-1, 50, 14, 10), (1, 57, 12, 10), (-1, 64, 8, 8)):
        x0, y0 = bx + (h > 40), by - h; ex, ey = x0 + side * rch, y0 - rise
        sp.line(x0, y0, ex, ey, "stem")
        for t in (.45, .75, 1.0): whorl(sp, x0 + (ex - x0) * t, y0 + (ey - y0) * t, 3, 8 - 2 * t, 1.1)
    whorl(sp, bx + 1, by - 74, 3, 8, 1.2); whorl(sp, bx + 1, by - 68, 3, 9, 1.2)
    return sp

def equisetites():   # small: jointed horsetail stalks with dark sheath rings and whorled branchlets, a cone on the tallest
    sp = Sprite(44, 44, mix(FERN, (255, 255, 255), .06)); bx, by = 22, 43
    for tx, top, lean in ((-17, 26, -3), (17, 28, 3), (-7, 34, -1), (8, 37, 1)):
        x1, y1 = bx + tx + lean, by - top; sp.line(bx + tx * .2, by, x1, y1, "leaf", 1.5)
        for h in range(3, top - 2, 4):
            f = h / top; x = bx + tx * .2 + (x1 - bx - tx * .2) * f; y = by - h
            sp.put(x - 1, y, "leaflo"); sp.put(x, y, "leaflo"); sp.put(x + 1, y, "leaflo")   # the sheath ring
            if h > 6:
                for k in (-1, 1): sp.line(x + k * 2, y, x + k * (5 - f * 2), y - 3, "leaf")   # a whorled branchlet each side
    cx, cy = bx + 9, by - 38; sp.fill(cx, cy + 1, 2, 3.4, "seed"); sp.put(cx, cy - 2, "seedhi")   # a cone capping the tallest stalk
    return sp

def cladophlebis():   # medium: a wide low crown of arching fern fronds with wide pinnae
    sp = Sprite(72, 50, mix(FERN, (0, 0, 0), .08)); bx, by = 36, 48
    stem(sp, [(bx, by + 1), (bx, by - 6)], 1.9, 1.5); top = (bx, by - 6)
    for tx, ty, b in sorted(((-34, 4, -4), (34, 5, 4), (-28, 13, -7), (29, 14, 7), (-18, 20, -6), (19, 21, 6), (-8, 23, -3), (9, 24, 3)), key=lambda f: -abs(f[0])):
        tip = (bx + tx, top[1] - ty); frond(sp, top, ((top[0] + tip[0]) / 2 + b * .4, (top[1] + tip[1]) / 2 - 8), tip, 4.4, 7, .42)
    return sp

def strap(sp, x0, y0, x1, y1, w):   # a long strap leaf bowing downward: a bent narrow lens with a rib
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2 - 3
    for t0, t1 in ((0, .5), (.5, 1)):
        a = bez((x0, y0), (mx, my - 4), (x1, y1), t0); b = bez((x0, y0), (mx, my - 4), (x1, y1), t1); lens(sp, *a, *b, w, teeth=False)

def heidiphyllum():   # large: a conifer, a slim trunk with branches ending in dense tufts of long strap leaves
    sp = Sprite(64, 92, mix(FERN, (0, 0, 0), .16)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 24), (bx + 1, by - 46), (bx + 1, by - 58)], 2.4, 1.3)
    for x in range(bx - 4, bx + 5): sp.put(x, by + 1, "stem")
    for side, h, rch, rise in ((-1, 12, 21, 6), (1, 17, 22, 7), (-1, 27, 19, 8), (1, 33, 18, 8), (-1, 42, 14, 8), (1, 47, 12, 8), (-1, 53, 7, 7)):
        x0, y0 = bx + 1, by - h; ex, ey = x0 + side * rch, y0 - rise; stem(sp, [(x0, y0), (ex, ey)], 1.5, 1.0)
        for k in range(5):   # a tuft at the tip: long leaves fanned from rising to drooping
            strap(sp, ex, ey, ex + side * (4 + k * 3), ey - 8 + k * 5, 1.4)
        for t in (.3, .55, .8): strap(sp, x0 + (ex - x0) * t, y0 + (ey - y0) * t, x0 + (ex - x0) * t + side * 7, y0 + (ey - y0) * t + 5, 1.3)
    for k in range(6): strap(sp, bx + 1, by - 59, bx + 1 + (k - 2.5) * 4.5, by - 59 - 14 + abs(k - 2.5) * 4, 1.5)   # the crown
    return sp


def blade(sp, x0, y0, x1, y1, w, bowx=0, bowy=0):   # a long narrow leaf along a bent curve (grass, reed, strap), a lens in short runs with a rib
    c = ((x0 + x1) / 2 + bowx, (y0 + y1) / 2 + bowy); n = max(3, int(math.hypot(x1 - x0, y1 - y0) / 4))
    for i in range(n):
        a = bez((x0, y0), c, (x1, y1), i / n); b = bez((x0, y0), c, (x1, y1), (i + 1) / n); lens(sp, *a, *b, w * (1 - .55 * i / n), teeth=False)

def fork(sp, x, y, ang, L, depth, spor=True, r=0, split=.5, shrink=.76):   # a Y-forking bare stem, a sporangium capping each tip
    x1, y1 = x + math.sin(ang) * L, y - math.cos(ang) * L; sp.line(x, y, x1, y1, "leaf", 1 if depth >= 1 else 0)   # thicker toward the base
    if depth == 0:
        if spor: sp.fill(x1, y1 - 1, 1.2, 1.8, "seed")
        return
    for d in (-1, 1): fork(sp, x1, y1, ang + d * split, L * shrink, depth - 1, spor, r, split, shrink)

def needles(sp, x, y, n, L):   # a whorl of needle leaves seen from the side, swept upward
    for i in range(n):
        a = -1.3 + 2.6 * i / (n - 1); lens(sp, x, y, x + math.sin(a) * L, y - math.cos(a) * L * .8 - L * .15, .8, teeth=False)

def scars(sp, bx, y0, y1, hw, step=4):   # a scaly trunk: rows of leaf-scar dashes, offset row to row
    for k, y in enumerate(range(y0, y1, -step)):
        for dx in range(-hw + 1 + (k % 2), hw, 2): sp.put(bx + dx, y, "stemlo")

def rhynia():   # small: bare forked stalks, a sporangium on each tip
    sp = Sprite(40, 44, mix(FERN, (255, 255, 255), .12)); bx, by = 20, 42
    for ang, L in ((-.5, 12), (.45, 14), (-.1, 17), (.1, 10)): fork(sp, bx + ang * 5, by, ang * .5, L, 2, split=.45)
    return sp

def aglaophyton():   # medium: a low spreading mat of forked bare stems with round sporangia
    sp = Sprite(64, 40, mix(FERN, (0, 0, 0), .02)); bx, by = 32, 38
    for ang, L, x in ((-1.2, 12, -6), (1.15, 12, 6), (-.7, 13, -3), (.7, 14, 3), (-.25, 15, -1), (.2, 15, 1), (0, 11, 0)): fork(sp, bx + x, by, ang, L, 2, split=.55, shrink=.8)
    return sp

def pseudosporochnus():   # large: a slender trunk under a broom of repeatedly forked, leafless branchlets
    sp = Sprite(64, 92, mix(FERN, (0, 0, 0), .12)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx + 1, by - 52)], 2.4, 1.4)
    for x in range(bx - 4, bx + 5): sp.put(x, by + 1, "stem")
    for ang, h in ((-1.15, 46), (-.75, 52), (-.4, 56), (0, 58), (.4, 56), (.75, 52), (1.15, 46)):
        y = by - h; x = bx + 1; fork(sp, x, y, ang, 12, 3, spor=False, split=.45, shrink=.82)
    return sp

def asterophyllites():   # small: a slender jointed stem with whorls of needle leaves swept upward
    sp = Sprite(40, 46, mix(FERN, (255, 255, 255), .1)); bx, by = 20, 44
    for h, L in ((7, 12), (15, 11), (23, 9), (31, 7), (38, 5)): needles(sp, bx, by - h, 7, L)
    stem(sp, [(bx, by + 1), (bx, by - 42)], 1.6, 1.1)
    for h in range(4, 42, 4): sp.put(bx, by - h, "stemlo")
    return sp

def medullosa():   # medium: a stout short trunk, a few big seed-fern fronds with large separate pinnules
    sp = Sprite(64, 50, mix(FERN, (0, 0, 0), .06)); bx, by = 32, 48
    stem(sp, [(bx, by + 1), (bx, by - 10)], 2.8, 2.2); top = (bx, by - 10)
    for tx, ty, b in sorted(((-29, 2, -3), (29, 3, 3), (-22, 12, -6), (23, 13, 6), (-10, 19, -3), (11, 20, 3)), key=lambda f: -abs(f[0])):
        tip = (bx + tx, top[1] - ty); frond(sp, top, ((top[0] + tip[0]) / 2 + b * .3, (top[1] + tip[1]) / 2 - 7), tip, 4.6, 6, .1)
    return sp

def sigillaria():   # large: an unbranched scaly trunk under a tuft of long strap leaves
    sp = Sprite(64, 92, mix(FERN, (0, 0, 0), .14)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 62)], 3.2, 2.4)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    scars(sp, bx, by - 3, by - 62, 3)
    for k in sorted(range(13), key=lambda k: -abs(k - 6)):
        t = (k - 6) / 6; blade(sp, bx, by - 63, bx + t * 21, by - 63 - 31 + abs(t) * 15, 2.1, bowx=t * 11, bowy=-5)
    return sp

def coniopteris():   # small: a tuft of fine, upright-arching fern fronds
    sp = Sprite(54, 40, mix(FERN, (255, 255, 255), .14)); bx, by = 27, 38
    for tx, ty, b in ((-23, 4, -8), (23, 5, 8), (-15, 16, -6), (15, 17, 6), (-6, 24, -2), (6, 25, 2), (0, 18, 0)):
        base = (bx + tx * .08, by - 1); tip = (bx + tx, by - 1 - ty); frond(sp, base, ((base[0] + tip[0]) / 2 + b * .3, (base[1] + tip[1]) / 2 - 9), tip, 2.4, 10, .22, groove=False)
    stem(sp, [(bx, by + 1), (bx, by - 2)], 1.9, 1.5)
    return sp

def todites():   # medium: a crown of broad arching fern fronds, upswept
    sp = Sprite(70, 50, mix(FERN, (0, 0, 0), .04)); bx, by = 35, 48
    stem(sp, [(bx, by + 1), (bx, by - 5)], 2.0, 1.6); top = (bx, by - 5)
    for tx, ty, b in sorted(((-31, 6, -4), (31, 7, 4), (-24, 17, -6), (25, 18, 6), (-13, 25, -4), (14, 26, 4)), key=lambda f: -abs(f[0])):
        tip = (bx + tx, top[1] - ty); frond(sp, top, ((top[0] + tip[0]) / 2 + b * .3, (top[1] + tip[1]) / 2 - 12), tip, 4.0, 8, .28)
    return sp

def matonidium():   # large: a tall tree-fern trunk, a crown of drooping fronds
    sp = Sprite(70, 92, mix(FERN, (0, 0, 0), .14)); bx, by = 35, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 54)], 3.0, 2.2)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    scars(sp, bx, by - 3, by - 54, 3, 3); top = (bx, by - 56)
    for tx, ty, b in sorted(((-32, -6, -4), (32, -5, 4), (-26, 6, -5), (27, 7, 5), (-14, 14, -2), (15, 15, 2), (0, 16, 0)), key=lambda f: -abs(f[0])):
        tip = (bx + tx, top[1] - ty); frond(sp, top, ((top[0] + tip[0]) / 2 + b, top[1] - 16), tip, 4.2, 8, .3)
    return sp

def disc(sp, x, y, rx, ry):   # a round floating-type leaf seen at a slant: a flat ellipse with ribs radiating from the stalk
    sp.fill(x, y, rx, ry, "leaf")
    for k in range(-3, 4): sp.line(x, y, x + k * rx / 3.4, y - abs(k) * ry / 7 + (ry * .55 if abs(k) == 3 else 0), "rib")

def archaefructus():   # small: thin stems with finely divided leaves and little seed pods along the tips
    sp = Sprite(44, 44, mix(FERN, (255, 255, 255), .12)); bx, by = 22, 43
    for tx, top, lean in ((-12, 26, -3), (12, 29, 3), (-4, 36, -1), (5, 40, 1)):
        x1, y1 = bx + tx + lean, by - top; sp.line(bx + tx * .15, by, x1, y1, "leaf", 1)
        for h in range(6, top - 2, 6):
            f = h / top; x = bx + tx * .15 + (x1 - bx - tx * .15) * f; y = by - h
            for d in (-1, 1): lens(sp, x, y, x + d * 5, y - 3, .8, teeth=False); lens(sp, x + d * 5, y - 3, x + d * 8, y - 7, .7, teeth=False)
        for k in range(3): sp.fill(x1 + (k - 1) * 1.2, y1 + k * 2, 1.1, 1.5, "seed")
    for x in range(bx - 3, bx + 4): sp.put(x, by + 1, "stem")
    return sp

def nelumbites():   # medium: lotus-type round leaf discs on tall stalks, a bud
    sp = Sprite(64, 50, mix(FERN, (0, 0, 0), .04)); bx, by = 32, 48
    for tx, top, rx in sorted(((-22, 20, 9), (21, 24, 9), (-8, 34, 10), (9, 30, 8), (-1, 42, 8)), key=lambda f: -f[1]):
        sp.line(bx + tx * .3, by, bx + tx, by - top, "leaf", 1); disc(sp, bx + tx, by - top - 1, rx + 2, (rx + 2) * .4)
    sp.line(bx + 15, by, bx + 17, by - 36, "leaf", 1); sp.fill(bx + 17, by - 39, 2, 3.4, "seed"); sp.put(bx + 17, by - 42, "seedhi")
    return sp

def spray(sp, x, y, side, L, drop, w=1.3):   # a feathery drooping spray of scale-leaf shoots: a stem with short blades hanging off it
    ex, ey = x + side * L, y + drop; sp.line(x, y, ex, ey, "leaf")
    for t in (.3, .55, .8, 1.0): bx_, by_ = x + (ex - x) * t, y + (ey - y) * t; blade(sp, bx_, by_, bx_ + side * 2, by_ + 7 - 2 * t, w, bowx=side * 1)

def glyptostrobus():   # large: a swamp conifer, a flared trunk and tiers of dense drooping sprays, knees at the foot
    sp = Sprite(64, 92, mix(FERN, (255, 255, 255), .04)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx, by - 60)], 3.8, 1.5)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    for kx in (-12, -8, 9, 13): sp.fill(bx + kx, by - 2, 1.6, 3.4, "stem")   # knees
    for h in range(14, 64, 6):
        r = 24 * (1 - h / 80)
        for side in (-1, 1): spray(sp, bx, by - h, side, r, -2, 1.3); spray(sp, bx, by - h + 3, side, r * .55, 1, 1.2)
    spray(sp, bx, by - 62, 1, 3, -4, 1.2); spray(sp, bx, by - 62, -1, 3, -4, 1.2)
    for h in range(14, 62, 5):
        for d in (-2, 2): blade(sp, bx + d, by - h, bx + d * 1.5, by - h + 11, 1.4)   # a curtain in front of the trunk
    return sp

def azolla():   # small: a floating mat of tiny overlapping rosettes, rust-tinged
    sp = Sprite(44, 20, mix(FERN, (255, 255, 255), .08)); sp.fill(22, 11, 20, 6, "leaf")
    for x, y in ((8, 9), (15, 12), (22, 8), (28, 12), (34, 9), (12, 14), (24, 14), (18, 7), (31, 15), (6, 12)):
        for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)): sp.put(x + dx, y + dy, "leafhi" if dx == dy == 0 else "leaf")
    for x, y in ((11, 11), (20, 12), (27, 9), (33, 12), (16, 9)): sp.put(x, y, "seed"); sp.put(x + 1, y, "seedlo")
    return sp

def salvinia():   # medium: a floating mat of paired oval leaves with a pale midrib
    sp = Sprite(60, 28, mix(FERN, (0, 0, 0), .02)); sp.fill(30, 15, 28, 8, "leaf")
    for x, y in ((10, 11), (18, 15), (26, 10), (34, 15), (42, 11), (49, 15), (14, 19), (30, 20), (46, 19), (22, 13), (38, 12)):
        for d in (-1, 1): sp.fill(x + d * 2.6, y, 2.6, 1.7, "leafhi"); sp.put(x + d * 2.6, y, "rib")
    return sp

def taxodium():   # large: a bald cypress, a flared trunk and knees, a tall tapering crown of long drooping sprays
    sp = Sprite(64, 92, mix(FERN, (255, 255, 255), .02)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 18), (bx, by - 70)], 4.4, 1.4)
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "stem")
    for kx, kh in ((-14, 7), (-10, 5), (-17, 4), (11, 6), (15, 4), (9, 3)): sp.fill(bx + kx, by - kh // 2, 1.4, kh / 2 + 1, "stem")   # knees
    for h in range(18, 74, 7):
        r = 26 * (1 - h / 96)
        for side in (-1, 1): spray(sp, bx, by - h, side, r, -3, 1.2); spray(sp, bx, by - h - 3, side, r * .6, -1, 1.1)
    for k in range(3): blade(sp, bx, by - 72, bx + (k - 1) * 3, by - 82, 1.2)
    for h in range(20, 72, 6):
        for d in (-2, 2): blade(sp, bx + d, by - h, bx + d * 1.5, by - h + 12, 1.4)   # a curtain in front of the trunk
    return sp

def typha():   # small: a clump of upright strap blades with two cigar-shaped brown heads
    sp = Sprite(44, 46, mix(FERN, (255, 255, 255), .1)); bx, by = 22, 44
    for tx, h in ((-14, 28), (-9, 34), (-4, 40), (2, 38), (8, 33), (14, 27), (0, 24)): blade(sp, bx + tx * .2, by, bx + tx, by - h, 1.5, bowx=tx * .25, bowy=-2)
    for tx, h in ((-3, 36), (5, 30)):
        sp.line(bx + tx * .5, by, bx + tx, by - h, "stem", 0); sp.fill(bx + tx, by - h - 3, 1.7, 4.2, "stem"); sp.put(bx + tx, by - h - 8, "stemlo")
    return sp

def phragmites():   # medium: a stand of tall arching reeds with feathery plumes
    sp = Sprite(64, 56, mix(FERN, (0, 0, 0), .04)); bx, by = 32, 54
    for tx, h in sorted(((-24, 24), (-18, 34), (-11, 42), (-4, 47), (3, 49), (10, 44), (17, 36), (24, 26), (-1, 30)), key=lambda f: f[1]):
        blade(sp, bx + tx * .15, by, bx + tx, by - h, 1.5, bowx=tx * .2, bowy=-3)
        if h > 33: sp.line(bx + tx, by - h, bx + tx, by - h - 1, "stem"); sp.fill(bx + tx + (1 if tx > 0 else -1), by - h - 3, 1.6, 3.8, "seedhi"); sp.put(bx + tx + (1 if tx > 0 else -1), by - h, "seedlo")
    return sp

def nyssa():   # large: a tupelo, a swollen trunk base under a rounded crown of leaf clumps
    sp = Sprite(64, 92, mix(FERN, (0, 0, 0), .12)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx - 1, by - 40), (bx, by - 62)], 4.2, 1.8)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    for cx, cy, rx, ry in sorted(((-18, 50, 12, 8), (18, 50, 12, 8), (-8, 62, 14, 9), (10, 62, 14, 9), (-20, 66, 9, 6), (20, 66, 9, 6), (0, 76, 14, 9), (-9, 79, 9, 7), (9, 79, 9, 7), (0, 66, 10, 7)), key=lambda c: c[1]):
        sp.fill(bx + cx, by - cy, rx, ry, "leaf")
        for y in range(int(by - cy - ry), int(by - cy + ry) + 1):   # the underside of each clump: rows of dark dashes
            for x in range(int(bx + cx - rx), int(bx + cx + rx) + 1):
                if sp.get(x, y) == "leaf" and y > by - cy + ry * .35 and (x + y // 2) % 3 == 0: sp.put(x, y, "leaflo")
    return sp

def sphagnum():   # small: a moss hummock, rows of short tufts, a few rusty capitula
    sp = Sprite(44, 28, mix(FERN, (255, 255, 255), .22)); sp.fill(22, 20, 20, 12, "leaf")
    for y in range(26, 7, -1):
        for x in range(2, 43):
            if sp.get(x, y) == "leaf" and y > 24: sp.put(x, y, None)   # cut flat at the foot
    for y in range(10, 25, 3):
        for x in range(4 + (y // 3 % 2) * 2, 41, 4):
            if sp.get(x, y) == "leaf": sp.put(x, y, "leafhi"); sp.put(x + 1, y, "leafhi")
    for x, y in ((12, 13), (22, 10), (30, 14), (18, 19), (28, 20), (8, 20)): sp.put(x, y, "seed"); sp.put(x + 1, y, "seedlo")
    return sp

def carex():   # medium: a tussock of arching narrow blades, a few seed spikes
    sp = Sprite(64, 50, mix(FERN, (0, 0, 0), .02)); bx, by = 32, 48
    for tx, h in sorted(((-28, 14), (-24, 24), (-17, 34), (-9, 40), (0, 42), (9, 40), (17, 33), (24, 24), (28, 14), (-4, 30), (5, 32)), key=lambda f: f[1]):
        blade(sp, bx + tx * .1, by, bx + tx, by - h, 1.2, bowx=tx * .1, bowy=-h * .55)
    for tx, h in ((-6, 38), (7, 36), (14, 28)): sp.put(bx + tx, by - h, "stem"); sp.fill(bx + tx, by - h - 2, 1, 2.4, "seed")
    return sp

def salix():   # large: a willow, a forked leaning trunk under a canopy and long weeping strands
    sp = Sprite(72, 92, mix(FERN, (0, 0, 0), .1)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx - 1, by - 20), (bx - 2, by - 38)], 3.6, 2.2)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    stem(sp, [(bx - 2, by - 36), (bx - 12, by - 52)], 1.8, 1.2); stem(sp, [(bx - 2, by - 36), (bx + 10, by - 54)], 1.8, 1.2)
    for cx, cy, rx, ry in ((-12, 55, 12, 6), (11, 56, 12, 6), (0, 62, 14, 7)): sp.fill(bx + cx, by - cy, rx, ry, "leaf")
    for x0, y0, side in ((-22, 55, -1), (-16, 52, -1), (-9, 50, -1), (-2, 52, 1), (5, 50, 1), (12, 51, 1), (19, 53, 1), (24, 56, 1), (-6, 60, -1), (2, 62, 1), (-17, 59, -1), (14, 60, 1)):
        blade(sp, bx + x0, by - y0, bx + x0 + side * 2, by - y0 + 34 - abs(x0) * .3, 1.2, bowx=side * 3, bowy=0)
    return sp

PINK = tones((236, 170, 190))   # water lily blossom: base, lit, shaded

def q_bald_cypress():   # large: a modern bald cypress, a fluted flared trunk with knees and tiers of feathery sprays, a touch of autumn gold
    sp = Sprite(64, 92, mix(FERN, (150, 150, 50), .3)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 16), (bx, by - 66)], 4.6, 1.4)
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 30, -3): sp.put(bx - 2, y, "stemlo"); sp.put(bx + 2, y, "stemlo")   # flutes
    for kx, kh in ((-15, 8), (-11, 5), (-18, 4), (12, 7), (16, 4), (9, 3)): sp.fill(bx + kx, by - kh // 2, 1.4, kh / 2 + 1, "stem")
    for h in range(16, 70, 8):
        r = 28 * (1 - h / 92)
        for side in (-1, 1): spray(sp, bx, by - h, side, r, -2, 1.3); spray(sp, bx, by - h - 3, side, r * .6, 0, 1.2)
        for d in (-2, 2): blade(sp, bx + d, by - h, bx + d * 1.5, by - h + 11, 1.4)
    for k in range(3): blade(sp, bx, by - 68, bx + (k - 1) * 3, by - 80, 1.2)
    for x, y in ((14, 40), (46, 30), (24, 22), (40, 54), (20, 62)): sp.put(x, y, "seed"); sp.put(x + 1, y, "seedhi")   # a few gold sprays
    return sp

def q_weeping_willow():   # large: a broad willow, thick leaning limbs and a full curtain of strands to the ground
    sp = Sprite(72, 92, mix(FERN, (170, 170, 60), .3)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx - 1, by - 18), (bx - 2, by - 34)], 4.2, 2.6)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    for lx in (-14, -4, 9, 16): stem(sp, [(bx - 2, by - 32), (bx + lx, by - 52)], 1.8, 1.2)
    for cx, cy, rx, ry in ((-13, 54, 13, 7), (12, 55, 13, 7), (0, 62, 16, 8), (-3, 52, 10, 5)): sp.fill(bx + cx, by - cy, rx, ry, "leaf")
    for x0, y0, side in ((-26, 54, -1), (-22, 52, -1), (-18, 50, -1), (-14, 49, -1), (-10, 49, -1), (-5, 52, -1), (-1, 52, 1), (4, 50, 1), (9, 49, 1), (13, 49, 1), (17, 50, 1), (21, 52, 1), (25, 54, 1), (-8, 60, -1), (0, 62, 1), (8, 60, 1), (-18, 58, -1), (18, 58, 1)):
        blade(sp, bx + x0, by - y0, bx + x0 + side * 2, by - y0 + 36 - abs(x0) * .4, 1.2, bowx=side * 3)
    return sp

def q_mangrove():   # medium: a dense glossy dome on arching prop roots that wade into the water
    sp = Sprite(64, 56, mix(FERN, (0, 0, 0), .06)); bx, by = 32, 54
    for tx, hh in ((-24, 20), (-17, 18), (-9, 15), (9, 15), (17, 18), (24, 20)):
        pts = [bez((bx + tx * .15, by - hh), (bx + tx * .7, by - hh - 5), (bx + tx, by), t / 6) for t in range(7)]
        stem(sp, pts, 1.6, 1.2)
    stem(sp, [(bx, by + 1), (bx, by - 30)], 2.8, 2.2)
    for cx, cy, rx, ry in sorted(((-14, 31, 13, 8), (14, 31, 13, 8), (0, 37, 17, 9), (-8, 41, 11, 6), (9, 41, 11, 6)), key=lambda c: c[1]):
        sp.fill(bx + cx, by - cy, rx, ry, "leaf")
        for y in range(int(by - cy - ry), int(by - cy + ry) + 1):
            for x in range(int(bx + cx - rx), int(bx + cx + rx) + 1):
                if sp.get(x, y) == "leaf" and y > by - cy + ry * .35 and (x + y // 2) % 3 == 0: sp.put(x, y, "leaflo")
        for x in range(int(bx + cx - rx * .6), int(bx + cx + rx * .3), 4): sp.put(x, int(by - cy - ry * .45), "leafhi")   # glossy highlights
    return sp

def q_cattails():   # small: a dense clump of blades, three brown heads
    sp = Sprite(44, 46, mix(FERN, (255, 255, 255), .08)); bx, by = 22, 44
    for tx, h in ((-15, 26), (-11, 32), (-7, 36), (-2, 42), (3, 40), (8, 35), (12, 31), (16, 25), (-4, 28), (6, 29)): blade(sp, bx + tx * .2, by, bx + tx, by - h, 1.6, bowx=tx * .25, bowy=-2)
    for tx, h in ((-5, 37), (2, 32), (9, 28)):
        sp.line(bx + tx * .5, by, bx + tx, by - h, "stem", 0); sp.fill(bx + tx, by - h - 3, 1.8, 4.4, "stem"); sp.put(bx + tx, by - h - 8, "stemlo")
    return sp

def q_water_lily():   # small: flat round pads with a notch and ribs, two pink blossoms
    sp = Sprite(48, 26, mix(FERN, (255, 255, 255), .08)); sp.C.update(pink=PINK[0], pinkhi=PINK[1], pinklo=PINK[2])
    for x, y, rx, ry in ((13, 20, 11, 3.8), (35, 19, 10, 3.5), (24, 23, 8, 2.6), (44, 23, 4, 1.8)):
        sp.fill(x, y, rx, ry, "leaf")
        for k in (-.7, 0, .7): sp.line(x, y, x + k * rx * .8, y + abs(k) * ry * .5, "rib", 0)
        for dx in (1, 2, 3): sp.put(x + int(rx) - dx, y, None)   # the notch
    for x, y in ((19, 13), (37, 11)):
        for dx, dy, c in ((0, -3, "pinkhi"), (-1, -2, "pinkhi"), (1, -2, "pink"), (-2, -1, "pinkhi"), (-1, -1, "pink"), (0, -1, "pink"), (1, -1, "pink"), (2, -1, "pink"),
                          (-3, 0, "pink"), (-2, 0, "pink"), (-1, 0, "seed"), (0, 0, "seedhi"), (1, 0, "seed"), (2, 0, "pink"), (3, 0, "pinklo"),
                          (-2, 1, "pinklo"), (-1, 1, "pink"), (0, 1, "pink"), (1, 1, "pinklo"), (2, 1, "pinklo")): sp.put(x + dx, y + dy, c)
        sp.put(x, y + 2, "leaflo"); sp.put(x, y + 3, "leaflo")
    return sp

def q_cypress_knees():   # small: five knobbly woody knees apart from each other, rounded tops, a little moss between them
    sp = Sprite(40, 34, mix(FERN, (255, 255, 255), .1)); bx, by = 20, 32
    for kx, kh, lean in ((-15, 10, 1), (-8, 18, 1), (0, 24, 0), (8, 15, -1), (15, 9, -1)):
        stem(sp, [(bx + kx, by + 1), (bx + kx + lean, by - kh * .5), (bx + kx + lean * 2, by - kh)], 3.2, 1.8)
        sp.fill(bx + kx + lean * 2, by - kh, 1.8, 1.4, "stem"); sp.put(bx + kx + lean * 2 - 1, by - kh - 1, "stemhi")
    for x in range(bx - 17, bx + 18, 3): sp.put(x, by + 1, "leaf"); sp.put(x + 1, by + 1, "leaf")
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
REG = [("dev-wetland-small", rhynia), ("dev-wetland-medium", aglaophyton), ("dev-wetland-large", pseudosporochnus),
       ("car-wetland-small", asterophyllites), ("car-wetland-medium", medullosa), ("car-wetland-large", sigillaria),
       ("jur-wetland-small", coniopteris), ("jur-wetland-medium", todites), ("jur-wetland-large", matonidium)]
REG += [("cre-wetland-small", archaefructus), ("cre-wetland-medium", nelumbites), ("cre-wetland-large", glyptostrobus),
        ("pal-wetland-small", azolla), ("pal-wetland-medium", salvinia), ("pal-wetland-large", taxodium),
        ("neo-wetland-small", typha), ("neo-wetland-medium", phragmites), ("neo-wetland-large", nyssa),
        ("qua-wetland-small", sphagnum), ("qua-wetland-medium", carex), ("qua-wetland-large", salix)]
REG += [("q-bald-cypress", q_bald_cypress), ("q-weeping-willow", q_weeping_willow), ("q-mangrove", q_mangrove),
        ("q-cattails", q_cattails), ("q-water-lily", q_water_lily), ("q-cypress-knees", q_cypress_knees)]
for key, fn in [("per-wetland-small", annularia), ("per-wetland-medium", pecopteris), ("per-wetland-large", arthropitys),
                ("tri-wetland-small", equisetites), ("tri-wetland-medium", cladophlebis), ("tri-wetland-large", heidiphyllum)] + REG:
    fn().save(f"{out}/{key}.png")
