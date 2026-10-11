# Draws the tropical landscape plants of the Paleogene, Neogene and Quaternary in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_tropical_meso.py,
# because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges. Vivid jungle greens. Modern plants, so they use common names (PLANT_TABLE).
#   pal-  Climbing Fern (Lygodium: a twining vine hung with finger-lobed leaflets), Nipa Palm (huge upright pinnate fronds straight from the mud, a fruit head), Dipterocarp Tree (a tall straight column on buttresses under a high flat crown, winged fruits)
#   neo-  Heliconia (upright paddle leaves around red and yellow boat-shaped bracts), Musa (a clump of banana stems of different heights, torn leaves, a hanging bunch), Ceiba / Kapok (a thorny trunk on buttresses under a flat spreading crown, pods)
#   qua-  Philodendron (a mound of big heart-shaped leaves), Euterpe / Palm (slender clustered trunks, arching feathery fronds, purple berries), Swietenia / Big-leaf Mahogany (a broad buttressed tree, a wide layered crown hung with vines)
# Usage: python3 -I tools/pixelplants_tropical_ceno.py [outdir]
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



LEAF = (70, 178, 96)
def vivid(t): return mix((44, 160, 80), (66, 188, 100), t)   # small steps lighter, large darker
def ramp(sp, name, rgb): t = tones(rgb); sp.C.update({name: t[0], name + "hi": t[1], name + "lo": t[2]})   # a new shaded color

def wedge(sp, x, y, ang, L, wd, notch=True, key="leaf"):   # a wedge (fan) leaf pointing along ang (0 is up, radians): narrow at the stalk, broad at the tip, a notch cut in the tip
    ux, uy = math.sin(ang), -math.cos(ang); nx, ny = -uy, ux
    for i in range(int(L * 2) + 1):
        r = i / 2; hw = wd * (r / L) ** .85
        for k in range(-int(hw * 2) - 1, int(hw * 2) + 2):
            if abs(k / 2) <= hw and not (notch and r > L - 1.6 and abs(k / 2) < .6): sp.put(x + ux * r + nx * k / 2, y + uy * r + ny * k / 2, key)
    for r in range(2, int(L) - 1, 2): sp.put(x + ux * r, y + uy * r, "rib") if L > 6 else None

