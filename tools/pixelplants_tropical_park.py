# Draws the tropical Park Plants (Strangler Fig, Mahogany, Bamboo, Banana, Giant Tree Fern, Hibiscus) in the Dimetrodon's flat, simple style (helpers copied from tools/pixelplants_temperate.py and
# tools/pixelplants_desert_park.py, because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges.
# They are the pretty garden versions, with a touch of the PARK_PLANTS accent color, in vivid jungle greens that stand out from the near-black tropical floor. Sprites are sprites/plants/q-<name>.png.
#   q-strangler-fig    large: a lattice of woven aerial roots that has swallowed its host, buttressed at the base, under a wide dense dome, a few small red figs
#   q-mahogany         large: a tall straight trunk on buttress roots under a tight oval crown of glossy leaflets, brown seed capsules hanging
#   q-bamboo           medium: a clump of segmented culms (dark node rings, a lit left edge) arching a little, feathery leaf plumes at the tips
#   q-banana           medium: a pseudostem of stacked sheaths under big torn paddle leaves, a hanging purple bud and a bunch of green fruit
#   q-giant-tree-fern  medium: a thick fibrous dark trunk with leaf-scar rows, a crown of arching fronds and a curled fiddlehead
#   q-hibiscus         small: a glossy leafy shrub with big red five-petalled flowers and a long stamen
# Usage: python3 -I tools/pixelplants_tropical_park.py [outdir]
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
                if c is None or c.endswith(("hi", "lo")) or c + "hi" not in s.C: continue   # any color with a hi and lo ramp is shaded
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
def blade(sp, x0, y0, x1, y1, w, bowx=0, bowy=0):   # a long narrow leaf along a bent curve (grass, reed, strap), a lens in short runs with a rib
    c = ((x0 + x1) / 2 + bowx, (y0 + y1) / 2 + bowy); n = max(3, int(math.hypot(x1 - x0, y1 - y0) / 4))
    for i in range(n):
        a = bez((x0, y0), c, (x1, y1), i / n); b = bez((x0, y0), c, (x1, y1), (i + 1) / n); lens(sp, *a, *b, w * (1 - .55 * i / n), teeth=False)


LEAF = mix(OLIVE, (50, 150, 60), .35)   # the temperate leaf: the olive pulled toward fresh green
WHITE = tones((240, 238, 226))   # trillium petals: base, lit, shaded

