# Draws the boreal landscape plants (Permian onward: no boreal before the Permian) and the two boreal Park Plants in the Dimetrodon's flat, simple style
# (helpers copied from tools/pixelplants_temperate_ceno.py, because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge,
# shadow on undersides and right edges. Mostly conifers, ferns and cycad relatives, in dark cold blue-greens so they stand out from the mid forest-floor green.
#   per-boreal-  Gangamopteris (a tuft of broad tongue leaves), Noeggerathiopsis (strap-leaved rosettes on short trunks), Glossopteris (a tree with tufts of midribbed tongue leaves)
#   jur-boreal-  Phoenicopsis (brooms of hair-fine leaves), Pityophyllum (a small needle-tufted conifer), Elatides (a broad tiered cone with ovoid cones)
#   cre-boreal-  Birisia (an umbrella fern), Heilungia (a cycad-like crown of stiff pinnate leaves), Parataxodium (a swamp-cypress-like conifer with drooping feathery sprays)
#   pal-boreal-  Royal Fern (a vase of fronds, a rust spore tassel), Birch (white trunks, airy crown, catkins), Larch (a loose cone of soft needle tufts)
#   neo-boreal-  Blueberry (a wiry bush, red leaves, blue berries), Alder (a dark rounded shrub with catkins), Spruce (a tall narrow tiered dark cone)
#   qua-boreal-  Reindeer Lichen (a pale mound with red-capped stalks), Marsh Rosemary (a mound of narrow leaves under pink bells), Pine (a tall reddish trunk, flat pads of needles)
#   q-black-spruce  q-quaking-aspen   the two Park Plants (a scruffy club-topped spruce; a white trunk under green and gold leaves)
# Usage: python3 -I tools/pixelplants_boreal.py [outdir]
import sys, math, random
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


# ---- boreal helpers (new) ----
def wood(sp, rgb): t = tones(rgb); sp.C.update(stem=t[0], stemhi=t[1], stemlo=t[2])   # the sprite's "stem" color as another woody tone

def tongue(sp, x, y, ang, L, w, vein=True, key="leaf"):
    # a tongue-shaped leaf from its base (x, y) out along ang (0 is up): narrow at the stalk, widest in the outer half, a rounded tip; a midrib, and dashes for net veins
    c, s = math.cos(ang), math.sin(ang)
    for py in range(int(y - L) - 3, int(y + L) + 4):
        for px in range(int(x - L) - 3, int(x + L) + 4):
            u = (px - x) * s - (py - y) * c; v = (px - x) * c + (py - y) * s
            if not 0 <= u <= L: continue
            t = u / L; hw = w * min(1, (t / .55) ** .7) * (1 - max(0, (t - .72) / .28) ** 2.2) ** .5
            if abs(v) <= hw: sp.put(px, py, key)
    if vein:
        for r in range(1, int(L * .9)): sp.put(x + s * r, y - c * r, "rib")
        for i in range(2, int(L * .8), 3):
            for side in (-1, 1):
                if w > 2: sp.put(x + s * i + c * side * min(w * .5, 2), y - c * i + s * side * min(w * .5, 2), "leaflo")

def pom(sp, x, y, r, n=14, L=None, key="leaf", seed=0):
    # a soft tuft of needles: a small body and short needles spiking out all round (mostly up and out), the lower ones shaded
    L = L or r * 1.1; sp.fill(x, y, r * .8, r * .62, key)
    for i in range(n):
        a = -math.pi + (i + .5) / n * math.pi * 2 + seed; ex, ey = x + math.cos(a) * (r * .6 + L * .5), y + math.sin(a) * (r * .5 + L * .35)
        sp.line(x + math.cos(a) * r * .4, y + math.sin(a) * r * .3, ex, ey, key if math.sin(a) < .3 else "leaflo", 0)

def limb(sp, x0, y0, x1, y1, r0, r1):   # a straight limb from the trunk, tapering
    stem(sp, [(x0, y0), (x1, y1)], r0, r1)

def cone(sp, x, y, w=2.0, h=3.2, key="seed"):   # a small hanging cone: an oval, lit top left, shaded base
    sp.fill(x, y, w, h, key); sp.put(x - 1, y - 1, key + "hi"); sp.put(x, y + int(h), key + "lo"); sp.put(x + 1, y + 1, key + "lo")

