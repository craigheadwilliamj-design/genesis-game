# Draws the desert landscape plants of the Devonian, Carboniferous and Permian in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_temperate_old.py,
# because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges. Leaves are dry olive, pulled toward sage and straw for the desert.
#   dev-  Zosterophyllum (a low mat of forked stems from a creeping rhizome, each ending in a spike of round sporangia), Psilophyton (spiny forked stems, pairs of sporangia hanging at the tips), Prototaxites (tall pale unbranched pillars of fungus-like tissue, banded by growth)
#   car-  Sphenopteris (a low sprawl of fine arching fronds with lobed wedge pinnules), Callipteris (upright fronds with long pinnae, comb-like), Walchia (an early conifer, a conical tree of tiered drooping branches with needle sprays)
#   per-  Supaia (a rosette of stiff fronds with broad oblong pinnules), Ullmannia (a bushy conifer, a short trunk under a round crown of needle tufts), Pseudovoltzia (a conifer with a layered, umbrella crown of flat leafy shoots)
# Usage: python3 -I tools/pixelplants_desert_old.py [outdir]
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

def zosterophyllum():   # small: a creeping rhizome sending up short forked stems, each tip a spike of round sporangia
    sp = Sprite(44, 38, lf(-.06)); by = 36
    sp.line(4, by, 40, by - 1, "stem", 1)
    for x, L, ang in ((7, 15, -.2), (13, 22, .15), (20, 26, 0), (27, 21, -.12), (34, 16, .2)):
        x1, y1 = x + math.sin(ang) * L, by - 1 - math.cos(ang) * L; sp.line(x, by - 1, x1, y1, "leaf", 1)
        if L > 18:   # one fork near the top, a short second spike beside the first
            xm, ym = x + (x1 - x) * .6, by - 1 + (y1 - by + 1) * .6; sp.line(xm, ym, xm + 4, ym - 6, "leaf", 0); spike(sp, xm + 4, ym - 6, 2, 1)
        spike(sp, x1, y1, 3 if L > 18 else 2, 1)
    return sp

def psilophyton():   # medium: spiny Y-forked stems, a pair of drooping sporangia at each tip
    sp = Sprite(62, 54, lf(-.12))
    def spiny(x, y, ang, L, depth):
        x1, y1 = x + math.sin(ang) * L, y - math.cos(ang) * L; sp.line(x, y, x1, y1, "leaf", 1 if depth >= 2 else 0)
        for k in range(1, int(L), 3): sp.put(x + (x1 - x) * k / L + (1 if k % 2 else -1), y + (y1 - y) * k / L, "leafhi")   # little spines
        if depth == 0:
            for d in (-1, 1): sp.line(x1, y1, x1 + d * 2, y1 + 2, "leaf"); sp.fill(x1 + d * 2, y1 + 4, 1.2, 1.8, "seed"); sp.put(x1 + d * 2 - 1, y1 + 3, "seedhi")
            return
        for d in (-1, 1): spiny(x1, y1, ang + d * .5, L * .74, depth - 1)
    spiny(31, 52, -.1, 14, 3); spiny(31, 52, .35, 12, 2); spiny(31, 52, -.55, 11, 2)
    for x in range(25, 38): sp.put(x, 53, "stem")
    return sp

def prototaxites():   # large: tall pale unbranched pillars of fungus-like tissue, banded by growth, blunt tops
    sp = Sprite(64, 92, lf(0)); pale(sp, (150, 122, 84)); bx, by = 32, 90
    for cx, h, hw in ((22, 52, 4), (33, 86, 6), (46, 62, 5)):
        for y in range(by - h, by + 1):
            t = (by - y) / h; w = hw * (1 + .22 * (1 - t) + .1 * math.sin(y * .35)) * (1 if t < .94 else .75)
            for x in range(int(cx - w), int(cx + w) + 1):
                if abs(x - cx) <= w: sp.put(x, y, "stem")
        for y in range(by - 3, by - h + 3, -4):   # growth bands, a dash across each, offset
            for x in range(int(cx - hw) + 1 + (y // 4) % 2, int(cx + hw), 2): sp.put(x, y, "stemlo")
        for x in range(int(cx - hw - 3), int(cx + hw + 4)): sp.put(x, by + 1, "stem")
    return sp

def sphenopteris():   # small: a low sprawl of fine arching fronds, lobed wedge pinnules (deeply notched)
    sp = Sprite(44, 38, lf(-.04)); bx, by = 22, 36
    for tip, ctrl, wm in (((3, 22), (8, 12), 3.2), ((41, 22), (36, 12), 3.2), ((12, 6), (13, 22), 3.4), ((32, 6), (31, 22), 3.4), ((22, 3), (22, 20), 3.0)):
        frond(sp, (bx, by), ctrl, tip, wm, 8, notch=.12)
    for x in range(bx - 3, bx + 4): sp.put(x, by + 1, "stem")
    return sp

def callipteris():   # medium: three upright fronds, a long rachis with long narrow pinnae down both sides
    sp = Sprite(64, 58, lf(-.12)); bx, by = 32, 56
    for ang, L in ((-.5, 40), (0, 50), (.5, 40)):
        tip = (bx + math.sin(ang) * L * .8, by - math.cos(ang) * L); ctrl = (bx + math.sin(ang) * L * .2, by - L * .6)
        sp.line(bx, by, *tip, "stem") if False else None
        for i in range(2, 13):
            t = i / 13; px, py = bez((bx, by), ctrl, tip, t); tx, ty = tangent((bx, by), ctrl, tip, t); d = math.hypot(tx, ty) or 1; nx, ny = -ty / d, tx / d
            pl = (9 if L > 45 else 7) * math.sin(math.pi * min(.98, t * .95 + .05)) ** .7
            for side in (-1, 1): lens(sp, px, py, px + (nx * side * .9 + tx / d * .5) * pl, py + (ny * side * .9 + ty / d * .5) * pl, 1.0, teeth=False)
        for i in range(0, 41): px, py = bez((bx, by), ctrl, tip, i / 40); sp.put(px, py, "rib")
    for x in range(bx - 3, bx + 4): sp.put(x, by + 1, "stem")
    return sp

def walchia():   # large: an early conifer, a conical tree of tiered drooping branches hung with needle sprays
    sp = Sprite(64, 92, lf(-.14)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 40), (bx, by - 84)], 3.0, 1.0)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 40, -3): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y + 1, "stemlo")
    for h, L in ((20, 26), (30, 24), (40, 21), (50, 18), (60, 14), (69, 10), (77, 6)):
        for side in (-1, 1):
            spray(sp, bx, by - h, side, L, 4 + L * .12, 1.2)
            if L > 12: spray(sp, bx + side * L * .5, by - h + 2, side, L * .5, 3, 1.1)
    for k in range(3): lens(sp, bx, by - 80, bx + (k - 1) * 2, by - 91 + abs(k - 1), 1.0, teeth=False)
    return sp