def clump(sp, cx, cy, rx, ry, dash=True):   # a leaf mass with its underside in rows of dark dashes
    sp.fill(cx, cy, rx, ry, "leaf")
    if not dash: return
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if sp.get(x, y) == "leaf" and y > cy + ry * .35 and (x + y // 2) % 3 == 0: sp.put(x, y, "leaflo")



def crown(sp, bx, by, spec, key="leaf", dash=True):   # leaf clumps back to front, each (dx, up, rx, ry)
    for cx, cy, rx, ry in sorted(spec, key=lambda c: c[1]): clump(sp, bx + cx, by - cy, rx, ry, dash) if key == "leaf" else sp.fill(bx + cx, by - cy, rx, ry, key)



def flower(sp, x, y, r, key="bloom", n=5, center="seed"):   # a five-petalled flower seen from the front, with a bright center
    for i in range(n):
        a = -math.pi / 2 + i * 2 * math.pi / n; sp.fill(x + math.cos(a) * r * .65, y + math.sin(a) * r * .65, r * .62, r * .55, key)
    sp.put(x - r * .5, y - r * .6, key + "hi"); sp.put(x, y, center)



def cycad_crown(sp, bx, top, spec, wd=3.2, pinnae=12, notch=.12):   # a crown of stiff pinnate fronds: spec is (angle, length) pairs, stiff upright or arching
    for ang, L in spec:
        ex, ey = bx + math.sin(ang) * L, top - math.cos(ang) * L * .6 + (8 if abs(ang) > 1.2 else 3 if abs(ang) > .8 else 0)
        frond(sp, (bx, top), (bx + math.sin(ang) * L * .5, top - math.cos(ang) * L * .8), (ex, ey), wd, pinnae, notch=notch)


def fanleaf(sp, x, y, ang, L, spread, n=6):   # a palm fan leaf: narrow rays from the stalk tip, drooping at the ends
    for i in range(n):
        a = ang - spread + 2 * spread * i / (n - 1); ex, ey = x + math.sin(a) * L, y - math.cos(a) * L * .75 + abs(a - ang) * 7
        blade(sp, x, y, ex, ey, 1.0, bowy=-3)



def finger(sp, x, y, ang, L, n=4, spread=.9):   # a hand-shaped leaflet: narrow lobes fanned from one point
    for i in range(n):
        a = ang - spread / 2 + spread * i / (n - 1); lens(sp, x, y, x + math.sin(a) * L, y - math.cos(a) * L, .9, teeth=False)

def lygodium():   # small: two twining stems winding up, hung with finger-lobed leaflets
    sp = Sprite(44, 38, vivid(0)); bx, by = 22, 36
    for x in range(bx - 9, bx + 10): sp.put(x, by + 1, "leaflo") if x % 2 else None
    for ph, x0 in ((0, -6), (2.4, 6)):
        pts = [(bx + x0 + math.sin(ph + k * .75) * 6, by - k * 2.4) for k in range(14)]
        for (a, b), (c, d) in zip(pts, pts[1:]): sp.line(a, b, c, d, "stem", 1)
        for k in range(2, 14, 2):
            x, y = pts[k]; s_ = 1 if (k // 2) % 2 else -1
            sp.line(x, y, x + s_ * 3, y + 2, "stem"); finger(sp, x + s_ * 3, y + 2, s_ * 1.0 + .3, 8, 5, 1.2)
    return sp

def nypa():   # medium: huge upright pinnate fronds straight from the mud, a round brown fruit head at the base
    sp = Sprite(64, 54, vivid(.4)); ramp(sp, "nut", (120, 76, 40)); bx, by = 32, 52
    sp.line(bx - 10, by, bx + 10, by - 1, "stem", 1)
    for ang, L, wd in ((-.55, 46, 3.0), (.5, 46, 3.0), (-.2, 50, 3.2), (.2, 50, 3.2), (-.9, 34, 2.8), (.9, 34, 2.8), (-1.3, 22, 2.4), (1.3, 22, 2.4)):
        ex, ey = bx + math.sin(ang) * L * .8, by - 1 - math.cos(ang) * L * .5 - (4 if abs(ang) < .6 else 0)
        frond(sp, (bx, by - 1), (bx + math.sin(ang) * L * .35, by - 1 - math.cos(ang) * L * .6), (ex, ey), wd, 14, notch=.12)
    sp.fill(bx, by - 4, 5, 4.5, "nut"); sp.put(bx - 2, by - 6, "nuthi"); sp.put(bx - 1, by - 7, "nuthi")
    for dx, dy in ((-3, -4), (0, -6), (3, -3), (-1, -2), (2, -5)): sp.put(bx + dx, by + dy, "nutlo")   # the fruit head's knobs
    return sp

def dipterocarp():   # large: a tall straight column on buttress roots under a high flat umbrella crown, winged fruits
    sp = Sprite(72, 92, vivid(.9)); ramp(sp, "wing", (200, 130, 50)); bx, by = 36, 90
    for x in range(bx - 10, bx + 11): sp.put(x, by + 1, "stem")
    stem(sp, [(bx, by + 1), (bx, by - 36), (bx, by - 60)], 3.8, 2.8)
    for s_ in (-1, 1): stem(sp, [(bx + s_ * 9, by + 1), (bx + s_ * 5, by - 8), (bx + s_ * 2, by - 18)], 2.4, 1.2)
    for y in range(by - 4, by - 60, -4): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y - 2, "stemlo")
    for lx, ly in ((-18, 70), (-8, 76), (8, 76), (18, 70)): stem(sp, [(bx, by - 58), (bx + lx * .5, by - ly + 12), (bx + lx, by - ly)], 1.8, 1.0)
    crown(sp, bx, by, ((-24, 66, 10, 5), (24, 66, 10, 5), (-13, 72, 12, 6), (13, 72, 12, 6), (0, 77, 13, 6), (-28, 71, 7, 4), (28, 71, 7, 4), (-6, 82, 8, 4), (7, 82, 8, 4)))
    for x, y in ((-18, 62), (-6, 66), (10, 64), (22, 62), (0, 63)):   # winged fruits: a seed with two long wings, hanging
        sp.put(bx + x, by - y, "wing"); sp.put(bx + x, by - y + 1, "winglo"); lens(sp, bx + x, by - y + 1, bx + x - 4, by - y + 6, .8, teeth=False); lens(sp, bx + x, by - y + 1, bx + x + 4, by - y + 5, .8, teeth=False)
    return sp

def heliconia():   # small: upright paddle leaves around red and yellow boat-shaped bracts
    sp = Sprite(44, 38, vivid(0)); ramp(sp, "bract", (220, 50, 40)); ramp(sp, "tip", (232, 200, 60)); bx, by = 22, 36
    for ang, L, w in ((-.8, 24, 3.2), (.8, 24, 3.2), (-.35, 30, 3.4), (.4, 28, 3.4)):
        ex, ey = bx + math.sin(ang) * L, by - 2 - math.cos(ang) * L + 2; lens(sp, bx, by - 2, ex, ey, w, teeth=False)
    for k in range(5):   # bracts zigzagging up a stalk, each a red boat with a yellow lip
        x = bx + (3 if k % 2 else -3); y = by - 8 - k * 4
        sp.fill(x, y, 3.4, 2.0, "bract"); sp.put(x - 2, y - 1, "bracthi"); sp.put(x + (2 if k % 2 else -2), y + 1, "tip"); sp.put(x + (3 if k % 2 else -3), y, "tip")
    sp.line(bx, by - 2, bx, by - 8, "stem")
    for x in range(bx - 5, bx + 6): sp.put(x, by + 1, "leaflo") if x % 2 else None
    return sp

def musa():   # medium: a clump of banana stems of different heights, big torn leaves, a hanging bunch
    sp = Sprite(64, 54, vivid(.4)); ramp(sp, "fruit", (156, 200, 70)); ramp(sp, "bud", (128, 40, 96)); bx, by = 32, 52
    for x0, h, ls in ((-14, 18, 1), (0, 28, 1), (14, 22, 1)):
        x = bx + x0
        for y in range(by, by - h, -1):
            w = 3.4 - (by - y) * .03
            for dx in range(-int(w), int(w) + 1): sp.put(x + dx, y, "leaf")
            if (by - y) % 4 == 0:
                for dx in range(-int(w), int(w) + 1): sp.put(x + dx, y, "leaflo")
    for x0, h, angs in ((-14, 18, (-1.2, -.3, .7)), (0, 28, (-1.1, 0, 1.1)), (14, 22, (-.7, .3, 1.3))):
        x = bx + x0; top = by - h
        for ang in angs:
            L = 20; ex, ey = x + math.sin(ang) * L, top - math.cos(ang) * L * .7 + (5 if abs(ang) > 1 else 0)
            frond(sp, (x, top), (x + math.sin(ang) * L * .5, top - math.cos(ang) * L * .8), (ex, ey), 4.2, 4, notch=.55, groove=False)
    sp.line(bx + 3, by - 22, bx + 9, by - 10, "stem"); sp.fill(bx + 10, by - 8, 2.4, 3.2, "bud")
    for fx, fy in ((6, -14), (9, -15), (12, -13), (7, -10), (10, -11)): sp.fill(bx + fx, by + fy + 3, 1.3, 2.0, "fruit")
    return sp

def ceiba():   # large: a thorny trunk on buttresses under a flat spreading crown, pods and cream fluff hanging
    sp = Sprite(72, 92, vivid(.9)); ramp(sp, "fluff", (238, 232, 214)); ramp(sp, "pod", (120, 84, 44)); bx, by = 36, 90
    for x in range(bx - 11, bx + 12): sp.put(x, by + 1, "stem")
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 58)], 6.0, 4.0)
    for s_ in (-1, 1): stem(sp, [(bx + s_ * 11, by + 1), (bx + s_ * 7, by - 8), (bx + s_ * 3, by - 20)], 3.0, 1.4)
    for k, y in enumerate(range(by - 4, by - 52, -4)):   # conical thorns: a lit tip over a dark base
        for dx in range(-4 + (k % 2) * 2, 5, 4): sp.put(bx + dx, y, "stemlo"); sp.put(bx + dx, y - 1, "stemhi")
    crown(sp, bx, by, ((-26, 60, 11, 6), (26, 60, 11, 6), (-14, 68, 13, 7), (14, 68, 13, 7), (0, 72, 14, 7), (-29, 66, 8, 5), (29, 66, 8, 5), (-7, 80, 10, 6), (8, 80, 10, 6)))
    for x in range(bx - 32, bx + 33, 4): sp.put(x, by - 54 + (abs(x - bx) // 8), "leaflo")
    for x, y in ((-20, 56), (-8, 62), (10, 60), (22, 56)): sp.fill(bx + x, by - y + 3, 1.4, 3.0, "pod"); sp.put(bx + x - 1, by - y + 2, "podhi")
    for x, y in ((-14, 58), (2, 62), (16, 58)): sp.put(bx + x, by - y + 2, "fluff"); sp.put(bx + x + 1, by - y + 3, "fluff"); sp.put(bx + x - 1, by - y + 3, "fluffhi")
    return sp

def heart(sp, x, y, r, ang=0):   # a heart-shaped leaf (the implicit heart curve) with its point toward ang (0 is up), a rib down the middle
    ux, uy = math.sin(ang), -math.cos(ang); nx, ny = -uy, ux
    for yy in range(int(y - r * 1.4) - 1, int(y + r * 1.4) + 2):
        for xx in range(int(x - r * 1.4) - 1, int(x + r * 1.4) + 2):
            dx, dy = xx - x, yy - y; u = (dx * nx + dy * ny) / r * 1.15; v = -(dx * ux + dy * uy) / r * 1.15   # v up the heart's axis, the point at v < 0
            v = -v + .15
            if (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0: sp.put(xx, yy, "leaf")
    sp.line(x - ux * r * .9, y - uy * r * .9, x + ux * r * .2, y + uy * r * .2, "rib")

def philodendron():   # small: a mound of big heart-shaped leaves on stalks
    sp = Sprite(44, 38, vivid(0)); bx, by = 22, 36
    for x in range(bx - 9, bx + 10): sp.put(x, by + 1, "leaflo") if x % 2 else None
    for dx, h, r, ang in ((-13, 8, 4.6, -.9), (13, 8, 4.6, .9), (-8, 17, 5.0, -.5), (8, 16, 5.0, .5), (0, 26, 5.6, 0), (-3, 9, 4.2, -.3), (4, 10, 4.2, .35)):
        lx, ly = bx + dx, by - h; sp.line(bx, by, lx, ly + r * .6, "stem"); heart(sp, lx, ly, r, ang)
    return sp

def euterpe():   # medium: slender clustered trunks, each under arching feathery fronds, purple berries
    sp = Sprite(64, 54, vivid(.4)); ramp(sp, "fiber", (110, 82, 50)); sp.C.update(stem=sp.C["fiber"], stemhi=sp.C["fiberhi"], stemlo=sp.C["fiberlo"]); ramp(sp, "berry", (96, 50, 120)); bx, by = 32, 52
    for x0, top, lean in ((-12, 24, -3), (0, 12, 0), (12, 28, 3)):
        x = bx + x0; stem(sp, [(x, by + 1), (x + lean * .4, by - (by - top) * .5), (x + lean, top)], 1.8, 1.4)
        for y in range(by - 3, top, -3): sp.put(x - 1 + lean * (by - y) / (by - top) * 0, y, "stemlo")
        for ang, L in ((-1.3, 17), (1.3, 17), (-.7, 19), (.7, 19), (0, 13)):
            ex, ey = x + lean + math.sin(ang) * L, top - math.cos(ang) * L * .5 + (6 if abs(ang) > 1 else 2)
            frond(sp, (x + lean, top), (x + lean + math.sin(ang) * L * .5, top - math.cos(ang) * L * .7), (ex, ey), 2.2, 9, notch=.12)
        for dx, dy in ((-1, 3), (1, 4), (0, 6)): sp.fill(x + lean + dx, top + dy, 1.2, 1.2, "berry")
    for x in range(bx - 16, bx + 17, 3): sp.put(x, by + 1, "leaflo")
    return sp

def swietenia():   # large: a broad buttressed tree, a wide layered crown hung with vines
    sp = Sprite(72, 92, vivid(.9)); bx, by = 36, 90
    for x in range(bx - 12, bx + 13): sp.put(x, by + 1, "stem")
    stem(sp, [(bx, by + 1), (bx, by - 22), (bx - 1, by - 38)], 5.2, 3.4)
    for s_ in (-1, 1): stem(sp, [(bx + s_ * 11, by + 1), (bx + s_ * 7, by - 7), (bx + s_ * 3, by - 18)], 3.0, 1.2)
    for y in range(by - 4, by - 36, -3): sp.put(bx - 2, y, "stemlo"); sp.put(bx + 2, y + 1, "stemlo")
    for lx, ly in ((-24, 52), (-12, 60), (12, 60), (24, 52)): stem(sp, [(bx - 1, by - 36), (bx + lx * .5, by - ly + 12), (bx + lx, by - ly)], 2.4, 1.3)
    crown(sp, bx, by, ((-27, 46, 10, 7), (27, 46, 10, 7), (-16, 55, 13, 8), (16, 55, 13, 8), (0, 60, 15, 9), (-29, 57, 8, 6), (29, 57, 8, 6), (-8, 70, 12, 8), (9, 70, 12, 8), (0, 79, 10, 6)))
    for x in range(bx - 32, bx + 33, 4): sp.put(x, by - 40 + (abs(x - bx) // 8), "leaflo")
    for vx, vy, L in ((-22, 42, 16), (-10, 46, 12), (8, 45, 14), (20, 42, 17), (28, 46, 10)):   # lianas hanging from the crown
        sp.line(bx + vx, by - vy, bx + vx + 1, by - vy + L, "stem"); sp.put(bx + vx, by - vy + L, "leaf"); sp.put(bx + vx + 1, by - vy + L - 4, "leaf")
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("pal-tropical-small", lygodium), ("pal-tropical-medium", nypa), ("pal-tropical-large", dipterocarp),
                ("neo-tropical-small", heliconia), ("neo-tropical-medium", musa), ("neo-tropical-large", ceiba),
                ("qua-tropical-small", philodendron), ("qua-tropical-medium", euterpe), ("qua-tropical-large", swietenia)):
    fn().save(f"{out}/{key}.png")