# ---- Permian ----
def gangamopteris():   # small: a low tuft of broad tongue-shaped blades with no midrib but net veins, fanned from the ground
    sp = Sprite(44, 38, (88, 126, 66)); bx, by = 22, 36
    for a, L, w, dx in ((-1.3, 13, 3.4, -6), (1.3, 13, 3.4, 6), (-.85, 18, 4, -3), (.85, 18, 4, 3), (-.4, 22, 4.2, -1), (.4, 21, 4.2, 1), (0, 16, 3.6, 0)):
        sp.line(bx + dx, by - 1, bx + dx + math.sin(a) * 4, by - 1 - math.cos(a) * 4, "stem", 0)
        tongue(sp, bx + dx + math.sin(a) * 4, by - 1 - math.cos(a) * 4, a, L - 3, w)
    base(sp, bx, by, 6)
    return sp

def noeggerathiopsis():   # medium: a short woody trunk under a spiral rosette of long strap leaves with parallel veins, arching over
    sp = Sprite(64, 54, (66, 114, 76)); wood(sp, (100, 74, 52)); bx, by = 32, 52
    for tx, ty, lean in ((-12, 20, -3), (11, 15, 3)):
        stem(sp, [(bx + tx * .5, by + 1), (bx + tx * .8 + lean * .4, by - ty * .5), (bx + tx + lean, by - ty)], 2.6, 1.9)
        cx, cy = bx + tx + lean, by - ty
        for k in range(9):
            a = -1.45 + k * .36; L = 22 - abs(k - 4) * 1.5; ex, ey = cx + math.sin(a) * L, cy - math.cos(a) * L * .75 + (abs(a) ** 1.6) * 5
            blade(sp, cx, cy, ex, ey, 1.5, bowx=math.sin(a) * -2, bowy=-L * .2)
    scars(sp, bx - 12, by - 3, by - 18, 2) if False else None
    base(sp, bx, by, 8)
    return sp

def glossopteris():   # large: a tree whose branches end in tufts of tongue-shaped leaves with a midrib, set in a rounded crown
    sp = Sprite(72, 92, (56, 104, 66)); wood(sp, (104, 78, 56)); bx, by = 36, 90; rnd = random.Random(21)
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx - 1, by - 42)], 4.2, 2.4); base(sp, bx, by, 9)
    scars(sp, bx, by - 3, by - 38, 3, 5)
    tufts = ((-22, 48, -2.6), (22, 50, 2.6), (-13, 62, -1.2), (14, 66, 1.3), (0, 78, 0), (-24, 66, -2.1), (25, 68, 2.0), (-3, 56, .2))
    for dx, h, lean in tufts:   # limbs fork from the trunk to a tuft each
        y0 = by - (22 + (h - 40) * .4); limb(sp, bx, y0 + 2, bx + dx, by - h + 5, 2.0, 1.0)
    for dx, h, lean in sorted(tufts, key=lambda t: t[1]):   # a whorl of tongues round each tip: upper ones upright, lower ones flopping out
        tx, ty = bx + dx, by - h
        for k, a in enumerate((-1.55, -.8, 0, .8, 1.55)):
            tongue(sp, tx, ty + 3, a + lean * .06, 12 + (3 if abs(a) < .6 else 0), 2.9)
    return sp

# ---- Jurassic ----
def phoenicopsis():   # small: two short shoots, each topped by a broom of long, hair-thin linear leaves
    sp = Sprite(44, 38, (104, 142, 74)); wood(sp, (112, 84, 54)); bx, by = 22, 36
    for tx, h, n in ((-9, 13, 10), (9, 11, 11), (0, 17, 13)):
        sx, sy = bx + tx, by - h; stem(sp, [(bx + tx * .5, by), (sx, sy)], 1.5, 1.1)
        for k in range(n):
            a = -1.5 + 3.0 * k / (n - 1); L = 19 - abs(a) * 4.5; blade(sp, sx, sy, sx + math.sin(a) * L, sy - math.cos(a) * L * .8 + abs(a) ** 2 * 3, .7, bowx=math.sin(a) * -1, bowy=-3)
    base(sp, bx, by, 6)
    return sp

