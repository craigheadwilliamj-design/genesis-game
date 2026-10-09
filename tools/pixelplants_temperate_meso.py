# Draws the temperate landscape plants of the Triassic, Jurassic and Cretaceous in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_temperate_old.py,
# because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges.
#   tri-  Baiera (a few fans of narrow ginkgo-like strap lobes), Podozamites (a shrub of arching shoots hung with broad lance leaflets), Elatocladus (a conifer in flat tiers of feathery sprays)
#   jur-  Ginkgoites (solid fan leaves notched at the tip), Czekanowskia (a wiry shrub with tufts of hair-fine leaves), Araucarites (a tall monkey-puzzle tree, scaly branches in tiers)
#   cre-  Ficophyllum (a low early flowering shrub, ovate veined leaves), Credneria (a plane-like tree, big toothed palmate leaves), Sequoia (a huge fluted trunk under a drooping conical crown)
# Usage: python3 -I tools/pixelplants_temperate_meso.py [outdir]
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

def strap(sp, x0, y0, x1, y1, w):   # a long strap leaf bowing downward: a bent narrow lens with a rib
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2 - 3
    for t0, t1 in ((0, .5), (.5, 1)):
        a = bez((x0, y0), (mx, my - 4), (x1, y1), t0); b = bez((x0, y0), (mx, my - 4), (x1, y1), t1); lens(sp, *a, *b, w, teeth=False)

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

def spray(sp, x, y, side, L, drop, w=1.3):   # a feathery drooping spray of scale-leaf shoots: a stem with short blades hanging off it
    ex, ey = x + side * L, y + drop; sp.line(x, y, ex, ey, "leaf")
    for t in (.3, .55, .8, 1.0): bx_, by_ = x + (ex - x) * t, y + (ey - y) * t; blade(sp, bx_, by_, bx_ + side * 2, by_ + 7 - 2 * t, w, bowx=side * 1)

def disc(sp, x, y, rx, ry):   # a round floating-type leaf seen at a slant: a flat ellipse with ribs radiating from the stalk
    sp.fill(x, y, rx, ry, "leaf")
    for k in range(-3, 4): sp.line(x, y, x + k * rx / 3.4, y - abs(k) * ry / 7 + (ry * .55 if abs(k) == 3 else 0), "rib")

def scale_shoot(sp, x0, y0, x1, y1, th):
    # a shoot of tight scale leaves: a thick band tapering to a tip, with a regular row of short dark dashes (the scales)
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1; dx, dy = x1 - x0, y1 - y0; d = math.hypot(dx, dy) or 1; nx, ny = -dy / d, dx / d
    for i in range(n + 1):
        t = i / n; w = th * (1 - .6 * t)
        for k in range(-int(w * 2) - 1, int(w * 2) + 2):
            if abs(k / 2) <= w: sp.put(x0 + dx * t + nx * k / 2, y0 + dy * t + ny * k / 2, "leaf")
    for i in range(2, n - 1, 5):
        t = i / n; w = th * (1 - .6 * t)
        for k in (-1, 1):
            if abs(k) < w: sp.put(x0 + dx * t + nx * k * .8, y0 + dy * t + ny * k * .8, "leaflo")




LEAF = mix(OLIVE, (50, 150, 60), .28)   # the temperate leaf, a little more olive than the Quaternary woods
def lf(t): return mix(LEAF, (255, 255, 255), t) if t > 0 else mix(LEAF, (0, 0, 0), -t)
def base(sp, bx, by, hw):
    for x in range(bx - hw, bx + hw + 1): sp.put(x, by + 1, "stem")

def pinnate(sp, p0, ctrl, p1, n, L, w, ang=.9, both=True):   # a shoot with a leaflet pair at each step, angled forward and drooping a little
    sp.line(*p0, *p1, "leaf") if False else None
    for i in range(0, 41): sp.put(*bez(p0, ctrl, p1, i / 40), "leaf")
    for i in range(1, n + 1):
        t = i / (n + 1); x, y = bez(p0, ctrl, p1, t); tx, ty = tangent(p0, ctrl, p1, t); d = math.hypot(tx, ty) or 1; tx, ty = tx / d, ty / d
        l = L * (1 - .45 * t)
        for side in ((-1, 1) if both else (1,)):
            a = side * ang; dx, dy = tx * math.cos(a) - ty * math.sin(a), tx * math.sin(a) + ty * math.cos(a)
            lens(sp, x, y, x + dx * l, y + dy * l + .08 * l * l / 5, w, teeth=False)

