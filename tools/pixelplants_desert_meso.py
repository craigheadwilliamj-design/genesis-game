# Draws the desert landscape plants of the Triassic, Jurassic and Cretaceous in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_desert_old.py,
# because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges. Leaves are dry olive, pulled toward sage and straw for the desert.
#   tri-  Dicroidium (a clump of fronds that fork once, each branch a feather of pinnae), Pleuromeia (an unbranched scaly stem under a tuft of straps and a cone), Voltzia (a slim conifer, upswept branches of needle shoots and cones)
#   jur-  Pachypteris (a dome of small leathery fronds, rounded pinnules), Hirmeriella (a bushy conifer of scale-leaf shoots with round cones), Cupressinocladus (a tall columnar cypress, drooping flat sprays of scale leaves)
#   cre-  Ephedra (a broom of jointed leafless green stems with seed cones at the nodes), Welwitschiophyllum (a woody stump, two long frayed straps sprawled on the ground), Tempskya (a tall false trunk of wiry roots crowned by fern fronds)
# Usage: python3 -I tools/pixelplants_desert_meso.py [outdir]
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

def knobs(sp, x, y, n):   # a few small round seed cones
    for k in range(n): sp.fill(x + (k % 2) * 3 - 1, y - k * 2, 1.4, 1.6, "seed"); sp.put(x + (k % 2) * 3 - 2, y - k * 2 - 1, "seedhi")

def dicroidium():   # small: fronds that fork once at the middle, each branch a feather of narrow pinnae
    sp = Sprite(44, 38, lf(-.04)); bx, by = 22, 36
    for ang, L in ((-.55, 22), (0, 27), (.55, 22)):
        fx, fy = bx + math.sin(ang) * L * .5, by - math.cos(ang) * L * .5; sp.line(bx, by, fx, fy, "stem")
        for d in (-1, 1):
            tip = (fx + d * 8 + math.sin(ang) * L * .3, fy - L * .55); ctrl = (fx + d * 2, fy - L * .35)
            frond(sp, (fx, fy), ctrl, tip, 2.6, 5, notch=.2)
    for x in range(bx - 3, bx + 4): sp.put(x, by + 1, "stem")
    return sp

def pleuromeia():   # medium: an unbranched scaly stem, a tuft of straps and a stout cone on top
    sp = Sprite(62, 56, lf(-.1)); bx, by = 31, 54
    stem(sp, [(bx, by + 1), (bx, by - 14), (bx, by - 30)], 4.0, 2.6)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    scars(sp, bx, by - 3, by - 30, 2, 3)
    for k in range(-3, 4): blade(sp, bx, by - 30, bx + k * 6, by - 38 - (3 - abs(k)) * 3 + (abs(k) > 2) * 8, 1.5, bowx=k * 2)
    sp.fill(bx, by - 40, 2.4, 5, "seed"); sp.put(bx - 1, by - 43, "seedhi"); sp.put(bx + 1, by - 38, "seedlo")
    return sp

def voltzia():   # large: a slim conifer, short upswept branches of needle shoots, cones dotted among them
    sp = Sprite(64, 92, lf(-.12)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 40), (bx, by - 82)], 3.0, 1.0)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 38, -3): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y + 1, "stemlo")
    for n, (h, L) in enumerate(((22, 20), (32, 20), (42, 18), (51, 16), (60, 13), (68, 10), (75, 6))):
        for side in (-1, 1):
            ex, ey = bx + side * L, by - h - L * .35; sp.line(bx, by - h, ex, ey, "stem", 1)
            for t in (.45, .75, 1.0): needles(sp, bx + side * L * t, by - h - L * .35 * t, 5, 7 - 2 * (1 - t))
            if n % 2 == (side > 0): sp.fill(bx + side * L * .6, by - h - L * .2 + 3, 1.4, 2.2, "seed"); sp.put(bx + side * L * .6 - 1, by - h - L * .2 + 2, "seedhi")
    needles(sp, bx, by - 82, 5, 8)
    return sp

def pachypteris():   # small: a low dome of short leathery fronds with tiny rounded pinnules
    sp = Sprite(44, 36, lf(-.04)); bx, by = 22, 34
    for ang, L in ((-1.3, 17), (-.9, 20), (-.45, 22), (0, 23), (.45, 22), (.9, 20), (1.3, 17)):
        tip = (bx + math.sin(ang) * L, by - 2 - math.cos(ang) * L * .8 + abs(ang) * 3); ctrl = (bx + math.sin(ang) * L * .35, by - 2 - L * .7)
        frond(sp, (bx, by - 2), ctrl, tip, 3.0, 6, notch=.45)
    for x in range(bx - 3, bx + 4): sp.put(x, by + 1, "stem")
    return sp

def hirmeriella():   # medium: a bushy conifer, scale-leaf shoots on a short trunk, a few round cones
    sp = Sprite(66, 54, lf(-.12)); bx, by = 33, 52
    stem(sp, [(bx, by + 1), (bx, by - 10), (bx + 1, by - 18)], 3.0, 2.0)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for ang, L in ((-1.3, 24), (-.8, 28), (-.35, 30), (.1, 30), (.55, 29), (1.0, 27), (1.35, 22)):
        ex, ey = bx + 1 + math.sin(ang) * L, by - 18 - math.cos(ang) * L * .8 + 3 * abs(ang)
        sp.line(bx + 1, by - 18, ex, ey, "stem", 1)
        for t in (.5, .75, 1.0):
            px, py = bx + 1 + (ex - bx - 1) * t, by - 18 + (ey - by + 18) * t
            scale_shoot(sp, px, py, px + math.sin(ang) * 5, py - 7, 1.7); scale_shoot(sp, px, py, px - math.sin(ang) * 3, py - 6, 1.4)
    for cx, cy in ((10, 18), (50, 24), (30, 8)): sp.fill(cx, cy, 2.0, 2.4, "seed"); sp.put(cx - 1, cy - 1, "seedhi"); sp.put(cx + 1, cy + 1, "seedlo")
    return sp

