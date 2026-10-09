# Draws the other 18 scrubland landscape plants (Devonian, Jurassic, Cretaceous, Paleogene, Neogene, Quaternary) in the Dimetrodon's flat, simple style.
# Same helpers and rules as tools/pixelplants_wetland.py (copied because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge,
# shadow on undersides and right edges, a lighter rib. Leaves lean dry khaki-olive for the scrubland, with grey-green sage for the silvery shrubs. (Permian and Triassic are in pixelplant_flat.py / pixelplants_flat.py.)
#   dev-  Hostinella (forked bare stems), Sawdonia (spiny forked stems), Drepanophycus (upright hooked-leaf stems)
#   jur-  Otozamites (tuft of ear-pinna fronds), Ptilophyllum (stubby cycadeoid crown), Brachyphyllum (stout araucarian conifer)
#   cre-  Ruffordia (lacy sprawling fern), Pseudofrenelopsis (jointed-branch shrub), Eucalyptophyllum (early gum with sickle leaves)
#   pal-  Hopbush (pink seed pods), Acacia (flat-topped umbrella), Eucalyptus (tall gum)
#   neo-  Sagebrush (silver dome), Saltbush (scurfy silver shrub), Juniper (dark cone with berries)
#   qua-  Sage (violet flower spikes), Chamise (wiry dome with white sprays), Manzanita (red crooked limbs)
# Usage: python3 -I tools/pixelplants_scrubland.py [outdir]
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


DRY = mix(OLIVE, (178, 150, 70), .32)    # scrubland leaf: the olive dried toward khaki
SAGE = mix(OLIVE, (150, 165, 140), .45)  # grey-green sage / silvery shrubs

def hostinella():   # small: bare, repeatedly forked little stems, a sporangium at each tip, low and tufted
    sp = Sprite(44, 38, mix(DRY, (255, 255, 255), .1)); bx, by = 22, 36
    for ang, L, x in ((-.9, 9, -5), (.8, 9, 5), (-.35, 13, -2), (.3, 12, 2), (0, 15, 0)): fork(sp, bx + x, by, ang, L, 3, split=.5, shrink=.72)
    for x in range(bx - 4, bx + 5): sp.put(x, by + 1, "stem")
    return sp

def spines(sp, x, y, n, L, side):   # short spine dashes standing off a stem
    for i in range(n): sp.line(x, y - i * 3, x + side * L, y - i * 3 - 1, "leaf")

def sawdonia():   # medium: stout forked stems bristling with rows of tiny spines, curled tips
    sp = Sprite(64, 46, mix(DRY, (0, 0, 0), .04)); bx, by = 32, 44
    for ang, L, x in ((-1.0, 13, -6), (1.0, 13, 6), (-.45, 16, -2), (.4, 16, 2)):
        x1, y1 = bx + x + math.sin(ang) * L, by - math.cos(ang) * L; sp.line(bx + x, by, x1, y1, "leaf", 1)
        for t in (.25, .5, .75): px, py = bx + x + (x1 - bx - x) * t, by + (y1 - by) * t; sp.line(px, py, px - 2, py - 1, "leaflo"); sp.line(px, py, px + 2, py - 1, "leaflo")
        for d in (-1, 1): fork(sp, x1, y1, ang + d * .45, L * .75, 2, split=.5, shrink=.8, spor=True)
    for x in range(bx - 5, bx + 6): sp.put(x, by + 1, "stem")
    return sp

