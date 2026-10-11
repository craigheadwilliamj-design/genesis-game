# Draws the tropical landscape plants of the Triassic, Jurassic and Cretaceous in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_tropical_old.py and
# tools/pixelplants_tropical_park.py, because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges. Vivid jungle greens.
#   tri-  Neocalamites (slim reed-like stems with feathery whorls), Zamites (a short trunk under a crown of stiff pinnate cycad fronds), Araucarioxylon (a tall conifer, a straight trunk with tiers of drooping whorled branches)
#   jur-  Nilssonia (a low arching tuft of scalloped cycad leaves), Williamsonia (a slender trunk with a crown of fronds and goblet-shaped flowers), Cycadeoidea (a squat barrel trunk of leaf bases, a crown of fronds, cones nestled in the trunk)
#   cre-  Nilssoniopteris (a tuft of tall narrow upright strap leaves), Sabalites (a fan palm, fan leaves on a slim trunk), Sapindopsis (an early flowering tree, a broad crown with cream blossom)
# Usage: python3 -I tools/pixelplants_tropical_meso.py [outdir]
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



def neocalamites():   # small: slim reed-like jointed stems, each node with a feathery whorl of fine leaves
    sp = Sprite(44, 38, vivid(0)); bx, by = 22, 36
    for x in range(bx - 11, bx + 12): sp.put(x, by + 1, "leaflo") if x % 2 else None
    for x0, top, lean in ((-10, 18, -3), (-4, 6, -1), (2, 2, 1), (8, 10, 3), (13, 22, 4)):
        x = bx + x0; n = by - top
        for k in range(n):
            y = by - 1 - k; cx = x + lean * (k / n) ** 1.3; sp.put(cx, y, "leaf"); sp.put(cx + 1, y, "leaf") if k % 4 else None
            if k % 6 == 5 and k > 5:
                sp.put(cx - 1, y, "leaflo")
                for s_ in (-1, 1): lens(sp, cx, y, cx + s_ * 6, y - 1, .6, teeth=False); lens(sp, cx, y, cx + s_ * 4, y + 3, .6, teeth=False)
    return sp

def cycad_crown(sp, bx, top, spec, wd=3.2, pinnae=12, notch=.12):   # a crown of stiff pinnate fronds: spec is (angle, length) pairs, stiff upright or arching
    for ang, L in spec:
        ex, ey = bx + math.sin(ang) * L, top - math.cos(ang) * L * .6 + (8 if abs(ang) > 1.2 else 3 if abs(ang) > .8 else 0)
        frond(sp, (bx, top), (bx + math.sin(ang) * L * .5, top - math.cos(ang) * L * .8), (ex, ey), wd, pinnae, notch=notch)

def zamites():   # medium: a short thick trunk under a crown of stiff pinnate cycad fronds
    sp = Sprite(64, 54, vivid(.4)); ramp(sp, "fiber", (96, 66, 38)); sp.C.update(stem=sp.C["fiber"], stemhi=sp.C["fiberhi"], stemlo=sp.C["fiberlo"]); bx, by = 32, 52
    stem(sp, [(bx, by + 1), (bx, by - 8), (bx, by - 14)], 4.6, 4.0)
    for k, y in enumerate(range(by - 2, by - 14, -3)):
        for dx in range(-3 + (k % 2), 4, 2): sp.put(bx + dx, y, "stemlo")
    cycad_crown(sp, bx, by - 14, ((-1.5, 24), (1.5, 24), (-1.05, 28), (1.05, 28), (-.5, 28), (.5, 28), (0, 22), (-1.3, 20), (1.3, 20)), 3.0, 12, .1)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    return sp

def araucarioxylon():   # large: a tall conifer, a straight trunk with tiers of whorled branches hung with drooping scale-leaf shoots
    sp = Sprite(72, 92, vivid(.9)); bx, by = 36, 90
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "stem")
    stem(sp, [(bx, by + 1), (bx, by - 40), (bx, by - 80)], 4.2, 1.6)
    for k, y in enumerate(range(by - 4, by - 76, -4)): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y - 2, "stemlo")
    for ty, L in ((by - 30, 28), (by - 42, 24), (by - 53, 20), (by - 63, 16), (by - 72, 11), (by - 79, 6)):   # tiers, each a whorl seen from the side: branches out and a little down, hung with sprays
        for s_ in (-1, 1):
            ex, ey = bx + s_ * L, ty + 3 + L * .12; sp.line(bx, ty, ex, ey, "stem")
            for t in (.4, .65, .9):
                px, py = bx + (ex - bx) * t, ty + (ey - ty) * t; scale_shoot(sp, px, py, px + s_ * 2, py + 5, 1.3)
            scale_shoot(sp, ex, ey, ex + s_ * 3, ey + 4, 1.2)
        sp.fill(bx, ty - 1, 3, 2, "leaf")
    sp.fill(bx, by - 82, 2, 4, "leaf")
    return sp

