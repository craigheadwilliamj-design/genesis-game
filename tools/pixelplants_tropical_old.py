# Draws the tropical landscape plants of the Devonian, Carboniferous and Permian in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_temperate_old.py,
# because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges. Vivid jungle greens, to stand out from the near-black tropical floor.
#   dev-  Cooksonia (a tuft of bare forked stems capped with tiny cup sporangia), Asteroxylon (bottlebrush stems bristling with short spiral leaves, rising from a creeping rhizome), Wattieza (the first tree: a slender trunk on a swollen base under a crown of finely forked bare branches)
#   car-  Sphenophyllum (a slender zigzag stem with whorls of wedge-shaped leaves at each node), Calamites (giant ribbed horsetail stems, node rings, whorls of narrow leaves, a cone), Lepidodendron (a scaly diamond-scarred trunk forking into a crown of strap-leaf tufts, on spreading roots)
#   per-  Taeniopteris (a rosette of simple strap leaves with a midrib and fine parallel veins), Gigantopteris (large netted-vein lobed leaves on a climbing stem), Psaronius (a tree fern on a fat root-mantle trunk under big pinnate fronds)
# Usage: python3 -I tools/pixelplants_tropical_old.py [outdir]

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

def cooksonia():   # small: a tuft of bare forked stems, each tip capped with a tiny amber cup sporangium
    sp = Sprite(44, 38, vivid(0)); bx, by = 22, 36
    for x in range(bx - 11, bx + 12): sp.put(x, by + 1, "leaflo") if x % 2 else None
    for dx, ang, L, d in ((-11, -.6, 13, 2), (-5, -.25, 17, 2), (1, .05, 19, 2), (7, .3, 17, 2), (12, .65, 13, 2), (-8, -.4, 8, 1), (9, .45, 8, 1)):
        fork(sp, bx + dx, by, ang, L * .5, d, spor=True, split=.5, shrink=.8)
    return sp

def cooksonia_caps(sp):   # capped after the forks are laid: re-run the same forks and put a cup at every tip
    return sp

def asteroxylon():   # medium: bottlebrush stems bristling with short spiral leaves, rising from a creeping rhizome
    sp = Sprite(64, 54, vivid(.35)); pale = tones((120, 150, 70)); bx, by = 32, 52
    sp.line(bx - 26, by, bx + 26, by - 1, "stem"); sp.line(bx - 26, by + 1, bx + 26, by, "stem")   # the creeping rhizome
    for x0, top, lean in ((-22, 22, -3), (-13, 10, -1), (-4, 3, 0), (6, 8, 2), (16, 14, 4), (24, 26, 5)):
        x = bx + x0; n = by - top
        for k in range(n):
            y = by - 1 - k; cx = x + lean * (k / n) ** 1.3
            sp.put(cx, y, "stem") if k < 6 else sp.put(cx, y, "leaf")
            if k > 2 and k % 2 == 0:
                s = -1 if (k // 2) % 2 else 1; ln = 3 if k < n * .7 else 2
                for i in range(1, ln + 1): sp.put(cx + s * i, y - (i // 2), "leaf")   # spiral leaves, alternating sides
        sp.fill(x + lean, by - n - 1, 1.2, 1.8, "seed")   # a sporangium at the tip
    return sp

def wattieza():   # large: the first tree, a slender trunk on a swollen base under a crown of finely forked, drooping bare branches
    sp = Sprite(64, 92, vivid(.9)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx, by - 50)], 5.2, 2.8)
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "stem")
    for k, y in enumerate(range(by - 6, by - 52, -5)): sp.put(bx - 1 - (k % 2), y, "stemlo"); sp.put(bx + 1 + (k % 2), y + 2, "stemlo")
    top = by - 50
    for ang, L in ((-1.5, 24), (-1.1, 28), (-.7, 30), (-.3, 28), (.3, 28), (.7, 30), (1.1, 28), (1.5, 24), (0, 22)):
        ex, ey = bx + math.sin(ang) * L, top - math.cos(ang) * L * .6 + (14 if abs(ang) > 1.2 else 8 if abs(ang) > .8 else 0)
        mx, my = bx + math.sin(ang) * L * .5, top - math.cos(ang) * L * .95
        sp.line(bx, top, mx, my, "leaf"); sp.line(mx, my, ex, ey, "leaf")
        for t in ((.7, .95) if abs(ang) < .5 else (.35, .55, .75, .95)):   # side twigs that fork again, drooping
            px, py = mx + (ex - mx) * t, my + (ey - my) * t
            for s_ in (-1, 1): sp.line(px, py, px + s_ * 5, py + 6, "leaf"); sp.line(px + s_ * 5, py + 6, px + s_ * 7, py + 11, "leaf"); sp.line(px + s_ * 5, py + 6, px + s_ * 2, py + 12, "leaf")
    return sp