def drepanophycus():   # large: a few upright leafy stems, thickly set with curved spine leaves, hooked at the tips, from a creeping base
    sp = Sprite(64, 92, mix(DRY, (0, 0, 0), .14)); bx, by = 32, 90
    for tx, top in ((-12, 56), (0, 78), (11, 62)):
        lean = 3 if tx >= 0 else -3; pts = [(bx + tx * .4, by), (bx + tx * .9, by - top * .5), (bx + tx + lean, by - top)]
        for i in range(len(pts) - 1): sp.line(*pts[i], *pts[i + 1], "leaf", 2.2)   # a green, leaf-clad stem
        for h in range(4, top, 3):   # spiral of hooked leaves, alternating sides
            f = h / top; x = bx + tx * .4 + (tx + lean - tx * .4) * f; side = 1 if (h // 3) % 2 else -1
            sp.line(x, by - h, x + side * 5, by - h - 2, "leaf"); sp.line(x + side * 5, by - h - 2, x + side * 6, by - h + 1, "leaf")
            sp.put(x + side * 2, by - h - 1, "leaflo")
        sp.fill(pts[-1][0], pts[-1][1] - 2, 1.8, 2.6, "leaf")
    stem(sp, [(bx - 13, by + 1), (bx, by + 1), (bx + 13, by + 1)], 1.8, 1.8)
    return sp

def otozamites():   # small: a tuft of short stiff fronds, each a row of rounded ear-shaped pinnae
    sp = Sprite(48, 38, mix(DRY, (255, 255, 255), .06)); bx, by = 24, 36
    for tx, ty, b in ((-20, 8, -3), (20, 9, 3), (-13, 18, -3), (13, 19, 3), (-5, 25, -1), (5, 26, 1)):
        base = (bx, by - 1); tip = (bx + tx, by - ty - 2); frond(sp, base, ((base[0] + tip[0]) / 2 + b, (base[1] + tip[1]) / 2 - 3), tip, 3.2, 9, .55)
    stem(sp, [(bx, by + 1), (bx, by - 3)], 2.6, 2.0)
    return sp

def ptilophyllum():   # medium: a stubby trunk with a crown of stiff, straight-sided fronds
    sp = Sprite(72, 54, mix(DRY, (0, 0, 0), .04)); bx, by = 36, 52
    stem(sp, [(bx, by + 1), (bx, by - 12)], 3.4, 3.0); top = (bx, by - 12)
    for dx in range(-3, 4):
        if dx % 2 == 0: sp.put(bx + dx, by - 5, "stemlo"); sp.put(bx + dx, by - 9, "stemlo")
    for tx, ty in sorted(((-33, -1), (33, 0), (-27, 10), (28, 11), (-16, 17), (17, 18), (-5, 21), (6, 22)), key=lambda f: -abs(f[0])):
        tip = (bx + tx, top[1] - ty); frond(sp, top, ((top[0] + tip[0]) / 2, (top[1] + tip[1]) / 2 - 5), tip, 3.0, 12, .2)
    return sp

def brachyphyllum():   # large: a stout araucarian conifer, thick trunk, whorled rounded branches of fat overlapping scale shoots
    sp = Sprite(64, 92, mix(DRY, (0, 0, 0), .16)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 60)], 3.6, 1.4)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    scars(sp, bx, by - 3, by - 40, 2, 5)
    for side, h, rch, drop in ((-1, 14, 22, 2), (1, 18, 23, 2), (-1, 27, 19, 2), (1, 32, 18, 2), (-1, 41, 14, 1), (1, 45, 13, 1), (-1, 53, 8, 0), (1, 56, 7, 0)):
        x0, y0 = bx, by - h
        scale_shoot(sp, x0, y0, x0 + side * rch, y0 - 3 + drop, 2.6)
        for t in (.45, .75): px = x0 + side * rch * t; scale_shoot(sp, px, y0 - 1, px + side * 3, y0 - 9 + t * 4, 2.0)
    scale_shoot(sp, bx, by - 58, bx, by - 74, 2.6)
    return sp

def ruffordia():   # small: a low sprawl of finely cut, lacy fern fronds
    sp = Sprite(54, 34, mix(DRY, (255, 255, 255), .14)); bx, by = 27, 32
    for tx, ty, b in ((-24, 4, -4), (24, 5, 4), (-17, 11, -5), (17, 12, 5), (-9, 17, -3), (9, 18, 3), (0, 21, 0)):
        base = (bx + tx * .06, by - 1); tip = (bx + tx, by - 1 - ty); frond(sp, base, ((base[0] + tip[0]) / 2 + b * .3, (base[1] + tip[1]) / 2 - 7), tip, 2.5, 13, .08, groove=False)
    stem(sp, [(bx, by + 1), (bx, by - 2)], 1.8, 1.4)
    return sp

