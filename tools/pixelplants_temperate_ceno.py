# Draws the temperate landscape plants of the Paleogene and Neogene in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_temperate_meso.py,
# because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges.
#   pal-  Zelkova (a young elm relative, zigzag twigs with two rows of toothed leaves), Quercus (a squat spreading oak, a lobed scalloped crown, acorns in cups), Metasequoia (a tall narrow dawn redwood, buttressed trunk, paired feathery sprays)
#   neo-  Anemone (a low tuft of deeply cut leaves under white star flowers), Acer (a round maple, star-lobed leaves, tan winged seeds), Fagus (a beech: a smooth silver trunk, a broad tiered crown sweeping down to the ground)
# With these the temperate biome has all 27 landscape plants in the flat style (the Quaternary three are in tools/pixelplants_temperate.py).
# Usage: python3 -I tools/pixelplants_temperate_ceno.py [outdir]
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


def ramp(sp, name, rgb): t = tones(rgb); sp.C.update({name: t[0], name + "hi": t[1], name + "lo": t[2]})   # a new shaded color

def clump(sp, cx, cy, rx, ry, dash=True):   # a leaf mass with its underside in rows of dark dashes
    sp.fill(cx, cy, rx, ry, "leaf")
    if not dash: return
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if sp.get(x, y) == "leaf" and y > cy + ry * .35 and (x + y // 2) % 3 == 0: sp.put(x, y, "leaflo")

def lobed(sp, cx, cy, rx, ry, n=7):   # a leaf mass with a scalloped rim (little round lobes all round), the underside in dark dashes
    sp.fill(cx, cy, rx, ry, "leaf")
    for k in range(n):
        a = 2 * math.pi * k / n + .4; sp.fill(cx + math.cos(a) * rx * .92, cy + math.sin(a) * ry * .92, max(1.6, rx * .22), max(1.4, ry * .24), "leaf")
    for y in range(int(cy - ry) - 2, int(cy + ry) + 3):
        for x in range(int(cx - rx) - 2, int(cx + rx) + 3):
            if sp.get(x, y) == "leaf" and y > cy + ry * .3 and (x + y // 2) % 3 == 0: sp.put(x, y, "leaflo")

def crown(sp, bx, by, spec, shape=clump):   # leaf clumps back to front, each (dx, up, rx, ry)
    for cx, cy, rx, ry in sorted(spec, key=lambda c: c[1]): shape(sp, bx + cx, by - cy, rx, ry)

def star(sp, x, y, r, key="leaf", pts=5, rot=0.0):   # a lobed leaf seen flat: a small disc with pointed lobes (maple)
    sp.fill(x, y, r * .55, r * .55, key)
    for k in range(pts):
        a = rot + 2 * math.pi * k / pts; sp.line(x, y, x + math.sin(a) * r, y - math.cos(a) * r, key, 0)
        sp.line(x, y, x + math.sin(a) * r * .8, y - math.cos(a) * r * .8, key, 1 if r > 4 else 0)

# Paleogene
def zelkova():   # small: a young elm relative, zigzag twigs with two rows of toothed pointed leaves
    sp = Sprite(44, 38, lf(.04)); bx, by = 22, 36
    for tx, tips in ((-10, ((-4, 30), (-12, 22))), (0, ((2, 34), (-2, 24))), (10, ((6, 28), (14, 20)))):
        pts = [(bx + tx * .3, by), (bx + tx * .6, by - 9), (bx + tx + tips[0][0] * .3, by - 17), (bx + tx + tips[0][0], by - tips[0][1] + 2)]
        stem(sp, pts, 1.3, .8)
        for i, (px, py) in enumerate(pts[1:], 1):   # alternate leaves, left then right, longer toward the middle of the twig
            side = -1 if i % 2 else 1; veined(sp, px, py, side * 1.15, 9 - (1 if i == 3 else 0), 2.9, pairs=2)
        veined(sp, pts[-1][0], pts[-1][1], 0, 8, 2.7, pairs=2)
    base(sp, bx, by, 5)
    return sp

def quercus():   # medium: a squat spreading oak, a short gnarled trunk, a wide scalloped crown, acorns in cups
    sp = Sprite(64, 54, lf(-.08)); bx, by = 32, 52
    stem(sp, [(bx, by + 1), (bx + 1, by - 8), (bx - 1, by - 15)], 4.2, 3.0); base(sp, bx, by, 7)
    for y in range(by - 3, by - 15, -3): sp.put(bx - 2, y, "stemlo"); sp.put(bx + 2, y + 1, "stemlo")
    for lx, ly in ((-18, 26), (-8, 31), (9, 31), (19, 26)): stem(sp, [(bx - 1, by - 14), (bx + lx * .5, by - ly + 9), (bx + lx, by - ly)], 2.2, 1.2)
    crown(sp, bx, by, ((-20, 28, 10, 7), (20, 28, 10, 7), (-10, 36, 12, 8), (10, 36, 12, 8), (0, 31, 12, 8), (-26, 24, 6, 5), (26, 24, 6, 5), (0, 43, 9, 5)), shape=lobed)
    for x, y in ((-22, 23), (-8, 27), (11, 25), (24, 22), (2, 32)): sp.put(bx + x, by - y, "seed"); sp.put(bx + x, by - y + 1, "seed"); sp.put(bx + x, by - y - 1, "stemlo")   # acorn and cup
    return sp

def metasequoia():   # large: a tall narrow dawn redwood, a buttressed trunk, flat tiers of paired feathery sprays up a slim cone
    sp = Sprite(72, 92, mix(lf(-.12), (150, 110, 40), .12)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx, by - 76)], 4.4, 1.2)
    for x in range(bx - 10, bx + 11): sp.put(x, by + 1, "stem"); sp.put(x, by, "stem")
    for x in range(bx - 7, bx + 8): sp.put(x, by - 1, "stem")   # the flared buttress
    for y in range(by - 3, by - 22, -4):
        for dx in (-2, 1): sp.put(bx + dx + (y // 4) % 2, y, "stemlo"); sp.put(bx + dx + (y // 4) % 2, y - 1, "stemlo")   # flutes
    for h in range(66, 17, -6):   # a dense leaf tier at each level, narrowing to the top, with sprays hanging off its rim
        r = 4 + 20 * (1 - h / 74) ** .9
        clump(sp, bx, by - h, r, 4.2)
        for x in range(int(bx - r) + 1, int(bx + r), 2): sp.put(x, by - h - 3, "leafhi")
        for side in (-1, 1):
            feather(sp, bx + side * r * .3, by - h + 1, bx + side * (r + 4), by - h + 3, 3.2, w=.9)
            for t in (.4, .7, 1.0): blade(sp, bx + side * r * t, by - h + 3, bx + side * (r * t + 1), by - h + 10, 1.2, bowx=side)
    for k in range(3): lens(sp, bx, by - 72, bx + (k - 1) * 2, by - 86 + abs(k - 1), 1.0, teeth=False)
    return sp

# Neogene
def anemone():   # small: a low tuft of deeply cut three-lobed leaves, a few white star flowers on thin stems
    sp = Sprite(44, 38, lf(.1)); ramp(sp, "white", (240, 238, 226)); bx, by = 22, 36
    for tx, a, L in ((-12, -1.0, 13), (12, 1.0, 13), (-5, -.45, 14), (5, .45, 14), (0, 0, 12)):   # leaves: three narrow lobes fanned from a stalk
        sx, sy = bx + tx * .5, by - 1
        sp.line(sx, sy, sx + math.sin(a) * L * .55, sy - math.cos(a) * L * .55, "stem", 0)
        px, py = sx + math.sin(a) * L * .55, sy - math.cos(a) * L * .55
        for da in (-.55, 0, .55): lens(sp, px, py, px + math.sin(a + da) * L * .6, py - math.cos(a + da) * L * .6, 1.5, teeth=False)
    for fx, fy in ((-8, 24), (7, 28), (-1, 16)):   # flowers: a stem up to six pointed white petals round a gold centre
        sp.line(bx + fx * .5, by - 8, bx + fx, by - fy + 2, "stem", 0)
        for k in range(6):
            a = math.pi * 2 * k / 6 + .3; lens(sp, bx + fx, by - fy, bx + fx + math.cos(a) * 4.6, by - fy + math.sin(a) * 3.4, 1.15, teeth=False)
        for yy in range(int(by - fy - 5), int(by - fy + 5)):
            for xx in range(int(bx + fx - 6), int(bx + fx + 7)):
                if sp.get(xx, yy) == "leaf" and abs(xx - bx - fx) < 6 and abs(yy - by + fy) < 5 and math.hypot(xx - bx - fx, (yy - by + fy) * 1.3) > 1.8 and (xx, yy) not in ((0, 0),): sp.put(xx, yy, "white")
        sp.fill(bx + fx, by - fy, 1.5, 1.3, "seed"); sp.put(bx + fx - 1, by - fy - 1, "seedhi")
    base(sp, bx, by, 6)
    return sp

def acer():   # medium: a round maple on a slim trunk, a crown of star-lobed leaves, tan winged seeds
    sp = Sprite(64, 54, lf(.06)); ramp(sp, "key", (214, 190, 120)); bx, by = 32, 52
    stem(sp, [(bx, by + 1), (bx, by - 10), (bx, by - 20)], 3.0, 1.9); base(sp, bx, by, 5)
    for y in range(by - 3, by - 18, -3): sp.put(bx - 1, y, "stemlo")
    for lx, ly in ((-12, 32), (12, 32), (-4, 38), (5, 38)): stem(sp, [(bx, by - 18), (bx + lx, by - ly)], 1.5, 1.0)
    crown(sp, bx, by, ((-15, 32, 10, 7), (15, 32, 10, 7), (0, 38, 12, 8), (-8, 27, 10, 6), (9, 27, 10, 6), (0, 44, 8, 5)))
    for dx, dy in ((-20, 34), (-14, 41), (-5, 46), (5, 46), (13, 42), (20, 35), (-10, 31), (9, 32), (0, 38), (-22, 28), (22, 29)): star(sp, bx + dx, by - dy, 3.6, "leafhi")   # lit lobed leaves on the rim
    for dx, dy in ((-16, 24), (-3, 22), (10, 23), (20, 25)):   # a pair of winged seeds hanging below the crown
        sp.line(bx + dx, by - dy, bx + dx, by - dy + 3, "stem", 0)
        for s_ in (-1, 1): lens(sp, bx + dx, by - dy + 3, bx + dx + s_ * 2.4, by - dy + 8, .9, teeth=False); 
        for s_ in (-1, 1):
            for r_ in range(3, 8): sp.put(bx + dx + s_ * (r_ - 3) * .5, by - dy + r_, "key")
    return sp

def fagus():   # large: a beech, a smooth silver trunk, a broad tiered crown whose lower layers sweep down nearly to the ground
    sp = Sprite(72, 92, lf(-.1)); bx, by = 36, 90
    sp.C.update(stem=(150, 144, 132), stemhi=(184, 180, 170), stemlo=(98, 94, 88))
    stem(sp, [(bx, by + 1), (bx, by - 14), (bx, by - 30)], 6.4, 4.0)
    for x in range(bx - 11, bx + 12): sp.put(x, by + 1, "stem"); sp.put(x, by, "stem")
    for x in range(bx - 8, bx + 9): sp.put(x, by - 1, "stem")   # the splayed roots
    for y in range(by - 3, by - 24, -4): sp.put(bx - 2, y, "stemlo"); sp.put(bx + 3, y + 1, "stemlo")
    spec = ((-26, 14, 9, 5), (26, 14, 9, 5), (-22, 22, 12, 6), (22, 22, 12, 6), (-12, 30, 14, 7), (12, 30, 14, 7), (0, 26, 12, 7),
            (-23, 38, 11, 8), (23, 38, 11, 8), (0, 42, 17, 9), (-12, 54, 15, 9), (12, 54, 15, 9), (0, 62, 16, 9), (-5, 72, 12, 7), (5, 72, 12, 7), (0, 79, 8, 5))
    crown(sp, bx, by, spec)
    for cx, cy, rx, ry in ((-9, 62, 4, 3), (11, 52, 4, 3), (-17, 38, 4, 3), (4, 72, 3, 2), (19, 28, 3, 2), (-20, 20, 3, 2)): sp.fill(bx + cx, by - cy, rx, ry, "leafhi")   # lit tips of new leaf
    for x, y in ((-18, 20), (-4, 26), (8, 22), (22, 16), (-26, 12)): sp.put(bx + x, by - y, "seed"); sp.put(bx + x, by - y + 1, "seedlo")   # beech nuts in husks
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("pal-temperate-small", zelkova), ("pal-temperate-medium", quercus), ("pal-temperate-large", metasequoia),
                ("neo-temperate-small", anemone), ("neo-temperate-medium", acer), ("neo-temperate-large", fagus)):
    fn().save(f"{out}/{key}.png")