def cupressinocladus():   # large: a tall columnar cypress, drooping flat sprays of scale leaves
    sp = Sprite(64, 92, lf(-.14)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 70)], 3.4, 1.2)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 30, -3): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y + 1, "stemlo")
    for n, (h, L) in enumerate(((26, 15), (34, 17), (42, 17), (50, 16), (58, 14), (66, 12), (74, 9), (81, 5))):
        for side in (-1, 1):
            x0, y0 = bx, by - h; ex, ey = bx + side * L, y0 + 3 + L * .1; sp.line(x0, y0, ex, ey, "stem")
            for t in (.4, .7, 1.0): scale_shoot(sp, x0 + side * L * t, y0 + (ey - y0) * t, x0 + side * L * t + side * 1.5, y0 + (ey - y0) * t + 9, 1.8)
    for k in range(3): scale_shoot(sp, bx, by - 78, bx + (k - 1) * 2, by - 90, 1.6)
    return sp

def ephedra():   # small: a broom of jointed, leafless green stems; seed cones at the nodes
    sp = Sprite(44, 38, lf(-.02)); bx, by = 22, 36
    for ang, L in ((-.6, 20), (-.3, 26), (0, 30), (.3, 26), (.6, 20)):
        x1, y1 = bx + math.sin(ang) * L, by - math.cos(ang) * L; sp.line(bx, by, x1, y1, "leaf", 1)
        for k in range(3, int(L), 5):   # a joint, a dark dash across the stem, a small cone at one side
            t = k / L; jx, jy = bx + (x1 - bx) * t, by + (y1 - by) * t
            sp.put(jx - 1, jy, "leaflo"); sp.put(jx + 1, jy, "leaflo")
            if (k // 5 + int(L)) % 2: sp.fill(jx + 2, jy - 1, 1.1, 1.5, "seed")
    for x in range(bx - 4, bx + 5): sp.put(x, by + 1, "stem")
    return sp

def welwitschiophyllum():   # medium: a short woody stump with two long frayed straps sprawling on the ground
    sp = Sprite(64, 46, lf(-.12)); bx, by = 32, 44
    pale(sp, (132, 100, 66))
    for y in range(by - 12, by + 1):   # a goblet-shaped stump, wider at the top, with grooves
        w = 7 + (by - y) * .12
        for x in range(int(bx - w), int(bx + w) + 1): sp.put(x, y, "stem")
    for x in range(bx - 6, bx + 7, 2): sp.put(x, by - 12, "stemlo")
    for y in range(by - 10, by, 3): sp.put(bx - 3, y, "stemlo"); sp.put(bx + 3, y + 1, "stemlo")
    for side in (-1, 1):   # the two big straps, bowing out and curling down, split into frays at the ends
        for off, drop in ((0, 0), (5, 3)):
            x0, y0 = bx + side * 3, by - 11 + off; x1, y1 = bx + side * 29, by - 1 - off * .3 + drop
            blade(sp, x0, y0, x1, y1, 3.2 - off * .12, bowx=side * 2, bowy=-12 + off)
            for k in range(3): blade(sp, x1 - side * 5, y1 - 1, x1 + side * (2 + k) - side * 2, y1 + 3 - k, 1.1, bowy=1)
    sp.fill(bx, by - 15, 2.0, 2.4, "seed"); sp.fill(bx - 4, by - 14, 1.6, 2.0, "seed")
    return sp

def tempskya():   # large: a tall false trunk of wiry roots matted together, a crown of fern fronds on top
    sp = Sprite(64, 92, lf(-.1)); pale(sp, (116, 84, 54)); bx, by = 32, 90
    for y in range(by - 62, by + 1):
        t = (by - y) / 62; w = 6.5 + 4.5 * (1 - t) ** 1.6 + math.sin(y * .5) * .4
        for x in range(int(bx - w), int(bx + w) + 1):
            if abs(x - bx) <= w: sp.put(x, y, "stem")
    for y in range(by - 62, by + 1):   # wiry roots: thin vertical dark dashes down the trunk
        for k, x in enumerate(range(bx - 9, bx + 10, 3)):
            if sp.get(x + (y // 5) % 2, y) == "stem" and (y + k * 3) % 5 < 3: sp.put(x + (y // 5) % 2, y, "stemlo")
    for x in range(bx - 12, bx + 13): sp.put(x, by + 1, "stem")
    top = by - 62
    for ang, L, rise in ((-1.45, 28, 8), (-1.0, 30, 22), (-.45, 26, 30), (0, 18, 26), (.45, 26, 30), (1.0, 30, 22), (1.45, 28, 8)):
        tip = (bx + math.sin(ang) * L, top - rise * .6 + abs(ang) * 7); ctrl = (bx + math.sin(ang) * L * .5, top - rise * 1.3)
        frond(sp, (bx, top + 2), ctrl, tip, 3.4, int(L / 3.4), notch=.3)
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("tri-desert-small", dicroidium), ("tri-desert-medium", pleuromeia), ("tri-desert-large", voltzia),
                ("jur-desert-small", pachypteris), ("jur-desert-medium", hirmeriella), ("jur-desert-large", cupressinocladus),
                ("cre-desert-small", ephedra), ("cre-desert-medium", welwitschiophyllum), ("cre-desert-large", tempskya)):
    fn().save(f"{out}/{key}.png")