def joint_stem(sp, pts, w, seg=4):   # a thick green branch made of short beads (jointed, succulent-looking scale-leaf shoots)
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]; d = math.hypot(x1 - x0, y1 - y0); n = max(1, int(d / seg))
        for k in range(n):
            t = (k + .5) / n; sp.fill(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w, w * .85, "leaf")
            sp.put(x0 + (x1 - x0) * (k / n), y0 + (y1 - y0) * (k / n) + w * .6, "leaflo")

def pseudofrenelopsis():   # medium: a squat shrub of bead-jointed green branches, fanning up from a short trunk
    sp = Sprite(66, 52, mix(DRY, (0, 0, 0), .06)); bx, by = 33, 50
    stem(sp, [(bx, by + 1), (bx, by - 8)], 2.4, 1.8)
    for ang, L in ((-1.15, 22), (-.75, 28), (-.35, 32), (0, 34), (.35, 32), (.75, 28), (1.15, 22)):
        mx, my = bx + math.sin(ang) * L * .5, by - 8 - math.cos(ang) * L * .5; ex, ey = bx + math.sin(ang) * L, by - 8 - math.cos(ang) * L
        joint_stem(sp, [(bx, by - 8), (mx, my), (ex, ey)], 2.0 if abs(ang) < .8 else 1.8)
        if abs(ang) < 1: sp.fill(ex, ey - 1, 1.6, 2.0, "seed")   # a small cone
    return sp

def eucalyptophyllum():   # large: an early gum, pale mottled trunk and a loose crown of long sickle leaves hanging in clumps
    sp = Sprite(72, 92, mix(DRY, (0, 0, 0), .1)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx - 1, by - 24), (bx - 1, by - 44)], 3.0, 2.0)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for y in range(by - 6, by - 44, -6): sp.put(bx - 1, y, "stemhi"); sp.put(bx, y - 1, "stemhi")   # peeling bark strips
    stem(sp, [(bx - 1, by - 40), (bx - 14, by - 54)], 1.6, 1.2); stem(sp, [(bx - 1, by - 40), (bx + 13, by - 56)], 1.6, 1.2); stem(sp, [(bx - 1, by - 44), (bx, by - 62)], 1.6, 1.2)
    for cx, cy in ((-20, 52), (-12, 62), (-2, 68), (9, 63), (18, 56), (22, 48), (0, 56)):
        for k in range(5):
            a = (k - 2) * .35; blade(sp, bx + cx, by - cy, bx + cx + a * 8, by - cy + 15 - abs(a) * 4, 1.3, bowx=a * 3 + (2 if cx > 0 else -2))
    return sp

def dodonaea():   # small: a dense little bush of narrow leaves with papery rose-pink winged seed pods
    sp = Sprite(46, 40, mix(DRY, (255, 255, 255), .12)); bx, by = 23, 38; sp.C.update(pod=(204, 96, 80), podhi=(230, 140, 120), podlo=(140, 60, 56))
    for tx, h in ((-17, 18), (-12, 26), (-6, 31), (0, 33), (6, 30), (12, 25), (17, 17), (-2, 22), (4, 23)): blade(sp, bx + tx * .2, by, bx + tx, by - h, 1.5, bowx=tx * .15, bowy=-2)
    for x, y in ((-10, 28), (-3, 33), (5, 31), (11, 26), (-14, 20), (15, 20), (0, 27)):
        sp.put(bx + x, by - y, "pod"); sp.put(bx + x + 1, by - y, "podhi"); sp.put(bx + x, by - y + 1, "podlo"); sp.put(bx + x + 1, by - y + 1, "pod")
    return sp

