# Draws the desert landscape plants of the Paleogene, Neogene and Quaternary in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_desert_old.py,
# because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges. Modern desert plants: leaves are sage and olive, cacti a cool blue-green.
#   pal-  Tamarisk (small: arching feathery sprays with pink plumes), Haloxylon (medium: a gnarled saxaul, bare jointed green twigs hanging from a crooked trunk), Prosopis (large: a mesquite, a flat spreading crown of feathery leaves and pods)
#   neo-  Opuntia (small: stacked flat pads with spines and a red fruit), Agave (medium: a rosette of thick pointed blades), Carnegiea (large: a saguaro, a ribbed column with upturned arms)
#   qua-  Larrea (small: a creosote bush of whippy stems, small leaves and yellow flowers), Ferocactus (medium: a ribbed barrel with a crown of flowers), Joshua tree (large: a shaggy forked trunk, daggers of leaves at the tips)
# Usage: python3 -I tools/pixelplants_desert_ceno.py [outdir]
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



LEAF = mix(OLIVE, (176, 152, 72), .34)   # dry olive, toward sage and straw
def lf(t): return mix(LEAF, (255, 255, 255), t) if t > 0 else mix(LEAF, (0, 0, 0), -t)
def pale(sp, base):   # a paler, fungus-like "stem" tone set for plants that aren't green
    t = tones(base); sp.C.update(stem=t[0], stemhi=t[1], stemlo=t[2])
def spike(sp, x, y, n, side=0):   # a spike of round sporangia stacked up a stem tip
    for k in range(n): sp.fill(x + (side if k % 2 else 0), y - k * 2.2, 1.4, 1.5, "seed"); sp.put(x - 1, y - k * 2.2 - 1, "seedhi")

CACTUS = (82, 128, 92)   # a cool blue-green, not the olive of the leaves
def bloom(sp, col):   # a flower color with its own lit and shaded tone (not auto-shaded)
    t = tones(col); sp.C.update(bloom=t[0], bloomhi=t[1], bloomlo=t[2])
def column(sp, x, y0, y1, hw, ribs=1):   # a ribbed cactus column from y0 (bottom) up to y1, a rounded top, dark rib lines and pale spine dots
    for y in range(int(y1), int(y0) + 1):
        t = (y - y1) / max(1, (y0 - y1)); w = hw * (math.sqrt(max(0, 1 - ((y1 + hw - y) / hw) ** 2)) if y < y1 + hw else 1)
        for xx in range(int(x - w), int(x + w) + 1):
            if abs(xx - x) <= w: sp.put(xx, y, "leaf")
    for k in range(-ribs, ribs + 1):
        rx = x + k * hw * .55
        for y in range(int(y1) + 3, int(y0) + 1):
            if sp.get(int(rx + .5), y) == "leaf" and (y + k) % 7 < 5: sp.put(rx, y, "leaflo")
            if k and sp.get(int(rx + .5) + 1, y) == "leaf" and y % 6 == 0: sp.put(rx + 1, y, "rib")

def tamarisk():   # small: arching stems with feathery sprays, pink plumes at the tips
    sp = Sprite(44, 40, lf(.04)); sp.C["leaf"] = mix(LEAF, (110, 160, 150), .35); bloom(sp, (214, 120, 150)); bx, by = 22, 38
    for ang, L in ((-1.0, 22), (-.5, 28), (0, 31), (.5, 28), (1.0, 22)):
        tip = (bx + math.sin(ang) * L, by - math.cos(ang) * L * .85); ctrl = (bx + math.sin(ang) * L * .25, by - L * .75)
        pts = [bez((bx, by), ctrl, tip, k / 12) for k in range(13)]
        for a, b in zip(pts, pts[1:]): sp.line(*a, *b, "stem")
        for k in (4, 6, 8, 10, 12):
            px, py = pts[k]
            for side in (-1, 1): blade(sp, px, py, px + side * 4, py + 5, 1.0, bowx=side)
        sp.fill(tip[0], tip[1] - 1, 1.2, 2.2, "bloom"); sp.put(tip[0] - 1, tip[1] - 2, "bloomhi")
    for x in range(bx - 4, bx + 5): sp.put(x, by + 1, "stem")
    return sp