def nilssonia():   # small: a low arching tuft of scalloped cycad leaves, the blade running continuously along the rachis
    sp = Sprite(44, 38, vivid(0)); bx, by = 22, 36
    for ang, L, wd in ((-1.45, 17, 3.0), (1.45, 17, 3.0), (-.95, 24, 3.4), (.95, 24, 3.4), (-.4, 28, 3.4), (.4, 28, 3.4), (0, 24, 3.2)):
        ex, ey = bx + math.sin(ang) * L, by - 3 - math.cos(ang) * L * .8 + (6 if abs(ang) > 1.3 else 0)
        frond(sp, (bx, by - 2), (bx + math.sin(ang) * L * .5, by - 3 - math.cos(ang) * L * .95), (ex, ey), wd, 6, notch=.5)
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "leaflo") if x % 2 else None
    return sp

def goblet(sp, x, y, r=3):   # a bennettitalean flower: a cup of petals on a short stalk
    ramp(sp, "cup", (222, 170, 60)); sp.line(x, y + 3, x, y + 7, "stem")
    for k in range(-r, r + 1): sp.put(x + k, y + 2 - (abs(k) > r - 1), "cup"); sp.put(x + k, y + 1 - (abs(k) > r - 2), "cup")
    sp.put(x - 1, y, "cuphi"); sp.put(x + 1, y, "cuphi"); sp.put(x, y - 1, "seed")

def williamsonia():   # medium: a slender trunk under a crown of stiff fronds, goblet-shaped flowers among them
    sp = Sprite(64, 54, vivid(.4)); ramp(sp, "fiber", (96, 66, 38)); sp.C.update(stem=sp.C["fiber"], stemhi=sp.C["fiberhi"], stemlo=sp.C["fiberlo"]); bx, by = 32, 52
    stem(sp, [(bx, by + 1), (bx - 1, by - 12), (bx, by - 22)], 3.2, 2.4)
    for k, y in enumerate(range(by - 3, by - 22, -3)): sp.put(bx - 1 + (k % 2) * 2, y, "stemlo")
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    cycad_crown(sp, bx, by - 22, ((-1.5, 22), (1.5, 22), (-1.0, 25), (1.0, 25), (-.45, 24), (.45, 24), (0, 17)), 2.6, 11, .12)
    for gx, gy in ((-6, 33), (7, 31), (1, 28)): goblet(sp, bx + gx, by - gy)
    return sp

def cycadeoidea():   # large: a squat barrel trunk armored in leaf bases, a crown of stiff fronds, cones nestled in the trunk
    sp = Sprite(72, 92, vivid(.9)); ramp(sp, "fiber", (104, 72, 40)); sp.C.update(stem=sp.C["fiber"], stemhi=sp.C["fiberhi"], stemlo=sp.C["fiberlo"]); ramp(sp, "cone", (180, 130, 44)); bx, by = 36, 90
    for y in range(by, by - 40, -1):   # a barrel, widest in the middle
        w = 11 - ((by - 20 - y) / 20.0) ** 2 * 4
        for dx in range(-int(w), int(w) + 1): sp.put(bx + dx, y, "stem")
    for k, y in enumerate(range(by - 2, by - 40, -3)):   # persistent leaf bases in a diamond lattice
        w = 11 - ((by - 20 - y) / 20.0) ** 2 * 4
        for dx in range(-int(w) + 1 + (k % 2), int(w), 3): sp.put(bx + dx, y, "stemlo"); sp.put(bx + dx, y - 1, "stemhi")
    for dx, y in ((-6, by - 22), (7, by - 14), (-2, by - 32)): sp.fill(bx + dx, y, 2.2, 2.8, "cone"); sp.put(bx + dx - 1, y - 2, "conehi")   # cones in the trunk
    cycad_crown(sp, bx, by - 40, ((-1.55, 28), (1.55, 28), (-1.2, 32), (1.2, 32), (-.8, 34), (.8, 34), (-.4, 32), (.4, 32), (0, 26)), 3.8, 13, .1)
    return sp