def solid_fan(sp, x, y, ang, L, spread, notch=0.0, ribs=3):   # a wedge leaf: filled sector, an optional notch cut at the tip, a few veins fanning from the stalk
    r = 0.0
    while r <= L:
        m = int(r * spread * 2.2) + 2
        for k in range(m + 1):
            a = ang + (k / m - .5) * spread
            if notch and abs(a - ang) < notch * (r / L) ** 3 and r > L * .55: continue
            sp.put(x + math.sin(a) * r, y - math.cos(a) * r, "leaf")
        r += .45
    for k in range(ribs):
        a = ang + ((k + .5) / ribs - .5) * spread * .9
        for r in range(2, int(L) - 1): sp.put(x + math.sin(a) * r, y - math.cos(a) * r, "rib")

def oval(sp, x, y, ang, L, w, key="leaf"):   # a rotated pointed oval from its base (x, y) out along ang (0 is up), widest a third of the way
    c, s = math.cos(ang), math.sin(ang)
    for py in range(int(y - L) - 3, int(y + L) + 4):
        for px in range(int(x - L) - 3, int(x + L) + 4):
            u = (px - x) * s - (py - y) * c; v = (px - x) * c + (py - y) * s
            if 0 <= u <= L and abs(v) <= w * math.sin(math.pi * (u / L) ** .75) ** .9 + (.35 if int(u) % 3 == 0 and w > 3 else 0): sp.put(px, py, key)

def veined(sp, x, y, ang, L, w, pairs=3):   # a broad leaf with a midrib and side veins
    oval(sp, x, y, ang, L, w)
    c, s = math.cos(ang), math.sin(ang)
    for r in range(1, int(L) - 1): sp.put(x + s * r, y - c * r, "rib")
    for i in range(1, pairs + 1):
        u = L * (.15 + .65 * i / (pairs + 1)); bxx, byy = x + s * u, y - c * u
        for side in (-1, 1):
            for r in range(1, int(w * .75 * (1 - u / L) + 2)): sp.put(bxx + s * r * .6 + c * side * r, byy - c * r * .6 + s * side * r, "leaflo" if r > 1 else "rib")

def palm_leaf(sp, x, y, ang, L, w):   # a big rounded toothed leaf with veins fanning from the stalk (plane-tree style)
    c, s = math.cos(ang), math.sin(ang)
    for py in range(int(y - L) - 3, int(y + L) + 4):
        for px in range(int(x - L) - 3, int(x + L) + 4):
            u = (px - x) * s - (py - y) * c; v = (px - x) * c + (py - y) * s
            if u < 0 or u > L: continue
            e = math.sqrt(max(0, 1 - ((u - L * .5) / (L * .5)) ** 2)); lim = w * e * (1.0 + (.1 if int(u) % 3 == 0 else 0))
            if abs(v) <= lim: sp.put(px, py, "leaf")
    for k in (-1, 0, 1):
        a = ang + k * .55
        for r in range(1, int(L * (.85 if k else 1)) - 1): sp.put(x + math.sin(a) * r, y - math.cos(a) * r, "rib")

def feather(sp, x0, y0, x1, y1, L, w=1.0, step=2):   # a flat branchlet: a stem with short needles both sides, swept toward the tip
    sp.line(x0, y0, x1, y1, "leaf")
    n = int(math.hypot(x1 - x0, y1 - y0) / step)
    for i in range(1, n + 1):
        t = i / (n + 1); x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t; l = L * (1 - .5 * t) + .5
        for side in (-1, 1): lens(sp, x, y, x + side * l, y + l * .5, w, teeth=False)

# Triassic
def baiera():   # small: a few stalked fans cut into narrow strap lobes (a ginkgo relative)
    sp = Sprite(44, 38, lf(-.06)); bx, by = 22, 36
    for dx, tx, ty, L, sp_ in ((-9, -14, 14, 13, 1.7), (9, 14, 14, 13, 1.7), (0, 0, 8, 17, 2.1), (-3, -7, 22, 10, 1.5), (3, 7, 22, 10, 1.5)):
        sx, sy = bx + tx * .5, by - ty
        sp.line(bx + dx * .3, by, sx, sy, "stem", 1); ang = math.atan2(tx, ty + 6) * .8
        for j in range(6):
            a = ang + (j / 5 - .5) * sp_; lens(sp, sx, sy, sx + math.sin(a) * L, sy - math.cos(a) * L, 1.0, teeth=False)
    base(sp, bx, by, 4)
    return sp