def pityophyllum():   # medium: a small conifer, a thin trunk and whorled branches ending in tufts of long needles, brown cones hanging
    sp = Sprite(64, 54, (46, 98, 72)); wood(sp, (92, 62, 44)); ramp(sp, "seed", (150, 92, 52)); bx, by = 32, 52
    stem(sp, [(bx, by + 1), (bx, by - 16), (bx, by - 36)], 2.6, 1.0); base(sp, bx, by, 5)
    for lx, h in ((-17, 14), (17, 16), (-13, 24), (13, 26), (-8, 33), (8, 34), (0, 42)):
        y = by - h * .75; limb(sp, bx, y, bx + lx * .9, by - h, 1.5, .8); pom(sp, bx + lx, by - h, 5.8, 15, 7)
    for dx, dy in ((-15, 11), (17, 13), (-9, 21), (8, 30)): cone(sp, bx + dx, by - dy, 1.6, 2.6)
    return sp

def elatides():   # large: a broad dense cone of a conifer, drooping tiers thick with scale-leaf shoots, ovoid cones, light blue-green
    sp = Sprite(72, 92, (82, 134, 98)); wood(sp, (96, 68, 50)); ramp(sp, "seed", (150, 98, 56)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 74)], 3.6, .9); base(sp, bx, by, 7)
    for h in range(12, 80, 7):   # a drooping skirt every 7 px, widest at the bottom: a solid mass with its rim hung with scale shoots
        r = (6 + 27 * (1 - h / 86) ** .9) * (1 + .07 * ((h // 7) % 3 - 1))
        sp.fill(bx, by - h, r, 4.6, "leaf")
        for x in range(int(bx - r), int(bx + r) + 1, 1):
            if sp.get(x, int(by - h + 3)) == "leaf" and (x // 2) % 2 == 0: sp.put(x, by - h + 3, "leaflo")
            if sp.get(x, int(by - h - 3)) == "leaf" and (x // 3) % 2 == 0: sp.put(x, by - h - 3, "leafhi")
        for x in range(int(bx - r) + 1, int(bx + r), 4): scale_shoot(sp, x, by - h + 2, x + (1 if x > bx else -1), by - h + 9 + (x % 3), 1.2)
    for k in range(5): scale_shoot(sp, bx, by - 72, bx + (k - 2) * 1.2, by - 88 + abs(k - 2), 1.1)
    for dx, h in ((-11, 28), (13, 36), (-6, 48), (7, 54), (-16, 17), (17, 22), (0, 40)): cone(sp, bx + dx, by - h + 2, 1.9, 3.0)
    return sp

# ---- Cretaceous ----

def birisia():   # small: an umbrella fern: three tall stalks, each ending in a hand of long scalloped fingers
    sp = Sprite(44, 38, (80, 134, 70)); wood(sp, (96, 78, 52)); bx, by = 22, 36
    for tx, h in ((-10, 17), (0, 22), (10, 18)):
        sx, sy = bx + tx, by - h; sp.line(bx + tx * .3, by, sx, sy, "stem", 1)
        for a in (-1.0, -.35, .35, 1.0):
            L = 13 - abs(a) * 2; ex, ey = sx + math.sin(a) * L, sy - math.cos(a) * L * .9 + abs(a) * 2
            frond(sp, (sx, sy), ((sx + ex) / 2, (sy + ey) / 2 - 2), (ex, ey), 1.9, 6, .25, groove=False)
    base(sp, bx, by, 6)
    return sp

def heilungia():   # medium: a short scaly trunk with a crown of stiff pinnate leaves, cycad-like, the older ones drooping
    sp = Sprite(64, 54, (58, 108, 80)); wood(sp, (108, 84, 62)); ramp(sp, "seed", (176, 110, 40)); bx, by = 32, 52
    stem(sp, [(bx, by + 1), (bx, by - 9), (bx, by - 16)], 5.0, 4.2); base(sp, bx, by, 8); scars(sp, bx, by - 2, by - 16, 4, 3)
    for k in range(7):
        a = -1.4 + k * .467; L = 27 - abs(a) * 2; ex, ey = bx + math.sin(a) * L, by - 17 - math.cos(a) * L * .7 + abs(a) ** 2 * 7
        pinnate(sp, (bx, by - 16), ((bx + ex) / 2, by - 17 - L * .6 + abs(a) * 3), (ex, ey), 7, 4.6, .8, ang=1.1)
    sp.fill(bx, by - 18, 3.2, 2.6, "seed"); sp.put(bx - 1, by - 19, "seedhi"); sp.put(bx + 1, by - 17, "seedlo")   # the cone in the crown
    return sp

def parataxodium():   # large: a bald-cypress-like conifer, a fluted trunk, a rounded open crown of drooping feathery sprays, small round cones
    sp = Sprite(72, 92, (112, 146, 72)); wood(sp, (118, 88, 62)); ramp(sp, "seed", (140, 100, 58)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 24), (bx, by - 50)], 5.0, 2.2)
    for x in range(bx - 10, bx + 11): sp.put(x, by + 1, "stem"); sp.put(x, by, "stem")
    for x in range(bx - 7, bx + 8): sp.put(x, by - 1, "stem")
    for y in range(by - 3, by - 24, -4): sp.put(bx - 2, y, "stemlo"); sp.put(bx + 2, y + 1, "stemlo")
    limbs = ((-24, 56, 40), (24, 58, 42), (-16, 68, 48), (17, 70, 50), (-30, 46, 38), (30, 48, 40), (0, 80, 52), (-8, 74, 52), (9, 76, 54))
    for dx, h, y0 in limbs: limb(sp, bx, by - y0, bx + dx, by - h + 5, 1.8, .9)
    for dx, h, y0 in sorted(limbs, key=lambda l: l[1]):   # a thin feathery tuft at each tip: short side twigs hung with fine needles
        tx, ty = bx + dx, by - h
        sp.fill(tx, ty + 3, 3.4, 1.6, "leaf")
        for side in (-1, 1):
            for t, L in ((.2, 9), (.55, 10), (.9, 8)):
                x, y = tx + side * 11 * t, ty + 3 + t * 2
                sp.line(x, y, x + side * L * .35, y + 3, "leaf", 0)
                for q in (0, 1): blade(sp, x + side * (1 + q * 2), y + 1, x + side * (2 + q * 3), y + L, .8, bowx=side)
        for q in (-2, 0, 2): blade(sp, tx + q, ty + 3, tx + q * 1.5, ty + 12, .8)
    for dx, h in ((-18, 52), (20, 58), (-5, 68), (9, 62), (-26, 44)): sp.fill(bx + dx, by - h, 1.5, 1.5, "seed"); sp.put(bx + dx - 1, by - h - 1, "seedhi"); sp.put(bx + dx + 1, by - h + 1, "seedlo")
    return sp

# ---- Paleogene ----
def osmunda():   # small: royal fern, a vase of tall bipinnate fronds, a rust-brown spore panicle tufted in the middle
    sp = Sprite(44, 38, (96, 148, 72)); ramp(sp, "spore", (170, 98, 48)); wood(sp, (104, 78, 52)); bx, by = 22, 36
    for tx, ty, b in ((-17, 21, -1), (17, 21, 1), (-9, 29, -1), (9, 29, 1), (0, 33, 0)):
        base_ = (bx + tx * .1, by - 1); tip = (bx + tx, by - 1 - ty)
        frond(sp, base_, ((base_[0] + tip[0]) / 2 + b * 4, (base_[1] + tip[1]) / 2 - 6), tip, 4.6, 6, .1, groove=True)
    for dx, h in ((-1, 31), (2, 28)):   # the fertile fronds: a bare stalk ending in a tassel of spore cases
        sp.line(bx + dx, by - 2, bx + dx, by - h + 3, "stem", 0)
        for k in range(6): sp.fill(bx + dx + (k % 3 - 1) * 1.1, by - h + 1 - k * .9, 1.4, 1.2, "spore")
    base(sp, bx, by, 5)
    return sp

def betula():   # medium: birch, slender white trunks with black marks up into an airy crown of small yellow-green leaves and hanging catkins
    sp = Sprite(64, 54, (116, 158, 62)); ramp(sp, "mark", (44, 42, 42)); ramp(sp, "cat", (186, 166, 96)); wood(sp, (232, 230, 218)); bx, by = 32, 52; rnd = random.Random(31)
    trunks = (((bx - 6, by + 1), (bx - 8, by - 16), (bx - 10, by - 34)), ((bx + 4, by + 1), (bx + 5, by - 18), (bx + 8, by - 37)), ((bx - 1, by + 1), (bx - 1, by - 15), (bx - 2, by - 30)))
    for pts in trunks:
        stem(sp, pts, 1.5, .9)
        for y in range(by - 5, int(pts[-1][1]), -5):
            x = pts[0][0] + (pts[-1][0] - pts[0][0]) * (by - y) / (by - pts[-1][1]); sp.put(x - 1, y, "mark"); sp.put(x, y, "mark") if y % 10 == 0 else None
    for dx, h in ((-14, 31), (13, 33), (-4, 42), (6, 44), (-1, 36)): stem(sp, [(bx + dx * .3, by - 20), (bx + dx, by - h)], .8, .5)
    for cx, cy, rx, ry in ((-14, 36, 8, 5), (14, 38, 8, 5), (-4, 45, 9, 5), (7, 46, 8, 5), (-1, 39, 8, 5), (-20, 30, 5, 4), (20, 31, 5, 4), (-9, 32, 6, 4), (10, 33, 6, 4), (-6, 26, 5, 3), (4, 28, 5, 3)):
        clump(sp, bx + cx, by - cy, rx, ry)
        for k in range(5): sp.put(bx + cx + rnd.randint(-rx, rx), by - cy - rnd.randint(0, ry), "leafhi")
    for dx, dy in ((-16, 30), (-3, 39), (12, 31), (20, 28), (3, 40)):
        sp.line(bx + dx, by - dy, bx + dx, by - dy + 5, "cat", 0); sp.put(bx + dx, by - dy + 5, "cathi")
    base(sp, bx, by, 8)
    return sp

def larix():   # large: a larch, a straight trunk, a loose cone of whorled branches hung with soft tufts of fresh green needles, small cones
    sp = Sprite(72, 92, (126, 168, 78)); wood(sp, (112, 84, 64)); ramp(sp, "seed", (150, 98, 60)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 80)], 3.4, .8); base(sp, bx, by, 6); scars(sp, bx, by - 3, by - 28, 2, 5)
    for h in range(80, 9, -7):
        r = 4 + 23 * (1 - h / 92) ** .95
        for side in (-1, 1):
            r_ = r * (.85 + .15 * ((h // 7 + (side > 0)) % 2)); sp.line(bx, by - h + 1, bx + side * r_, by - h + 6, "stem", 0)
            for t in (.45, .75, 1.0): pom(sp, bx + side * r_ * t, by - h + 1 + 5 * t + 1, 3.6 + 1.6 * t, 12, 4.6, seed=h * .13 + side)
    pom(sp, bx, by - 84, 3.2, 10, 4.6)
    for dx, h in ((-8, 22), (9, 30), (-4, 44), (5, 52), (-13, 16), (14, 20)): cone(sp, bx + dx, by - h + 4, 1.3, 1.9)
    return sp

# ---- Neogene ----
def vaccinium():   # small: a blueberry bush, wiry red-brown stems with two rows of small oval leaves, some turned red, and blue berries
    sp = Sprite(44, 38, (72, 112, 70)); ramp(sp, "red", (184, 66, 52)); ramp(sp, "blue", (76, 90, 156)); wood(sp, (140, 74, 60)); bx, by = 22, 36; rnd = random.Random(5)
    spots = []
    for tx, tips in ((-12, ((-16, 24), (-10, 30))), (-2, ((-3, 31), (3, 26))), (9, ((6, 32), (16, 26)))):
        for tipx, h in tips:
            pts = [(bx + tx * .4, by), (bx + (tx + tipx) / 2 + (2 if h % 2 else -2), by - h * .55), (bx + tipx, by - h)]
            stem(sp, pts, .9, .5)
            for i, (px, py) in enumerate(pts[1:] + [(pts[-1][0], pts[-1][1] + 6)]):
                for side in (-1, 1): spots.append((px + side * 2.2, py + (side + 1) * 1.2 + i))
    for x, y in spots:
        oval(sp, x, y, rnd.choice((-1.2, -.7, .7, 1.2, 0)), 4.4, 1.7, "red" if rnd.random() < .1 else "leaf")
    for x, y in spots[::3]:   # berries in pairs: dark blue with a pale bloom on the lit side
        bxp, byp = int(x), int(y + 3); sp.put(bxp, byp, "blue"); sp.put(bxp + 1, byp, "blue"); sp.put(bxp, byp + 1, "blue"); sp.put(bxp + 1, byp + 1, "blue"); sp.put(bxp, byp, "bluehi"); sp.put(bxp + 1, byp + 1, "bluelo")
    base(sp, bx, by, 6)
    return sp

def alnus():   # medium: an alder, a few grey stems under a rounded crown of dark toothed leaves with dangling purple catkins and small woody cones
    sp = Sprite(64, 52, (54, 96, 60)); ramp(sp, "cat", (126, 78, 70)); ramp(sp, "seed", (92, 62, 44)); wood(sp, (112, 100, 92)); bx, by = 32, 50; rnd = random.Random(13)
    for tx, tl, h in ((-10, -3, 24), (0, 0, 27), (10, 3, 23)):
        stem(sp, [(bx + tx * .5, by + 1), (bx + tx * .8, by - h * .5), (bx + tx + tl, by - h)], 1.7, 1.1)
    crown(sp, bx, by, ((-18, 28, 9, 6), (18, 28, 9, 6), (-8, 34, 11, 7), (9, 34, 11, 7), (0, 29, 11, 7), (-23, 21, 6, 5), (23, 21, 6, 5), (0, 40, 8, 5), (-12, 21, 7, 5), (13, 21, 7, 5)), shape=lobed)
    for x, y in ((-20, 31), (-10, 38), (2, 42), (13, 38), (21, 30), (-4, 33), (8, 31)):
        sp.fill(bx + x, by - y, 1.6, 1.0, "leafhi")
    for dx, dy in ((-18, 22), (-7, 26), (5, 25), (16, 23), (-24, 20), (23, 19)):   # catkins hang in threes, and a cone beside each
        for k in (-1, 0, 1): sp.line(bx + dx + k * 1.6, by - dy, bx + dx + k * 1.6, by - dy + 5 + (k == 0) * 2, "cat", 0)
        sp.fill(bx + dx + 3, by - dy + 1, 1, 1.5, "seed")
    base(sp, bx, by, 8)
    return sp

def picea():   # large: a spruce, a tall narrow dark cone, whorled drooping branches layered tier on tier, hanging cones
    sp = Sprite(72, 92, (32, 78, 68)); sp.C["rib"] = mix((32, 78, 68), (150, 200, 160), .3); wood(sp, (84, 60, 46)); ramp(sp, "seed", (128, 84, 60)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 30), (bx, by - 76)], 3.0, .8); base(sp, bx, by, 6)
    for h in range(14, 84, 5):
        r = 3 + 20 * (1 - h / 92) ** .8
        for side in (-1, 1):
            for k, (f, dy, w) in enumerate(((1, 8, 2.6), (.68, 5, 2.4), (.4, 3, 2.0))):
                lens(sp, bx, by - h + 1, bx + side * r * f, by - h + dy + 1 + (h // 5 + k) % 2, w, teeth=False)
    for k in range(5): lens(sp, bx, by - 70, bx + (k - 2) * 1.2, by - 88 + abs(k - 2), 1.1, teeth=False)
    for x, h, s in ((-12, 24, 1), (13, 30, -1), (-8, 42, 1), (9, 48, -1), (-17, 14, 1), (18, 20, -1), (-4, 62, 1)): cone(sp, bx + x, by - h + 8, 1.5, 3.0)
    return sp

# ---- Quaternary ----
def cladonia():   # small: reindeer lichen, a pale grey-green mound of crowded coral-like puffs, a few red-capped stalks
    sp = Sprite(44, 30, (184, 196, 164)); ramp(sp, "red", (196, 58, 48)); bx, by = 22, 28; rnd = random.Random(2)
    pts = []
    for i in range(70):   # puffs scattered over a low dome, big ones low and wide, small ones on top
        a = rnd.uniform(math.pi, 2 * math.pi); r = math.sqrt(rnd.random()) ** .6
        pts.append((bx + math.cos(a) * r * 17, by - 2 + math.sin(a) * r * 14))
    for x, y in sorted(pts, key=lambda p: p[1]): sp.fill(x, y, 3.4 - (by - y) * .05, 2.9 - (by - y) * .05, "leaf")
    for x in range(0, 44):   # solid down to the ground
        top = next((y for y in range(0, by) if sp.get(x, y) == "leaf"), None)
        for y in range(top, by) if top is not None else (): sp.put(x, y, "leaf")
        if top is not None and top > 2:   # a ragged, crowded top: small puffs standing out of the dome
            for k in range(1, 1 + rnd.randint(0, 2)): sp.put(x, top - k, "leaf") if rnd.random() < .6 else None
    for y in range(2, by):   # a regular dapple of shaded and lit dashes, the coral texture
        for x in range(0, 44):
            if sp.get(x, y) == "leaf":
                if (x * 3 + y * 5) % 7 == 0: sp.put(x, y, "leaflo")
                elif (x + y * 2) % 11 == 0 and y < 22: sp.put(x, y, "leafhi")
    for dx, h in ((-9, 19), (2, 22), (11, 18)): sp.line(bx + dx, by - 12, bx + dx, by - h, "leaf", 0); sp.fill(bx + dx, by - h - 1, 1.5, 1.3, "red"); sp.put(bx + dx - 1, by - h - 2, "redhi")
    base(sp, bx, by, 14)
    return sp

def ledum():   # medium: marsh rosemary, a sprawling mound of narrow leaves with rust-brown undersides and clusters of pink-white bells
    sp = Sprite(64, 46, (66, 102, 64)); ramp(sp, "rust", (160, 98, 52)); ramp(sp, "pink", (238, 198, 206)); wood(sp, (132, 92, 66)); bx, by = 32, 44; rnd = random.Random(17)
    sp.fill(bx, by - 9, 21, 9, "leaf")
    for y in range(by - 12, by - 1):
        for x in range(bx - 22, bx + 23):
            if sp.get(x, y) == "leaf" and (x + y // 2) % 3 == 0 and y > by - 8: sp.put(x, y, "leaflo")
    for i in range(46):
        a = -1.55 + i / 45 * 3.1 + rnd.uniform(-.05, .05); L = 11 + 7 * math.cos(a * .9) + rnd.uniform(0, 3); x0 = bx + math.sin(a) * 4; y0 = by - 2
        ex, ey = bx + math.sin(a) * L * 1.45, by - 4 - math.cos(a) * L * .55 + abs(a) ** 2 * 1.6
        lens(sp, x0, y0, ex, ey, 1.2, teeth=False)
        if abs(a) > .5 and i % 2 == 0: sp.put((x0 + ex) / 2, (y0 + ey) / 2 + 1, "rust"); sp.put((x0 + ex) / 2 + 1, (y0 + ey) / 2 + 1, "rust")
    for fx, h in ((-18, 18), (-8, 26), (3, 29), (13, 24), (22, 16)):   # an umbel of pink bells on thin red stalks above the mound
        sp.line(bx + fx * .7, by - 12, bx + fx, by - h - 5, "stem", 0)
        for k in range(7):
            a = -2.4 + k * .8; ex, ey = bx + fx + math.cos(a) * 4.2, by - h - 6 + math.sin(a) * 3.0; sp.line(bx + fx, by - h - 5, ex, ey, "stem", 0)
            sp.put(ex, ey + 1, "pink"); sp.put(ex + 1, ey + 1, "pink"); sp.put(ex, ey, "pink"); sp.put(ex, ey, "pinkhi"); sp.put(ex + 1, ey + 2, "pinklo")
    base(sp, bx, by, 13)
    return sp

def pinus():   # large: a pine, a tall reddish trunk bare below, an irregular crown of flat pads of long needles on level limbs, hanging cones
    sp = Sprite(72, 92, (48, 100, 72)); wood(sp, (142, 86, 60)); ramp(sp, "seed", (140, 94, 60)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx + 1, by - 26), (bx, by - 52), (bx + 1, by - 78)], 3.3, 1.0)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    for y in range(by - 3, by - 50, -3): sp.put(bx - 1 + (y // 3) % 3, y, "stemlo"); sp.put(bx + 2 - (y // 3) % 2, y - 1, "stemhi")   # plated bark
    limbs = ((-24, 56, 40), (25, 62, 46), (-17, 69, 54), (17, 76, 62), (-8, 82, 68), (6, 85, 74), (-27, 46, 36), (28, 50, 40))
    for dx, h, y0 in limbs: limb(sp, bx + 1, by - y0, bx + dx, by - h + 3, 1.7, .9)
    for dx, h, y0 in sorted(limbs, key=lambda l: l[1]): pom(sp, bx + dx, by - h, 8.5 if abs(dx) > 10 else 6.6, 24, 7.2, seed=dx * .07)
    for dx, h in ((-22, 50), (24, 56), (-14, 63), (14, 70)): cone(sp, bx + dx, by - h + 9, 1.5, 2.8)
    return sp

# ---- Park Plants ----
def q_black_spruce():   # Park Plant: a slender black spruce, a long bare trunk with sparse drooping branches under a dense, dark, club-shaped top thick with cones
    sp = Sprite(56, 92, (28, 64, 54)); sp.C["rib"] = mix((28, 64, 54), (150, 200, 160), .3); wood(sp, (84, 62, 48)); ramp(sp, "seed", (120, 70, 74)); bx, by = 28, 90; rnd = random.Random(23)
    stem(sp, [(bx, by + 1), (bx, by - 40), (bx, by - 80)], 2.8, .8); base(sp, bx, by, 5)
    for h in range(14, 52, 8):   # sparse short branches low down, drooping
        for side in (-1, 1):
            if rnd.random() < .75: lens(sp, bx, by - h, bx + side * (5 + rnd.randint(0, 4)), by - h + 6, 1.5, teeth=False)
    for h in range(46, 86, 4):   # the dense top: close tiers, narrow
        r = 2 + 13 * min(1, (92 - h) / 46) ** .7 * (1 if h < 74 else (86 - h) / 12 + .0)
        for side in (-1, 1):
            for f, dy, w in ((1, 6, 2.5), (.62, 4, 2.2)): lens(sp, bx, by - h + 1, bx + side * r * f, by - h + dy + 1 + (h // 4) % 2, w, teeth=False)
    for k in range(5): lens(sp, bx, by - 78, bx + (k - 2) * 1.2, by - 90 + abs(k - 2), 1.1, teeth=False)
    for dx, h in ((-5, 66), (6, 72), (-2, 76), (4, 60), (-7, 58), (0, 68)): cone(sp, bx + dx, by - h + 5, 1.3, 2.0)
    return sp

def q_quaking_aspen():   # Park Plant: a quaking aspen, a smooth white trunk with black scars, a tall oval crown of round, shimmering leaves, green and golden
    sp = Sprite(64, 92, (156, 194, 90)); ramp(sp, "gold", (232, 212, 90)); ramp(sp, "bark", (226, 224, 212)); bx, by = 32, 90; rnd = random.Random(29)
    wood(sp, (226, 224, 212))
    stem(sp, [(bx, by + 1), (bx, by - 24), (bx - 1, by - 46)], 3.1, 1.9)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stemlo")
    for y in range(by - 3, by - 44, -5): sp.put(bx - 2 + (y // 5) % 2, y, "stemlo"); sp.put(bx - 1 + (y // 5) % 2, y, "stemlo"); sp.put(bx + 1, y - 2, "stemlo")   # the dark scars
    for dx, h, y0 in ((-15, 66, 38), (15, 70, 40), (-6, 80, 44), (7, 82, 46), (-20, 56, 34), (21, 58, 36)): stem(sp, [(bx - 1, by - y0), (bx + dx * .6, by - (y0 + h) / 2), (bx + dx, by - h + 3)], 1.4, .8)
    cl = []
    for i in range(150):
        a = rnd.random() * 6.283; r = math.sqrt(rnd.random()); x = bx + math.cos(a) * r * 22; y = by - 61 + math.sin(a) * r * 24
        if y < by - 36: cl.append((x, y))
    for x, y in sorted(cl, key=lambda c: c[1]):
        gold = ((x - bx) / 24 + (y - (by - 62)) / 26) < rnd.uniform(-.2, .4) and rnd.random() < .85
        c = "gold" if gold else "leaf"
        sp.fill(x, y, 2.3, 2.1, c)
        sp.put(x - 1, y - 1, c + "hi"); sp.put(x + 1, y + 2, c + "lo")
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("per-boreal-small", gangamopteris), ("per-boreal-medium", noeggerathiopsis), ("per-boreal-large", glossopteris),
                ("jur-boreal-small", phoenicopsis), ("jur-boreal-medium", pityophyllum), ("jur-boreal-large", elatides),
                ("cre-boreal-small", birisia), ("cre-boreal-medium", heilungia), ("cre-boreal-large", parataxodium),
                ("pal-boreal-small", osmunda), ("pal-boreal-medium", betula), ("pal-boreal-large", larix),
                ("neo-boreal-small", vaccinium), ("neo-boreal-medium", alnus), ("neo-boreal-large", picea),
                ("qua-boreal-small", cladonia), ("qua-boreal-medium", ledum), ("qua-boreal-large", pinus),
                ("q-black-spruce", q_black_spruce), ("q-quaking-aspen", q_quaking_aspen)):
    fn().save(f"{out}/{key}.png")