def supaia():   # small: a rosette of stiff fronds with broad oblong pinnules (red-bed seed fern)
    sp = Sprite(44, 36, lf(-.04)); bx, by = 22, 34
    for ang, L in ((-1.25, 19), (-.75, 24), (-.3, 27), (.3, 27), (.75, 24), (1.25, 19)):
        tip = (bx + math.sin(ang) * L, by - 3 - math.cos(ang) * L * .95 + abs(ang) * 4)
        tx, ty = tip[0] - bx, tip[1] - (by - 3); d = math.hypot(tx, ty); ux, uy = tx / d, ty / d
        for i in range(2, 8):   # broad oblong pinnules in pairs, angled forward off the rachis
            t = i / 8; px, py = bx + tx * t, by - 3 + ty * t; pl = 7.5 * (1 - .45 * t)
            for side in (-1, 1): lens(sp, px, py, px + (-uy * side * .8 + ux * .6) * pl, py + (ux * side * .8 + uy * .6) * pl, 1.7, teeth=False)
        sp.line(bx, by - 3, *tip, "rib")
    for x in range(bx - 4, bx + 5): sp.put(x, by + 1, "stem")
    return sp

def ullmannia():   # medium: a bushy conifer, a short trunk under a round crown of needle tufts
    sp = Sprite(66, 54, lf(-.12)); bx, by = 33, 52
    stem(sp, [(bx, by + 1), (bx, by - 10), (bx - 1, by - 18)], 3.0, 2.2)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for y in range(by - 3, by - 18, -3): sp.put(bx - 1, y, "stemlo")
    for ang, L in ((-1.3, 24), (-.85, 28), (-.4, 29), (0, 28), (.4, 29), (.85, 28), (1.3, 24)):
        ex, ey = bx - 1 + math.sin(ang) * L, by - 18 - math.cos(ang) * L * .78 + 4 * abs(ang)
        sp.line(bx - 1, by - 18, ex, ey, "stem", 1)
        for t in (.45, .7, 1.0): needles(sp, bx - 1 + (ex - bx + 1) * t, by - 18 + (ey - by + 18) * t, 7, 8 - 2 * (1 - t))
    return sp

def pseudovoltzia():   # large: a layered, umbrella crown, a tall trunk with tiers of limbs ending in flat leafy shoots
    sp = Sprite(72, 92, lf(-.1)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 62)], 3.8, 1.8)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 44, -3): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y + 1, "stemlo")
    for h, L in ((44, 30), (56, 28), (68, 22), (78, 14)):
        for side in (-1, 1):
            ex, ey = bx + side * L, by - h - 3; sp.line(bx, by - h + 2, ex, ey, "stem", 1)
            for t in (.4, .65, .9):   # a flat leafy shoot, a row of short blades laid along a twig
                px, py = bx + side * L * t, by - h + 2 + (ey - by + h - 2) * t
                for k in range(-2, 3): blade(sp, px, py, px + k * 2.6, py - 6 - (2 - abs(k)), 1.2, bowx=k * .6)
    for k in range(5): blade(sp, bx, by - 62, bx + (k - 2) * 3, by - 74 - (2 - abs(k - 2)) * 2, 1.2, bowx=(k - 2) * .8)
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("dev-desert-small", zosterophyllum), ("dev-desert-medium", psilophyton), ("dev-desert-large", prototaxites),
                ("car-desert-small", sphenopteris), ("car-desert-medium", callipteris), ("car-desert-large", walchia),
                ("per-desert-small", supaia), ("per-desert-medium", ullmannia), ("per-desert-large", pseudovoltzia)):
    fn().save(f"{out}/{key}.png")
