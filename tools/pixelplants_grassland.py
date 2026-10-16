# Draws the grassland landscape plants (Neogene and Quaternary only: no grassland before the Neogene) and the Prairie Wildflowers Park Plant in the Dimetrodon's flat, simple style
# (helpers copied from tools/pixelplants_temperate.py, because -I scripts can't import each other): flat fills, no outline, stair-stepped shapes, a lit top-left edge, shadow on undersides
# and right edges. Leaves lean to dry olive and sun-bleached gold, so they stand out from the light green ground.
#   neo-grassland-small   Poa (bluegrass): a small tuft of fine arching blades with airy seed panicles
#   neo-grassland-medium  Themeda (kangaroo grass): a wide tussock, tall stalks tipped with bronze-red seed heads
#   neo-grassland-large   Cortaderia (pampas grass): a big fountain of long blades under tall stems with silver-cream plumes
#   qua-grassland-small   Festuca (fescue): a dense blue-grey hair-fine dome with a few seed stalks
#   qua-grassland-medium  Bouteloua (grama): blond bunchgrass, arching stems hung with comb-like flag seed spikes along one side
#   qua-grassland-large   Andropogon (bluestem): tall upright blue-purple stems tipped with three-pronged turkey-foot heads over a blade tuft
#   q-prairie-wildflowers the Park Plant: a grassy mound with yellow coneflowers and a few purple ones
# Usage: python3 -I tools/pixelplants_grassland.py [outdir]
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



def ramp(sp, name, rgb): t = tones(rgb); sp.C.update({name: t[0], name + "hi": t[1], name + "lo": t[2]})   # a new shaded color

def tuft(sp, bx, by, n, L, spread, w=.9, lean=0, rnd=0, key="leaf"):   # a fountain of blades from one point: n blades, longest L, fanning +-spread px at the tip
    for i in range(n):
        t = (i / (n - 1) - .5) * 2 if n > 1 else 0; k = 1 - .45 * abs(t) ** 1.5; j = ((i * 7 + rnd) % 5 - 2) * .06
        x1 = bx + t * spread + lean; y1 = by - L * (k + j)
        blade(sp, bx + t * 2, by, x1, y1, w, bowx=t * spread * .35, bowy=L * .12) if key == "leaf" else None

def seedstalk(sp, x0, y0, x1, y1, head, key="stem"):   # a thin stalk with a head drawn by the caller
    sp.line(x0, y0, x1, y1, key, 0); head(x1, y1)

def poa():   # small: bluegrass, a tuft of fine arching blades with airy seed panicles
    sp = Sprite(44, 38, mix(OLIVE, (80, 150, 90), .3)); ramp(sp, "pan", (196, 188, 120)); bx, by = 22, 36
    sp.C.update(stem=sp.C["pan"], stemhi=sp.C["panhi"], stemlo=sp.C["panlo"])
    tuft(sp, bx, by, 13, 15, 15, .9)
    for x0, x1, h in ((-5, -11, 24), (-1, -2, 30), (3, 6, 26), (6, 13, 20)):   # panicles: a stalk topped by an airy teardrop of fine branches
        sx, sy = bx + x1, by - h
        sp.line(bx + x0, by - 6, sx, sy + 4, "pan", 0)
        sp.fill(sx, sy, 3.2, 5, "pan"); sp.put(sx - 1, sy - 3, "panhi"); sp.put(sx - 2, sy - 1, "panhi"); sp.put(sx + 2, sy + 3, "panlo"); sp.put(sx, sy + 4, "panlo")
        for yy in range(int(sy) - 4, int(sy) + 5, 2): sp.put(sx + 1, yy, "panlo")
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "leaflo")
    return sp

def themeda():   # medium: kangaroo grass, a wide tussock with tall stalks tipped by bronze-red seed heads
    sp = Sprite(64, 52, mix(OLIVE, (150, 130, 40), .25)); ramp(sp, "bronze", (176, 84, 36)); bx, by = 32, 50
    sp.C.update(stem=sp.C["bronze"], stemhi=sp.C["bronzehi"], stemlo=sp.C["bronzelo"])
    tuft(sp, bx, by, 19, 24, 26, 1.0, rnd=3)
    for x0, x1, h in ((-12, -17, 38), (-5, -8, 46), (3, 4, 49), (9, 14, 43), (15, 22, 34)):
        sp.line(bx + x0 * .4, by - 12, bx + x1, by - h, "stem", 0)
        sp.fill(bx + x1, by - h + 3, 2.2, 5, "stem")
        for k in range(4): sp.line(bx + x1, by - h + k * 2, bx + x1 + (1 if k % 2 else -1) * 3, by - h + k * 2 + 3, "stem", 0)   # awns
        sp.put(bx + x1 - 1, by - h - 1, "stemhi"); sp.put(bx + x1 - 1, by - h + 1, "stemhi")
    for x in range(bx - 14, bx + 15): sp.put(x, by + 1, "leaflo")
    return sp