def acacia():   # medium: a flat-topped, umbrella-crowned thorn tree with feathery layered canopy
    sp = Sprite(72, 56, mix(DRY, (0, 0, 0), .04)); bx, by = 36, 54
    stem(sp, [(bx, by + 1), (bx - 1, by - 14), (bx - 2, by - 24)], 2.6, 1.8)
    stem(sp, [(bx - 2, by - 22), (bx - 13, by - 31)], 1.4, 1.0); stem(sp, [(bx - 2, by - 22), (bx + 10, by - 32)], 1.4, 1.0)
    for cx, cy, rx, ry in sorted(((-22, 32, 12, 4), (-8, 38, 13, 4), (8, 37, 13, 4), (23, 33, 12, 4), (0, 44, 14, 4), (-14, 42, 10, 3), (16, 43, 10, 3)), key=lambda c: c[1]):
        sp.fill(bx + cx, by - cy, rx, ry, "leaf")
        for x in range(int(bx + cx - rx), int(bx + cx + rx) + 1):   # feathery underside: short drips of leaflets
            if (x + cx) % 3 == 0 and sp.get(x, int(by - cy + ry)) == "leaf": sp.put(x, int(by - cy + ry) + 1, "leaflo")
            if (x + cx) % 4 == 0: sp.put(x, int(by - cy - ry * .5), "leafhi")
    return sp

def eucalyptus():   # large: a tall gum, smooth pale trunk, thin crown of long drooping leaf tassels
    sp = Sprite(72, 92, mix(DRY, (0, 0, 0), .08)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx - 1, by - 52)], 3.0, 1.8)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    for y in range(by - 8, by - 50, -7): sp.put(bx, y, "stemlo"); sp.put(bx - 1, y - 1, "stemhi")
    brs = ((-1, 56, 18, 6), (1, 60, 19, 6), (-1, 66, 13, 6), (1, 70, 12, 6), (-1, 74, 6, 5), (1, 78, 5, 4))
    for side, h, rch, rise in brs:
        x0, y0 = bx - 1, by - h + 8; ex, ey = x0 + side * rch, y0 - rise
        stem(sp, [(x0, y0), (ex, ey)], 1.4, 1.0)
        for k in range(5): a = (k - 2) * .35; blade(sp, ex, ey, ex + side * 3 + a * 8, ey + 17 - abs(a) * 5, 1.3, bowx=a * 3)
    return sp

