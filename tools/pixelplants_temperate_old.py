# Draws the temperate landscape plants of the Devonian, Carboniferous and Permian in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_scrubland.py,
# because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges. Leaves lean fresh green for the temperate woods.
#   dev-  Gosslingia (upright forked stems with kidney sporangia down one side), Barinophyton (a stem with paired side branches ending in fertile spikes), Archaeopteris (a tall tree, flat branch systems hung with wedge leaves)
#   car-  Neuropteris (a low sprawl of arching fronds with big rounded pinnules), Alethopteris (a short trunk crowned by long fronds with tongue-shaped pinnules), Cordaites (a tall tree, tufts of long strap leaves at the branch tips)
#   per-  Sphenobaiera (a rosette of wedge leaves forked at the tip), Rufloria (a shrubby tree with broad parallel-veined straps), Ginkgophyllum (a tree hung with deeply cut fan leaves)
# Usage: python3 -I tools/pixelplants_temperate_old.py [outdir]
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

def kidney(sp, x, y, side=1):   # a small kidney-shaped sporangium sitting on the stem
    sp.fill(x + side, y, 1.6, 1.2, "seed"); sp.put(x + side - 1, y - 1, "seedhi"); sp.put(x + side + 1, y + 1, "seedlo")

def gosslingia():   # small: a few upright forked stems with kidney sporangia in a row down one side
    sp = Sprite(40, 44, lf(.08)); bx, by = 20, 42
    for ang, L, x, top in ((-.5, 22, -6, 28), (.45, 24, 6, 32), (0, 30, 0, 38), (-.2, 16, -2, 22), (.25, 16, 3, 24)):
        x1, y1 = bx + x + math.sin(ang) * L, by - math.cos(ang) * L; sp.line(bx + x, by, x1, y1, "leaf", 1)
        for i in range(3, int(L) - 2, 4):
            t = i / L; kidney(sp, bx + x + (x1 - bx - x) * t, by + (y1 - by) * t, 1 if (i // 4) % 2 else -1)
        sp.fill(x1, y1 - 1, 1.2, 1.8, "seed")
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    return sp

def barinophyton():   # medium: an upright stem with paired side branches that curl up into fertile spikes
    sp = Sprite(64, 56, lf(0)); bx, by = 32, 54
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx, by - 44)], 1.6, 1.0)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for h, L in ((8, 22), (18, 20), (28, 15), (36, 9)):
        for side in (-1, 1):
            x0, y0 = bx, by - h; xm, ym = bx + side * L * .7, y0 - 3; x1, y1 = bx + side * L, y0 - 9 - L * .3
            sp.line(x0, y0, xm, ym, "leaf", 1); sp.line(xm, ym, x1, y1, "leaf", 1)
            for k in range(4):   # a spike of paired sporangia on the branch tip
                t = k / 4; sx, sy = xm + (x1 - xm) * t, ym + (y1 - ym) * t; sp.fill(sx + side, sy - 1, 1.3, 1.8, "seed"); sp.put(sx + side - 1, sy - 2, "seedhi")
    for k in range(4): sp.fill(bx + (k % 2) * 2 - 1, by - 46 - k * 1.6, 1.3, 1.8, "seed")
    return sp

def archaeopteris():   # large: the first true tree, a tall straight trunk with flat branch systems hung with small wedge leaves
    sp = Sprite(64, 92, lf(-.1)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx, by - 56)], 4.2, 1.6)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    scars(sp, bx, by - 3, by - 40, 3, 4)
    for h, L in ((40, 24), (50, 26), (60, 24), (69, 19), (77, 13)):
        for side in (-1, 1):
            x0, y0 = bx, by - h; ex, ey = bx + side * L, y0 + 4 + L * .12
            sp.line(x0, y0, ex, ey, "stem", 1)
            for t in (.3, .5, .7, .9):   # the flat branch: wedge leaves in tufts above and below the axis
                px, py = x0 + (ex - x0) * t, y0 + (ey - y0) * t
                lens(sp, px, py, px + side * 3, py - 6 - 2 * t, 1.5, teeth=False); lens(sp, px, py, px + side * 4, py + 6, 1.5, teeth=False)
            for dx in range(2, int(L), 3): sp.put(x0 + side * dx, y0 + (ey - y0) * dx / L - 3, "leafhi")
    for k in range(3): lens(sp, bx, by - 78, bx + (k - 1) * 4, by - 90 + abs(k - 1) * 2, 1.4, teeth=False)
    return sp

def neuropteris():   # small: a low sprawl of arching fronds, each a row of big rounded, heart-based pinnules
    sp = Sprite(44, 38, lf(.08)); bx, by = 22, 36
    for ang, L in ((-1.25, 19), (-.7, 20), (-.15, 21), (.4, 21), (1.0, 20), (1.4, 17)):
        ex, ey = bx + math.sin(ang) * L, by - 4 - math.cos(ang) * L * .8; cx, cy = bx + math.sin(ang) * L * .5, by - 8 - math.cos(ang) * L * .95
        sp.line(bx, by, cx, cy, "stem"); sp.line(cx, cy, ex, ey, "stem")
        for i, t in enumerate((.35, .55, .75, .95)):
            px, py = bez((bx, by), (cx, cy), (ex, ey), t); sp.fill(px, py - 2, 2.6 - i * .2, 1.9, "leaf"); sp.fill(px, py + 2, 2.6 - i * .2, 1.9, "leaf")
        sp.fill(ex, ey, 1.6, 1.3, "leaf")
    for x in range(bx - 3, bx + 4): sp.put(x, by + 1, "stem")
    return sp