def clump(sp, cx, cy, rx, ry, dash=True):   # a leaf mass with its underside in rows of dark dashes
    sp.fill(cx, cy, rx, ry, "leaf")
    if not dash: return
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if sp.get(x, y) == "leaf" and y > cy + ry * .35 and (x + y // 2) % 3 == 0: sp.put(x, y, "leaflo")


def ramp(sp, name, rgb): t = tones(rgb); sp.C.update({name: t[0], name + "hi": t[1], name + "lo": t[2]})   # a new shaded color

def spray(sp, x, y, side, L, drop, w=1.3):   # a feathery drooping spray of scale-leaf shoots: a stem with short blades hanging off it
    ex, ey = x + side * L, y + drop; sp.line(x, y, ex, ey, "leaf")
    for t in (.3, .55, .8, 1.0): bx_, by_ = x + (ex - x) * t, y + (ey - y) * t; blade(sp, bx_, by_, bx_ + side * 2, by_ + 7 - 2 * t, w, bowx=side * 1)

def crown(sp, bx, by, spec, key="leaf", dash=True):   # leaf clumps back to front, each (dx, up, rx, ry)
    for cx, cy, rx, ry in sorted(spec, key=lambda c: c[1]): clump(sp, bx + cx, by - cy, rx, ry, dash) if key == "leaf" else sp.fill(bx + cx, by - cy, rx, ry, key)


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



def scars(sp, bx, y0, y1, hw, step=4):   # a scaly trunk: rows of leaf-scar dashes, offset row to row
    for k, y in enumerate(range(y0, y1, -step)):
        for dx in range(-hw + 1 + (k % 2), hw, 2): sp.put(bx + dx, y, "stemlo")


JUNGLE = (44, 150, 70)   # vivid jungle green, brighter than the near-black floor

def flower(sp, x, y, r, key="bloom", n=5, center="seed"):   # a five-petalled flower seen from the front, with a bright center
    for i in range(n):
        a = -math.pi / 2 + i * 2 * math.pi / n; sp.fill(x + math.cos(a) * r * .65, y + math.sin(a) * r * .65, r * .62, r * .55, key)
    sp.put(x - r * .5, y - r * .6, key + "hi"); sp.put(x, y, center)

def q_strangler_fig():   # large: a lattice of woven aerial roots, buttressed, under a wide dense dome with a few small red figs
    sp = Sprite(72, 92, JUNGLE); ramp(sp, "fig", (206, 54, 44)); bx, by = 36, 90
    for x in range(bx - 13, bx + 14): sp.put(x, by + 1, "stem")
    for y in range(by - 2, by - 44, -1): sp.put(bx - 1, y, "stemlo"); sp.put(bx, y, "stemlo")   # the dark hollow where the host rotted away
    strands = (((-11, 0), (-5, -20), (7, -44)), ((11, 0), (5, -20), (-7, -44)), ((-5, 0), (-12, -24), (-4, -44)), ((5, 0), (12, -24), (4, -44)), ((-8, 0), (-1, -26), (-9, -44)), ((8, 0), (1, -26), (9, -44)))
    for k, s_ in enumerate(strands): stem(sp, [(bx + x, by + y) for x, y in s_], 2.6 if k < 4 else 2.0, 1.8)   # woven roots, each crossing the others, with gaps between
    for y in (by - 14, by - 30): sp.line(bx - 11, y, bx + 11, y + 1, "stemlo")   # growth rings where the roots fuse
    for lx, ly in ((-24, 52), (-12, 60), (12, 60), (24, 52)): stem(sp, [(bx, by - 44), (bx + lx * .5, by - ly + 12), (bx + lx, by - ly)], 2.2, 1.2)
    crown(sp, bx, by, ((-27, 50, 10, 8), (27, 50, 10, 8), (-19, 60, 13, 9), (19, 60, 13, 9), (0, 66, 17, 10), (-29, 62, 8, 6), (29, 62, 8, 6), (-9, 76, 13, 8), (10, 76, 13, 8), (0, 84, 11, 6)))
    for x in range(bx - 32, bx + 33, 4): sp.put(x, by - 44 + (abs(x - bx) // 8), "leaflo")   # a ragged hem under the crown
    for x, y in ((-22, 50), (-6, 56), (14, 53), (25, 50), (3, 60)): sp.put(bx + x, by - y, "fig"); sp.put(bx + x + 1, by - y, "fig"); sp.put(bx + x, by - y - 1, "fighi"); sp.put(bx + x + 1, by - y + 1, "figlo")   # small red figs
    return sp

def q_mahogany():   # large: a tall straight trunk on buttress roots, a tight oval crown of glossy leaflets, brown seed capsules
    sp = Sprite(72, 92, mix(JUNGLE, (60, 190, 90), .15)); ramp(sp, "pod", (138, 74, 42)); bx, by = 36, 90
    for x in range(bx - 11, bx + 12): sp.put(x, by + 1, "stem")
    stem(sp, [(bx, by + 1), (bx, by - 24), (bx, by - 44)], 4.2, 3.0)
    for s in (-1, 1): stem(sp, [(bx + s * 9, by + 1), (bx + s * 5, by - 6), (bx + s * 2, by - 14)], 2.4, 1.2)   # buttresses
    for y in range(by - 4, by - 44, -4): sp.put(bx - 2, y, "stemlo"); sp.put(bx + 1, y + 2, "stemlo")
    for lx, ly in ((-14, 62), (-6, 70), (6, 70), (14, 62)): stem(sp, [(bx, by - 42), (bx + lx * .5, by - ly + 14), (bx + lx, by - ly)], 2.0, 1.0)
    crown(sp, bx, by, ((-14, 52, 11, 8), (14, 52, 11, 8), (-9, 62, 13, 9), (9, 62, 13, 9), (0, 70, 14, 10), (-12, 72, 9, 7), (12, 72, 9, 7), (0, 82, 11, 7), (-18, 62, 8, 6), (18, 62, 8, 6)))
    for x in range(bx - 26, bx + 27, 4): sp.put(x, by - 46 + (abs(x - bx) // 7), "leaflo")
    for x, y in ((-17, 54), (-3, 52), (11, 54), (18, 58), (4, 60)): sp.line(bx + x, by - y, bx + x, by - y + 2, "stemlo"); sp.fill(bx + x, by - y + 4, 1.5, 2.2, "pod"); sp.put(bx + x - 1, by - y + 3, "podhi")   # hanging pods
    return sp

def culm(sp, x, y0, y1, lean, th, node=5):   # one segmented bamboo culm, a straight stem leaning with height, dark node rings, lit left edge
    for k, y in enumerate(range(int(y0), int(y1), -1)):
        t = (y0 - y) / max(1, y0 - y1); cx = x + lean * t * t
        for dx in range(-int(th), int(th) + 1): sp.put(cx + dx, y, "leaf")
        if k % node == 0:
            for dx in range(-int(th) - 1, int(th) + 2): sp.put(cx + dx, y, "leaflo")
    return x + lean, y1

def q_bamboo():   # medium: a clump of segmented culms arching a little, feathery leaf plumes at the tips
    sp = Sprite(60, 56, (125, 188, 72)); bx, by = 30, 54; ramp(sp, "dry", (200, 190, 90))
    tips = []
    for x0, top, lean, th in ((-12, 22, -8, 1.2), (-6, 6, -4, 1.6), (0, 2, 1, 1.8), (6, 8, 5, 1.6), (12, 20, 9, 1.2), (-2, 14, -2, 1.3)):
        tips.append(culm(sp, bx + x0, by, top, lean, th, 6 if x0 % 2 else 5))
    for tx, ty in tips:
        for a in (-1.2, -.7, -.2, .3, .8, 1.3):
            lens(sp, tx, ty + 1, tx + math.sin(a) * 9, ty - math.cos(a) * 3 + 4 + abs(a) * 3, .8, teeth=False)   # leaves drooping off the tip
        for a in (-.5, .5): lens(sp, tx, ty + 6, tx + a * 14, ty + 11, .8, teeth=False)
    for x in range(bx - 14, bx + 15, 3): sp.put(x, by + 1, "leaflo")
    return sp

def q_banana():   # medium: a pseudostem of stacked sheaths, big torn paddle leaves, a hanging purple bud and a bunch of green fruit
    sp = Sprite(64, 52, (96, 192, 70)); ramp(sp, "bud", (128, 40, 96)); ramp(sp, "fruit", (150, 196, 70)); bx, by = 30, 50
    for y in range(by, by - 24, -1):
        w = 4.6 - (by - y) * .045
        for dx in range(-int(w), int(w) + 1): sp.put(bx + dx, y, "stem" if False else "leaf")
        if (by - y) % 4 == 0:
            for dx in range(-int(w), int(w) + 1): sp.put(bx + dx, y, "leaflo")   # the sheaths stack in dark rings
    for ang, L, wd in ((-1.45, 24, 5.0), (1.45, 24, 5.0), (-1.0, 28, 5.6), (1.0, 28, 5.6), (-.45, 28, 5.6), (.4, 28, 5.6), (0, 24, 4.6)):
        ex, ey = bx + math.sin(ang) * L, by - 22 - math.cos(ang) * L * .8 + (6 if abs(ang) > 1.3 else 0)
        frond(sp, (bx, by - 22), (bx + math.sin(ang) * L * .45, by - 22 - math.cos(ang) * L * .95), (ex, ey), wd, 4, notch=.55, groove=False)
        mx, my = bx + math.sin(ang) * L * .55, by - 22 - math.cos(ang) * L * .8
        for k in (-1, 0, 1): sp.put(mx + k * 2, my + 2, "leaflo") if sp.get(int(mx + k * 2), int(my + 2)) == "leaf" else None   # a tear in the blade
    sp.line(bx + 3, by - 18, bx + 8, by - 8, "stem")   # the flower stalk droops down the stem
    sp.fill(bx + 9, by - 6, 2.6, 3.4, "bud"); sp.put(bx + 8, by - 8, "budhi")
    for r, (fx, fy) in enumerate(((5, -11), (8, -12), (11, -10), (6, -8), (9, -9))): sp.fill(bx + fx, by + fy + 3, 1.4, 2.1, "fruit"); sp.put(bx + fx - 1, by + fy + 2, "fruithi")
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "leaflo") if x % 2 else None
    return sp

def q_giant_tree_fern():   # medium: a thick fibrous trunk with leaf-scar rows, a crown of arching fronds and a curled fiddlehead
    sp = Sprite(64, 56, (52, 156, 80)); ramp(sp, "fiber", (82, 52, 34)); sp.C.update(stem=sp.C["fiber"], stemhi=sp.C["fiberhi"], stemlo=sp.C["fiberlo"]); bx, by = 32, 54
    stem(sp, [(bx, by + 1), (bx - 1, by - 14), (bx, by - 26)], 4.6, 3.8)
    for x in range(bx - 7, bx + 8): sp.put(x, by + 1, "stem")
    scars(sp, bx, by - 3, by - 28, 4, 3)
    for y in range(by - 2, by - 28, -2): sp.put(bx - 3 + (y % 3), y, "stemhi") if y % 4 == 0 else None   # hairy fiber flecks
    top = by - 27
    for ang, L, wd in ((-1.5, 25, 3.2), (1.5, 25, 3.2), (-1.0, 26, 3.4), (1.0, 26, 3.4), (-.5, 24, 3.4), (.5, 24, 3.4), (-1.25, 22, 3), (1.25, 22, 3), (0, 14, 2.6)):
        ex, ey = bx + math.sin(ang) * L, top - math.cos(ang) * L * .55 + (9 if abs(ang) > 1.2 else 3 if abs(ang) > .8 else 0)
        frond(sp, (bx, top), (bx + math.sin(ang) * L * .5, top - math.cos(ang) * L * .8), (ex, ey), wd, 9, notch=.2)
    sp.line(bx + 1, top - 2, bx + 1, top - 7, "stem"); sp.line(bx + 1, top - 7, bx + 3, top - 8, "stem"); sp.put(bx + 3, top - 7, "stem")   # a curled fiddlehead
    return sp

def q_hibiscus():   # small: a glossy leafy shrub with big red five-petalled flowers
    sp = Sprite(48, 40, (40, 140, 62)); ramp(sp, "bloom", (232, 52, 74)); bx, by = 24, 38
    for x in range(bx - 12, bx + 13): sp.put(x, by + 1, "leaflo") if x % 2 else None
    stem(sp, [(bx, by + 1), (bx, by - 8)], 1.6, 1.2)
    for cx, cy, rx, ry in ((-10, 12, 7, 5), (10, 12, 7, 5), (-14, 7, 6, 4.5), (14, 7, 6, 4.5), (0, 18, 10, 7), (-5, 24, 7, 5), (6, 23, 7, 5), (0, 10, 9, 6)): clump(sp, bx + cx, by - cy, rx, ry)
    for fx, fy, r in ((-8, 22, 4.2), (8, 18, 4.6), (0, 28, 4.8), (-14, 11, 3.6), (14, 12, 3.8)):
        flower(sp, bx + fx, by - fy, r); sp.line(bx + fx, by - fy, bx + fx + 3, by - fy - 4, "seed")   # the long stamen
        sp.fill(bx + fx + 3, by - fy - 4, 1.0, 1.0, "seed")
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("q-strangler-fig", q_strangler_fig), ("q-mahogany", q_mahogany), ("q-bamboo", q_bamboo), ("q-banana", q_banana), ("q-giant-tree-fern", q_giant_tree_fern), ("q-hibiscus", q_hibiscus)):
    fn().save(f"{out}/{key}.png")
