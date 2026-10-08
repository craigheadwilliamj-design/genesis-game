# Draws the other Permian and Triassic scrubland plants in the Dimetrodon's flat, simple style (the same style as tools/pixelplant_flat.py, which draws per-scrubland-large):
# flat fills, no outline, olive-green family, stair-stepped shapes, a lit top-left edge, shadow on undersides and right edges, a lighter rib and rhythmic grooves.
# Same canvases as the older tools/pixelplants.py pictures, so PLANT_SPRITES in data.js doesn't change. Light comes from the top left.
#   per-scrubland-small  Peltaspermum: a tuft of Lepidopteris-type fronds with two stalks carrying umbrella seed discs (Townrow 1960)
#   per-scrubland-medium Comia: once-pinnate fronds with narrow separate pinnules, fanned wide off a short stem
#   tri-scrubland-small  Lepidopteris: a compact tuft of fine bipinnate fronds
#   tri-scrubland-medium Scytophyllum: a low shrub of once-pinnate fronds with broad, toothed, lanceolate pinnae
#   tri-scrubland-large  Pagiophyllum: a shrubby conifer, slim trunk with ascending branches of tight scale-leaf shoots
# Usage: python3 -I tools/pixelplants_flat.py [outdir]
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

def seed_disc(sp, x, y, rx):
    # a Peltaspermum seed organ: an umbrella disc with a lit top and ovules hanging from the underside in a regular row
    sp.fill(x, y, rx, 1.8, "seed")
    for i in range(-rx + 1, rx, 2):
        sp.put(x + i, y + 2, "seedlo"); sp.put(x + i, y + 3, "seedlo")
        if abs(i) < rx - 1: sp.put(x + i, y + 4 + (i % 4 == 0), "seedhi")
    sp.line(x - rx + 1, y - 1, x + rx - 2, y - 1, "seedhi")

def peltaspermum():   # small: a few bipinnate fronds and two seed-disc stalks
    sp = Sprite(44, 46, mix(OLIVE, (255, 255, 255), .18)); bx, by = 22, 44
    for tip, bend in (((1, 36), -5), ((43, 37), 5), ((4, 27), -8), ((40, 28), 8), ((12, 20), -6), ((32, 21), 6)):
        base = (bx + (tip[0] - bx) * .12, by - 1); ctrl = ((base[0] + tip[0]) / 2 + bend, (base[1] + tip[1]) / 2 - 4)
        frond(sp, base, ctrl, tip, 3.8, 6, .45)
    for tx, top in ((10, 12), (-9, 8)):   # a stalk curves up from the base to a disc
        pts = [(bx, by - 1), (bx + tx * .15, by - 14), (bx + tx * .6, by - 26), (bx + tx, by - 44 + top)]
        for i in range(len(pts) - 1): sp.line(*pts[i], *pts[i + 1], "stem")
        seed_disc(sp, bx + tx, by - 44 + top - 1, 6)
    for x in range(bx - 3, bx + 4): sp.put(x, by + 1, "stem")
    return sp

def comia():   # medium: a short stem, a wide low fan of once-pinnate fronds with narrow separate pinnules
    sp = Sprite(64, 46, mix(OLIVE, (255, 255, 255), .08)); bx, by = 32, 44
    stem(sp, [(bx, by + 1), (bx, by - 5)], 1.8, 1.4)
    top = (bx, by - 5)
    for tx, ty, b in sorted(((-30, 2, -3), (30, 3, 3), (-26, 9, -7), (27, 10, 7), (-19, 15, -6), (20, 16, 6), (-10, 17, -3), (11, 18, 3)), key=lambda f: -abs(f[0])):
        tip = (bx + tx, top[1] - ty); frond(sp, top, ((top[0] + tip[0]) / 2 + b * .3, (top[1] + tip[1]) / 2 - 7), tip, 3.6, 8, .08)
    return sp