def sphenophyllum():   # small: a slender zigzag stem with whorls of wedge-shaped leaves at each node
    sp = Sprite(44, 38, vivid(0)); bx, by = 22, 36
    pts = [(bx, by)] + [(bx + (3 if k % 2 else -3), by - 9 - k * 9) for k in range(3)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]): sp.line(x0, y0, x1, y1, "stem", 1)
    for (x, y) in pts[1:]:
        for a in (-1.35, -.55, .55, 1.35): wedge(sp, x, y, a, 9, 2.8)
    for a in (-.35, .35): wedge(sp, pts[-1][0], pts[-1][1], a, 8, 2.2)
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "leaflo") if x % 2 else None
    return sp

def calamites():   # medium: giant ribbed horsetail stems, node rings, long drooping whorls of narrow leaves, a cone
    sp = Sprite(64, 54, vivid(.4)); bx, by = 32, 52; ramp(sp, "cone", (178, 130, 40))
    for x0, top, lean, th in ((-15, 14, -4, 1.6), (-4, 2, 0, 2.2), (8, 8, 3, 1.8), (18, 20, 5, 1.4)):
        x = bx + x0; n = by - top
        for k in range(n):
            y = by - 1 - k; cx = x + lean * (k / n) ** 1.4
            for dx in range(-int(th), int(th) + 1): sp.put(cx + dx, y, "leaf")
            sp.put(cx - int(th) + 1, y, "rib") if k % 3 else None   # a rib line running up the stem
            if k % 8 == 7:
                for dx in range(-int(th) - 1, int(th) + 2): sp.put(cx + dx, y, "leaflo")   # node rings
                if k > n * .3:
                    for s_ in (-1, 1):
                        for a in (.2, .55): lens(sp, cx, y, cx + s_ * (6 + a * 8), y - 1 + a * 14, .7, teeth=False)   # whorls of long narrow leaves, drooping
        sp.fill(x + lean, by - n - 3, 1.4, 3.2, "cone"); sp.put(x + lean - 1, by - n - 5, "conehi")
    for x in range(bx - 20, bx + 24, 3): sp.put(x, by + 1, "leaflo")
    return sp

def lepidodendron():   # large: a scaly trunk marked with diamond leaf scars, forking twice into a crown of strap-leaf tufts, on spreading roots
    sp = Sprite(72, 92, vivid(.9)); bx, by = 36, 90
    for s_ in (-1, 1): stem(sp, [(bx + s_ * 4, by - 2), (bx + s_ * 11, by + 1), (bx + s_ * 17, by + 1)], 2.2, 1.2)   # stigmarian roots
    stem(sp, [(bx, by + 1), (bx, by - 26), (bx, by - 50)], 4.4, 3.0)
    for k, y in enumerate(range(by - 4, by - 50, -3)):   # a lattice of diamond leaf scars
        for dx in range(-3 + (k % 2), 4, 2): sp.put(bx + dx, y, "stemlo"); sp.put(bx + dx, y - 1, "stemhi") if k % 2 else None
    fx, fy = bx, by - 50; tips = []
    for ang, L in ((-.75, 15), (.75, 15)):
        mx, my = fx + math.sin(ang) * L, fy - math.cos(ang) * L; stem(sp, [(fx, fy), (mx, my)], 2.4, 1.8)
        for a2 in (-.55, .55):
            tx, ty = mx + math.sin(ang + a2) * 11, my - math.cos(ang + a2) * 11; stem(sp, [(mx, my), (tx, ty)], 1.5, 1.0)
            for a3 in (-.45, .45): ux, uy = tx + math.sin(ang + a2 + a3) * 7, ty - math.cos(ang + a2 + a3) * 7; sp.line(tx, ty, ux, uy, "stem"); tips.append((ux, uy))
    for tx, ty in sorted(tips, key=lambda t: t[1]):
        for a in (-1.5, -1.15, -.8, -.4, 0, .4, .8, 1.15, 1.5): blade(sp, tx, ty, tx + math.sin(a) * 13, ty - math.cos(a) * 7 + 5, 1.1, bowy=-2)   # a drooping tuft of strap leaves
    return sp

def taeniopteris():   # small: a rosette of simple strap leaves, each with a midrib and fine parallel veins
    sp = Sprite(44, 38, vivid(0)); bx, by = 22, 36
    for ang, L, w in ((-1.45, 15, 2.8), (1.45, 15, 2.8), (-.95, 22, 3.0), (.95, 22, 3.0), (-.45, 28, 3.2), (.45, 28, 3.2), (0, 26, 3.0)):
        ex, ey = bx + math.sin(ang) * L, by - 2 - math.cos(ang) * L * .9 + (4 if abs(ang) > 1.3 else 0)
        lens(sp, bx, by - 2, ex, ey, w, teeth=False)
        dx, dy = ex - bx, ey - by + 2; d = math.hypot(dx, dy) or 1
        for t in range(3, int(d) - 2, 2):   # lateral veins: short dashes either side of the midrib
            for s in (-1, 1):
                if sp.get(int(bx + dx * t / d - dy / d * s * 1.4 + .5), int(by - 2 + dy * t / d + dx / d * s * 1.4 + .5)) == "leaf": sp.put(bx + dx * t / d - dy / d * s * 1.4, by - 2 + dy * t / d + dx / d * s * 1.4, "leaflo")
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "leaflo") if x % 2 else None
    return sp