def nilssoniopteris():   # small: a tuft of tall narrow upright strap leaves with a midrib and fine veins, on a short stem
    sp = Sprite(44, 38, vivid(0)); bx, by = 22, 36
    for ang, L, w in ((-.9, 22, 2.0), (-.55, 29, 2.2), (-.2, 33, 2.4), (.15, 34, 2.4), (.5, 30, 2.2), (.85, 23, 2.0)):
        ex, ey = bx + math.sin(ang) * L, by - 3 - math.cos(ang) * L + 3
        lens(sp, bx, by - 2, ex, ey, w, teeth=False)
        dx, dy = ex - bx, ey - by + 2; d = math.hypot(dx, dy) or 1
        for t in range(4, int(d) - 2, 3):
            for s_ in (-1, 1):
                x = bx + dx * t / d - dy / d * s_ * 1.1; y = by - 2 + dy * t / d + dx / d * s_ * 1.1
                if sp.get(int(x + .5), int(y + .5)) == "leaf": sp.put(x, y, "leaflo")
    for x in range(bx - 5, bx + 6): sp.put(x, by + 1, "leaflo") if x % 2 else None
    return sp

def fanleaf(sp, x, y, ang, L, spread, n=6):   # a palm fan leaf: narrow rays from the stalk tip, drooping at the ends
    for i in range(n):
        a = ang - spread + 2 * spread * i / (n - 1); ex, ey = x + math.sin(a) * L, y - math.cos(a) * L * .75 + abs(a - ang) * 7
        blade(sp, x, y, ex, ey, 1.0, bowy=-3)

def sabalites():   # medium: a fan palm, a slim ringed trunk under a crown of fan leaves
    sp = Sprite(64, 54, vivid(.4)); ramp(sp, "fiber", (110, 76, 42)); sp.C.update(stem=sp.C["fiber"], stemhi=sp.C["fiberhi"], stemlo=sp.C["fiberlo"]); bx, by = 32, 52
    stem(sp, [(bx, by + 1), (bx + 1, by - 14), (bx, by - 26)], 3.0, 2.4)
    for y in range(by - 3, by - 26, -3): sp.put(bx - 1, y, "stemlo"); sp.put(bx + 1, y, "stemlo")   # leaf-scar rings
    for x in range(bx - 6, bx + 7): sp.put(x, by + 1, "stem")
    top = by - 26
    for ang, off in ((-1.05, -14), (1.05, 14), (0, 0)):
        px, py = bx + off * .6, top + abs(off) * .1 - 4; sp.line(bx, top, px, py, "stem"); fanleaf(sp, px, py, ang, 23, .62)
    return sp

def sapindopsis():   # large: an early flowering tree, a broad open crown of leaf clumps with cream blossom among them
    sp = Sprite(72, 92, vivid(.9)); ramp(sp, "bloom", (240, 230, 190)); bx, by = 36, 90
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx - 1, by - 36)], 4.6, 3.0)
    for x in range(bx - 9, bx + 10): sp.put(x, by + 1, "stem")
    for y in range(by - 4, by - 34, -3): sp.put(bx - 2, y, "stemlo"); sp.put(bx + 2, y + 1, "stemlo")
    for lx, ly in ((-22, 50), (-10, 58), (10, 58), (22, 50)): stem(sp, [(bx - 1, by - 34), (bx + lx * .5, by - ly + 12), (bx + lx, by - ly)], 2.2, 1.2)
    crown(sp, bx, by, ((-24, 46, 9, 6), (24, 46, 9, 6), (-14, 56, 11, 7), (14, 56, 11, 7), (0, 62, 12, 8), (-26, 56, 7, 5), (26, 56, 7, 5), (-7, 70, 10, 7), (8, 70, 10, 7), (0, 79, 9, 6)))
    for x in range(bx - 30, bx + 31, 4): sp.put(x, by - 40 + (abs(x - bx) // 7), "leaflo")
    for x, y in ((-20, 50), (-8, 60), (6, 56), (19, 52), (-1, 70), (12, 70), (-14, 66)): sp.put(bx + x, by - y, "bloom"); sp.put(bx + x + 1, by - y, "bloomhi"); sp.put(bx + x, by - y + 1, "bloomlo"); sp.put(bx + x - 1, by - y - 1, "bloom")
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("tri-tropical-small", neocalamites), ("tri-tropical-medium", zamites), ("tri-tropical-large", araucarioxylon),
                ("jur-tropical-small", nilssonia), ("jur-tropical-medium", williamsonia), ("jur-tropical-large", cycadeoidea),
                ("cre-tropical-small", nilssoniopteris), ("cre-tropical-medium", sabalites), ("cre-tropical-large", sapindopsis)):
    fn().save(f"{out}/{key}.png")