def podozamites():   # medium: arching shoots hung with two rows of broad lance leaflets
    sp = Sprite(64, 56, lf(-.12)); bx, by = 32, 54
    stem(sp, [(bx, by + 1), (bx, by - 8), (bx, by - 14)], 2.6, 2.0); base(sp, bx, by, 5)
    for ang, L, rise in ((-1.4, 27, 10), (-.9, 28, 20), (-.4, 24, 30), (0, 14, 34), (.4, 24, 30), (.9, 28, 20), (1.4, 27, 10)):
        tip = (bx + math.sin(ang) * L, by - 14 - rise * .6 + abs(ang) * 5); ctrl = (bx + math.sin(ang) * L * .5, by - 14 - rise * 1.2)
        pinnate(sp, (bx, by - 14), ctrl, tip, 5 if L > 20 else 3, 9 if L > 20 else 6, 1.8, ang=1.0)
    return sp

def elatocladus():   # large: a conifer in flat tiers, each branch a feathery spray, thinning to the top
    sp = Sprite(72, 92, lf(-.1)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 80)], 3.4, 1.2); base(sp, bx, by, 6)
    for y in range(by - 4, by - 36, -3): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y + 1, "stemlo")
    for h, L in ((26, 27), (36, 28), (46, 25), (56, 22), (65, 17), (73, 11)):
        for side in (-1, 1):
            y0 = by - h; feather(sp, bx, y0, bx + side * L, y0 + 4 + L * .1, 5.0 if L > 15 else 3.5)
    for k in range(3): lens(sp, bx, by - 80, bx + (k - 1) * 3, by - 90 + abs(k - 1), 1.1, teeth=False)
    return sp

# Jurassic
def ginkgoites():   # small: a cluster of solid fan leaves on stalks, each notched at the tip
    sp = Sprite(44, 38, lf(-.04)); bx, by = 22, 36
    for dx, tx, ty, L, a in ((-12, -14, 10, 14, -.45), (12, 14, 10, 14, .45), (0, 0, 6, 18, 0), (-5, -7, 21, 12, -.2), (5, 7, 21, 12, .2)):
        sx, sy = bx + tx * .6, by - ty
        sp.line(bx + dx * .3, by, sx, sy, "stem", 1); solid_fan(sp, sx, sy, a, L, 2.0, notch=.3, ribs=4)
    base(sp, bx, by, 4)
    return sp

def czekanowskia():   # medium: a wiry shrub, slender forking stems each ending in a tuft of hair-fine leaves
    sp = Sprite(64, 54, lf(-.1)); bx, by = 32, 52
    stem(sp, [(bx, by + 1), (bx, by - 8)], 2.2, 1.8); base(sp, bx, by, 4)
    shoots = ((-22, 24), (-14, 36), (-5, 44), (6, 40), (15, 34), (23, 22), (0, 30))
    for tx, ty in shoots:
        sp.line(bx, by - 8, bx + tx, by - ty, "stem", 1)
        for k in range(-3, 4): blade(sp, bx + tx, by - ty, bx + tx + k * 3.2, by - ty - 11 + abs(k) * 2.2 + 3, 0.9, bowx=k * .8)
        mx, my = bx + tx * .55, by - 8 - (ty - 8) * .55   # a side tuft midway
        for k in (-2, -1, 0, 1, 2): blade(sp, mx, my, mx + k * 3 + (4 if tx > 0 else -4), my + 4 + abs(k), 0.8, bowy=2)
    return sp