def cortaderia():   # large: pampas grass, a big fountain of long blades, tall stems with silver-cream plumes
    sp = Sprite(72, 92, mix(OLIVE, (60, 140, 90), .25)); ramp(sp, "plume", (226, 214, 176)); ramp(sp, "pstem", (160, 150, 90)); bx, by = 36, 90
    sp.C.update(stem=sp.C["pstem"], stemhi=sp.C["pstemhi"], stemlo=sp.C["pstemlo"])
    tuft(sp, bx, by, 27, 42, 32, 1.1, rnd=1)
    for x0, x1, h in ((-18, -24, 66), (-9, -12, 78), (0, 0, 86), (9, 13, 76), (18, 25, 62), (-4, -6, 58), (5, 7, 56)):
        sp.line(bx + x0 * .3, by - 14, bx + x1, by - h + 8, "stem", 0)
        top = by - h; ln = 22 if h > 70 else 17
        for k in range(ln):   # the plume: a feathery teardrop, widest a third of the way up
            w = (3.6 * math.sin(math.pi * min(1, (k + 2) / (ln + 2))) ** .8) + (.6 if k % 3 == 0 else 0)
            yy = top + 6 + ln * .6 - k; xx = bx + x1 + (k - ln * .5) * (.07 if x1 > 0 else -.07) * 0
            sp.fill(bx + x1, top + (ln - k) * .85 - 2 + 6, w, .8, "plume")
        sp.put(bx + x1 - 1, top + 3, "plumehi"); sp.put(bx + x1 - 2, top + 8, "plumehi")
    for x in range(bx - 12, bx + 13): sp.put(x, by + 1, "leaflo")
    return sp

def festuca():   # small: fescue, a dense blue-grey hair-fine dome with a few seed stalks
    sp = Sprite(44, 32, (96, 142, 152)); ramp(sp, "pan", (190, 186, 150)); bx, by = 22, 30
    sp.C.update(stem=sp.C["pan"], stemhi=sp.C["panhi"], stemlo=sp.C["panlo"])
    for i in range(15):   # blades fountaining from the base into a rounded dome, with gaps between so it stays hair-fine
        t = (i / 14 - .5) * 2; L = 16 * (1 - .4 * abs(t) ** 2); x1 = bx + t * 17; y1 = by - L
        blade(sp, bx + t * 3, by, x1, y1, .9, bowx=t * 3, bowy=1.5)
    for x in range(bx - 7, bx + 8, 2): sp.put(x, by - 1, "leaflo")
    for x0, x1, h in ((-6, -9, 24), (2, 4, 26), (8, 13, 21)):
        sp.line(bx + x0 * .3, by - 8, bx + x1, by - h, "stem", 0); sp.line(bx + x1, by - h, bx + x1 + 1, by - h - 3, "stem", 0); sp.put(bx + x1, by - h - 1, "stemhi")
    for x in range(bx - 8, bx + 9): sp.put(x, by + 1, "leaflo")
    return sp

