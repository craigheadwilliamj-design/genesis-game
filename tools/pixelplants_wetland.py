# Draws the Permian and Triassic wetland plants in the Dimetrodon's flat, simple style (same helpers and rules as tools/pixelplants_flat.py, copied because -I scripts can't import each other):
# flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges, a lighter rib and rhythmic grooves. Leaves lean blue-green for the wet ground.
#   per-wetland-small   Annularia: a slender jointed stem with flat whorls of narrow lanceolate leaves
#   per-wetland-medium  Pecopteris: a short trunk with a wide crown of arching bipinnate fronds
#   per-wetland-large   Arthropitys: a tall jointed calamite trunk, ribbed, with whorled branches
#   tri-wetland-small   Equisetites: a clump of jointed horsetail stalks with sheath rings, one cone
#   tri-wetland-medium  Cladophlebis: a broad crown of arching fern fronds with wide pinnae
#   tri-wetland-large   Heidiphyllum: a conifer with a trunk and branches ending in tufts of long strap leaves
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

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("per-wetland-small", annularia), ("per-wetland-medium", pecopteris), ("per-wetland-large", arthropitys),
                ("tri-wetland-small", equisetites), ("tri-wetland-medium", cladophlebis), ("tri-wetland-large", heidiphyllum)):
    fn().save(f"{out}/{key}.png")