def artemisia():   # small: a low sagebrush, a clump of silvery wedge-leaf tufts on short grey stems, ragged on top
    sp = Sprite(48, 34, mix(SAGE, (255, 255, 255), .12)); bx, by = 24, 32
    for tx, top in ((-12, 12), (-5, 16), (3, 15), (11, 11)): sp.line(bx + tx * .3, by, bx + tx, by - top, "stem")
    for cx, cy, rx, ry in sorted(((-14, 15, 7, 5), (-6, 22, 8, 6), (4, 24, 8, 6), (13, 17, 7, 5), (0, 14, 9, 5), (-18, 10, 4, 3), (19, 10, 4, 3)), key=lambda c: c[1]):
        sp.fill(bx + cx, by - cy, rx, ry, "leaf")
        for y in range(int(by - cy - ry), int(by - cy + ry) + 1):
            for x in range(int(bx + cx - rx), int(bx + cx + rx) + 1):
                if sp.get(x, y) == "leaf":
                    if y > by - cy + ry * .3 and (x + y // 2) % 3 == 0: sp.put(x, y, "leaflo")
                    elif y < by - cy and (x * 2 + y) % 5 == 0: sp.put(x, y, "leafhi")
    for x in range(bx - 3, bx + 4): sp.put(x, by, "stem")
    return sp

def atriplex():   # medium: a loose silver-green shrub of bare grey stems under clumps of pale scurfy leaves, with papery seed bracts
    sp = Sprite(66, 48, mix(SAGE, (255, 255, 255), .2)); bx, by = 33, 46
    for tx, top in ((-18, 24), (-9, 32), (0, 36), (9, 32), (18, 24)): sp.line(bx + tx * .15, by, bx + tx, by - top, "stem", 0)
    for cx, cy, rx, ry in sorted(((-18, 30, 10, 6), (-8, 38, 11, 6), (4, 40, 11, 6), (14, 34, 11, 6), (22, 26, 8, 5), (0, 28, 10, 6)), key=lambda c: c[1]):
        sp.fill(bx + cx, by - cy, rx, ry, "leaf")
        for x in range(int(bx + cx - rx), int(bx + cx + rx) + 1):
            if (x + cx) % 4 == 0: sp.put(x, int(by - cy + ry * .6), "leaflo")
            if (x + cx) % 5 == 1: sp.put(x, int(by - cy - ry * .4), "leafhi")
    for x, y in ((-12, 36), (2, 44), (12, 38), (-20, 31), (20, 30)): sp.put(bx + x, by - y, "seed"); sp.put(bx + x + 1, by - y, "seedhi")
    return sp

def juniperus():   # large: a juniper, a short twisted trunk under a dense, dark, rounded cone of scale-leaf shoots with blue-grey berries
    sp = Sprite(64, 92, mix(DRY, (20, 40, 30), .45)); bx, by = 32, 90; sp.C.update(berry=(110, 130, 170), berryhi=(160, 175, 205))
    stem(sp, [(bx, by + 1), (bx + 1, by - 12), (bx - 1, by - 22), (bx, by - 30)], 3.2, 2.2)
    for x in range(bx - 5, bx + 6): sp.put(x, by + 1, "stem")
    for cx, cy, rx, ry in sorted(((0, 78, 8, 8), (-10, 66, 14, 9), (10, 66, 14, 9), (-14, 50, 17, 9), (14, 50, 17, 9), (0, 56, 15, 10), (-9, 38, 18, 8), (9, 38, 18, 8), (0, 28, 22, 7)), key=lambda c: c[1], reverse=True):
        sp.fill(bx + cx, by - cy + 6, rx, ry, "leaf")
        for y in range(int(by - cy + 6 - ry), int(by - cy + 6 + ry) + 1):
            for x in range(int(bx + cx - rx), int(bx + cx + rx) + 1):
                if sp.get(x, y) == "leaf":
                    if y > by - cy + 6 + ry * .3 and (x + y // 2) % 3 == 0: sp.put(x, y, "leaflo")
                    elif y < by - cy + 6 - ry * .3 and (x // 2 + y) % 4 == 0: sp.put(x, y, "leafhi")
    for x, y in ((-12, 46), (10, 56), (-4, 62), (14, 40), (-16, 38), (4, 32)): sp.put(bx + x, by - y, "berry"); sp.put(bx + x + 1, by - y, "berryhi")
    return sp

def salvia():   # small: a clump of grey-green wrinkled leaves with tall spikes of violet-blue flowers
    sp = Sprite(48, 44, mix(SAGE, (255, 255, 255), .08)); bx, by = 24, 42; sp.C.update(flw=(120, 100, 190), flwhi=(165, 150, 225), flwlo=(80, 62, 140))
    for tx, h in ((-14, 14), (-8, 18), (-2, 20), (4, 19), (10, 16), (15, 13), (0, 14)): lens(sp, bx, by, bx + tx, by - h, 2.4, teeth=False)
    for tx, h in ((-8, 34), (-1, 40), (7, 36)):
        sp.line(bx + tx * .3, by - 12, bx + tx, by - h, "stem")
        for y in range(by - h, by - 20, 3):
            f = (y - (by - h)) / 3; sp.put(bx + tx - 1, y, "flw"); sp.put(bx + tx + 1, y, "flwlo"); sp.put(bx + tx, y - 1, "flwhi"); sp.put(bx + tx, y, "flw")
    return sp

def adenostoma():   # medium: chamise, a dense dome of thin wiry stems carrying needle-like leaf clusters, with sprays of tiny white flowers on top
    sp = Sprite(68, 54, mix(DRY, (0, 0, 0), .08)); bx, by = 34, 52; sp.C.update(wht=(236, 230, 205), whthi=(255, 252, 235), whtlo=(180, 172, 150))
    for tx, top in ((-22, 24), (-14, 32), (-6, 37), (2, 38), (10, 35), (18, 29), (25, 22)): sp.line(bx + tx * .2, by, bx + tx, by - top, "stem")
    sp.fill(bx, by - 26, 28, 18, "leaf")
    for y in range(by - 46, by - 6):
        for x in range(0, 68):
            if sp.get(x, y) == "leaf":
                if y > by - 24 and (x * 3 + y) % 4 == 0: sp.put(x, y, "leaflo")
                elif (x + y * 2) % 5 == 0: sp.put(x, y, "leafhi")
    for y in range(by - 6, by + 1):
        for x in range(0, 68):
            if y > by - 8: sp.put(x, y, None) if y > by - 7 and (x < bx - 18 or x > bx + 18) else None
    for x in range(bx - 20, bx + 21, 5):   # flower sprays along the top
        yy = by - 26 - int(18 * math.sqrt(max(0, 1 - ((x - bx) / 28) ** 2))) - 1
        for k in range(3): sp.put(x + k - 1, yy - (k == 1), "whthi" if k == 1 else "wht")
        sp.put(x, yy + 1, "whtlo")
    return sp

def arctostaphylos():   # large: manzanita, a few smooth red-brown crooked limbs under a rounded crown of round leaves, with pale pink bells
    sp = Sprite(70, 92, mix(DRY, (0, 0, 0), .06)); bx, by = 35, 90; sp.C.update(rust=(150, 66, 40), rusthi=(190, 100, 70), rustlo=(96, 40, 28), bell=(236, 190, 190))
    for ang, L in ((-.55, 46), (.3, 54), (.7, 44), (-.15, 60)):
        pts = [(bx, by), (bx + math.sin(ang) * L * .4 + 2, by - L * .5), (bx + math.sin(ang) * L, by - math.cos(ang) * L)]
        for i in range(len(pts) - 1):
            sp.line(*pts[i], *pts[i + 1], "rust", 1.5)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "rust")
    sp.line(bx - 3, by - 6, bx - 3, by - 40, "rusthi"); sp.line(bx + 3, by - 6, bx + 5, by - 30, "rustlo")
    for cx, cy, rx, ry in sorted(((-18, 52, 11, 8), (18, 50, 11, 8), (-6, 66, 14, 9), (12, 66, 13, 9), (-22, 66, 9, 6), (24, 62, 9, 6), (0, 78, 12, 7), (-12, 78, 8, 5), (12, 76, 8, 5)), key=lambda c: c[1]):
        sp.fill(bx + cx, by - cy, rx, ry, "leaf")
        for y in range(int(by - cy - ry), int(by - cy + ry) + 1):
            for x in range(int(bx + cx - rx), int(bx + cx + rx) + 1):
                if sp.get(x, y) == "leaf":
                    if y > by - cy + ry * .3 and (x + y // 2) % 3 == 0: sp.put(x, y, "leaflo")
                    elif y < by - cy - ry * .3 and (x + y) % 4 == 0: sp.put(x, y, "leafhi")
    for x, y in ((-14, 56), (6, 70), (-4, 74), (20, 54), (-24, 62), (14, 78)): sp.put(bx + x, by - y, "bell"); sp.put(bx + x, by - y + 1, "bell")
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("dev-scrubland-small", hostinella), ("dev-scrubland-medium", sawdonia), ("dev-scrubland-large", drepanophycus),
                ("jur-scrubland-small", otozamites), ("jur-scrubland-medium", ptilophyllum), ("jur-scrubland-large", brachyphyllum),
                ("cre-scrubland-small", ruffordia), ("cre-scrubland-medium", pseudofrenelopsis), ("cre-scrubland-large", eucalyptophyllum),
                ("pal-scrubland-small", dodonaea), ("pal-scrubland-medium", acacia), ("pal-scrubland-large", eucalyptus),
                ("neo-scrubland-small", artemisia), ("neo-scrubland-medium", atriplex), ("neo-scrubland-large", juniperus),
                ("qua-scrubland-small", salvia), ("qua-scrubland-medium", adenostoma), ("qua-scrubland-large", arctostaphylos)):
    fn().save(f"{out}/{key}.png")