def haloxylon():   # medium: a gnarled saxaul, a crooked pale trunk, bare jointed twigs drooping like a weeping crown
    sp = Sprite(64, 56, lf(-.02)); pale(sp, (150, 128, 96)); bx, by = 32, 54
    stem(sp, [(bx, by + 1), (bx - 3, by - 8), (bx + 1, by - 16), (bx - 2, by - 22)], 3.6, 2.4)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for y in range(by - 3, by - 20, -3): sp.put(bx - 2 + (y // 3) % 2 * 2, y, "stemlo")
    for a, b in (((bx - 2, by - 22), (bx - 20, by - 30)), ((bx - 2, by - 22), (bx + 18, by - 34)), ((bx + 1, by - 16), (bx + 12, by - 24)), ((bx - 1, by - 14), (bx - 11, by - 22))): sp.line(*a, *b, "stem", 1)
    for cx, cy in ((-20, 30), (-12, 34), (-4, 36), (18, 34), (10, 30), (12, 24), (-11, 22), (2, 36)):
        for k in range(-2, 3):
            x0, y0 = bx + cx + k * 2, by - cy; sp.line(x0, y0, x0 + k * .7, y0 + 11 + (2 - abs(k)) * 2, "leaf", 0)
            for j in range(2, 12, 4): sp.put(x0 + k * .7 * j / 11 - 1, y0 + j, "leaflo")
    return sp

def prosopis():   # large: a mesquite, a bent trunk under a broad flat-topped crown of feathery leaves, a few pods
    sp = Sprite(72, 90, lf(-.1)); bx, by = 36, 88
    stem(sp, [(bx, by + 1), (bx - 2, by - 14), (bx + 2, by - 28), (bx, by - 36)], 4.4, 2.8)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 34, -3): sp.put(bx - 1 + (y // 3) % 2 * 2, y, "stemlo")
    limbs = ((-30, 52), (-20, 60), (-8, 64), (6, 62), (19, 60), (30, 52), (-24, 46), (24, 44))
    for lx, ly in limbs: stem(sp, [(bx, by - 34), (bx + lx * .5, by - ly + 8), (bx + lx, by - ly)], 1.9, 1.1)
    for lx, ly in sorted(limbs, key=lambda l: l[1]):
        for dx, dy in ((0, 0), (-7, 3), (7, 3), (-3, -5)):
            x, y = bx + lx + dx, by - ly + dy
            for side in (-1, 1): lens(sp, x, y, x + side * 7, y - 3, 1.1, teeth=False); lens(sp, x, y, x + side * 5, y + 3, 1.0, teeth=False)
    for px, py in ((-26, 40), (-8, 48), (14, 46), (28, 42)): sp.line(bx + px, by - py, bx + px + 1, by - py + 8, "seed", 0); sp.put(bx + px, by - py, "seedhi")
    return sp

def opuntia():   # small: stacked flat oval pads, spines as pale dots, a red fruit on the top edge
    sp = Sprite(44, 40, (0, 0, 0)); sp.C.update(leaf=CACTUS, leafhi=mix(CACTUS, (255, 255, 255), .22), leaflo=mix(CACTUS, (0, 0, 0), .32)); bloom(sp, (206, 72, 96)); bx, by = 22, 38
    pads = ((bx, by - 8, 9, 7), (bx - 8, by - 17, 6.5, 5.5), (bx + 8, by - 16, 7, 6), (bx - 11, by - 25, 5, 4.5), (bx + 1, by - 24, 6, 5.5), (bx + 12, by - 24, 5, 4.5))
    for cx, cy, rx, ry in pads: sp.fill(cx, cy, rx, ry, "leaf")
    for cx, cy, rx, ry in pads:
        for k in range(-int(rx) + 2, int(rx) - 1, 4):
            for j in (-1, 1): sp.put(cx + k + (j > 0) * 2, cy + j * ry * .45, "rib")
    for cx, cy in ((bx - 11, by - 30), (bx + 12, by - 29), (bx + 1, by - 29)): sp.fill(cx, cy, 1.5, 1.8, "bloom"); sp.put(cx - 1, cy - 1, "bloomhi")
    return sp

def agave():   # medium: a rosette of thick pointed blades, the lowest drooping, with pale marginal teeth
    sp = Sprite(64, 50, (0, 0, 0)); a = (104, 146, 124); sp.C.update(leaf=a, leafhi=mix(a, (255, 255, 255), .22), leaflo=mix(a, (0, 0, 0), .32), rib=mix(a, (235, 240, 200), .5)); bx, by = 32, 46
    for ang, L in ((-1.35, 26), (1.35, 26), (-1.05, 30), (1.05, 30), (-.7, 34), (.7, 34), (-.35, 36), (.35, 36), (0, 36)):
        ex, ey = bx + math.sin(ang) * L, by - math.cos(ang) * L * (.75 if abs(ang) > 1 else 1) + (6 if abs(ang) > 1.3 else 0)
        lens(sp, bx, by - 2, ex, ey, 3.2, teeth=False)
        for t in (.3, .5, .7): sp.put(bx + (ex - bx) * t + (1 if ang > 0 else -1) * 2, by - 2 + (ey - by + 2) * t, "rib")
    for x in range(bx - 5, bx + 6): sp.put(x, by + 1, "leaflo")
    return sp

def carnegiea():   # large: a saguaro, a ribbed column with arms that turn up
    sp = Sprite(64, 92, (0, 0, 0)); sp.C.update(leaf=CACTUS, leafhi=mix(CACTUS, (255, 255, 255), .2), leaflo=mix(CACTUS, (0, 0, 0), .34), rib=mix(CACTUS, (235, 240, 210), .55)); bloom(sp, (240, 240, 230)); bx, by = 32, 90
    column(sp, bx, by, 8, 6.5, 2)
    for side, h, L, top in ((-1, 44, 15, 22), (1, 34, 16, 14)):   # the arm: out from the trunk, then straight up
        y = by - h; sp.line(bx + side * 5, y, bx + side * L, y, "leaf", 2.5)
        column(sp, bx + side * L, y + 2, by - h - top - 10, 3.6, 1)
    for ix in (bx, bx - 15, bx + 16): sp.fill(ix, 9 if ix == bx else (by - 44 - 32 if ix < bx else by - 34 - 24), 1.8, 1.4, "bloom")
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "leaflo")
    return sp

def larrea():   # small: a creosote bush, whippy stems, small leaves in pairs, yellow flowers
    sp = Sprite(44, 40, lf(.0)); bloom(sp, (232, 196, 64)); bx, by = 22, 38
    for ang, L in ((-.95, 24), (-.6, 30), (-.25, 33), (.12, 33), (.5, 30), (.9, 24)):
        tip = (bx + math.sin(ang) * L, by - math.cos(ang) * L); sp.line(bx, by, *tip, "stem")
        for k in range(5, int(L), 4):
            px, py = bx + (tip[0] - bx) * k / L, by + (tip[1] - by) * k / L
            for side in (-1, 1): sp.fill(px + side * 1.8, py, 1.4, 1.0, "leaf")
        sp.fill(tip[0], tip[1] - 1, 1.2, 1.2, "bloom"); sp.put(tip[0] - 1, tip[1] - 2, "bloomhi")
    for x in range(bx - 3, bx + 4): sp.put(x, by + 1, "stem")
    return sp

def ferocactus():   # medium: a ribbed barrel with spine tufts and a ring of flowers on top
    sp = Sprite(56, 52, (0, 0, 0)); sp.C.update(leaf=CACTUS, leafhi=mix(CACTUS, (255, 255, 255), .2), leaflo=mix(CACTUS, (0, 0, 0), .34), rib=mix((190, 150, 90), (255, 255, 255), .3)); bloom(sp, (232, 176, 60)); bx, by = 28, 50
    for y in range(by - 36, by + 1):   # a barrel: widest in the lower middle, a flat dome on top
        t = (y - (by - 36)) / 36; w = 15 * math.sin(math.pi * (t * .8 + .12)) ** .6
        for x in range(int(bx - w), int(bx + w) + 1):
            if abs(x - bx) <= w: sp.put(x, y, "leaf")
    for k in range(-3, 4):   # curved rib lines and a spine tuft on each
        for y in range(by - 32, by, 1):
            t = (y - (by - 36)) / 36; w = 15 * math.sin(math.pi * (t * .8 + .12)) ** .6; rx = bx + k * w * .3
            if sp.get(int(rx + .5), y) == "leaf" and (y + k) % 6 < 4: sp.put(rx, y, "leaflo")
            if y % 5 == 2 and k % 2 == 0: sp.put(rx + 1, y, "rib"); sp.put(rx - 1, y, "rib")
    for k in range(-2, 3): sp.fill(bx + k * 4, by - 37 + abs(k), 1.8, 1.5, "bloom"); sp.put(bx + k * 4 - 1, by - 38 + abs(k), "bloomhi")
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "leaflo")
    return sp

def joshua():   # large: a shaggy trunk forking into thick arms, each tipped with a burst of dagger leaves
    sp = Sprite(72, 92, lf(-.04)); pale(sp, (120, 92, 62)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 18), (bx - 1, by - 34)], 5.0, 3.6)
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "stem")
    for y in range(by - 3, by - 34, -3):
        for dx in (-3, 0, 3): sp.put(bx + dx + (y // 3) % 2, y, "stemlo")   # shaggy dead-leaf thatch on the trunk
    arms = (((-22, 62), (-1, 52)), ((20, 66), (1, 52)), ((-6, 76), (-1, 50)), ((-34, 44), (-3, 38)), ((30, 46), (2, 40)))
    for (tx, ty), (jx, jy) in arms:
        stem(sp, [(bx + jx * .1, by - 34 - (50 - jy) * .1), (bx + tx * .45, by - ty + 10), (bx + tx, by - ty)], 2.6, 1.8)
    for (tx, ty), _ in arms:   # dagger leaves bursting from the tip in a ball
        x, y = bx + tx, by - ty
        for k in range(-4, 5): blade(sp, x, y, x + k * 3.2, y - 8 - (4 - abs(k)) * 1.2 + (abs(k) > 3) * 5, 1.4, bowx=k * .5)
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("pal-desert-small", tamarisk), ("pal-desert-medium", haloxylon), ("pal-desert-large", prosopis),
                ("neo-desert-small", opuntia), ("neo-desert-medium", agave), ("neo-desert-large", carnegiea),
                ("qua-desert-small", larrea), ("qua-desert-medium", ferocactus), ("qua-desert-large", joshua)):
    fn().save(f"{out}/{key}.png")