def grama():   # medium: blue grama, blond bunchgrass, stems arching to one side hung with comb-like flag spikes
    sp = Sprite(64, 48, mix(OLIVE, (150, 150, 70), .3)); ramp(sp, "gold", (196, 152, 62)); ramp(sp, "flag", (150, 120, 120)); bx, by = 28, 46
    sp.C.update(stem=sp.C["gold"], stemhi=sp.C["goldhi"], stemlo=sp.C["goldlo"])
    tuft(sp, bx, by, 19, 17, 24, 1.0, rnd=4)
    for x0, x1, h, side in ((-6, -14, 28, 1), (0, -3, 33, 1), (5, 8, 36, 1), (9, 16, 30, 1), (-2, -9, 22, 1)):
        sx, sy = bx + x1, by - h
        sp.line(bx + x0 * .4, by - 10, sx, sy + 3, "stem", 0)
        for k in range(5):   # eyelash flags: short spikes in a row, angled out to the right like a comb
            fx, fy = sx + k * 2 - 1, sy - k * 1 + 1
            for i in range(5): sp.put(fx + i, fy + i // 2, "gold"); sp.put(fx + i, fy + i // 2 + 1, "gold")
            sp.put(fx + 5, fy + 3, "flag"); sp.put(fx, fy - 1, "goldhi"); sp.put(fx + 1, fy, "goldhi")
    for x in range(bx - 12, bx + 13): sp.put(x, by + 1, "leaflo")
    return sp

def andropogon():   # large: bluestem, tall upright blue-purple stems tipped with three-pronged turkey-foot heads over a blade tuft
    sp = Sprite(72, 92, mix((92, 124, 112), (110, 90, 130), .25)); ramp(sp, "foot", (150, 104, 76)); ramp(sp, "cane", (132, 108, 134)); bx, by = 36, 90
    sp.C.update(stem=sp.C["cane"], stemhi=sp.C["canehi"], stemlo=sp.C["canelo"])
    tuft(sp, bx, by, 25, 36, 28, 1.1, rnd=2)
    for x0, x1, h in ((-16, -22, 62), (-9, -13, 76), (-3, -4, 84), (4, 6, 78), (10, 16, 70), (17, 24, 58), (0, 2, 66)):
        sx, sy = bx + x1, by - h
        sp.line(bx + x0 * .8, by - 12, sx, sy, "stem", 0); sp.line(bx + x0 * .8 + 1, by - 12, sx + 1, sy, "stem", 0)   # a stem two pixels wide
        for dx in (-5, 0, 5):   # the turkey foot: three spikelet prongs fanning from the tip
            ex, ey = sx + dx, sy - 9 + abs(dx) // 3
            for o in (0, 1): sp.line(sx + o, sy, ex + o, ey, "foot", 0)
            sp.put(ex - 1, ey + 2, "foothi"); sp.put(ex, ey - 1, "foothi")
        sp.fill(sx, sy, 1.6, 1.6, "foot")
    for x in range(bx - 11, bx + 12): sp.put(x, by + 1, "leaflo")
    return sp

def prairie():   # Park Plant: a grassy mound with yellow coneflowers and a few purple ones
    sp = Sprite(48, 40, (130, 160, 70)); ramp(sp, "yel", (232, 184, 58)); ramp(sp, "pur", (170, 110, 190)); ramp(sp, "dark", (120, 78, 40)); bx, by = 24, 38
    tuft(sp, bx, by, 17, 16, 20, .9, rnd=2)
    sp.C.update(seed=sp.C["dark"], seedhi=sp.C["darkhi"], seedlo=sp.C["darklo"])
    for x, h, c in ((-14, 22, "yel"), (-7, 30, "pur"), (-1, 26, "yel"), (6, 32, "yel"), (13, 24, "pur"), (17, 30, "yel"), (-18, 29, "yel")):
        sp.line(bx + x * .5, by - 8, bx + x, by - h, "leaf", 0)
        for k in range(8):   # petals: a ring of short rays round a dark cone
            a = k / 8 * 6.283; sp.put(bx + x + math.cos(a) * 4, by - h + math.sin(a) * 3, c); sp.put(bx + x + math.cos(a) * 3, by - h + math.sin(a) * 2.2, c); sp.put(bx + x + math.cos(a) * 2, by - h + math.sin(a) * 1.4, c)
        sp.put(bx + x, by - h, "seed"); sp.put(bx + x - 1, by - h - 3, c + "hi"); sp.put(bx + x - 2, by - h - 2, c + "hi")
    for x in range(bx - 10, bx + 11): sp.put(x, by + 1, "leaflo")
    return sp

out = sys.argv[1] if len(sys.argv) > 1 else "sprites/plants"
for key, fn in (("neo-grassland-small", poa), ("neo-grassland-medium", themeda), ("neo-grassland-large", cortaderia),
                ("qua-grassland-small", festuca), ("qua-grassland-medium", grama), ("qua-grassland-large", andropogon), ("q-prairie-wildflowers", prairie)):
    fn().save(f"{out}/{key}.png")