def lepidopteris():   # small: a compact tuft of fine bipinnate fronds, no seed organs
    sp = Sprite(54, 40, mix(OLIVE, (255, 255, 255), .14)); bx, by = 27, 38
    for tx, ty, b in ((-22, 9, -6), (22, 10, 6), (-15, 20, -6), (15, 21, 6), (-6, 25, -3), (6, 26, 3), (-1, 18, 0)):
        base = (bx + tx * .1, by - 1); tip = (bx + tx, by - 1 - ty); sp_ctrl = ((base[0] + tip[0]) / 2 + b * .3, (base[1] + tip[1]) / 2 + 2)
        frond(sp, base, sp_ctrl, tip, 2.3, 9, .25, groove=False)
    stem(sp, [(bx, by + 1), (bx, by - 3)], 1.9, 1.5)
    return sp

def scytophyllum():   # medium: a low shrub of once-pinnate fronds with broad toothed pinnae
    sp = Sprite(76, 52, mix(OLIVE, (0, 0, 0), .05)); bx, by = 38, 50
    stem(sp, [(bx, by + 1), (bx, by - 6)], 1.9, 1.5)
    top = (bx, by - 6)
    for tx, ty, b in sorted(((-34, 3, -4), (34, 4, 4), (-27, 11, -7), (28, 12, 7), (-15, 16, -4), (16, 17, 4)), key=lambda f: -abs(f[0])):
        tip = (bx + tx, top[1] - ty); ctrl = ((top[0] + tip[0]) / 2 + b * .5, (top[1] + tip[1]) / 2 - 8); pairs = 4
        pts = [bez(top, ctrl, tip, i / pairs) for i in range(pairs + 1)]
        for i in range(1, pairs + 1): sp.line(*pts[i - 1], *pts[i], "stem")
        for i in range(1, pairs + 1):
            (x0, y0), (x1, y1) = pts[i - 1], pts[i]; dx, dy = x1 - x0, y1 - y0; d = math.hypot(dx, dy) or 1; nx, ny = -dy / d, dx / d; L = 13 * (1 - .5 * i / pairs)
            for side in (1, -1): lens(sp, x1, y1, x1 + (nx * side * .85 + dx / d * .5) * L, y1 + (ny * side * .85 + dy / d * .5) * L + .5, 2.1 * (1 - .3 * i / pairs))
        lens(sp, *pts[-1], tip[0] + (tip[0] - ctrl[0]) * .2, tip[1] + (tip[1] - ctrl[1]) * .2 - 1, 1.6)   # a terminal pinna
    return sp

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

def pagiophyllum():   # large: a shrubby conifer, a slim trunk with ascending branches of scale-leaf shoots
    sp = Sprite(64, 92, mix(OLIVE, (0, 0, 0), .12)); bx, by = 32, 90
    stem(sp, [(bx, by + 1), (bx, by - 20), (bx + 1, by - 40), (bx + 1, by - 52)], 2.2, 1.2)
    for x in range(bx - 4, bx + 5): sp.put(x, by + 1, "stem")
    sp.line(bx - 5, by + 1, bx - 1, by - 3, "stem"); sp.line(bx + 5, by + 1, bx + 1, by - 3, "stem")
    # (side, height up the trunk, reach, rise): lower branches reach furthest and sweep up, so the whole is a loose cone
    for side, h, rch, rise in ((-1, 9, 24, 8), (1, 13, 25, 9), (-1, 20, 21, 11), (1, 26, 19, 11), (-1, 32, 15, 11), (1, 37, 13, 11), (-1, 42, 9, 9), (1, 46, 8, 9)):
        x0, y0 = bx + 1, by - h; scale_shoot(sp, x0, y0, x0 + side * rch, y0 - rise, 2.1)
        if rch > 12: scale_shoot(sp, x0 + side * rch * .6, y0 - rise * .6, x0 + side * rch * .6 + side * 5, y0 - rise * .6 - 8, 1.6)   # a side twig
    scale_shoot(sp, bx + 1, by - 50, bx + 1, by - 66, 2.2)   # leader
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("per-scrubland-small", peltaspermum), ("per-scrubland-medium", comia), ("tri-scrubland-small", lepidopteris),
                ("tri-scrubland-medium", scytophyllum), ("tri-scrubland-large", pagiophyllum)):
    fn().save(f"{out}/{key}.png")