def alethopteris():   # medium: a short trunk crowned by long arching fronds, each a comb of tongue-shaped pinnules
    sp = Sprite(64, 58, lf(-.03)); bx, by = 32, 56
    stem(sp, [(bx, by + 1), (bx, by - 12), (bx, by - 20)], 3.2, 2.4)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 20, -3): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y + 1, "stemlo")
    for ang, L, rise in ((-1.35, 28, 14), (-.8, 28, 24), (-.3, 22, 30), (.3, 22, 30), (.8, 28, 24), (1.35, 28, 14), (0, 12, 34)):
        tip = (bx + math.sin(ang) * L, by - 20 - rise * .75 + abs(ang) * 7); ctrl = (bx + math.sin(ang) * L * .55, by - 20 - rise * 1.15)
        frond(sp, (bx, by - 20), ctrl, tip, 3.6 if L > 15 else 2.6, int(L / 3.2), notch=.38)
    return sp

def cordaites():   # large: a tall slender tree, bare straight trunk, tufts of long strap leaves at the ends of a few branches
    sp = Sprite(64, 92, lf(-.12)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 60)], 3.6, 2.0)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 56, -3): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y + 1, "stemlo")
    tufts = ((-18, 66), (17, 70), (-9, 80), (8, 84), (0, 88), (-22, 52), (22, 56))
    for tx, ty in tufts:
        stem(sp, [(bx, by - 54), (bx + tx * .5, by - ty + 6), (bx + tx, by - ty)], 1.5, 1.0)
        for k in range(-3, 4): blade(sp, bx + tx, by - ty, bx + tx + k * 4.5 + (3 if tx > 0 else -3) * (abs(k) > 1), by - ty - 10 + abs(k) * 2.5, 1.5, bowx=k * 1.5)
    return sp

def sphenobaiera():   # small: a rosette of wedge-shaped leaves, each forked at the tip, on a short stalk
    sp = Sprite(44, 36, lf(.08)); bx, by = 22, 34
    for a in (-1.2, -.7, -.25, .25, .7, 1.2):
        L = 21 - abs(a) * 3; sx, sy = bx + math.sin(a) * L, by - 4 - math.cos(a) * L
        lens(sp, bx, by, sx, sy, 2.0, teeth=False)   # the wedge, narrow at the stalk, then forked into two lobes at the tip
        for d in (-1, 1): lens(sp, sx - math.sin(a) * 5, sy + math.cos(a) * 5, sx + d * 3 + math.sin(a) * 2, sy - 5, 1.5, teeth=False)
    for x in range(bx - 4, bx + 5): sp.put(x, by + 1, "stem")
    return sp

def rufloria():   # medium: a shrubby cordaitalean, a short stem under a crown of broad strap leaves with parallel veins
    sp = Sprite(66, 54, lf(0)); bx, by = 33, 52
    stem(sp, [(bx, by + 1), (bx, by - 10), (bx, by - 18)], 2.8, 2.2)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for ang, L in ((-1.3, 27), (-.95, 31), (-.55, 34), (-.2, 34), (.2, 34), (.55, 34), (.95, 31), (1.3, 27)):
        ex, ey = bx + math.sin(ang) * L, by - 18 - math.cos(ang) * L * .95 + 3 * abs(ang)
        for t0, t1 in ((0, .25), (.25, .5), (.5, .75), (.75, 1)):   # broad blade bowing out, vein lines down it
            a = bez((bx, by - 18), ((bx + ex) / 2, by - 18 - L * .9), (ex, ey), t0); b = bez((bx, by - 18), ((bx + ex) / 2, by - 18 - L * .9), (ex, ey), t1)
            lens(sp, *a, *b, 2.8 - 1.4 * t0, teeth=False)
    return sp

def ginkgophyllum():   # large: a tree hung with deeply cut fan leaves, a gappy crown that shows the limbs
    sp = Sprite(72, 92, lf(-.1)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx + 1, by - 40)], 4.0, 2.4)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 38, -3): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y + 1, "stemlo")
    limbs = ((-22, 56), (-12, 68), (0, 78), (13, 66), (23, 54), (-5, 54), (8, 82))
    for lx, ly in limbs: stem(sp, [(bx + 1, by - 38), (bx + lx * .5, by - ly + 8), (bx + lx, by - ly)], 1.7, 1.1)
    for lx, ly in sorted(limbs, key=lambda l: l[1]):   # a spray of fans on each limb tip, cut into narrow lobes
        for k, (dx, dy) in enumerate(((0, 0), (-6, 4), (6, 4), (-3, -5), (4, -4))):
            x, y = bx + lx + dx, by - ly + dy; sp.line(x, y + 3, x, y + 1, "stem")
            for j in range(-3, 4):
                a = j / 3 * 1.0; Lg = 7 - (1 if j == 0 else 0); sp.line(x, y, x + math.sin(a) * Lg, y - math.cos(a) * Lg, "leaf", 0)
                sp.line(x + (1 if j > 0 else -1) * (j != 0), y, x + math.sin(a) * Lg * .6 + (1 if j > 0 else -1) * (j != 0), y - math.cos(a) * Lg * .6, "leaf", 0)
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("dev-temperate-small", gosslingia), ("dev-temperate-medium", barinophyton), ("dev-temperate-large", archaeopteris),
                ("car-temperate-small", neuropteris), ("car-temperate-medium", alethopteris), ("car-temperate-large", cordaites),
                ("per-temperate-small", sphenobaiera), ("per-temperate-medium", rufloria), ("per-temperate-large", ginkgophyllum)):
    fn().save(f"{out}/{key}.png")