def araucarites():   # large: a tall straight trunk with whorled branches thick with scale leaves, turned up at the ends, a rounded top
    sp = Sprite(72, 92, lf(-.14)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 78)], 3.8, 1.6); base(sp, bx, by, 7)
    scars(sp, bx, by - 3, by - 44, 3, 4)
    for h, L in ((36, 27), (45, 27), (54, 24), (62, 21), (70, 16), (77, 10)):
        for side in (-1, 1):
            y0 = by - h; ex, ey = bx + side * L, y0 + 4
            scale_shoot(sp, bx, y0, bx + side * L * .8, y0 + 5, 2.3); scale_shoot(sp, bx + side * L * .8, y0 + 5, ex + side * 2, y0 - 6 - L * .12, 1.7)
    for k in range(5): scale_shoot(sp, bx, by - 78, bx + (k - 2) * 2.5, by - 89 + abs(k - 2) * 1.5, 1.8)
    for cx, cy in ((-14, 62), (16, 70), (4, 80)): sp.fill(bx + cx, by - cy, 2.4, 3, "seed"); sp.put(bx + cx - 1, by - cy - 2, "seedhi")
    return sp

# Cretaceous
def ficophyllum():   # small: a low early flowering shrub, forked woody stems with ovate net-veined leaves
    sp = Sprite(44, 38, lf(0)); bx, by = 22, 36
    for tx, ty in ((-13, 24), (13, 24), (0, 30), (-6, 14), (7, 14)):
        sp.line(bx, by, bx + tx * .9, by - ty * .7, "stem", 1)
    for tx, ty, a, L in ((-15, 28, -.9, 13), (15, 28, .9, 13), (0, 34, 0, 14), (-8, 20, -.5, 11), (9, 20, .5, 11), (-17, 14, -1.3, 10), (17, 14, 1.3, 10)):
        veined(sp, bx + tx * .8, by - ty * .62, a, L, 3.6, pairs=2)
    base(sp, bx, by, 4)
    return sp

def credneria():   # medium: a plane-like tree, a short stem under big rounded toothed leaves with fanning veins
    sp = Sprite(64, 56, lf(-.12)); bx, by = 32, 54
    stem(sp, [(bx, by + 1), (bx, by - 14), (bx - 1, by - 22)], 3.2, 2.2); base(sp, bx, by, 6)
    for y in range(by - 4, by - 20, -3): sp.put(bx - 1, y, "stemlo")
    for tx, ty in ((-14, 28), (14, 30)): sp.line(bx - 1, by - 20, bx + tx, by - ty, "stem", 1)
    for x0, y0, a, L, w in ((bx + 14, by - 30, 1.0, 18, 9), (bx - 14, by - 28, -1.0, 18, 9), (bx - 1, by - 22, -.3, 24, 10), (bx - 1, by - 22, .35, 24, 10), (bx - 14, by - 28, -.35, 17, 8), (bx + 14, by - 30, .4, 17, 8), (bx - 1, by - 22, 0, 20, 8)):
        palm_leaf(sp, x0, y0, a, L, w)
    return sp

def sequoia():   # large: a thick fluted trunk with a flared foot, a dense conical crown of drooping feathery sprays
    sp = Sprite(72, 92, lf(-.16)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 80)], 5.6, 1.8)
    for x in range(bx - 9, bx + 10): sp.put(x, by + 1, "stem"); sp.put(x, by, "stem")
    for y in range(by - 3, by - 44, -4):
        for dx in (-3, 0, 3): sp.put(bx + dx + (y // 4) % 2, y, "stemlo"); sp.put(bx + dx + (y // 4) % 2, y - 1, "stemlo")
    for h, L in ((30, 24), (38, 26), (46, 25), (54, 22), (62, 19), (69, 15), (75, 10)):
        for side in (-1, 1):
            y0 = by - h; feather(sp, bx, y0, bx + side * L, y0 + 8 + L * .22, 4.0 if L > 14 else 3.0, w=.9)
            feather(sp, bx + side * L * .5, y0 + 4 + L * .1, bx + side * L * .85, y0 + 14 + L * .3, 3.0, w=.9)
    for k in range(3): lens(sp, bx, by - 80, bx + (k - 1) * 2, by - 90 + abs(k - 1), 1.0, teeth=False)
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("tri-temperate-small", baiera), ("tri-temperate-medium", podozamites), ("tri-temperate-large", elatocladus),
                ("jur-temperate-small", ginkgoites), ("jur-temperate-medium", czekanowskia), ("jur-temperate-large", araucarites),
                ("cre-temperate-small", ficophyllum), ("cre-temperate-medium", credneria), ("cre-temperate-large", sequoia)):
    fn().save(f"{out}/{key}.png")