def netted(sp, cx, cy, rx, ry, notches=3):   # a big lobed leaf blade seen flat, netted with a lattice of vein dashes and cut by deep notches
    sp.fill(cx, cy, rx, ry, "leaf")
    for k in range(notches):
        a = -1.1 + k * 2.2 / max(1, notches - 1); nx, ny = cx + math.sin(a) * rx, cy - math.cos(a) * ry * .9
        for i in range(5): sp.put(nx - math.sin(a) * i * .9, ny + math.cos(a) * i * .9, None)
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if sp.get(x, y) == "leaf" and ((x + y) % 4 == 0 and (x - y) % 5 < 2): sp.put(x, y, "leaflo")   # the net
    sp.line(cx - rx + 1, cy, cx + rx - 1, cy, "rib")

def gigantopteris():   # medium: large netted-vein lobed leaves on a climbing stem
    sp = Sprite(64, 54, vivid(.4)); bx, by = 32, 52
    pts = [(bx, by + 1), (bx - 3, by - 12), (bx + 3, by - 24), (bx - 2, by - 36), (bx + 2, by - 46)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]): sp.line(x0, y0, x1, y1, "stem", 1)
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "stem")
    for (nx, ny), ang, L in ((pts[1], -1.15, 24), (pts[2], 1.1, 26), (pts[3], -.95, 22), (pts[4], .85, 20), (pts[4], -.2, 16), (pts[2], -1.5, 14)):
        ex, ey = nx + math.sin(ang) * L, ny - math.cos(ang) * L * .6 + 6
        frond(sp, (nx, ny), (nx + math.sin(ang) * L * .5, ny - math.cos(ang) * L * .7), (ex, ey), 5.4, 4, notch=.35, groove=False)
    for y in range(sp.h):
        for x in range(sp.w):
            if sp.get(x, y) == "leaf" and (x + y) % 4 == 0 and (x - y) % 5 < 2: sp.put(x, y, "leaflo")   # the net of veins
    return sp

def psaronius():   # large: a tree fern on a fat root-mantle trunk, widest at the base, under big pinnate fronds
    sp = Sprite(72, 92, vivid(.9)); ramp(sp, "fiber", (96, 66, 38)); sp.C.update(stem=sp.C["fiber"], stemhi=sp.C["fiberhi"], stemlo=sp.C["fiberlo"]); bx, by = 36, 90
    for y in range(by, by - 46, -1):   # the root mantle: broad at the foot, narrowing up
        w = 4.2 + 7.5 * max(0, 1 - (by - y) / 26.0)
        for dx in range(-int(w), int(w) + 1): sp.put(bx + dx, y, "stem")
    for k in range(-5, 6):   # aerial roots, dark lines running down the mantle
        for y in range(by - 2, by - 40, -1):
            if (y + k) % 5 and abs(k * 1.3) < 4.2 + 7.5 * max(0, 1 - (by - y) / 26.0): sp.put(bx + k * 1.3, y, "stemlo") if (k % 2 == 0) else None
    for y in range(by - 4, by - 44, -3): sp.put(bx - 3, y, "stemhi")
    top = by - 45
    for ang, L, wd in ((-1.5, 30, 3.8), (1.5, 30, 3.8), (-1.05, 32, 4.0), (1.05, 32, 4.0), (-.5, 28, 4.0), (.5, 28, 4.0), (-1.3, 26, 3.4), (1.3, 26, 3.4), (0, 18, 3.0)):
        ex, ey = bx + math.sin(ang) * L, top - math.cos(ang) * L * .6 + (14 if abs(ang) > 1.2 else 5 if abs(ang) > .8 else 0)
        frond(sp, (bx, top), (bx + math.sin(ang) * L * .5, top - math.cos(ang) * L * .85), (ex, ey), wd, 10, notch=.15)
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("dev-tropical-small", cooksonia), ("dev-tropical-medium", asteroxylon), ("dev-tropical-large", wattieza),
                ("car-tropical-small", sphenophyllum), ("car-tropical-medium", calamites), ("car-tropical-large", lepidodendron),
                ("per-tropical-small", taeniopteris), ("per-tropical-medium", gigantopteris), ("per-tropical-large", psaronius)):
    fn().save(f"{out}/{key}.png")
